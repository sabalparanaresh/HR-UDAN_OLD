pub mod k_engine;
use tauri::command;
use serde_json::Value;
use rusqlite::Connection;
use k_engine::salary_engine_factory::SalaryEngineFactory;

#[command]
pub async fn calculate_k_module_wages_rust(month: String, filters: Option<Value>) -> Result<Vec<Value>, String> {
    let conn = Connection::open("primary.db").map_err(|e| format!("DB Error: {}", e))?;
    let engine = SalaryEngineFactory::get_engine(&conn)?;
    engine.calculate(&conn, &month, filters)
}
