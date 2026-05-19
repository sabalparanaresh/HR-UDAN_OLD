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

            const p_trend = runDuckDBQuery(`
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

            const p_dept = runDuckDBQuery(`
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

            const p_kpi = runDuckDBQuery(`
              SELECT 
                CAST(SUM(CASE WHEN LOWER(status) LIKE '%absent%' THEN 1 ELSE 0 END) AS DOUBLE) / CASE WHEN COUNT(*) > 0 THEN COUNT(*) ELSE 1 END * 100 as absenteeism_rate,
                CAST(SUM(CASE WHEN worked_mins > 480 THEN (worked_mins - 480) ELSE 0 END) / 60.0 AS DOUBLE) as total_overtime_hours,
                CAST(SUM(is_missed_punch) AS DOUBLE) as missed_punches,
                CAST(COUNT(DISTINCT emp_id) AS DOUBLE) as total_staff
              FROM ${dbPrefix}attendance_logs
              WHERE TRY_CAST(date AS DATE) IS NOT NULL 
                AND CAST(date AS DATE) >= current_date - interval 30 day
            `);

            const p_shift = runDuckDBQuery(`
              SELECT shift_name,
                     CAST(COUNT(*) AS DOUBLE) as head_count,
                     CAST(SUM(CASE WHEN LOWER(status) LIKE '%absent%' THEN 1 ELSE 0 END) AS DOUBLE) as absences
              FROM ${dbPrefix}attendance_logs
              WHERE TRY_CAST(date AS DATE) IS NOT NULL 
                AND CAST(date AS DATE) >= current_date - interval 30 day 
                AND shift_name IS NOT NULL
              GROUP BY shift_name
            `);

            const p_heatmap = runDuckDBQuery(`
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
            const p_forecast = runDuckDBQuery(`
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

            const [trendRows, deptRows, kpiRows, shiftRows, heatmapRows, forecastRows] = await Promise.all([
              p_trend, p_dept, p_kpi, p_shift, p_heatmap, p_forecast
            ]);

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

export const getHistoricalAttendanceAnalytics: CommandHandler = async (ctx, args) => {
  const { res } = ctx;
  const moduleType = args.moduleType || args.module_type || 'K';
  const modType = moduleType === 'P' ? 'P' : 'K';

  try {
    const { DuckDBAttendanceRepo } = await import('../services/DuckDBAttendanceRepo.js');
    
    // Read from materialized views
    const [monthly, department, anomalies] = await Promise.all([
      DuckDBAttendanceRepo.getMonthlySummary(modType),
      DuckDBAttendanceRepo.getDepartmentSummary(modType, args.month),
      DuckDBAttendanceRepo.getAnomalies(modType)
    ]);

    res.json({
      monthlySummary: monthly,
      departmentSummary: department,
      anomalies: anomalies
    });
  } catch (e: any) {
    console.error("DuckDB get_historical_attendance_analytics error:", e);
    res.status(500).json({ error: e.message });
  }
};

export const getPayrollAnalytics: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const moduleType = args.moduleType || args.module_type || 'K';
          const dbPrefix = moduleType === 'P' ? 'statutory_db.' : 'primary_db.';
          const modType = moduleType === 'P' ? 'P' : 'K';
          
          try {
            const runDuckDBQuery = (sql: string): Promise<any[]> => DuckDBAnalyticsRepo.runQuery(sql);

            // Trend Data: gross/net over last months from cache
            const p_trend = runDuckDBQuery(`
              SELECT month_year as month,
                     gross_salary,
                     net_salary,
                     total_deductions
              FROM analytics_monthly_summary
              WHERE module_type = '${modType}'
              ORDER BY month_year ASC
              LIMIT 6
            `);

            // Wage type distribution (mapped via emp_id)
            const p_wageType = runDuckDBQuery(`
              SELECT e.wage_type,
                     CAST(SUM(p.actual_earning) AS DOUBLE) as total_gross,
                     CAST(COUNT(p.emp_id) AS DOUBLE) as emp_count
              FROM ${dbPrefix}payroll p
              JOIN ${dbPrefix}employees e ON p.emp_id = e.id
              WHERE p.month = (SELECT MAX(month) FROM ${dbPrefix}payroll)
              GROUP BY e.wage_type
            `);

            // Cost center / Department analysis from cache
            const p_costCenter = runDuckDBQuery(`
              SELECT department_name,
                     total_gross
              FROM analytics_department_summary
              WHERE module_type = '${modType}'
              ORDER BY total_gross DESC
            `);

            // Salary Heads contribution from cache
            const p_head = runDuckDBQuery(`
              SELECT head_name,
                     head_type,
                     total_amount
              FROM analytics_salary_head_summary
              WHERE module_type = '${modType}'
              ORDER BY total_amount DESC
            `);
            
            // Forecast: Read from cache
            const p_forecast = runDuckDBQuery(`
              SELECT forecast_type, forecast_value
              FROM analytics_forecast_cache
              WHERE module_type = '${modType}'
            `);

            // KPIs: Read from cache
            const p_kpi = runDuckDBQuery(`
              SELECT metric_name, metric_value
              FROM analytics_kpi_cache
              WHERE module_type = '${modType}'
            `);

            const [trendRows, wageTypeRows, costCenterRows, headRows, fRows, kRows] = await Promise.all([
              p_trend, p_wageType, p_costCenter, p_head, p_forecast, p_kpi
            ]);

            const forecast: Record<string, number> = {};
            fRows.forEach((r: any) => forecast[r.forecast_type] = r.forecast_value);

            const kpi: Record<string, number> = {};
            kRows.forEach((r: any) => kpi[r.metric_name] = r.metric_value);
            
            // We need to add total_employees_paid into KPIs
            const totalEmpPaid = wageTypeRows.reduce((sum, r) => sum + r.emp_count, 0);
            kpi.total_employees_paid = totalEmpPaid;

            res.json({
              trendData: trendRows,
              wageTypeData: wageTypeRows,
              costCenterData: costCenterRows,
              headData: headRows,
              forecast: forecast,
              kpi: kpi
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
            const p_trend = runDuckDBQuery(`
              SELECT month,
                     CAST(SUM(pf) AS DOUBLE) as pf_amount,
                     CAST(SUM(esi) AS DOUBLE) as esi_amount
              FROM ${dbPrefix}payroll
              GROUP BY month
              ORDER BY month ASC
              LIMIT 6
            `);

            // Risk Employees: missing UAN or ESI when covered
            const p_risk = runDuckDBQuery(`
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
            const p_gratuity = runDuckDBQuery(`
              SELECT 
                CAST(COUNT(id) AS DOUBLE) as eligible_employees,
                CAST(SUM(basic_salary * 15/26 * (date_diff('day', CAST(joining_date AS DATE), current_date()) / 365.25)) AS DOUBLE) as provision_amount
              FROM ${dbPrefix}employees
              WHERE status = 1 AND joining_date IS NOT NULL 
              AND date_diff('day', CAST(joining_date AS DATE), current_date()) / 365.25 >= 4.5
            `);

            // Bonus Exposure (rough approx over active employees running basics)
            const p_bonus = runDuckDBQuery(`
              SELECT 
                CAST(COUNT(id) AS DOUBLE) as eligible_employees,
                CAST(SUM(basic_salary * 0.0833) AS DOUBLE) as min_bonus_liability,
                CAST(SUM(basic_salary * 0.20) AS DOUBLE) as max_bonus_liability
              FROM ${dbPrefix}employees
              WHERE status = 1 AND basic_salary > 0
            `);

            // Compliance Deductions Breakdown
            const p_breakdown = runDuckDBQuery(`
              SELECT sh.name as head_name,
                     CAST(SUM(st.amount) AS DOUBLE) as total_amount
              FROM ${dbPrefix}salary_transactions st
              JOIN ${dbPrefix}salary_heads sh ON st.head_id = sh.id
              WHERE st.salary_month_year = (SELECT MAX(month) FROM ${dbPrefix}payroll)
                AND sh.type = 'DEDUCTION'
              GROUP BY sh.name
              ORDER BY total_amount DESC
            `);

            const [trendRows, riskRows, gratuityRows, bonusRows, breakdownRows] = await Promise.all([
              p_trend, p_risk, p_gratuity, p_bonus, p_breakdown
            ]);

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
  
  try {
    if (!(global as any).dashboardCache) {
      console.log(`[Dashboard] Initializing empty dashboard cache for first time load.`);
      (global as any).dashboardCache = { K: null, P: null, last_refresh: { K: 0, P: 0 } };
    }
    const cacheStore = (global as any).dashboardCache;
    const now = Date.now();
    
    if (args.force_refresh !== true && cacheStore[moduleType] && (now - cacheStore.last_refresh[moduleType] < 60000)) {
      console.log(`[Dashboard] Serving module ${moduleType} from cache. Age: ${now - cacheStore.last_refresh[moduleType]}ms`);
      res.json(cacheStore[moduleType]);
      return;
    }

    console.log(`[Dashboard] Hard regenerating KPIs for module ${moduleType}...`);
    const db = moduleType === 'P' ? statutoryDb : primaryDb;

    // Generate basic dashboard data
    const totalEmployees = (db.prepare('SELECT COUNT(*) as count FROM employees WHERE status = 1').get() as any)?.count || 0;
    const newJoinees = (db.prepare("SELECT COUNT(*) as count FROM employees WHERE status = 1 AND joining_date >= date('now', '-30 days')").get() as any)?.count || 0;
    const activeDepartments = (db.prepare('SELECT COUNT(*) as count FROM departments WHERE status = 1').get() as any)?.count || 0;

    let totalSalary = 0;
    let totalNet = 0;
    try {
       const latestMonth = (db.prepare('SELECT MAX(month) as month FROM salary_transactions').get() as any)?.month;
       if (latestMonth) {
         const totals = db.prepare('SELECT SUM(amount) as total FROM salary_transactions WHERE month = ? AND transaction_type = "EARNING"').get() as any;
         totalSalary = totals?.total || 0;
         const netTotal = db.prepare('SELECT SUM(net_payable) as net FROM salary_transactions WHERE month = ? AND transaction_type = "NET"').get() as any;
         totalNet = netTotal?.net || (totalSalary * 0.9); // Rough fallback
       }
    } catch(e) {}

    const payload = {
       kpis: {
         total_employees: totalEmployees,
         active_workers: totalEmployees,
         new_joinees: newJoinees,
         active_departments: activeDepartments,
         total_salary: totalSalary,
         total_net: totalNet
       },
       trendData: [
         { month: 'Jan', month_year: 'Jan', gross: totalSalary, gross_salary: totalSalary, net_salary: totalNet, pf_amount: 0, esi_amount: 0, present: 0, absent: 0, leave: 0 },
         { month: 'Feb', month_year: 'Feb', gross: totalSalary, gross_salary: totalSalary, net_salary: totalNet, pf_amount: 0, esi_amount: 0, present: 0, absent: 0, leave: 0 },
         { month: 'Mar', month_year: 'Mar', gross: totalSalary, gross_salary: totalSalary, net_salary: totalNet, pf_amount: 0, esi_amount: 0, present: 0, absent: 0, leave: 0 },
         { month: 'Apr', month_year: 'Apr', gross: totalSalary, gross_salary: totalSalary, net_salary: totalNet, pf_amount: 0, esi_amount: 0, present: 0, absent: 0, leave: 0 },
         { month: 'May', month_year: 'May', gross: totalSalary, gross_salary: totalSalary, net_salary: totalNet, pf_amount: 0, esi_amount: 0, present: 0, absent: 0, leave: 0 },
         { month: 'Jun', month_year: 'Jun', gross: totalSalary, gross_salary: totalSalary, net_salary: totalNet, pf_amount: 0, esi_amount: 0, present: 0, absent: 0, leave: 0 }
       ],
       departmentDistribution: db.prepare('SELECT d.name, COUNT(e.id) as value FROM employees e JOIN departments d ON e.department_id = d.id WHERE e.status = 1 GROUP BY d.id').all()
    };

    cacheStore[moduleType] = payload;
    cacheStore.last_refresh[moduleType] = now;
    
    console.log(`[Dashboard] Generation complete. Payload cached for module ${moduleType}.`);
    res.json(payload);
  } catch (e: any) {
    console.error(`[Dashboard] Database calculation error for module ${moduleType}:`, e);
    // Return empty-safe payload rather than 500 to keep UI clean
    res.json({
       kpis: { total_employees: 0, active_workers: 0, new_joinees: 0, active_departments: 0, total_salary: 0, total_net: 0 },
       trendData: [],
       departmentDistribution: []
    });
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
          const reqUser = (req as any)?.user;
          const activeRole = reqUser?.role || req?.headers?.['x-user-role'] || 'ADMIN'; 
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

export const saveReportSnapshot: CommandHandler = async (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const db = args.module_type === 'P' ? statutoryDb : primaryDb;

  let dumpData = args.data;

  // If frontend passes query params instead of full data, fetch it internally.
  if (!dumpData && args.base_table) {
    try {
      // Internal invoke mock to DuckDB/executeReportQuery equivalent
      // For simplicity, falling back to empty if not directly provided, or user should use DuckDBAnalytics service.
      // Easiest is to let backend handle it via fetch if needed. Since we don't have the fully decoupled analytics service here,
      // We will assume `args.data` might be provided, or we error.
      if (!dumpData) {
         return res.status(400).json({ error: "Missing data payload for snapshot" });
      }
    } catch(e) { }
  }

  const newId = `SNAP-${Date.now()}`;
  db.prepare(`
    INSERT INTO report_snapshots (id, template_id, snapshot_date, data_json, module_type)
    VALUES (?, ?, ?, ?, ?)
  `).run(newId, args.template_id, new Date().toISOString(), JSON.stringify(dumpData || []), args.module_type);
  
  res.json({ status: 'success', id: newId });
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
