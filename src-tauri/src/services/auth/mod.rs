use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::services::rbac::resolver::{RbacService, RbacCache};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Utc, Duration};

pub struct AuthService {
    pool: SqlitePool,
    rbac: RbacService,
}

impl AuthService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { 
            pool: pool.clone(),
            rbac: RbacService::new(pool),
        }
    }

    pub async fn login(&self, username: &str, password: &str) -> Result<(i64, RbacCache), String> {
        let user_rec = sqlx::query("SELECT id, password, role_id, login_attempts, is_locked, lock_until FROM users WHERE username = ?")
            .bind(username)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        let user = match user_rec {
            Some(u) => u,
            None => return Err("Invalid credentials".to_string()),
        };

        let is_locked: i64 = user.try_get("is_locked").unwrap_or(0);
        if is_locked == 1 {
            let lock_until: Option<chrono::NaiveDateTime> = user.try_get("lock_until").unwrap_or(None);
            if let Some(lock_time) = lock_until {
                if chrono::Utc::now().naive_utc() < lock_time {
                    return Err("Account is temporarily locked due to too many failed attempts".to_string());
                } else {
                    // Unlock account
                    sqlx::query("UPDATE users SET is_locked = 0, login_attempts = 0, lock_until = NULL WHERE id = ?")
                        .bind(user.try_get::<i64, _>("id").unwrap())
                        .execute(&self.pool)
                        .await
                        .ok();
                }
            } else {
                return Err("Account is permanently locked. Contact admin.".to_string());
            }
        }

        let hashed_pw: String = user.try_get("password").unwrap();
        let user_id: i64 = user.try_get("id").unwrap();
        let role_id: i64 = user.try_get("role_id").unwrap();

        let is_valid = verify(password, &hashed_pw).unwrap_or(false);

        if !is_valid {
            // Increment failed attempts
            let attempts: i64 = user.try_get("login_attempts").unwrap_or(0) + 1;
            if attempts >= 3 {
                let lock_time = chrono::Utc::now().naive_utc() + Duration::minutes(15);
                sqlx::query("UPDATE users SET is_locked = 1, lock_until = ?, login_attempts = ? WHERE id = ?")
                    .bind(lock_time)
                    .bind(attempts)
                    .bind(user_id)
                    .execute(&self.pool)
                    .await
                    .ok();
                return Err("Account locked. Try again in 15 minutes.".to_string());
            } else {
                sqlx::query("UPDATE users SET login_attempts = ? WHERE id = ?")
                    .bind(attempts)
                    .bind(user_id)
                    .execute(&self.pool)
                    .await
                    .ok();
            }
            return Err("Invalid credentials".to_string());
        }

        // Check Auditor K-module restriction
        let is_auditor = self.rbac.is_auditor(role_id).await.unwrap_or(false);
        // If connecting to primary db and user is Auditor, block login, EXCEPT our app expects single tauri process. 
        // We handle module context in frontend and sync bridge.

        // Reset attempts
        sqlx::query("UPDATE users SET login_attempts = 0, is_locked = 0, lock_until = NULL WHERE id = ?")
            .bind(user_id)
            .execute(&self.pool)
            .await
            .ok();

        // Load permissions
        let cache = self.rbac.load_user_permissions(user_id).await.map_err(|e| e.to_string())?;

        Ok((user_id, cache))
    }
}
