use rusqlite::Connection;
use super::{
    KSalaryEngine, 
    salary_engine_employee_master::EmployeeMasterEngine, 
    salary_engine_daily_mis::DailyMisEngine
};

pub struct SalaryEngineFactory;

impl SalaryEngineFactory {
    pub fn get_engine(conn: &Connection) -> Result<Box<dyn KSalaryEngine>, String> {
        let source: String = conn.query_row(
            "SELECT k_salary_calculation_source FROM company_payroll_rules WHERE id = 1",
            [],
            |row| row.get(0)
        ).unwrap_or("EMPLOYEE_MASTER".to_string());

        if source == "DAILY_MIS" {
            Ok(Box::new(DailyMisEngine))
        } else {
            Ok(Box::new(EmployeeMasterEngine))
        }
    }
}
