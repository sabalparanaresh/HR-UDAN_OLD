use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::{Utc, Duration};
use bcrypt::{hash, DEFAULT_COST};

pub struct RecoveryService {
    pool: SqlitePool,
}

impl RecoveryService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn verify_identity_and_generate_token(
        &self, 
        mobile: &str, 
        birth_date: &str, 
        answer_1: &str, 
        answer_2: &str
    ) -> Result<String, String> {
        let user_rec = sqlx::query(
            "SELECT id FROM users 
             WHERE mobile_number = ? AND birth_date = ? 
             AND secret_answer_1 = ? AND secret_answer_2 = ?"
        )
        .bind(mobile)
        .bind(birth_date)
        .bind(answer_1)
        .bind(answer_2)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let user = match user_rec {
            Some(u) => u,
            None => return Err("Information does not match our records".to_string()),
        };

        let user_id: i64 = user.try_get("id").unwrap();
        let token = Uuid::new_v4().to_string();
        let expires_at = Utc::now().naive_utc() + Duration::minutes(15);

        sqlx::query(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)"
        )
        .bind(user_id)
        .bind(&token)
        .bind(expires_at)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(token)
    }

    pub async fn reset_password(&self, token: &str, new_password: &str) -> Result<(), String> {
        let token_rec = sqlx::query(
            "SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ? AND is_used = 0"
        )
        .bind(token)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let record = match token_rec {
            Some(r) => r,
            None => return Err("Invalid or expired token".to_string()),
        };

        let expires_at: chrono::NaiveDateTime = record.try_get("expires_at").unwrap();
        if Utc::now().naive_utc() > expires_at {
            return Err("Token expired".to_string());
        }

        let user_id: i64 = record.try_get("user_id").unwrap();
        let hashed_pw = hash(new_password, DEFAULT_COST).map_err(|e| e.to_string())?;

        // Use transaction
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;

        sqlx::query("UPDATE users SET password = ? WHERE id = ?")
            .bind(hashed_pw)
            .bind(user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        sqlx::query("UPDATE password_reset_tokens SET is_used = 1 WHERE token = ?")
            .bind(token)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(())
    }
}
