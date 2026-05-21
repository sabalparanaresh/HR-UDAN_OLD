import { Database } from 'better-sqlite3';

export class RokdaRepository {
  db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  getNextToken(prefix: string): string {
    const row = this.db.prepare(`
      SELECT token_code FROM rokda_entries 
      WHERE token_code LIKE ? 
      ORDER BY token_code DESC LIMIT 1
    `).get(`${prefix}%`) as any;
    
    let nextNum = 1;
    if (row && row.token_code) {
      const lastNum = parseInt(row.token_code.substring(4));
      nextNum = lastNum + 1;
    }
    
    return `${prefix}${nextNum.toString().padStart(3, '0')}`;
  }

  saveVoucher(voucher: any, entries: any[]): number | bigint {
    return this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO rokda_vouchers (voucher_date, department_id, shift, reporting_employee_id, authorizer_id, total_count, total_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(voucher.voucher_date, voucher.department_id, voucher.shift, voucher.reporting_employee_id, voucher.authorizer_id, voucher.total_count, voucher.total_amount);
      const voucherId = info.lastInsertRowid;
      
      const entryStmt = this.db.prepare(`
        INSERT INTO rokda_entries (voucher_id, token_code, worker_name, designation, in_time, out_time, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const entry of entries) {
        entryStmt.run(voucherId, entry.token_code, entry.worker_name, entry.designation, entry.in_time, entry.out_time, entry.amount);
      }
      return voucherId;
    })();
  }
}

export class MisRepository {
  db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  saveVoucher(voucher: any, entries: any[]): number | bigint {
    return this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO mis_vouchers (voucher_date, shift, running_machines, reporting_employee_id, department_id, location_id, division_id, group_id, total_standard_amount, total_worked_amount, total_variance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(voucher.voucher_date, voucher.shift, voucher.running_machines, voucher.reporting_employee_id, voucher.department_id, voucher.location_id, voucher.division_id, voucher.group_id, voucher.total_standard_amount, voucher.total_worked_amount, voucher.total_variance);
      const voucherId = info.lastInsertRowid;
      
      const entryStmt = this.db.prepare(`
        INSERT INTO mis_entries (voucher_id, emp_id, master_designation, current_designation, standard_rate, worked_rate, variance)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const entry of entries) {
        entryStmt.run(voucherId, entry.emp_id, entry.master_designation, entry.current_designation, entry.standard_rate, entry.worked_rate, entry.variance);
      }
      return voucherId;
    })();
  }
}
