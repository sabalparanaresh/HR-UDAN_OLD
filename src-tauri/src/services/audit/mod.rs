use sqlx::SqlitePool;

pub struct AuditService {
    pool: SqlitePool,
}

impl AuditService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn log_action(
        &self, 
        table_name: &str, 
        record_id: i64, 
        action: &str, 
        old_data: Option<&str>, 
        new_data: Option<&str>, 
        user_id: i64
    ) -> Result<(), sqlx::Error> {
        let (created_by, modified_by, deleted_by) = match action {
            "CREATE" => (Some(user_id), None, None),
            "UPDATE" => (None, Some(user_id), None),
            "DELETE" => (None, None, Some(user_id)),
            _ => (None, None, None),
        };

        sqlx::query(
            "INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, created_by, modified_by, deleted_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(table_name)
        .bind(record_id)
        .bind(action)
        .bind(old_data)
        .bind(new_data)
        .bind(created_by)
        .bind(modified_by)
        .bind(deleted_by)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
