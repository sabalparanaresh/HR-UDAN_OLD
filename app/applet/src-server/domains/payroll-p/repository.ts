import { Database } from 'better-sqlite3';
import { BaseRepository } from '../base.repository';

export class PayrollPRepository extends BaseRepository<any> {
  constructor(primaryDb: Database, statutoryDb: Database) {
    super(primaryDb, statutoryDb);
  }

  getEffectiveStatutorySettings(date: string) {
    // Effective-date filtering mandatory
    const pfSettings = this.statutoryDb.prepare(`
      SELECT config FROM statutory_settings 
      WHERE type = 'PF' AND effective_date <= ? 
      ORDER BY effective_date DESC LIMIT 1
    `).get(date) as any;

    const esiSettings = this.statutoryDb.prepare(`
      SELECT config FROM statutory_settings 
      WHERE type = 'ESI' AND effective_date <= ? 
      ORDER BY effective_date DESC LIMIT 1
    `).get(date) as any;

    return {
      pf: pfSettings?.config ? JSON.parse(pfSettings.config) : { employee_contribution_rate: 12, wage_limit: 15000 },
      esi: esiSettings?.config ? JSON.parse(esiSettings.config) : { employee_contribution_rate: 0.75, wage_limit: 21000 }
    };
  }

  savePayrollRecord(payrollData: any) {
    // Immutable saving logic
    const db = this.statutoryDb;
    
    // Check locks
    const isLocked = db.prepare('SELECT is_locked FROM salary_locks WHERE month = ? AND emp_id = ? AND module_type = ?')
      .get(payrollData.month, payrollData.emp_id, 'P') as any;

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
}
