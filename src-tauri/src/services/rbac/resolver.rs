use std::collections::HashMap;
use sqlx::{SqlitePool, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RbacCache {
    // Maps a permission key to a boolean (always true if it exists in map, used for quick lookups)
    // Key format: module.page.component.action
    pub permissions: HashMap<String, bool>,
    // The scope of the user: 'K', 'P', or 'BOTH'
    pub module_scope: String,
}

pub struct RbacService {
    pool: SqlitePool,
}

impl RbacService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Load all permissions for a user into a HashMap cache during login
    pub async fn load_user_permissions(&self, user_id: i64) -> Result<RbacCache, sqlx::Error> {
        // Fetch role_id
        let role_rec = sqlx::query("SELECT role_id FROM users WHERE id = ?")
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;
        
        let role_id: i64 = role_rec.try_get("role_id")?;
        
        // SuperAdmin bypass check
        let role_name_rec = sqlx::query("SELECT name FROM roles WHERE id = ?")
            .bind(role_id)
            .fetch_one(&self.pool)
            .await?;
        let role_name: String = role_name_rec.try_get("name")?;
        
        let is_super_admin = role_name == "SuperAdmin";
        
        // If super admin, they theoretically get all permissions. 
        // For cache generation, we could fetch all permissions or let the middleware handle SuperAdmin dynamically.
        // Let's populate actual permissions, but in authorize() we always bypass if role == SuperAdmin.
        
        let query = "
            SELECT p.name AS perm_name, m.scope AS module_scope
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            JOIN permission_components c ON p.component_id = c.id
            JOIN permission_pages pg ON c.page_id = pg.id
            JOIN permission_modules m ON pg.module_id = m.id
            WHERE rp.role_id = ?
        ";

        let records = sqlx::query(query)
            .bind(role_id)
            .fetch_all(&self.pool)
            .await?;

        let mut permissions_map = HashMap::new();
        let mut overall_module_scope = "NONE".to_string();

        for row in records {
            let perm_name: String = row.try_get("perm_name")?;
            let scope: String = row.try_get("module_scope")?;
            permissions_map.insert(perm_name, true);

            // Simple scope resolution logic (in reality, depends on user's assigned modules)
            match overall_module_scope.as_str() {
                "NONE" => overall_module_scope = scope,
                "K" if scope == "P" => overall_module_scope = "BOTH".to_string(),
                "P" if scope == "K" => overall_module_scope = "BOTH".to_string(),
                _ => {}
            }
        }

        if is_super_admin {
            overall_module_scope = "BOTH".to_string();
        }

        Ok(RbacCache {
            permissions: permissions_map,
            module_scope: overall_module_scope,
        })
    }

    /// Check if a role is the Auditor
    pub async fn is_auditor(&self, role_id: i64) -> Result<bool, sqlx::Error> {
        let rec = sqlx::query("SELECT name FROM roles WHERE id = ?")
            .bind(role_id)
            .fetch_one(&self.pool)
            .await?;
        let role_name: String = rec.try_get("name")?;
        Ok(role_name == "Auditor")
    }
}
