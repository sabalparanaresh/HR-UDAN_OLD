use super::KSalaryEngine;
use rusqlite::{Connection, params};
use serde_json::{Value, json, from_str};

pub struct DailyMisEngine;

impl KSalaryEngine for DailyMisEngine {
    fn calculate(&self, conn: &Connection, month: &str, _filters: Option<Value>) -> Result<Vec<Value>, String> {
        let query = r#"
            WITH mis_agg AS (
                SELECT 
                    emp_id,
                    SUM(attendance_qty * worked_rate) as total_gross_wage,
                    SUM(attendance_qty) as total_attendance
                FROM daily_mis_entries
                WHERE date LIKE ? || '-%'
                GROUP BY emp_id
            ),
            earnings_agg AS (
                SELECT 
                    t.emp_id,
                    SUM(CASE WHEN h.allocation_type IN ('K_ONLY', 'KP') THEN t.amount ELSE 0 END) as total_k_earnings,
                    json_group_array(
                        json_object('name', h.name, 'amount', t.amount)
                    ) FILTER (WHERE h.allocation_type IN ('K_ONLY', 'KP')) as k_earnings_details
                FROM earnings_transactions t
                JOIN salary_heads h ON t.head_id = h.id
                WHERE t.month = ?
                GROUP BY t.emp_id
            ),
            deductions_agg AS (
                SELECT 
                    t.emp_id,
                    SUM(CASE WHEN h.allocation_type IN ('K_ONLY', 'KP') THEN t.amount ELSE 0 END) as total_k_deductions,
                    json_group_array(
                        json_object('name', h.name, 'amount', t.amount)
                    ) FILTER (WHERE h.allocation_type IN ('K_ONLY', 'KP')) as k_deductions_details
                FROM deductions_transactions t
                JOIN salary_heads h ON t.head_id = h.id
                WHERE t.month = ?
                GROUP BY t.emp_id
            )
            SELECT 
                e.id as emp_id,
                e.employee_code,
                e.first_name || ' ' || e.last_name as name,
                e.designation,
                COALESCE(m.total_gross_wage, 0) as total_gross_wage,
                COALESCE(m.total_attendance, 0) as total_attendance,
                COALESCE(ea.total_k_earnings, 0) as total_k_earnings,
                COALESCE(ea.k_earnings_details, '[]') as k_earnings_details,
                COALESCE(da.total_k_deductions, 0) as total_k_deductions,
                COALESCE(da.k_deductions_details, '[]') as k_deductions_details
            FROM employees e
            INNER JOIN mis_agg m ON m.emp_id = e.id
            LEFT JOIN earnings_agg ea ON ea.emp_id = e.id
            LEFT JOIN deductions_agg da ON da.emp_id = e.id
            WHERE e.status = 'active'
        "#;

        let mut stmt = conn.prepare(query).map_err(|e| format!("Query prepare error: {}", e))?;
        
        let rows = stmt.query_map(params![month, month, month], |row| {
            let emp_id: i64 = row.get(0)?;
            let emp_code: String = row.get(1)?;
            let name: String = row.get(2)?;
            let designation: Option<String> = row.get(3)?;
            let total_gross_wage: f64 = row.get(4)?;
            let total_attendance: f64 = row.get(5)?;
            let total_k_earnings: f64 = row.get(6)?;
            let k_earnings_details: String = row.get(7)?;
            let total_k_deductions: f64 = row.get(8)?;
            let k_deductions_details: String = row.get(9)?;

            let net_payable = total_gross_wage + total_k_earnings - total_k_deductions;

            let k_earnings_json: Value = from_str(&k_earnings_details).unwrap_or_else(|_| json!([]));
            let k_deductions_json: Value = from_str(&k_deductions_details).unwrap_or_else(|_| json!([]));

            Ok(json!({
                "emp_id": emp_id,
                "emp_code": emp_code,
                "name": name,
                "designation": designation.unwrap_or_default(),
                "gross_wage_amt": total_gross_wage,
                "attendance": total_attendance,
                "k_earnings_sum": total_k_earnings,
                "k_earnings_details": k_earnings_json,
                "k_deductions_sum": total_k_deductions,
                "k_deductions_details": k_deductions_json,
                "net_payable": net_payable,
                "p_module_target_amount": net_payable
            }))
        }).map_err(|e| format!("Query map error: {}", e))?;

        let mut result = Vec::new();
        for row in rows {
            if let Ok(value) = row {
                result.push(value);
            }
        }

        Ok(result)
    }
}
