// Repository for attendance punches to separate logic from raw command files
import Database from 'better-sqlite3';
import { DbAttendancePunch, DbAttendanceLog } from '../../types/index.js';

export class AttendanceRepository {
  constructor(private db: Database.Database) {}

  addPunch(logId: number, punchTime: string, punchType: string, deviceId: string = 'system') {
    const stmt = this.db.prepare(`
      INSERT INTO attendance_punches (attendance_log_id, punch_time, punch_type, device_id)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(logId, punchTime, punchType, deviceId);
  }

  getPunchesForLog(logId: number): DbAttendancePunch[] {
    const stmt = this.db.prepare(`
      SELECT * FROM attendance_punches WHERE attendance_log_id = ? ORDER BY punch_time ASC
    `);
    return stmt.all(logId) as DbAttendancePunch[];
  }

  deletePunchesForLog(logId: number) {
    const stmt = this.db.prepare(`
      DELETE FROM attendance_punches WHERE attendance_log_id = ?
    `);
    return stmt.run(logId);
  }

  // Support for bulk generating from JSON, as temporary backward compatibility
  syncPunchesFromJSON(logId: number, punchesJson: string) {
    this.deletePunchesForLog(logId);
    try {
      const punchesArray = JSON.parse(punchesJson);
      for (const p of punchesArray) {
        if (p.punch_in) this.addPunch(logId, p.punch_in, 'IN', p.device || 'sync');
        if (p.punch_out) this.addPunch(logId, p.punch_out, 'OUT', p.device || 'sync');
      }
    } catch (e) {
      // JSON parse error
    }
  }

  // Aggregation query: get all punches with log data for a date range
  getPunchesWithLogDetail(fromDate: string, toDate: string) {
    const stmt = this.db.prepare(`
      SELECT p.*, l.emp_id, l.emp_code, l.emp_name, l.date 
      FROM attendance_punches p
      JOIN attendance_logs l ON l.id = p.attendance_log_id
      WHERE l.date >= ? AND l.date <= ?
      ORDER BY l.emp_id, l.date, p.punch_time ASC
    `);
    return stmt.all(fromDate, toDate);
  }
}

