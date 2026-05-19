import { DuckDBAnalyticsRepo } from './DuckDBAnalytics.js';

export class DuckDBAttendanceRepo {
  /**
   * Retrieves the monthly attendance summary.
   */
  static async getMonthlySummary(moduleType: string) {
    const query = `
      SELECT month, total_present, total_absent, total_leave, total_overtime_mins
      FROM analytics_attendance_monthly
      WHERE module_type = ?
      ORDER BY month ASC
    `;
    return await DuckDBAnalyticsRepo.runQuery(query, [moduleType]);
  }

  /**
   * Retrieves the department-wise attendance summary for a given month.
   */
  static async getDepartmentSummary(moduleType: string, month?: string) {
    let query = `
      SELECT month, department_name, avg_attendance_rate as rate, total_overtime_mins as ot
      FROM analytics_attendance_department
      WHERE module_type = ?
    `;
    const params: any[] = [moduleType];

    if (month) {
      query += ` AND month = ?`;
      params.push(month);
    }

    query += ` ORDER BY month ASC, department_name ASC`;
    return await DuckDBAnalyticsRepo.runQuery(query, params);
  }

  /**
   * Retrieves punch anomalies (missed punches, etc.)
   */
  static async getAnomalies(moduleType: string) {
    const query = `
      SELECT month, missed_punches, late_arrivals, early_leavals
      FROM analytics_attendance_anomalies
      WHERE module_type = ?
      ORDER BY month ASC
    `;
    return await DuckDBAnalyticsRepo.runQuery(query, [moduleType]);
  }
}
