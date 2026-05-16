import duckdb from 'duckdb';
import path from 'path';

const analyticsDb = new duckdb.Database(':memory:');

export const DuckDBAnalyticsRepo = {
  init: () => {
    const pDbPath = path.resolve(process.cwd(), 'data/primary.db');
    const sDbPath = path.resolve(process.cwd(), 'data/statutory.db');
    analyticsDb.exec("INSTALL sqlite; LOAD sqlite;", (err) => {
      if (err) console.error("DuckDB sqlite extension error:", err);
      else {
        analyticsDb.exec(`ATTACH '${pDbPath}' AS primary_db (TYPE SQLITE, READ_ONLY true);`, (err) => {
          if(err) console.error("DuckDB attach primary:", err);
        });
        analyticsDb.exec(`ATTACH '${sDbPath}' AS statutory_db (TYPE SQLITE, READ_ONLY true);`, (err) => {
          if(err) console.error("DuckDB attach statutory:", err);
        });
      }
    });
  },
  runQuery: (sql: string, params: any[] = []): Promise<any[]> => new Promise((resolve, reject) => {
    analyticsDb.all(sql, ...params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  }),
  
  refreshMaterializedViews: async (emitEvent: any) => {
     try {
       console.log("Running DuckDB Snapshot Scheduler...");
       const modules = ['primary_db', 'statutory_db'];
       for (const src of modules) {
          // 1. Employee Master Snapshot
          await DuckDBAnalyticsRepo.runQuery(`
            CREATE OR REPLACE TABLE ${src}_emp_snapshot AS 
            SELECT e.id, e.emp_code, e.name, e.status, e.wage_type, 
                   e.department_id, e.designation_id, e.location_id, e.category_id, 
                   e.division_id, e.group_id, e.class_id, e.employment_type_id, e.shift_id,
                   d.name as department_name, ds.name as designation_name
            FROM ${src}.employees e
            LEFT JOIN ${src}.departments d ON e.department_id = d.id
            LEFT JOIN ${src}.designations ds ON e.designation_id = ds.id;
          `);

          // 2. Trend Analysis Snapshot (Monthly payroll trends)
          await DuckDBAnalyticsRepo.runQuery(`
            CREATE OR REPLACE TABLE ${src}_monthly_trend AS 
            SELECT month_year, SUM(k_gross_payable) as gross_salaryK, SUM(p_gross_statutory_payable) as gross_salaryP, sum(k_net_payable) as net_salary, COUNT(*) as emp_count
            FROM ${src}.final_payroll 
            WHERE status != 'DRAFT'
            GROUP BY month_year;
          `);

          // 3. Pivot Dataset: Employee salary heads pivoted
          await DuckDBAnalyticsRepo.runQuery(`
            CREATE OR REPLACE TABLE ${src}_salary_pivot AS
            PIVOT ${src}.salary_transactions 
            ON transaction_type 
            USING SUM(amount)
            GROUP BY emp_id, salary_month_year;
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
