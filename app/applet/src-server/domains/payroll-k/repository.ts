import { Database } from 'better-sqlite3';
import { BaseRepository } from '../base.repository';

export class PayrollKRepository extends BaseRepository<any> {
  constructor(primaryDb: Database, statutoryDb: Database) {
    super(primaryDb, statutoryDb);
  }

  savePayrollRecord(payrollData: any) {
    const db = this.primaryDb;
    
    // Check locks
    const isLocked = db.prepare('SELECT is_locked FROM salary_locks WHERE month = ? AND emp_id = ? AND module_type = ?')
      .get(payrollData.month, payrollData.emp_id, 'K') as any;

    if (isLocked?.is_locked === 1) {
      throw new Error(`Payroll for employee ${payrollData.emp_id} in month ${payrollData.month} is locked.`);
    }

    const keys = Object.keys(payrollData);
    const cols = keys.join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const updates = keys.map(k => `${k} = excluded.${k}`).join(', ');

    db.prepare(`
      INSERT INTO final_payroll (${cols}) VALUES (${placeholders})
      ON CONFLICT(month_year, emp_code) DO UPDATE SET ${updates}
    `).run(...Object.values(payrollData));
  }

  getTransactionsForMonth(empId: number, month: string) {
    return this.primaryDb.prepare(`
      SELECT t.*, h.name as head_name, h.type as head_type, h.is_deduction
      FROM salary_transactions t
      JOIN salary_heads h ON t.head_id = h.id
      WHERE t.emp_id = ? AND t.salary_month_year = ?
    `).all(empId, month) as any[];
  }
}
