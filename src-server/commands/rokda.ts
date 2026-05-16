import { logError } from '../utils/logger.js';
import { CommandHandler } from './types.js';

export const saveMisVoucher: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { voucher, entries, moduleType } = args;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
          
          try {
            const transaction = db.transaction((v, e) => {
              const stmt = db.prepare(`
                INSERT INTO mis_vouchers (voucher_date, shift, running_machines, reporting_employee_id, department_id, location_id, division_id, group_id, total_standard_amount, total_worked_amount, total_variance)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);
              const info = stmt.run(v.voucher_date, v.shift, v.running_machines, v.reporting_employee_id, v.department_id, v.location_id, v.division_id, v.group_id, v.total_standard_amount, v.total_worked_amount, v.total_variance);
              const voucherId = info.lastInsertRowid;
              
              const entryStmt = db.prepare(`
                INSERT INTO mis_entries (voucher_id, emp_id, master_designation, current_designation, standard_rate, worked_rate, variance)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `);
              for (const entry of e) {
                entryStmt.run(voucherId, entry.emp_id, entry.master_designation, entry.current_designation, entry.standard_rate, entry.worked_rate, entry.variance);
              }
              return voucherId;
            });
            
            const id = transaction(voucher, entries);
            res.json({ status: 'success', id });
          } catch (err) {
            logError(db, 'ERROR', '[Database] save_mis_voucher error', err);
            res.status(500).json({ error: 'Failed to save MIS voucher' });
          
}
};

export const getNextRokdaToken: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { prefix, moduleType } = args; // prefix is MMYY
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
          try {
            const row = db.prepare(`
              SELECT token_code FROM rokda_entries 
              WHERE token_code LIKE ? 
              ORDER BY token_code DESC LIMIT 1
            `).get(`${prefix}%`) as any;
            
            let nextNum = 1;
            if (row && row.token_code) {
              const lastNum = parseInt(row.token_code.substring(4));
              nextNum = lastNum + 1;
            }
            
            const nextToken = `${prefix}${nextNum.toString().padStart(3, '0')}`;
            res.json({ nextToken });
          } catch (err) {
            logError(db, 'ERROR', `Failed to generate next Rokda token for prefix ${prefix}`, err);
            res.json({ nextToken: `${prefix}001` });
          
}
};
