pub mod salary_engine_factory;
pub mod salary_engine_employee_master;
pub mod salary_engine_daily_mis;

use rusqlite::Connection;
use serde_json::Value;

pub trait KSalaryEngine {
    fn calculate(&self, conn: &Connection, month: &str, filters: Option<Value>) -> Result<Vec<Value>, String>;
}
