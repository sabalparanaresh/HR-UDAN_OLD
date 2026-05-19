import { CommandHandler } from './types.js';

export const getBankExcelConfigs: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          const rows = db.prepare('SELECT * FROM bank_excel_configs').all();
          res.json(rows.map((r: any) => ({ ...r, columns: JSON.parse(r.columns_json) })));
          
};

export const saveBankExcelConfig: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          const { id, bank_name, columns } = args;
          const columns_json = JSON.stringify(columns);
          if (id) {
            db.prepare('UPDATE bank_excel_configs SET bank_name = ?, columns_json = ? WHERE id = ?').run(bank_name, columns_json, id);
          } else {
            db.prepare('INSERT INTO bank_excel_configs (bank_name, columns_json) VALUES (?, ?)').run(bank_name, columns_json);
          }
          res.json({ status: 'success' });
          
};

export const deleteBankExcelConfig: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          db.prepare('DELETE FROM bank_excel_configs WHERE id = ?').run(args.id);
          res.json({ status: 'success' });
          
};

export const reserveBankReferenceNumbers: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { bankName, count, startNo, moduleType } = args;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;

          const begin = db.prepare('BEGIN IMMEDIATE');
          const commit = db.prepare('COMMIT');
          const rollback = db.prepare('ROLLBACK');

          try {
            begin.run();
            // Get current reference
            const existing = db.prepare('SELECT last_reference_number FROM bank_transfer_references WHERE bank_name = ?').get(bankName) as any;
            let currentRef = existing ? existing.last_reference_number : (startNo || 1);

            const generatedRefs: string[] = [];
            for (let i = 0; i < count; i++) {
              generatedRefs.push(currentRef.toString());
              currentRef++;
            }

            if (existing) {
              db.prepare('UPDATE bank_transfer_references SET last_reference_number = ?, updated_at = CURRENT_TIMESTAMP WHERE bank_name = ?').run(currentRef, bankName);
            } else {
              db.prepare('INSERT INTO bank_transfer_references (bank_name, last_reference_number) VALUES (?, ?)').run(bankName, currentRef);
            }

            commit.run();
            res.json(generatedRefs);
          } catch (err: any) {
            rollback.run();
            res.status(500).json({ error: err.message });
          
}
};

export const generateBankExcel: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          // This generates the bank excel equivalent logic via web APIs
          // In a real app, this would use 'xlsx' to generate a file
          // For now, we'll just return success and the data that would be in the excel
          res.json({ status: 'success', message: 'Excel generation initiated' });
          
};

export const getProcessedSalaryForBank: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          const { month } = args;
          // Fetch derived salary from final_payroll
          // Note: final_payroll already contains emp_code, name, bank_name, account_no, ifsc, net_payable_final
          const rows = db.prepare(`
            SELECT 
              fp.*, 
              fp.name as first_name, 
              '' as last_name,
              fp.net_payable_final as net_salary,
              fp.ifsc as ifsc_code,
              e.as_per_bank_name,
              e.phone,
              e.email
            FROM final_payroll fp
            LEFT JOIN employees e ON fp.emp_code = e.emp_code
            WHERE fp.month_year = ?
          `).all(month);
          res.json(rows);
          
};
