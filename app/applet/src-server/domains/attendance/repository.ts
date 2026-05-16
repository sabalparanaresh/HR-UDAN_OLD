import { Database } from 'better-sqlite3';
import { BaseRepository } from '../base.repository';

export class AttendanceRepository extends BaseRepository<any> {
  constructor(primaryDb: Database, statutoryDb: Database) {
    super(primaryDb, statutoryDb);
  }

  getWageAttendance(moduleType: 'K' | 'P', empId: number, dateStart: string, dateEnd: string) {
    const db = this.getDb(moduleType);
    return db.prepare(`
      SELECT * FROM wage_attendance_transactions 
      WHERE emp_id = ? AND date >= ? AND date <= ?
    `).all(empId, dateStart, dateEnd) as any[];
  }

  insertAttendance(moduleType: 'K' | 'P', attendance: any) {
    const db = this.getDb(moduleType);
    
    // Attendance data is synced over sync_queue automatically from K to P if configured.
    const keys = Object.keys(attendance);
    const cols = keys.join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    
    // Effective upsert logic
    const updates = keys.map(k => `${k} = excluded.${k}`).join(', ');

    db.prepare(`
      INSERT INTO wage_attendance_transactions (${cols}) VALUES (${placeholders})
      ON CONFLICT(emp_id, date) DO UPDATE SET ${updates}
    `).run(...Object.values(attendance));
  }

  getAggregatedAttendance(moduleType: 'K' | 'P', month: string) {
    const db = this.getDb(moduleType);
    // Use the index on wage_attendance_transactions(date, emp_id)
    return db.prepare(`
      SELECT emp_id, SUM(attendance_value) as total 
      FROM wage_attendance_transactions 
      WHERE date LIKE ? 
      GROUP BY emp_id
    `).all(`${month}%`) as any[];
  }
}
