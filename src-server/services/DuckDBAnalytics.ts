import duckdb from 'duckdb';
import path from 'path';

class DuckDBPool {
  private db: duckdb.Database;
  private pool: duckdb.Connection[] = [];
  private maxPoolSize = 5;

  constructor() {
    this.db = new duckdb.Database(':memory:');
  }

  async init(emitEvent?: any) {
    return new Promise<void>((resolve, reject) => {
      const pDbPath = path.resolve(process.cwd(), 'data/primary.db');
      const sDbPath = path.resolve(process.cwd(), 'data/statutory.db');
      this.db.exec("INSTALL sqlite; LOAD sqlite;", (err) => {
        if (err) return reject(err);
        this.db.exec(`ATTACH '${pDbPath}' AS primary_db (TYPE SQLITE, READ_ONLY true);`, (err) => {
          if (err) return reject(err);
          this.db.exec(`ATTACH '${sDbPath}' AS statutory_db (TYPE SQLITE, READ_ONLY true);`, async (err) => {
            if (err) return reject(err);
            for(let i = 0; i < this.maxPoolSize; i++) {
                this.pool.push(this.db.connect());
            }
            try {
              // Initialize snapshot tables directly in the in-memory DuckDB
              const createQueries = [
                `CREATE TABLE IF NOT EXISTS analytics_kpi_cache (module_type VARCHAR, snapshot_date DATE, metric_name VARCHAR, metric_value DOUBLE);`,
                `CREATE TABLE IF NOT EXISTS analytics_monthly_summary (module_type VARCHAR, month_year VARCHAR, gross_salary DOUBLE, net_salary DOUBLE, total_deductions DOUBLE);`,
                `CREATE TABLE IF NOT EXISTS analytics_department_summary (module_type VARCHAR, department_name VARCHAR, headcount INTEGER, total_gross DOUBLE);`,
                `CREATE TABLE IF NOT EXISTS analytics_salary_head_summary (module_type VARCHAR, head_name VARCHAR, head_type VARCHAR, total_amount DOUBLE);`,
                `CREATE TABLE IF NOT EXISTS analytics_forecast_cache (module_type VARCHAR, forecast_type VARCHAR, forecast_value DOUBLE);`,
                `CREATE TABLE IF NOT EXISTS analytics_attendance_monthly (module_type VARCHAR, month VARCHAR, total_present INTEGER, total_absent INTEGER, total_leave INTEGER, total_overtime_mins INTEGER);`,
                `CREATE TABLE IF NOT EXISTS analytics_attendance_department (module_type VARCHAR, month VARCHAR, department_name VARCHAR, avg_attendance_rate DOUBLE, total_overtime_mins INTEGER);`,
                `CREATE TABLE IF NOT EXISTS analytics_attendance_anomalies (module_type VARCHAR, month VARCHAR, missed_punches INTEGER, late_arrivals INTEGER, early_leavals INTEGER);`
              ];

              for (const q of createQueries) {
                await this.runQuery(q);
              }
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        });
      });
    });
  }

  async runQuery(sql: string, params: any[] = [], timeoutMs = 30000): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const conn = this.pool.pop() || this.db.connect();
      // console.log("DuckDB SQL Start:", sql.substring(0, 100)); // debug
      
      let isResolved = false;
      const timer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          // Do not push back here — connection is still busy!
          console.error("DuckDB Query Timed out:", sql.substring(0, 150));
          reject(new Error(`Query timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      conn.all(sql, ...params, (err: any, rows: any) => {
        // ALWAYS return the connection to the pool when the query is done
        this.pool.push(conn);
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          if (err) {
             console.error("DuckDB Query Error for SQL:", sql.substring(0, 150), err);
             reject(err);
          }
          else resolve(rows);
        }
      });
    });
  }
}

const pool = new DuckDBPool();

export const DuckDBAnalyticsRepo = {
  init: () => pool.init(),
  runQuery: (sql: string, params: any[] = [], timeoutMs = 30000) => pool.runQuery(sql, params, timeoutMs),
  
  refreshMaterializedViews: async (emitEvent: any) => {
     try {
       console.log("Running DuckDB Snapshot Scheduler...");
       // Serialize queries to avoid DuckDB Node.js concurrent serialization/catalog errors
       const tablesToDelete = [
         'analytics_kpi_cache',
         'analytics_monthly_summary',
         'analytics_department_summary',
         'analytics_salary_head_summary',
         'analytics_forecast_cache',
         'analytics_attendance_monthly',
         'analytics_attendance_department',
         'analytics_attendance_anomalies'
       ];
       
       for (const table of tablesToDelete) {
         try {
           await pool.runQuery(`DELETE FROM ${table};`);
         } catch(e) {
           // If table doesn't exist, ignore to prevent crashes
           console.log(`Failed to delete from ${table}, maybe not created yet?`);
         }
       }

       const modules = ['primary_db', 'statutory_db'];
       for (const src of modules) {
          const modType = src === 'primary_db' ? 'K' : 'P';
          
          await pool.runQuery(`
            INSERT INTO analytics_kpi_cache (module_type, snapshot_date, metric_name, metric_value)
            SELECT '${modType}', current_date, 'active_employees', COUNT(*)::DOUBLE FROM ${src}.employees WHERE status = 1;
          `);
          await pool.runQuery(`
             INSERT INTO analytics_kpi_cache (module_type, snapshot_date, metric_name, metric_value)
             SELECT '${modType}', current_date, 'total_gross_latest', SUM(actual_earning)::DOUBLE FROM ${src}.payroll WHERE month = (SELECT MAX(month) FROM ${src}.payroll);
          `);
          await pool.runQuery(`
             INSERT INTO analytics_kpi_cache (module_type, snapshot_date, metric_name, metric_value)
             SELECT '${modType}', current_date, 'total_net_latest', SUM(net_payable)::DOUBLE FROM ${src}.payroll WHERE month = (SELECT MAX(month) FROM ${src}.payroll);
          `);
          await pool.runQuery(`
             INSERT INTO analytics_kpi_cache (module_type, snapshot_date, metric_name, metric_value)
             SELECT '${modType}', current_date, 'total_ded_latest', SUM(pf + esi + loan_emi + canteen_deduction)::DOUBLE FROM ${src}.payroll WHERE month = (SELECT MAX(month) FROM ${src}.payroll);
          `);
          await pool.runQuery(`
            INSERT INTO analytics_monthly_summary (module_type, month_year, gross_salary, net_salary, total_deductions)
            SELECT '${modType}', month, SUM(actual_earning)::DOUBLE, SUM(net_payable)::DOUBLE, SUM(pf + esi + loan_emi + canteen_deduction)::DOUBLE
            FROM ${src}.payroll
            GROUP BY month;
          `);
          await pool.runQuery(`
            INSERT INTO analytics_department_summary (module_type, department_name, headcount, total_gross)
            SELECT '${modType}', o.name, COUNT(p.emp_id)::INTEGER, SUM(p.actual_earning)::DOUBLE
            FROM ${src}.payroll p
            JOIN ${src}.employees e ON p.emp_id = e.id
            LEFT JOIN ${src}.org_hierarchy o ON e.department_id = o.id
            WHERE p.month = (SELECT MAX(month) FROM ${src}.payroll) AND o.name IS NOT NULL
            GROUP BY o.name;
          `);
          await pool.runQuery(`
            INSERT INTO analytics_salary_head_summary (module_type, head_name, head_type, total_amount)
            SELECT '${modType}', sh.name, sh.type, SUM(st.amount)::DOUBLE
            FROM ${src}.salary_transactions st
            JOIN ${src}.salary_heads sh ON st.head_id = sh.id
            WHERE st.salary_month_year = (SELECT MAX(month) FROM ${src}.payroll)
            GROUP BY sh.name, sh.type;
          `);
          await pool.runQuery(`
            INSERT INTO analytics_forecast_cache (module_type, forecast_type, forecast_value)
            WITH monthly_data AS (
                SELECT month, SUM(actual_earning) as gross, SUM(net_payable) as net, SUM(pf) as pf, row_number() OVER (ORDER BY month ASC) as t
                FROM ${src}.payroll
                GROUP BY month
            ),
            stats AS (
                SELECT 
                  regr_slope(gross, t) as s_g, regr_intercept(gross, t) as i_g,
                  regr_slope(net, t) as s_n, regr_intercept(net, t) as i_n,
                  regr_slope(pf, t) as s_p, regr_intercept(pf, t) as i_p,
                  MAX(t) as c_t
                FROM monthly_data
            )
            SELECT '${modType}', 'predicted_gross', (i_g + s_g * (c_t + 1))::DOUBLE FROM stats UNION ALL
            SELECT '${modType}', 'predicted_net', (i_n + s_n * (c_t + 1))::DOUBLE FROM stats UNION ALL
            SELECT '${modType}', 'predicted_pf', (i_p + s_p * (c_t + 1))::DOUBLE FROM stats;
          `);
          await pool.runQuery(`
            INSERT INTO analytics_attendance_monthly (module_type, month, total_present, total_absent, total_leave, total_overtime_mins)
            SELECT '${modType}', SUBSTR(date, 1, 7) as month,
                   SUM(CASE WHEN attendance_value > 0 THEN 1 ELSE 0 END)::INTEGER as present,
                   SUM(CASE WHEN attendance_value = 0 THEN 1 ELSE 0 END)::INTEGER as absent,
                   0 as total_leave,
                   SUM(CASE WHEN worked_mins > total_time_mins THEN worked_mins - total_time_mins ELSE 0 END)::INTEGER as ot
            FROM ${src}.attendance_logs
            GROUP BY SUBSTR(date, 1, 7);
          `);
          await pool.runQuery(`
            INSERT INTO analytics_attendance_department (module_type, month, department_name, avg_attendance_rate, total_overtime_mins)
            SELECT '${modType}', SUBSTR(al.date, 1, 7) as month, al.department_name,
                   AVG(al.attendance_value)::DOUBLE as rate,
                   SUM(CASE WHEN al.worked_mins > al.total_time_mins THEN al.worked_mins - al.total_time_mins ELSE 0 END)::INTEGER as ot
            FROM ${src}.attendance_logs al
            GROUP BY SUBSTR(al.date, 1, 7), al.department_name;
          `);
          await pool.runQuery(`
            INSERT INTO analytics_attendance_anomalies (module_type, month, missed_punches, late_arrivals, early_leavals)
            SELECT '${modType}', SUBSTR(date, 1, 7) as month,
                   SUM(is_missed_punch)::INTEGER as missed,
                   0 as late, 0 as early
            FROM ${src}.attendance_logs
            GROUP BY SUBSTR(date, 1, 7);
          `);
       }

       if (emitEvent) {
         emitEvent('scheduler-update', { timestamp: Date.now(), status: 'success' });
       }
     } catch (e) {
       console.error("DuckDB Snapshot Scheduler Error:", e);
     }
  }
};
