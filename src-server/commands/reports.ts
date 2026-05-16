import cronParser from 'cron-parser';
import { DuckDBAnalyticsRepo } from '../services/DuckDBAnalytics.js';
import { CommandHandler } from './types.js';
import { isKConnected } from '../utils/syncCircuitBreaker.js';

export const getReportDefinition: CommandHandler = (ctx, args) => {
  const { res } = ctx;
  const { id } = args;
  const definitions: Record<string, any> = {
    'attendance_summary': {
      name: 'Monthly Attendance Summary',
      columns: [
        { header: 'Emp Code', key: 'emp_code' },
        { header: 'Name', key: 'name' },
        { header: 'Present', key: 'P' },
        { header: 'Absent', key: 'A' },
        { header: 'Leave', key: 'L' },
        { header: 'Holidays', key: 'H' },
        { header: 'Working Days', key: 'working_days' }
      ]
    }
  };
  res.json(definitions[id] || { columns: [] });
};

export const getAnalyticData: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { queryId } = args;
  if (queryId === 'dashboard_summary') {
    const empCount = primaryDb.prepare('SELECT COUNT(*) as count FROM employees WHERE status = 1').get() as any;
    res.json({
      activeEmployees: empCount.count,
      monthlyGross: 1250000,
      pendingGrievances: 4
    });
  } else {
    res.json({});
  }
};

export const syncKToP: CommandHandler = (ctx, args) => {
  const { statutoryDb, primaryDb, res } = ctx;
  if (!isKConnected(primaryDb)) return res.status(403).json({ error: 'Sync blocked: System is in Audit Mode' });
  const { records, tableName } = args;
  try {
    const table = tableName || 'employees';
    if (!records || records.length === 0) return res.json({ status: 'success' });
    const keys = Object.keys(records[0]);
    const sql = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    const insert = statutoryDb.prepare(sql);
    statutoryDb.transaction(() => {
      for (const rec of records) insert.run(...Object.values(rec));
    })();
    res.json({ status: 'success' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to sync K to P' });
  }
};

export const getAttendanceAnalytics: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const moduleType = args.moduleType || args.module_type || 'K';
          const dbPrefix = moduleType === 'P' ? 'statutory_db.' : 'primary_db.';
          
          try {
            const runDuckDBQuery = (sql: string): Promise<any[]> => DuckDBAnalyticsRepo.runQuery(sql);

            const trendRows = await runDuckDBQuery(`
              SELECT date,
                     CAST(SUM(CASE WHEN LOWER(status) LIKE '%present%' THEN 1 ELSE 0 END) AS DOUBLE) as present,
                     CAST(SUM(CASE WHEN LOWER(status) LIKE '%absent%' THEN 1 ELSE 0 END) AS DOUBLE) as absent,
                     CAST(SUM(CASE WHEN LOWER(status) LIKE '%half%' THEN 1 ELSE 0 END) AS DOUBLE) as half_day,
                     CAST(SUM(CASE WHEN LOWER(status) LIKE '%leave%' THEN 1 ELSE 0 END) AS DOUBLE) as leave
              FROM ${dbPrefix}attendance_logs
              WHERE TRY_CAST(date AS DATE) IS NOT NULL 
                AND CAST(date AS DATE) >= current_date - interval 30 day
              GROUP BY date
              ORDER BY date ASC
            `);

            const deptRows = await runDuckDBQuery(`
              SELECT department_name, 
                     CAST(AVG(worked_mins) / 60.0 AS DOUBLE) as avg_hours,
                     CAST(SUM(CASE WHEN LOWER(status) LIKE '%present%' THEN 1 ELSE 0 END) AS DOUBLE) as total_present
              FROM ${dbPrefix}attendance_logs
              WHERE TRY_CAST(date AS DATE) IS NOT NULL 
                AND CAST(date AS DATE) >= current_date - interval 30 day 
                AND department_name IS NOT NULL
              GROUP BY department_name
              ORDER BY avg_hours DESC
            `);

            const kpiRows = await runDuckDBQuery(`
              SELECT 
                CAST(SUM(CASE WHEN LOWER(status) LIKE '%absent%' THEN 1 ELSE 0 END) AS DOUBLE) / CASE WHEN COUNT(*) > 0 THEN COUNT(*) ELSE 1 END * 100 as absenteeism_rate,
                CAST(SUM(CASE WHEN worked_mins > 480 THEN (worked_mins - 480) ELSE 0 END) / 60.0 AS DOUBLE) as total_overtime_hours,
                CAST(SUM(is_missed_punch) AS DOUBLE) as missed_punches,
                CAST(COUNT(DISTINCT emp_id) AS DOUBLE) as total_staff
              FROM ${dbPrefix}attendance_logs
              WHERE TRY_CAST(date AS DATE) IS NOT NULL 
                AND CAST(date AS DATE) >= current_date - interval 30 day
            `);

            const shiftRows = await runDuckDBQuery(`
              SELECT shift_name,
                     CAST(COUNT(*) AS DOUBLE) as head_count,
                     CAST(SUM(CASE WHEN LOWER(status) LIKE '%absent%' THEN 1 ELSE 0 END) AS DOUBLE) as absences
              FROM ${dbPrefix}attendance_logs
              WHERE TRY_CAST(date AS DATE) IS NOT NULL 
                AND CAST(date AS DATE) >= current_date - interval 30 day 
                AND shift_name IS NOT NULL
              GROUP BY shift_name
            `);

            const heatmapRows = await runDuckDBQuery(`
              SELECT dayofweek(CAST(date AS DATE)) as day_of_week,
                     CAST(COUNT(*) AS DOUBLE) as absent_count
              FROM ${dbPrefix}attendance_logs
              WHERE LOWER(status) LIKE '%absent%' 
                AND TRY_CAST(date AS DATE) IS NOT NULL 
                AND CAST(date AS DATE) >= current_date - interval 90 day
              GROUP BY 1
              ORDER BY 1
            `);

            // Forecast trends: Overtime and Absenteeism Regression over last 30 days
            const forecastRows = await runDuckDBQuery(`
              WITH daily_data AS (
                SELECT 
                  date,
                  SUM(CASE WHEN LOWER(status) LIKE '%absent%' THEN 1 ELSE 0 END) as daily_absences,
                  CAST(SUM(CASE WHEN worked_mins > 480 THEN (worked_mins - 480) ELSE 0 END) / 60.0 AS DOUBLE) as daily_overtime,
                  row_number() OVER (ORDER BY date ASC) as t
                FROM ${dbPrefix}attendance_logs
                WHERE TRY_CAST(date AS DATE) IS NOT NULL
                  AND CAST(date AS DATE) >= current_date - interval 30 day
                GROUP BY date
              ),
              stats AS (
                SELECT
                  regr_slope(daily_absences, t) as slope_absences,
                  regr_intercept(daily_absences, t) as int_absences,
                  regr_slope(daily_overtime, t) as slope_overtime,
                  regr_intercept(daily_overtime, t) as int_overtime,
                  MAX(t) as current_t
                FROM daily_data
              )
              SELECT 
                CAST((int_absences + slope_absences * (current_t + 1)) AS DOUBLE) as predicted_absences,
                CAST((int_overtime + slope_overtime * (current_t + 1)) AS DOUBLE) as predicted_overtime
              FROM stats
            `);

            res.json({
              trendData: trendRows,
              deptProductivity: deptRows,
              kpi: kpiRows[0] || {},
              shiftData: shiftRows,
              heatmapData: heatmapRows,
              forecast: forecastRows[0] || {}
            });
          } catch (e: any) {
            console.error("DuckDB get_attendance_analytics error:", e);
            res.status(500).json({ error: e.message });
          
}
};

export const getPayrollAnalytics: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const moduleType = args.moduleType || args.module_type || 'K';
          const dbPrefix = moduleType === 'P' ? 'statutory_db.' : 'primary_db.';
          
          try {
            const runDuckDBQuery = (sql: string): Promise<any[]> => DuckDBAnalyticsRepo.runQuery(sql);

            // Trend Data: gross/net over last 6 months
            const trendRows = await runDuckDBQuery(`
              SELECT month,
                     CAST(SUM(actual_earning) AS DOUBLE) as gross_salary,
                     CAST(SUM(net_payable) AS DOUBLE) as net_salary,
                     CAST(SUM(pf + esi + loan_emi + canteen_deduction) AS DOUBLE) as total_deductions
              FROM ${dbPrefix}payroll
              GROUP BY month
              ORDER BY month ASC
              LIMIT 6
            `);

            // Wage type distribution (mapped via emp_id)
            const wageTypeRows = await runDuckDBQuery(`
              SELECT e.wage_type,
                     CAST(SUM(p.actual_earning) AS DOUBLE) as total_gross,
                     CAST(COUNT(p.emp_id) AS DOUBLE) as emp_count
              FROM ${dbPrefix}payroll p
              JOIN ${dbPrefix}employees e ON p.emp_id = e.id
              WHERE p.month = (SELECT MAX(month) FROM ${dbPrefix}payroll)
              GROUP BY e.wage_type
            `);

            // Cost center / Department analysis
            const costCenterRows = await runDuckDBQuery(`
              SELECT o.name as department_name,
                     CAST(SUM(p.actual_earning) AS DOUBLE) as total_gross
              FROM ${dbPrefix}payroll p
              JOIN ${dbPrefix}employees e ON p.emp_id = e.id
              LEFT JOIN ${dbPrefix}org_hierarchy o ON e.department_id = o.id
              WHERE p.month = (SELECT MAX(month) FROM ${dbPrefix}payroll) AND o.name IS NOT NULL
              GROUP BY o.name
              ORDER BY total_gross DESC
            `);

            // Salary Heads contribution
            const headRows = await runDuckDBQuery(`
              SELECT sh.name as head_name,
                     sh.type as head_type,
                     CAST(SUM(st.amount) AS DOUBLE) as total_amount
              FROM ${dbPrefix}salary_transactions st
              JOIN ${dbPrefix}salary_heads sh ON st.head_id = sh.id
              WHERE st.salary_month_year = (SELECT MAX(month) FROM ${dbPrefix}payroll)
              GROUP BY sh.name, sh.type
              ORDER BY total_amount DESC
            `);
            
            // Forecast: next month based on Linear Regression over last 12 months
            const forecastRows = await runDuckDBQuery(`
              WITH monthly_data AS (
                SELECT 
                  month, 
                  SUM(actual_earning) as monthly_gross, 
                  SUM(net_payable) as monthly_net,
                  SUM(pf) as monthly_pf,
                  row_number() OVER (ORDER BY month ASC) as t
                FROM ${dbPrefix}payroll
                GROUP BY month
              ),
              stats AS (
                SELECT 
                  regr_slope(monthly_gross, t) as slope_gross,
                  regr_intercept(monthly_gross, t) as int_gross,
                  regr_slope(monthly_net, t) as slope_net,
                  regr_intercept(monthly_net, t) as int_net,
                  regr_slope(monthly_pf, t) as slope_pf,
                  regr_intercept(monthly_pf, t) as int_pf,
                  MAX(t) as current_t
                FROM monthly_data
              )
              SELECT 
                CAST((int_gross + slope_gross * (current_t + 1)) AS DOUBLE) as predicted_gross,
                CAST((int_net + slope_net * (current_t + 1)) AS DOUBLE) as predicted_net,
                CAST((int_pf + slope_pf * (current_t + 1)) AS DOUBLE) as predicted_pf
              FROM stats
            `);

            // KPIs
            const kpiRows = await runDuckDBQuery(`
              SELECT 
                CAST(SUM(actual_earning) AS DOUBLE) as total_gross_latest,
                CAST(SUM(net_payable) AS DOUBLE) as total_net_latest,
                CAST(SUM(pf + esi + loan_emi + canteen_deduction) AS DOUBLE) as total_ded_latest,
                CAST(COUNT(DISTINCT emp_id) AS DOUBLE) as total_employees_paid
              FROM ${dbPrefix}payroll
              WHERE month = (SELECT MAX(month) FROM ${dbPrefix}payroll)
            `);

            res.json({
              trendData: trendRows,
              wageTypeData: wageTypeRows,
              costCenterData: costCenterRows,
              headData: headRows,
              forecast: forecastRows[0] || {},
              kpi: kpiRows[0] || {}
            });
          } catch (e: any) {
            console.error("DuckDB get_payroll_analytics error:", e);
            res.status(500).json({ error: e.message });
          
}
};

export const getAuditAnalytics: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const moduleType = args.moduleType || args.module_type || 'K';
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          const analyticsRunQuery = (sql: string, params: any[] = []): Promise<any[]> => new Promise((resolve, reject) => {
             DuckDBAnalyticsRepo.runQuery(sql, params).then(resolve).catch(reject);
          });

          try {
            // Because we want to run queries on the correct database dynamically attached or directly on SQLite
            // Since audit_logs is a regular table, we can just run queries via direct SQLite for some simpler stuff
            // but for DuckDB analytics, we attached 'primary_db' and 'statutory_db'.
            const dbPrefix = moduleType === 'P' ? 'statutory_db.' : 'primary_db.';
            
            // 1. KPI Metrics
            const kpiRows = await analyticsRunQuery(`
              SELECT 
                CAST(COUNT(*) AS DOUBLE) as total_activities,
                CAST(SUM(CASE WHEN action = 'LOGIN_FAILED' THEN 1 ELSE 0 END) AS DOUBLE) as failed_logins,
                CAST(SUM(CASE WHEN action = 'EX3000_EXCEL' THEN 1 ELSE 0 END) AS DOUBLE) as total_exports,
                CAST(SUM(CASE WHEN action = 'VIEW_RE3000' THEN 1 ELSE 0 END) AS DOUBLE) as total_views
              FROM ${dbPrefix}audit_logs
            `);
            
            // 2. Action Distribution
            const actionDist = await analyticsRunQuery(`
              SELECT action, CAST(COUNT(*) AS DOUBLE) as count
              FROM ${dbPrefix}audit_logs
              GROUP BY action
              ORDER BY count DESC
            `);
            
            // 3. User Activity (Top 10)
            const userActivity = await analyticsRunQuery(`
              SELECT a.user_id, CAST(COUNT(*) AS DOUBLE) as count
              FROM ${dbPrefix}audit_logs a
              GROUP BY a.user_id
              ORDER BY count DESC
              LIMIT 10
            `);
            
            // 4. Sync Failures
            const syncFailures = await analyticsRunQuery(`
              SELECT status, CAST(COUNT(*) AS DOUBLE) as count
              FROM ${dbPrefix}sync_queue
              WHERE status != 'COMPLETED'
              GROUP BY status
            `);
            
            // 5. Audit Amendments (if P module, otherwise return empty)
            let amendments = [];
            if (moduleType === 'P') {
                amendments = db.prepare(`SELECT * FROM audit_amendment_log ORDER BY timestamp DESC LIMIT 20`).all() as any[];
            }
            
            // 6. Recent Failed Logins
            const recentFailedLogins = await analyticsRunQuery(`
              SELECT * FROM ${dbPrefix}audit_logs
              WHERE action = 'LOGIN_FAILED'
              ORDER BY created_at DESC
              LIMIT 10
            `);
            
            // 7. Time series trend (Last 30 days)
            const trendData = await analyticsRunQuery(`
              SELECT 
                CAST(created_at AS DATE) as date,
                CAST(COUNT(*) AS DOUBLE) as total_actions,
                CAST(SUM(CASE WHEN action = 'EX3000_EXCEL' THEN 1 ELSE 0 END) AS DOUBLE) as export_actions
              FROM ${dbPrefix}audit_logs
              WHERE TRY_CAST(created_at AS DATE) IS NOT NULL AND CAST(created_at AS DATE) >= current_date - interval 30 day
              GROUP BY date
              ORDER BY date ASC
            `);

            res.json({
               kpis: kpiRows[0] || { total_activities: 0, failed_logins: 0, total_exports: 0, total_views: 0 },
               actionDist,
               userActivity,
               syncFailures,
               amendments,
               recentFailedLogins,
               trendData
            });
          } catch (e: any) {
             console.error("DuckDB get_audit_analytics error:", e);
             res.status(500).json({ error: e.message });
          
}
};

export const getComplianceAnalytics: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const moduleType = args.moduleType || args.module_type || 'P'; // By default, compliance is P module
          const dbPrefix = moduleType === 'P' ? 'statutory_db.' : 'primary_db.';
          
          try {
            const runDuckDBQuery = (sql: string): Promise<any[]> => DuckDBAnalyticsRepo.runQuery(sql);

            // Trend Data: Total Statutory Deductions (PF, ESI) over months
            const trendRows = await runDuckDBQuery(`
              SELECT month,
                     CAST(SUM(pf) AS DOUBLE) as pf_amount,
                     CAST(SUM(esi) AS DOUBLE) as esi_amount
              FROM ${dbPrefix}payroll
              GROUP BY month
              ORDER BY month ASC
              LIMIT 6
            `);

            // Risk Employees: missing UAN or ESI when covered
            const riskRows = await runDuckDBQuery(`
              SELECT 
                emp_code, name, department_id,
                CASE WHEN is_pf_covered = 1 AND (uan_no IS NULL OR uan_no = '') THEN 'Missing UAN'
                     WHEN is_esi_covered = 1 AND (esi_ip_number IS NULL OR esi_ip_number = '') THEN 'Missing ESI IP'
                     ELSE 'Risk' END as risk_type
              FROM ${dbPrefix}employees
              WHERE status = 1 AND (
                (is_pf_covered = 1 AND (uan_no IS NULL OR uan_no = ''))
                OR (is_esi_covered = 1 AND (esi_ip_number IS NULL OR esi_ip_number = ''))
              )
              LIMIT 20
            `);
            
            // Gratuity Provision
            const gratuityRows = await runDuckDBQuery(`
              SELECT 
                CAST(COUNT(id) AS DOUBLE) as eligible_employees,
                CAST(SUM(basic_salary * 15/26 * (date_diff('day', CAST(joining_date AS DATE), current_date()) / 365.25)) AS DOUBLE) as provision_amount
              FROM ${dbPrefix}employees
              WHERE status = 1 AND joining_date IS NOT NULL 
              AND date_diff('day', CAST(joining_date AS DATE), current_date()) / 365.25 >= 4.5
            `);

            // Bonus Exposure (rough approx over active employees running basics)
            const bonusRows = await runDuckDBQuery(`
              SELECT 
                CAST(COUNT(id) AS DOUBLE) as eligible_employees,
                CAST(SUM(basic_salary * 0.0833) AS DOUBLE) as min_bonus_liability,
                CAST(SUM(basic_salary * 0.20) AS DOUBLE) as max_bonus_liability
              FROM ${dbPrefix}employees
              WHERE status = 1 AND basic_salary > 0
            `);

            // Compliance Deductions Breakdown
            const breakdownRows = await runDuckDBQuery(`
              SELECT sh.name as head_name,
                     CAST(SUM(st.amount) AS DOUBLE) as total_amount
              FROM ${dbPrefix}salary_transactions st
              JOIN ${dbPrefix}salary_heads sh ON st.head_id = sh.id
              WHERE st.salary_month_year = (SELECT MAX(month) FROM ${dbPrefix}payroll)
                AND sh.type = 'DEDUCTION'
              GROUP BY sh.name
              ORDER BY total_amount DESC
            `);

            res.json({
              trendData: trendRows,
              riskData: riskRows,
              gratuity: gratuityRows[0] || {},
              bonus: bonusRows[0] || {},
              breakdownData: breakdownRows
            });
          } catch (e: any) {
            console.error("DuckDB get_compliance_analytics error:", e);
            res.status(500).json({ error: e.message });
          
}
};

export const getDashboardData: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const moduleType = args.moduleType || args.module_type;
          
          if (!(global as any).dashboardCache) {
             (global as any).dashboardCache = { K: null, P: null, last_refresh: { K: 0, P: 0 } };
          }
          const cacheStore = (global as any).dashboardCache;
          const now = Date.now();
          if (args.force_refresh !== true && cacheStore[moduleType] && (now - cacheStore.last_refresh[moduleType] < 60000)) {
             res.json(cacheStore[moduleType]);
             
}
};

export const getReportSchedules: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          const schedules = db.prepare(`SELECT rs.*, rt.name as template_name FROM report_schedules rs JOIN report_templates rt ON rs.template_id = rt.id WHERE rs.module_type = ? ORDER BY rs.created_at DESC`).all(args.module_type);
          res.json(schedules);
          
};

export const createReportSchedule: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          const newId = `SCH-${Date.now()}`;
          let nextRun = null;
          try {
             const interval = (cronParser as any).parseExpression(args.schedule_cron);
             nextRun = interval.next().toISOString();
          } catch (e) {
             console.error("Invalid cron:", args.schedule_cron);
          }
          
          db.prepare(`INSERT INTO report_schedules (id, name, template_id, module_type, schedule_cron, next_run, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(newId, args.name, args.template_id, args.module_type, args.schedule_cron, nextRun, 'ACTIVE', args.user);
          res.json({ id: newId });
          
};

export const deleteReportSchedule: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          db.prepare(`DELETE FROM report_schedules WHERE id = ?`).run(args.id);
          res.json({ status: 'success' });
          
};

export const toggleReportSchedule: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          db.prepare(`UPDATE report_schedules SET status = CASE WHEN status = 'ACTIVE' THEN 'INACTIVE' ELSE 'ACTIVE' END WHERE id = ?`).run(args.id);
          res.json({ status: 'success' });
          
};

export const getReportScheduleHistory: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          const history = db.prepare(`SELECT * FROM report_schedule_history WHERE schedule_id = ? ORDER BY run_timestamp DESC LIMIT 50`).all(args.schedule_id);
          res.json(history);
          
};

export const getReportTemplates: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          const templates = db.prepare(`SELECT * FROM report_templates WHERE module_type = ? ORDER BY created_at DESC`).all(args.module_type);
          res.json(templates.map((t: any) => ({
            ...t,
            columns: t.columns_json ? JSON.parse(t.columns_json) : [],
            filters: t.filters_json ? JSON.parse(t.filters_json) : [],
            config: t.config_json ? JSON.parse(t.config_json) : {}
          })));
          
};

export const saveReportTemplate: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          const { id, name, description, base_table, columns, filters, user, config, is_system, shared_with_roles } = args;
          
          const configJson = config ? JSON.stringify(config) : '{}';
          const isSystemVal = is_system ? 1 : 0;
          const sharedRolesStr = Array.isArray(shared_with_roles) ? shared_with_roles.join(',') : (shared_with_roles || '');

          if (id) {
             db.prepare(`
               UPDATE report_templates 
               SET name = ?, description = ?, base_table = ?, columns_json = ?, filters_json = ?, config_json = ?, is_system = ?, shared_with_roles = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND module_type = ?
             `).run(name, description, base_table, JSON.stringify(columns || []), JSON.stringify(filters || []), configJson, isSystemVal, sharedRolesStr, id, args.module_type);
          } else {
             const newId = `RPT-${Date.now()}`;
             db.prepare(`
               INSERT INTO report_templates (id, name, description, module_type, base_table, columns_json, filters_json, config_json, is_system, shared_with_roles, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             `).run(newId, name, description, args.module_type, base_table, JSON.stringify(columns || []), JSON.stringify(filters || []), configJson, isSystemVal, sharedRolesStr, user || 'system');
          }
          res.json({ status: 'success' });
          
};

export const deleteReportTemplate: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          db.prepare(`DELETE FROM report_templates WHERE id = ? AND module_type = ?`).run(args.id, args.module_type);
          res.json({ status: 'success' });
          
};

export const executeKpiQuery: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          // KPI aggregation over DuckDB
          const { query_type, module_type } = args;
          const dbPrefix = module_type === 'P' ? 'statutory_db.' : 'primary_db.';
          
          let sql = "";
          if (query_type === 'payroll_summary') {
             sql = `
               SELECT 
                 COUNT(DISTINCT emp_id) as active_employees,
                 SUM(amount) as total_payroll
               FROM ${dbPrefix}salary_transactions
               WHERE transaction_type = 'CREDIT'
             `;
          } else if (query_type === 'attendance_metrics') {
             sql = `
               SELECT 
                 status,
                 COUNT(*) as count
               FROM ${dbPrefix}attendance_logs
               WHERE log_date >= date_trunc('month', current_date)
               GROUP BY status
             `;
          } else if (query_type === 'department_headcount') {
             sql = `
               SELECT 
                 d.name as department,
                 COUNT(e.id) as headcount
               FROM ${dbPrefix}employees e
               JOIN ${dbPrefix}departments d ON e.department_id = d.id
               WHERE e.status = 'ACTIVE'
               GROUP BY d.name
               ORDER BY headcount DESC
             `;
          } else {
             res.status(400).json({ error: "Invalid KPI query type" });
             
}
};

export const executeReportQuery: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const dbPrefix = args.module_type === 'P' ? 'statutory_db.' : 'primary_db.';
          const { base_table, columns, filters, pagination, sorts, grouping, chart_request, drill_down } = args;
          
          // RBAC validation skeleton for mock server
          const activeRole = req?.headers?.['x-user-role'] || 'ADMIN'; 
          if (args.module_type === 'P' && activeRole !== 'ADMIN' && activeRole !== 'AUDITOR' && activeRole !== 'HR_MANAGER') {
             // Mock RBAC denial
             // res.status(403).json({ error: "Access Denied: Statutory Module" });
          }

          // Prevent Raw SQL by validating table names and columns against a whitelist
          const allowedTables = [
             'employees', 'salary_transactions', 'attendance_logs', 'cash_transactions', 
             'departments', 'designations', 'divisions', 'salary_components', 'salary_heads', 
             'audit_logs', 'final_payroll', 'emp_snapshot', 'monthly_trend', 'salary_pivot',
             'audit_amendment_log'
          ];
          
          let targetTable = base_table;
          if (['emp_snapshot', 'monthly_trend', 'salary_pivot'].includes(base_table)) {
             targetTable = `${dbPrefix.slice(0, -1)}_${base_table}`;
             // Materialized views don't need primary_db prefix inside DuckDB since they are created in the main duckdb catalog, not the ATTACH catalog! 
          }
          
          if (!allowedTables.includes(base_table)) {
             res.status(400).json({ error: "Invalid base table requested." });
             
}
};

export const saveReportSnapshot: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
           const db = args.module_type === 'P' ? statutoryDb : primaryDb;
           const newId = `SNAP-${Date.now()}`;
           db.prepare(`
             INSERT INTO report_snapshots (id, template_id, snapshot_date, data_json, module_type)
             VALUES (?, ?, ?, ?, ?)
           `).run(newId, args.template_id, new Date().toISOString(), JSON.stringify(args.data), args.module_type);
           res.json({ status: 'success' });
           
};

export const getReportSnapshots: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
           const db = args.module_type === 'P' ? statutoryDb : primaryDb;
           const snaps = db.prepare(`SELECT id, template_id, snapshot_date, module_type FROM report_snapshots WHERE template_id = ? AND module_type = ? ORDER BY snapshot_date DESC`).all(args.template_id, args.module_type);
           res.json(snaps);
           
};

export const getReportSnapshotData: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
           const db = args.module_type === 'P' ? statutoryDb : primaryDb;
           const snap = db.prepare(`SELECT data_json FROM report_snapshots WHERE id = ?`).get(args.snapshot_id) as any;
           res.json(snap ? JSON.parse(snap.data_json) : []);
           
};
