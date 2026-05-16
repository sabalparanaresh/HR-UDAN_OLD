import { CommandHandler } from './types.js';

export const getExistingAdvances: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { monthYear } = args;
          const [yyyy, mm] = monthYear.split('-');
          const formattedMonthYear = `${mm}-${yyyy}`;

          const existingAdvRows = primaryDb.prepare(`
             SELECT st.emp_id, SUM(st.amount) as amt 
             FROM salary_transactions st
             JOIN salary_heads sh ON st.head_id = sh.id
             WHERE st.salary_month_year = ? AND sh.system_head = 'ADVANCE_SALARY'
             GROUP BY st.emp_id
          `).all(formattedMonthYear) as any[];

          res.json(existingAdvRows);
          
};

export const postAdvanceTransactions: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { advances, monthYear, userId, authorisedBy, paymentMode, remark } = args;
          const [yyyy, mm] = monthYear.split('-');
          const formattedMonthYear = `${mm}-${yyyy}`;

          const allocationType = paymentMode === 'CASH' ? 'K_ONLY' : 'KP';
          const advanceHead = primaryDb.prepare("SELECT id FROM salary_heads WHERE system_head IN ('ADVANCE_SALARY', 'ADVANCE') AND status = 1 AND allocation_type = ? LIMIT 1").get(allocationType) as any;
          if (!advanceHead) {
             const typeStr = paymentMode === 'CASH' ? 'K Only (Cash)' : 'KP (Bank/Cheque)';
             res.status(400).json({ error: `Please define an Advance salary head with allocation type '${typeStr}' in Master data.` });
             
}
};

export const getCashTransactions: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          const txns = db.prepare(`
            SELECT *, balance_amount as balance
            FROM cash_transactions
            WHERE module_type = ?
          `).all(args.module_type) as any[];

          res.json(txns);
          
};

export const addCashPayment: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          const { transaction_id, amount, user, action } = args;
          
          try {
            db.prepare('BEGIN IMMEDIATE').run();
            // Optional: Check if overpaying, but not strictly needed if we assume trust or add it later
            db.prepare(`
              INSERT INTO cash_payment_entries (transaction_id, amount, action, created_by)
              VALUES (?, ?, ?, ?)
            `).run(transaction_id, amount, action || 'Payment', user || 'System');
            
            db.prepare('COMMIT').run();
            res.json({ status: 'success' });
          } catch (e: any) {
            db.prepare('ROLLBACK').run();
            res.status(500).json({ error: e.message });
          
}
};

export const reverseCashPayment: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          const { transaction_id, user } = args;

          try {
            db.prepare('BEGIN IMMEDIATE').run();
            // Find total paid
            const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) as paid FROM cash_payment_entries WHERE transaction_id = ?`).get(transaction_id) as any;
            if (row && row.paid > 0) {
              db.prepare(`
                INSERT INTO cash_payment_entries (transaction_id, amount, action, created_by)
                VALUES (?, ?, ?, ?)
              `).run(transaction_id, -row.paid, 'Reversal', user || 'System');
            }
            db.prepare('COMMIT').run();
            res.json({ status: 'success' });
          } catch (e: any) {
            db.prepare('ROLLBACK').run();
            res.status(500).json({ error: e.message });
          
}
};

export const getCashPaymentHistory: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const db = args.module_type === 'P' ? statutoryDb : primaryDb;
          const { transaction_id } = args;
          const history = db.prepare(`
            SELECT * FROM cash_payment_entries
            WHERE transaction_id = ?
            ORDER BY created_at DESC
          `).all(transaction_id);
          res.json(history);
          
};

export const calculateBulkAdvance: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { wageMonth, fromDate, toDate, percentage = 50, threshold = 1000, rounding = 100, filters = {} } = args;

          const minWageRow = statutoryDb.prepare("SELECT config, effective_date FROM statutory_settings WHERE type = 'MIN_WAGE' ORDER BY effective_date DESC LIMIT 1").get() as any;
          let hasValidMinWage = false;
          if (minWageRow && minWageRow.config) {
            try {
              const config = typeof minWageRow.config === 'string' ? JSON.parse(minWageRow.config) : minWageRow.config;
              if (config.wages && config.wages.length > 0) {
                 hasValidMinWage = true;
                 const [pYear, pMonth] = wageMonth.split('-').map(Number);
                 const processVal = pYear * 12 + pMonth;

                 if (config.end_date) {
                    const [eYear, eMonth] = config.end_date.split('-').map(Number);
                    const endVal = eYear * 12 + eMonth;
                    if (processVal > endVal) hasValidMinWage = false;
                 } else {
                    hasValidMinWage = true; // No end date means valid
                 }
              }
            } catch (e) { }
          }
        
          if (!hasValidMinWage) {
            res.status(400).json({ error: "System check failed: Minimum wages are not configured or are expired for this period. Please configure them in Statutory Settings with 'From' and 'To' dates." });
            
}
};

export const getAdvanceEligibleAmount: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { monthYear, processDate, filters, percentage = 80 } = args;

          if (!monthYear || !processDate) {
             res.status(400).json({ error: "monthYear and processDate are mandatory" });
             return;
          }

          const [mm, yyyy] = monthYear.split('-');
          // month separator usually depends on how ui sends it. If it's MM-YYYY we do:
          const [reqMonth, reqYear] = monthYear.includes('-') ? monthYear.split('-') : [undefined, undefined];
          const fromDate = `${reqYear || new Date().getFullYear()}-${reqMonth || '01'}-01`;
          const toDate = processDate;

          // Borrow logical from calculate_k_module_wages
          // But actually we can just invoke it from here, or do the query:
          let sql = `
            SELECT e.id, e.emp_code, e.name, e.wage_amount, e.payment_mode, d.name as dept_name, des.name as desig_name, e.bank_name, e.account_no, e.ifsc_code, e.wage_type, e.working_day_type_id
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN designations des ON e.designation_id = des.id
            WHERE e.status = 1
          `;
          const params: any[] = [];
          if (filters) {
            const arrayFilter = (field: string, values: any) => {
              if (Array.isArray(values) && values.length > 0) {
                sql += ` AND e.${field} IN (${values.map(()=>'?').join(', ')})`;
                params.push(...values);
              } else if (values && typeof values === 'string') {
                sql += ` AND e.${field} = ?`;
                params.push(values);
              }
            };
            arrayFilter('department_id', filters.departmentId);
            arrayFilter('location_id', filters.locationId);
            arrayFilter('division_id', filters.divisionId);
            arrayFilter('group_id', filters.groupId);
            arrayFilter('category_id', filters.categoryId);
            arrayFilter('class_id', filters.classId);
            arrayFilter('designation_id', filters.designationId);
          }

          const employees = primaryDb.prepare(sql).all(...params) as any[];
          const results = [];
          
          const daysInMonth = new Date(Number(reqYear), Number(reqMonth), 0).getDate();

          for (const emp of employees) {
            // Get divisor
            let divisor = 30;
            if (emp.working_day_type_id) {
              const wdt = primaryDb.prepare('SELECT * FROM working_day_types WHERE id = ?').get(emp.working_day_type_id) as any;
              if (wdt) {
                // Approximate it here, ignoring complex calendar if not strictly needed
                divisor = (wdt.monthly_divisor && wdt.monthly_divisor > 0) ? wdt.monthly_divisor : 30;
              }
            }

            const attendance = primaryDb.prepare(`
              SELECT SUM(attendance_value) as present_days 
              FROM attendance_logs 
              WHERE emp_id = ? AND date >= ? AND date <= ?
            `).get(emp.id, fromDate, toDate) as any;

            const presentDays = attendance?.present_days || 0;
            
            // Look into salary_rate_history
            const historyRate = primaryDb.prepare("SELECT amount FROM salary_rate_history WHERE emp_id = ? AND type = 'WAGE' AND effective_date <= ? ORDER BY effective_date DESC LIMIT 1").get(emp.id, toDate) as any;
            const wageRate = historyRate ? historyRate.amount : (emp.wage_amount || 0);

            let kGrossWage = 0;
            if (emp.wage_type === 'Daily') {
              kGrossWage = wageRate * presentDays;
            } else {
              kGrossWage = (wageRate / divisor) * presentDays;
            }

            const advanceAmount = (kGrossWage * percentage) / 100;
            
            results.push({
              emp_id: emp.id,
              emp_code: emp.emp_code,
              name: emp.name,
              dept_name: emp.dept_name,
              desig_name: emp.desig_name,
              wage_rate: wageRate,
              present_days: presentDays,
              net_payable: Math.round(kGrossWage),
              eligible_advance: Math.round(advanceAmount),
              payment_mode: emp.payment_mode || 'CASH',
              bank_name: emp.bank_name,
              account_no: emp.account_no,
              ifsc_code: emp.ifsc_code,
              ref_process_date: processDate
            });
          }

          res.json(results);
          
};

export const commitBulkAdvance: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { entries, wageMonth, remark, authorizerId, processDate } = args;
          const batchId = `ADV-${Date.now()}`;
          
          try {
            primaryDb.transaction(() => {
              const advHead = primaryDb.prepare("SELECT * FROM salary_heads WHERE (name LIKE '%ADVANCE%' OR name = 'ADVANCE') AND is_deduction = 1 LIMIT 1").get() as any;
              if (!advHead) {
                throw new Error("Advance salary head not found. Please ensure a deduction head named 'ADVANCE' exists.");
              }

              // Check if we need to sync to Statutory
              const shouldSync = advHead.applicability === 'KP';
              let statAdvHead: any = null;
              if (shouldSync) {
                statAdvHead = statutoryDb.prepare("SELECT id FROM salary_heads WHERE name = ?").get(advHead.name);
              }

              for (const entry of entries) {
                if (entry.advance_amount <= 0) continue;

                primaryDb.prepare(`
                  INSERT INTO advance_entries (batch_id, emp_id, amount, payment_mode, wage_month, status)
                  VALUES (?, ?, ?, ?, ?, 'COMMITTED')
                `).run(batchId, entry.emp_id, entry.advance_amount, entry.payment_mode, wageMonth);

                primaryDb.prepare(`
                  INSERT INTO salary_transactions (transaction_type, salary_month_year, emp_id, head_id, amount, remark, authorised_by, is_bulk_entry, ref_process_date)
                  VALUES ('DEDUCTION', ?, ?, ?, ?, ?, ?, 1, ?)
                `).run(wageMonth, entry.emp_id, advHead.id, entry.advance_amount, remark, authorizerId, processDate || null);

                if (shouldSync && statAdvHead) {
                  statutoryDb.prepare(`
                    INSERT INTO salary_transactions (transaction_type, salary_month_year, emp_id, head_id, amount, remark, authorised_by, is_bulk_entry, ref_process_date)
                    VALUES ('DEDUCTION', ?, ?, ?, ?, ?, ?, 1, ?)
                  `).run(wageMonth, entry.emp_id, statAdvHead.id, entry.advance_amount, remark, authorizerId, processDate || null);
                }

                if (entry.payment_mode === 'BANK') {
                  primaryDb.prepare(`
                    INSERT INTO bank_transfers (emp_id, amount, bank_name, account_no, ifsc_code, transfer_type, batch_id)
                    VALUES (?, ?, ?, ?, ?, 'ADVANCE', ?)
                  `).run(entry.emp_id, entry.advance_amount, entry.bank_name, entry.account_no, entry.ifsc_code, batchId);
                }
              }
            })();
            res.json({ status: 'success', batchId });
          } catch (err: any) {
            console.error("[Advance] Commit failed:", err);
            res.status(500).json({ error: err.message });
          
}
};
