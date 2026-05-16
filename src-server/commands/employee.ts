import fs from 'fs';
import path from 'path';
import { CommandHandler } from './types.js';
import { calculateBifurcation, mapBifurcationToColumns, mapKeys, sanitizeData, toSnakeCase } from '../utils/helpers.js';
import { logError } from '../utils/logger.js';
import { isKConnected } from '../utils/syncCircuitBreaker.js';
import { PayrollEngine } from '../services/PayrollEngine.js';
import { recalculateCanteenRules } from '../utils/canteen.js';

export const syncEmployeeToPakka: CommandHandler = (ctx, args) => {
  const { statutoryDb, res } = ctx;
  const { employee_id, slab_id, wage_amount } = args;

  if (!employee_id || !slab_id || !wage_amount) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const slab = statutoryDb.prepare('SELECT * FROM salary_slabs WHERE id = ?').get(slab_id) as any;
    if (!slab) {
      return res.status(404).json({ error: 'Salary slab not found' });
    }

    const heads = statutoryDb.prepare('SELECT * FROM salary_heads').all() as any[];
    let components = [];
    try {
      components = typeof slab.components === 'string' ? JSON.parse(slab.components) : slab.components;
    } catch (e) {
      return res.status(400).json({ error: 'Invalid slab components' });
    }

    const headAmounts: Record<number, number> = {};
    const bifurcation: Record<string, number> = {};
    let totalNonResidual = 0;

    // First pass for non-residual
    components.filter((c: any) => c.calculation_type !== 'RESIDUAL').forEach((comp: any) => {
      const head = heads.find(h => h.id === comp.salary_head_id);
      let amount = 0;

      if (comp.calculation_type === 'FIXED') {
        amount = comp.value;
      } else if (comp.calculation_type === 'PERCENT_CTC') {
        amount = (Number(wage_amount) * comp.value) / 100;
      } else if (comp.calculation_type === 'PERCENT_HEAD' && comp.parent_head_id) {
        const parentAmt = headAmounts[comp.parent_head_id] || 0;
        amount = (parentAmt * comp.value) / 100;
      }

      const roundedAmount = Math.round(amount);
      headAmounts[comp.salary_head_id] = roundedAmount;
      totalNonResidual += roundedAmount;
      if (head) bifurcation[head.name.toUpperCase()] = roundedAmount;
    });

    // Second pass for residual
    components.filter((c: any) => c.calculation_type === 'RESIDUAL').forEach((comp: any) => {
      const head = heads.find(h => h.id === comp.salary_head_id);
      const amount = Math.max(0, Number(wage_amount) - totalNonResidual);
      const roundedAmount = Math.round(amount);
      if (head) bifurcation[head.name.toUpperCase()] = roundedAmount;
    });

    const basic = bifurcation['BASIC'] || 0;
    const hra = bifurcation['HRA'] || 0;
    const conv = Object.keys(bifurcation).find(k => k.includes('CONVEYANCE')) ? bifurcation[Object.keys(bifurcation).find(k => k.includes('CONVEYANCE'))!] : 0;
    
    const handledHeadNames = ['BASIC', 'HRA'];
    let special = 0;
    Object.keys(bifurcation).forEach(k => {
      if (!handledHeadNames.includes(k) && !k.includes('CONVEYANCE')) {
        special += bifurcation[k];
      }
    });

    const updateSql = `
      UPDATE employees 
      SET slab_id = ?, statutory_wage_amount = ?, basic_salary = ?, hra = ?, conveyance = ?, special_allowance = ? 
      WHERE id = ?
    `;
    statutoryDb.prepare(updateSql).run(
      slab_id, wage_amount, basic, hra, conv, special, employee_id
    );

    res.json({ status: 'success' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getPSalaryDetailsForK: CommandHandler = (ctx, args) => {
  const { primaryDb, res, req } = ctx;
  const { employeeId } = args;
  
  try {
     const records = primaryDb.prepare('SELECT * FROM employee_p_salary_details WHERE employee_id = ? ORDER BY effective_from DESC').all(employeeId);
     const salaryHeads = primaryDb.prepare('SELECT id, name, type FROM salary_heads WHERE status = 1').all();
     res.json({ records, salaryHeads });
  } catch(e) {
     res.json({ records: [], salaryHeads: [] });
  }
};

export const savePSalaryDetailsForK: CommandHandler = (ctx, args) => {
  const { primaryDb, res, req } = ctx;
  const { employeeId, data } = args; // data is PSalaryDetailsDTO
  const userId = req.headers['x-user-id'] || null;

  try {
     const bridgeRow = primaryDb.prepare("SELECT state FROM bridge_state WHERE id = 1").get() as any;
     if (bridgeRow && bridgeRow.state === 'DISCONNECTED_AUDIT') {
         return res.status(403).json({ error: 'Cannot edit P module details while disconnected' });
     }

     if (data.id) {
         primaryDb.prepare(`
           UPDATE employee_p_salary_details 
           SET effective_from = ?, statutory_working_day_type = ?, statutory_wage_type = ?, statutory_base_rate = ?, salary_head_json = ?, modified_at = CURRENT_TIMESTAMP, modified_by = ?
           WHERE id = ?
         `).run(data.effective_from, data.statutory_working_day_type, data.statutory_wage_type, data.statutory_base_rate, data.salary_head_json, userId, data.id);
         
         // Trigger Sync Queue
         primaryDb.prepare("INSERT OR IGNORE INTO sync_queue (entity_type, entity_id, operation) VALUES ('employee_p_salary_details', ?, 'UPDATE')").run(data.id);
     } else {
         const result = primaryDb.prepare(`
           INSERT INTO employee_p_salary_details (employee_id, effective_from, statutory_working_day_type, statutory_wage_type, statutory_base_rate, salary_head_json, created_by, modified_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         `).run(employeeId, data.effective_from, data.statutory_working_day_type, data.statutory_wage_type, data.statutory_base_rate, data.salary_head_json, userId, userId);
         
         // Trigger Sync Queue
         primaryDb.prepare("INSERT INTO sync_queue (entity_type, entity_id, operation) VALUES ('employee_p_salary_details', ?, 'INSERT')").run(result.lastInsertRowid);
     }

     res.json({ status: 'success' });
  } catch(e: any) {
     res.status(500).json({ error: e.message });
  }
};

export const getLeaveCreditPreview: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { leaveConfigId, deptId, locationId, categoryId, moduleType } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;
  
  const config = db.prepare('SELECT * FROM leave_configurations WHERE id = ?').get(leaveConfigId) as any;
  if (!config) return res.status(404).json({ error: 'Leave configuration not found' });

  let sql = 'SELECT id, emp_code, name FROM employees WHERE status = 1';
  const params: any[] = [];
  if (deptId) { sql += ' AND department_id = ?'; params.push(deptId); }
  if (locationId) { sql += ' AND location_id = ?'; params.push(locationId); }
  if (categoryId) { sql += ' AND category_id = ?'; params.push(categoryId); }

  const emps = db.prepare(sql).all(...params) as any[];
  const preview = emps.map(emp => {
    const balRow = db.prepare('SELECT balance FROM leave_balances WHERE emp_id = ? AND leave_config_id = ?').get(emp.id, leaveConfigId) as any;
    const current_balance = balRow ? balRow.balance : 0;
    
    let calculated_credit = config.leave_value || 0;
    if (config.credit_type === 'Pro-rata' && config.multiplier) {
      calculated_credit = config.multiplier * 26;
    }

    return {
      emp_id: emp.id,
      emp_code: emp.emp_code,
      emp_name: emp.name,
      current_balance,
      calculated_credit
    };
  });

  res.json(preview);
};

export const postLeaveCredits: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { leaveConfigId, credits, moduleType } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;

  const insertOrUpdate = db.prepare(`
    INSERT INTO leave_balances (emp_id, leave_config_id, balance)
    VALUES (?, ?, ?)
    ON CONFLICT(emp_id, leave_config_id) DO UPDATE SET balance = balance + excluded.balance
  `);

  const transaction = db.transaction((items) => {
    for (const item of items) {
      insertOrUpdate.run(item.emp_id, leaveConfigId, item.amount);
    }
  });

  transaction(credits);
  res.json({ status: 'success' });
};

export const saveEmployeeAsset: CommandHandler = (ctx, args) => {
  const { res } = ctx;
  const { base64, emp_code } = args;
  const ASSETS_DIR = path.join(process.cwd(), 'assets', 'photos'); 

  if (!base64 || !emp_code) return res.status(400).json({ error: 'Missing base64 or emp_code' });
  
  try {
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `${emp_code}.jpg`;
    if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
    
    const filepath = path.join(ASSETS_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    res.json({ path: `/assets/photos/${filename}?t=${Date.now()}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const checkDuplicate: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { field, value, excludeId, moduleType } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;
  const snakeField = toSnakeCase(field);
  
  let sql = `SELECT id, emp_code, name FROM employees WHERE ${snakeField} = ?`;
  const params: any[] = [value];
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  const existing = db.prepare(sql).get(...params);
  res.json({ existing: existing || null });
};

const HEADER_MAPPING: Record<string, string> = {
  'employee_code': 'emp_code',
  'emp_code': 'emp_code',
  'employee_id': 'emp_code',
  'biometric_id': 'biometric_id',
  'first_name': 'first_name',
  'middle_name': 'middle_name',
  'last_name': 'last_name',
  'aadhar_no': 'aadhar_no',
  'aadhar_number': 'aadhar_no',
  'pan_no': 'pan_no',
  'pan_number': 'pan_no',
  'joining_date': 'joining_date',
  'mobile': 'mobile',
  'mobile_no': 'mobile',
  'phone': 'mobile',
  'address': 'perm_address',
  'designation': 'designation',
  'department': 'department_id',
  'location': 'location_id',
  'category': 'category_id',
  'employment_type': 'employment_type',
  'date_of_birth': 'dob',
  'dob': 'dob',
  'gender': 'gender',
  'marital_status': 'marital_status',
  'father_name': 'father_husband_guardian_name',
  'account_no': 'account_no',
  'ifsc': 'ifsc_code',
  'ifsc_code': 'ifsc_code',
  'bank_name': 'bank_name',
  'status': 'status',
  'slab_name': 'slab_name',
  'wage_amount': 'wage_amount',
  'wage_type': 'wage_type',
  'reporting_employee': 'reporting_to_emp_code',
  'parent_employee': 'parent_emp_code',
  'salary_process_sequence': 'salary_process_sequence'
};

export const bulkEmployeeUpsert: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { records, moduleType } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;
  
  if (!records || records.length === 0) return res.json({ status: 'success' });

  try { 
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_emp_code ON employees (emp_code)`); 
  } catch (e) { 
    logError(db, 'INFO', 'Index already exists or failed to create on emp_code', e); 
  }

  const columns = db.prepare(`PRAGMA table_info(employees)`).all() as any[];
  const columnNames = columns.map(c => c.name);
  const statutoryDbColumns = statutoryDb.prepare(`PRAGMA table_info(employees)`).all() as any[];
  const statutoryColumnNames = statutoryDbColumns.map(c => c.name);
  const salaryHeadsP = statutoryDb.prepare('SELECT id, name FROM salary_heads').all() as any[];
  const salarySlabsP = statutoryDb.prepare('SELECT id, name, components FROM salary_slabs').all() as any[];
  const companyConfig = primaryDb.prepare('SELECT date_of_incorporation FROM company_config LIMIT 1').get() as any;
  const incorporationDate = companyConfig?.date_of_incorporation;

  const syncRecordsP: any[] = [];
  const processedRecords = records.map((rec: any, index: number) => {
    // 1. Map headers using dictionary
    const mappedRec: any = {};
    Object.keys(rec).forEach(key => {
      const lowerKey = key.toLowerCase().trim();
      const mappedKey = HEADER_MAPPING[lowerKey] || toSnakeCase(key);
      mappedRec[mappedKey] = rec[key];
    });

    const r = mappedRec;
    const jsonFields = ['pf_history', 'esi_history', 'bank_history', 'family_members', 'employment_history'];
    jsonFields.forEach(f => { if (r[f] && typeof r[f] !== 'string') r[f] = JSON.stringify(r[f]); });
    
    // Age based logic (The "Smart Auditor")
    if (r.dob) {
      const birth = new Date(r.dob);
      if (!isNaN(birth.getTime())) {
        const age = Math.floor((new Date().getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18) {
          r.employment_type = "Apprentice/Trainee";
        }
        if (age >= 58) {
          r.eps_exempt = 1;
        }
      }
    }

    // Gratuity Eligibility Logic
    if (r.joining_date) {
      r.gratuity_eligible_date = PayrollEngine.calculateGratuityEligibility(
        r.joining_date, 
        r.employment_type || '', 
        !!r.is_fte_contract
      );
    }
    
    // 2. Default status to 1
    if (r.status === undefined || r.status === null || r.status === '') r.status = 1;

    if (moduleType === 'K' && isKConnected(primaryDb)) {
      const paymentMode = String(r.payment_mode || '').toLowerCase();
      const hasBookJoining = r.book_joining_date && String(r.book_joining_date).trim() !== '';
      const isAfterInc = !incorporationDate || (hasBookJoining && r.book_joining_date >= incorporationDate);
      
      // 4. Logging for skipped records due to Incorporation Date
      if (hasBookJoining && !isAfterInc) {
        console.log(`[Bulk Import Skip] Row ${index + 1} (Emp: ${r.emp_code}): Book Joining Date ${r.book_joining_date} is before Incorporation Date ${incorporationDate}`);
      }

      let isBankValid = true;
      if (['bank transfer', 'cheque'].includes(paymentMode)) isBankValid = !!(r.account_no && r.ifsc_code);
      else if (paymentMode === 'cash') isBankValid = false;

      if (hasBookJoining && isAfterInc && isBankValid && (r.slab_id || r.slab_name)) {
        try {
          const slabVal = r.slab_id || r.slab_name;
          const slab = salarySlabsP.find(s => s.id === slabVal || (s.name || s.slab_name || '').toLowerCase() === String(slabVal).toLowerCase());
          const targetWage = r.statutory_wage_amount || r.wage_amount;
          if (slab && targetWage) {
            const comps = typeof slab.components === 'string' ? JSON.parse(slab.components) : slab.components;
            const bif = calculateBifurcation(Number(targetWage), comps, salaryHeadsP);
            const pRec = { ...r, ...mapBifurcationToColumns(bif), slab_id: slab.id, statutory_rate: targetWage, wage_amount: targetWage, wage_type: r.statutory_wage_type || r.wage_type || 'Monthly' };
            const filteredP: any = {};
            statutoryColumnNames.forEach(col => { if (pRec[col] !== undefined && col !== 'id') filteredP[col] = pRec[col]; });

            if (pRec.reporting_to_emp_code) filteredP._reporting_to_emp_code = pRec.reporting_to_emp_code;
            if (pRec.parent_emp_code) filteredP._parent_emp_code = pRec.parent_emp_code;
            syncRecordsP.push(filteredP);
          }
        } catch (e) {
          logError(db, 'WARN', `Failed to calculate bifurcation for employee ${r.emp_code} during bulk upsert`, e);
        }
      }
    }

    // 5. Fix processedRecords mapping to match schema
    const filtered: any = {};
    columnNames.forEach(col => { 
      if (r[col] !== undefined && col !== 'id') filtered[col] = r[col]; 
    });

    if (r.reporting_to_emp_code) filtered._reporting_to_emp_code = r.reporting_to_emp_code;
    if (r.parent_emp_code) filtered._parent_emp_code = r.parent_emp_code;
    return filtered;
  });

  const performUpsert = (targetDb: any, recs: any[], cols: string[]) => {
    if (recs.length === 0) return;
    const keys = cols.filter(k => k !== 'id');
    const updateKeys = keys.filter(k => k !== 'emp_code' && k !== 'created_at');
    const sql = updateKeys.length > 0 
      ? `INSERT INTO employees (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) ON CONFLICT(emp_code) DO UPDATE SET ${updateKeys.map(k => `${k} = EXCLUDED.${k}`).join(', ')}`
      : `INSERT OR IGNORE INTO employees (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    const insert = targetDb.prepare(sql);
    targetDb.transaction(() => { for (const rec of recs) insert.run(...keys.map(k => sanitizeData(rec[k]))); })();
  };

  const performSecondPass = (targetDb: any, recs: any[]) => {
    if (recs.length === 0) return;
    targetDb.transaction(() => {
      for (const rec of recs) {
        let updateSql = '';
        const params: any[] = [];
        if (rec._reporting_to_emp_code) {
          const rep = targetDb.prepare('SELECT id FROM employees WHERE emp_code = ?').get(String(rec._reporting_to_emp_code)) as any;
          if (rep) {
            updateSql += 'reporting_employee_id = ?, ';
            params.push(rep.id);
          }
        }
        if (rec._parent_emp_code) {
          const parent = targetDb.prepare('SELECT id FROM employees WHERE emp_code = ?').get(String(rec._parent_emp_code)) as any;
          if (parent) {
            updateSql += 'parent_employee_id = ?, ';
            params.push(parent.id);
          }
        }
        
        if (updateSql) {
          updateSql = updateSql.slice(0, -2);
          params.push(rec.emp_code);
          targetDb.prepare(`UPDATE employees SET ${updateSql} WHERE emp_code = ?`).run(...params);
        }
      }
    })();
  };

  try {
    performUpsert(db, processedRecords, columnNames);
    performSecondPass(db, processedRecords);

    if (moduleType === 'K' && syncRecordsP.length > 0 && isKConnected(primaryDb)) {
      performUpsert(statutoryDb, syncRecordsP, statutoryColumnNames);
      performSecondPass(statutoryDb, syncRecordsP);
    }

    setTimeout(() => { recalculateCanteenRules(primaryDb); recalculateCanteenRules(statutoryDb); }, 100);

    res.json({ status: 'success', syncCount: syncRecordsP.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const recordSalaryRevision: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { empId, newRate, effectiveDate, revisionType, remarks, moduleType } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;

  try {
    const trx = db.transaction(() => {
      // Get old rate
      const emp = db.prepare('SELECT wage_amount, statutory_wage_amount, wage_type FROM employees WHERE id = ?').get(empId) as any;
      if (!emp) throw new Error('Employee not found');

      const previousAmount = moduleType === 'P' ? (emp.statutory_wage_amount || emp.wage_amount || 0) : (emp.wage_amount || 0);
      const type = moduleType === 'P' ? 'STATUTORY' : 'WAGE';

      // Check locks
      const monthYear = effectiveDate.substring(0, 7); // YYYY-MM
      const lockData = db.prepare('SELECT is_locked FROM salary_locks WHERE month = ? AND emp_id = ? AND module_type = ?').get(monthYear, empId, moduleType) as any;
      if (lockData && lockData.is_locked) throw new Error(`Salary is locked for ${monthYear}. Revisions are disabled for locked months.`);

      // Record history
      db.prepare(`
        INSERT INTO salary_rate_history (emp_id, type, previous_amount, amount, effective_date, revision_type, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(empId, type, previousAmount, newRate, effectiveDate, revisionType, remarks);

      // Update employee master with the absolute latest revision from history
      const latestRevision = db.prepare(`
        SELECT amount, effective_date 
        FROM salary_rate_history 
        WHERE emp_id = ? AND type = ? 
        ORDER BY effective_date DESC, created_at DESC 
        LIMIT 1
      `).get(empId, type) as any;

      if (latestRevision) {
        if (moduleType === 'P') {
          db.prepare('UPDATE employees SET statutory_wage_amount = ?, wage_effective_from = ? WHERE id = ?').run(latestRevision.amount, latestRevision.effective_date, empId);
        } else {
          db.prepare('UPDATE employees SET wage_amount = ?, wage_effective_from = ? WHERE id = ?').run(latestRevision.amount, latestRevision.effective_date, empId);
        }
      }
    });
    trx();
    res.json({ status: 'success' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const getSalaryRevisionHistory: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { empId, moduleType } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;
  const type = moduleType === 'P' ? 'STATUTORY' : 'WAGE';

  try {
    const history = db.prepare(`
      SELECT * FROM salary_rate_history 
      WHERE emp_id = ? AND type = ? 
      ORDER BY effective_date DESC, created_at DESC
    `).all(empId, type);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getOpenGrievances: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const module_type = args.moduleType || args.module_type || 'K';
  const db = module_type === 'P' ? statutoryDb : primaryDb;
  try {
    const grievances = db.prepare(`
      SELECT g.*, e.name as employee_name, e.emp_code, c.name as category_name, c.criticality
      FROM grievances g
      LEFT JOIN employees e ON g.employee_id = e.id
      LEFT JOIN grievance_categories c ON g.category_id = c.id
      WHERE g.status = 'OPEN'
      ORDER BY g.created_at DESC
    `).all();
    res.json(grievances);
  } catch (err) {
    logError(db, 'ERROR', 'Failed to fetch open grievances', err);
    res.json([]);
  }
};

export const searchEmployees: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { query, moduleType } = args;
  const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;

  try {
    const q = query || '';
    const sql = `
      SELECT id, emp_code, name, designation as designation_name, department as department_name, emp_group as group_name
      FROM employees 
      WHERE status = 1 AND (emp_code LIKE '%' || ? || '%' OR name LIKE '%' || ? || '%')
      ORDER BY 
        CASE 
          WHEN emp_code COLLATE NOCASE = ? THEN 1
          WHEN emp_code LIKE ? || '%' THEN 2 
          WHEN name LIKE ? || '%' THEN 3 
          ELSE 4 
        END,
        CAST(emp_code AS INTEGER) ASC,
        emp_code ASC
      LIMIT 25
    `;
    const rows = db.prepare(sql).all(q, q, q, q, q);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const resolveGrievance: CommandHandler = (ctx, args) => {
  const { statutoryDb, primaryDb, res } = ctx;
  const { id, resolution_notes, moduleType } = args;
  const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
  db.prepare("UPDATE grievances SET status = 'RESOLVED', resolution_notes = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(resolution_notes, id);
  res.json({ status: 'success' });
};

export const getEmployeeRecord: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { empId, month, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          const record = db.prepare('SELECT * FROM statutory_records WHERE emp_id = ? AND month = ?').get(empId, month);
          res.json(record || null);
          
};

export const getNextEmployeeCode: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const module_type = args.moduleType || args.module_type || 'K';
          const db = module_type === 'P' ? statutoryDb : primaryDb;
          
          try {
            const configRow = db.prepare('SELECT * FROM company_config WHERE id = 1').get() as any;
            if (!configRow) {
              return res.json({ nextCode: '1' });
            }
            
            const prefix = configRow.emp_id_prefix || '';
            const suffix = configRow.emp_id_suffix || '';
            const startNumber = parseInt(configRow.emp_id_start_number) || 1;
            const padding = parseInt(configRow.emp_id_padding) || 0;

            const employees = db.prepare('SELECT emp_code FROM employees WHERE emp_code IS NOT NULL').all() as any[];
            
            let maxNum = startNumber - 1;

            const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedPrefix = escapeRegExp(prefix);
            const escapedSuffix = escapeRegExp(suffix);
            
            // Build regex: ^prefix(\d+)suffix$
            const regex = new RegExp(`^${escapedPrefix}(\\d+)${escapedSuffix}$`);

            for (const emp of employees) {
              const match = emp.emp_code.match(regex);
              if (match) {
                const num = parseInt(match[1]);
                if (!isNaN(num) && num > maxNum) {
                  maxNum = num;
                }
              }
            }

            const nextNum = maxNum + 1;
            const paddedNum = nextNum.toString().padStart(padding, '0');
            const nextCode = `${prefix}${paddedNum}${suffix}`;

            res.json({ nextCode });
          } catch (err) {
            console.error('[Database] get_next_employee_code error:', err);
            res.status(500).json({ error: (err as Error).message });
          
}
};

export const checkMinWage: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { amount, moduleType } = args;
          // Mock min wage check
          res.json({ compliant: amount >= 500 });
          
};

export const getAssetDepositData: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { empId } = args;
          let assetsSql = 'SELECT a.*, e.name as emp_name, e.emp_code FROM employee_assets a JOIN employees e ON a.emp_id = e.id';
          let depositsSql = 'SELECT d.*, e.name as emp_name, e.emp_code FROM employee_deposits d JOIN employees e ON d.emp_id = e.id';
          const params: any[] = [];

          if (empId) {
            assetsSql += ' WHERE a.emp_id = ?';
            depositsSql += ' WHERE d.emp_id = ?';
            params.push(empId);
          }

          const assets = primaryDb.prepare(assetsSql).all(...params);
          const deposits = primaryDb.prepare(depositsSql).all(...params);

          res.json({ 
            assets, 
            deposits 
          });
          
};

export const saveAsset: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const snakeArgs = mapKeys(args, toSnakeCase);
          const { id, emp_id, item_description, serial_number, issue_date, value, expected_return_date, status } = snakeArgs;
          if (id) {
            primaryDb.prepare(`
              UPDATE employee_assets SET 
              item_description = ?, serial_number = ?, issue_date = ?, value = ?, expected_return_date = ?, status = ?
              WHERE id = ?
            `).run(item_description, serial_number, issue_date, value, expected_return_date, status, id);
          } else {
            primaryDb.prepare(`
              INSERT INTO employee_assets (emp_id, item_description, serial_number, issue_date, value, expected_return_date, status)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(emp_id, item_description, serial_number, issue_date, value, expected_return_date, status || 'Issued');
          }
          res.json({ status: 'success' });
          
};

export const saveDeposit: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const snakeArgs = mapKeys(args, toSnakeCase);
          const { id, emp_id, description, amount, payment_date, status } = snakeArgs;
          if (id) {
            primaryDb.prepare(`
              UPDATE employee_deposits SET 
              description = ?, amount = ?, payment_date = ?, status = ?
              WHERE id = ?
            `).run(description, amount, payment_date, status, id);
          } else {
            primaryDb.prepare(`
              INSERT INTO employee_deposits (emp_id, description, amount, payment_date, status)
              VALUES (?, ?, ?, ?, ?)
            `).run(emp_id, description, amount, payment_date, status || 'Paid');
          }
          res.json({ status: 'success' });
          
};

export const returnAsset: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { id, status, returned_date } = args;
          primaryDb.prepare('UPDATE employee_assets SET status = ?, returned_date = ? WHERE id = ?')
            .run(status || 'Returned', returned_date || new Date().toISOString().split('T')[0], id);
          res.json({ status: 'success' });
          
};

export const getFfClearance: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { empId } = args;
          const pendingAssets = primaryDb.prepare("SELECT * FROM employee_assets WHERE emp_id = ? AND status != 'Returned'").all(empId);
          const pendingDeposits = primaryDb.prepare("SELECT * FROM employee_deposits WHERE emp_id = ? AND status = 'Paid'").all(empId);
          
          res.json({
            is_cleared: pendingAssets.length === 0 && pendingDeposits.length === 0,
            pending_assets: pendingAssets,
            pending_deposits: pendingDeposits
          });
          
};
