import { syncEarningTransactionToP } from '../../src-server/legacyRouter.js';
import { CommandHandler } from './types.js';
import { CRUD_TABLE_WHITELIST } from '../db/whitelists.js';
import { EmployeeSchema, SalaryHeadSchema } from '../validation/index.js';
import { Mapper } from '../utils/mapper.js';
import { mapKeys, toSnakeCase, toCamelCase, sanitizeData } from '../utils/helpers.js';
import { logError } from '../utils/logger.js';
import { isKConnected } from '../utils/syncCircuitBreaker.js';

const MIRROR_TABLES = [
  'locations', 'divisions', 'groups', 'departments', 
  'categories', 'classes', 'designations', 'org_hierarchy', 
  'employment_types', 'employee_statuses', 'holidays', 'salary_heads',
  'company_config', 'banks', 'pincode_master', 'salary_slabs', 'shifts', 'weekly_off', 'working_day_types'
];

// Helper for sync salary heads (Removed in favor of unified MIRROR_TABLES logic)

export const masterCrud: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const rawTableName = args.table_name || args.tableName;
  // Normalize table name to lowercase
  const table_name = String(rawTableName || '').toLowerCase();
  
  if (!CRUD_TABLE_WHITELIST.includes(table_name)) {
    return res.status(403).json({ error: `Access denied. Unauthorized table: ${table_name}` });
  }

  // Normalize module type
  const module_type = String(args.module_type || args.moduleType || 'K').toUpperCase();
  const { operation, data, id, filters } = args;
  const db = module_type === 'P' ? statutoryDb : primaryDb;
  
  if (operation === 'list') {
    let sql = `SELECT * FROM ${table_name}`;
    if (table_name === 'employees') {
      const type = module_type === 'P' ? 'STATUTORY' : 'WAGE';
      const rateCol = module_type === 'P' ? 'statutory_wage_amount' : 'wage_amount';
      sql = `
        SELECT e.*, 
          COALESCE(
            (SELECT amount FROM salary_rate_history h 
             WHERE h.emp_id = e.id AND h.type = '${type}' 
             ORDER BY h.effective_date DESC, h.created_at DESC LIMIT 1),
            e.${rateCol}
          ) as ${rateCol},
          COALESCE(
            (SELECT effective_date FROM salary_rate_history h 
             WHERE h.emp_id = e.id AND h.type = '${type}' 
             ORDER BY h.effective_date DESC, h.created_at DESC LIMIT 1),
            e.wage_effective_from
          ) as wage_effective_from
        FROM employees e
      `;
    }
    const params: any[] = [];
    const skipFilters = ['groups', 'departments'].includes(table_name);
    if (filters && Object.keys(filters).length > 0 && !skipFilters) {
      const snakeFilters = mapKeys(filters, toSnakeCase);
      sql += ' WHERE ' + Object.keys(snakeFilters).map(k => `${k} = ?`).join(' AND ');
      params.push(...Object.values(snakeFilters));
    }
    
    // Task 2: Pagination (Shield)
    const limit = parseInt(String(args.limit || 50));
    const offset = parseInt(String(args.offset || 0));
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    let rows = db.prepare(sql).all(...params) as any[];

    const sharedMasters = ['groups', 'departments', 'designations', 'org_hierarchy', 'classes', 'categories', 'employment_types', 'employee_statuses'];
    if (module_type === 'P' && rows.length === 0 && sharedMasters.includes(table_name)) {
      rows = primaryDb.prepare(`SELECT * FROM ${table_name}`).all();
    }

    const parsedRows = rows.map((row: any) => {
      const jsonFields = ['components', 'slabs', 'pf_history', 'bank_history', 'esi_history', 'family_members', 'employment_history', 'categories', 'classes', 'groups', 'departments', 'designations'];
      jsonFields.forEach(f => {
        if (row[f] && typeof row[f] === 'string' && (row[f].startsWith('{') || row[f].startsWith('['))) {
          try { row[f] = JSON.parse(row[f]); } catch (e) { logError(db, 'WARN', `Failed to parse JSON field ${f} for record ${row.id}`, e); }
        }
      });
      return row;
    });
    res.json(parsedRows);
  } else if (operation === 'get') {
    const queryId = id || args.id;
    const idColumn = table_name === 'settings' ? 'key' : 'id';
    let sql = `SELECT * FROM ${table_name} WHERE ${idColumn} = ?`;
    if (table_name === 'employees' && idColumn === 'id') {
      const type = module_type === 'P' ? 'STATUTORY' : 'WAGE';
      const rateCol = module_type === 'P' ? 'statutory_wage_amount' : 'wage_amount';
      sql = `
        SELECT e.*, 
          COALESCE(
            (SELECT amount FROM salary_rate_history h 
             WHERE h.emp_id = e.id AND h.type = '${type}' 
             ORDER BY h.effective_date DESC, h.created_at DESC LIMIT 1),
            e.${rateCol}
          ) as ${rateCol},
          COALESCE(
            (SELECT effective_date FROM salary_rate_history h 
             WHERE h.emp_id = e.id AND h.type = '${type}' 
             ORDER BY h.effective_date DESC, h.created_at DESC LIMIT 1),
            e.wage_effective_from
          ) as wage_effective_from
        FROM employees e
        WHERE e.id = ?
      `;
    }
    const row = db.prepare(sql).get(queryId) as any;
    if (row) {
      if (row.value && typeof row.value === 'string' && (row.value.startsWith('{') || row.value.startsWith('['))) {
        try { row.value = JSON.parse(row.value); } catch (e) { logError(db, 'WARN', `Failed to parse value for setting ${queryId}`, e); }
      }
      res.json(row);
    } else {
      res.status(404).json({ error: 'Record not found' });
    }
  } else if (operation === 'create') {
    let processedData: any;
    try {
      if (table_name === 'employees') {
        const camelData = mapKeys(data, toCamelCase);
        if (!camelData.empCode && (camelData.employeeCode || camelData['employee code'])) {
          camelData.empCode = camelData.employeeCode || camelData['employee code'];
        }
        processedData = Mapper.employee.toPersistence(EmployeeSchema.parse(camelData));
      } else if (table_name === 'salary_heads') {
        processedData = Mapper.salaryHead.toPersistence(SalaryHeadSchema.parse(mapKeys(data, toCamelCase)));
      } else {
        processedData = mapKeys(data, toSnakeCase);
      }

      // Sanitize status field if present
      if (processedData.status !== undefined && processedData.status !== null) {
        let s = processedData.status;
        if (typeof s === 'string') {
          s = (s.toLowerCase() === 'active' || s === '1') ? 1 : 0;
        } else if (typeof s === 'boolean') {
          s = s ? 1 : 0;
        } else {
          s = s ? 1 : 0;
        }
        processedData.status = s;
      }
    } catch (valErr: any) {
      const details = valErr.errors ? valErr.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') : valErr.message;
      return res.status(400).json({ error: 'Input validation failed', details });
    }

    if (table_name === 'salary_heads' && processedData.system_head) {
      const restricted = ['PROVIDENT_FUND', 'ESI', 'PROFESSIONAL_TAX', 'LABOUR_WELFARE_FUND', 'INCOME_TAX_TDS'];
      if (restricted.includes(processedData.system_head)) {
        const existing = db.prepare('SELECT id FROM salary_heads WHERE system_head = ?').get(processedData.system_head);
        if (existing) {
          return res.status(400).json({ error: `Only one salary head is allowed for system head: ${processedData.system_head}` });
        }
      }
    }

    const columnsInfo = db.prepare(`PRAGMA table_info(${table_name})`).all() as any[];
    const validColumns = columnsInfo.map(c => c.name);
    const filteredData: any = {};
    for (const key of Object.keys(processedData)) {
      if (validColumns.includes(key) && key !== 'id') filteredData[key] = processedData[key];
    }
    processedData = filteredData;

    const keys = Object.keys(processedData);
    const sql = `INSERT INTO ${table_name} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    try {
      const result = db.prepare(sql).run(...keys.map(k => sanitizeData(processedData[k])));
      
      if (module_type === 'K' && MIRROR_TABLES.includes(table_name) && isKConnected(primaryDb)) {
        try {
          if (['salary_heads', 'shifts', 'weekly_off', 'working_day_types'].includes(table_name)) {
            const allocationType = processedData.allocation_type || processedData.allocationType;
            const identifierField = ['weekly_off'].includes(table_name) ? 'day' : 'name';
            if (allocationType === 'K_ONLY') {
              // Explicitly delete from Statutory to ensure it's not there
              statutoryDb.prepare(`DELETE FROM ${table_name} WHERE ${identifierField} = ?`).run(processedData[identifierField]);
            } else if (allocationType) {
              // Sync to Statutory
              const newId = result.lastInsertRowid;
              const mirrorData = { ...processedData, id: newId };
              const mKeys = Object.keys(mirrorData);
              const mirrorSql = `INSERT OR REPLACE INTO ${table_name} (${mKeys.join(', ')}) VALUES (${mKeys.map(() => '?').join(', ')})`;
              statutoryDb.prepare(mirrorSql).run(...mKeys.map(k => sanitizeData(mirrorData[k])));
            }
          } else {
            const newId = result.lastInsertRowid;
            const mirrorData = { ...processedData, id: newId };
            const mKeys = Object.keys(mirrorData);
            const mirrorSql = `INSERT OR REPLACE INTO ${table_name} (${mKeys.join(', ')}) VALUES (${mKeys.map(() => '?').join(', ')})`;
            statutoryDb.prepare(mirrorSql).run(...mKeys.map(k => sanitizeData(mirrorData[k])));
          }
        } catch (mirrorErr) {
          logError(statutoryDb, 'WARN', `[Mirror Sync] Failed to mirror 'create' for ${table_name} to Statutory`, mirrorErr);
        }
      }
      
      res.json({ status: 'success' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  } else if (operation === 'update') {
    let processedData: any;
    try {
      if (table_name === 'employees') {
        const camelData = mapKeys(data, toCamelCase);
        if (!camelData.empCode && (camelData.employeeCode || camelData['employee code'])) {
          camelData.empCode = camelData.employeeCode || camelData['employee code'];
        }
        processedData = Mapper.employee.toPersistence(EmployeeSchema.partial().parse(camelData) as any);
      } else if (table_name === 'salary_heads') {
        processedData = Mapper.salaryHead.toPersistence(SalaryHeadSchema.partial().parse(mapKeys(data, toCamelCase)) as any);
      } else {
        processedData = mapKeys(data, toSnakeCase);
      }

      // Sanitize status field if present
      if (processedData.status !== undefined && processedData.status !== null) {
        let s = processedData.status;
        if (typeof s === 'string') {
          s = (s.toLowerCase() === 'active' || s === '1') ? 1 : 0;
        } else if (typeof s === 'boolean') {
          s = s ? 1 : 0;
        } else {
          s = s ? 1 : 0;
        }
        processedData.status = s;
      }
    } catch (valErr: any) {
      const details = valErr.errors ? valErr.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') : valErr.message;
      return res.status(400).json({ error: 'Input validation failed', details });
    }

    if (table_name === 'salary_heads' && processedData.system_head) {
      const restricted = ['PROVIDENT_FUND', 'ESI', 'PROFESSIONAL_TAX', 'LABOUR_WELFARE_FUND', 'INCOME_TAX_TDS'];
      if (restricted.includes(processedData.system_head)) {
        const existing = db.prepare('SELECT id FROM salary_heads WHERE system_head = ? AND id != ?').get(processedData.system_head, id);
        if (existing) {
          return res.status(400).json({ error: `Only one salary head is allowed for system head: ${processedData.system_head}` });
        }
      }
    }

    const keys = Object.keys(processedData).filter(k => k !== 'id');
    const sql = `UPDATE ${table_name} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
    try {
      db.prepare(sql).run(...keys.map(k => sanitizeData(processedData[k])), id);
      
      if (module_type === 'K' && MIRROR_TABLES.includes(table_name)) {
        try {
          if (['salary_heads', 'shifts', 'weekly_off', 'working_day_types'].includes(table_name)) {
            const allocationType = processedData.allocation_type || processedData.allocationType;
            const identifierField = ['weekly_off'].includes(table_name) ? 'day' : 'name';
            const entityName = processedData[identifierField] || primaryDb.prepare(`SELECT ${identifierField} FROM ${table_name} WHERE id = ?`).get(id)?.[identifierField];
            
            if (allocationType === 'K_ONLY') {
              if (entityName) statutoryDb.prepare(`DELETE FROM ${table_name} WHERE ${identifierField} = ?`).run(entityName);
            } else {
              // We need to sync. If we have the full record, it's better.
              // But since we are inside UPDATE, 'processedData' might be partial.
              // Master sync logic usually handles partial updates by using identical SQL.
              statutoryDb.prepare(sql).run(...keys.map(k => sanitizeData(processedData[k])), id);
            }
          } else {
            statutoryDb.prepare(sql).run(...keys.map(k => sanitizeData(processedData[k])), id);
          }
        } catch (mirrorErr) {
          logError(statutoryDb, 'WARN', `[Mirror Sync] Failed to mirror 'update' for ${table_name} to Statutory`, mirrorErr);
        }
      }
      
      res.json({ status: 'success' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  } else if (operation === 'delete') {
    db.prepare(`DELETE FROM ${table_name} WHERE id = ?`).run(id);

    if (module_type === 'K' && MIRROR_TABLES.includes(table_name)) {
      try {
        statutoryDb.prepare(`DELETE FROM ${table_name} WHERE id = ?`).run(id);
      } catch (mirrorErr) {
        logError(statutoryDb, 'WARN', `[Mirror Sync] Failed to mirror 'delete' for ${table_name} to Statutory`, mirrorErr);
      }
    }

    res.json({ status: 'success' });
  }
};

export const transactionCrud: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const rawTableName = args.table_name || args.tableName;
  const table_name = String(rawTableName);
  
  if (!CRUD_TABLE_WHITELIST.includes(table_name)) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const module_type = args.module_type || args.moduleType || 'K';
  const { operation, data, id, filters } = args;
  const db = module_type === 'P' ? statutoryDb : primaryDb;

  if (operation === 'list') {
    let sql = `SELECT * FROM ${table_name}`;
    const params: any[] = [];
    if (filters && Object.keys(filters).length > 0) {
      const snakeFilters = mapKeys(filters, toSnakeCase);
      sql += ' WHERE ' + Object.keys(snakeFilters).map(k => `${k} = ?`).join(' AND ');
      params.push(...Object.values(snakeFilters));
    }
    
    // Task 2: Pagination (Shield)
    const limit = parseInt(String(args.limit || 50));
    const offset = parseInt(String(args.offset || 0));
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } else if (operation === 'create') {
    const snakeData = mapKeys(data, toSnakeCase);
    
    // Sanitize status field if present
    if (snakeData.status !== undefined && snakeData.status !== null) {
      let s = snakeData.status;
      if (typeof s === 'string') {
        s = (s.toLowerCase() === 'active' || s === '1') ? 1 : 0;
      } else if (typeof s === 'boolean') {
        s = s ? 1 : 0;
      } else {
        s = s ? 1 : 0;
      }
      snakeData.status = s;
    }

    const keys = Object.keys(snakeData);
    const sql = `INSERT INTO ${table_name} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    db.prepare(sql).run(...keys.map(k => sanitizeData(snakeData[k])));
    res.json({ status: 'success' });
  } else if (operation === 'update') {
    const snakeData = mapKeys(data, toSnakeCase);
    
    // Sanitize status field if present
    if (snakeData.status !== undefined && snakeData.status !== null) {
      let s = snakeData.status;
      if (typeof s === 'string') {
        s = (s.toLowerCase() === 'active' || s === '1') ? 1 : 0;
      } else if (typeof s === 'boolean') {
        s = s ? 1 : 0;
      } else {
        s = s ? 1 : 0;
      }
      snakeData.status = s;
    }

    const keys = Object.keys(snakeData).filter(k => k !== 'id');
    const sql = `UPDATE ${table_name} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...keys.map(k => sanitizeData(snakeData[k])), id);
    res.json({ status: 'success' });
  } else if (operation === 'delete') {
    db.prepare(`DELETE FROM ${table_name} WHERE id = ?`).run(id);
    res.json({ status: 'success' });
  }
};

export const saveDailyMisBatch: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { date, entries } = args;
  
  if (!date || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    primaryDb.transaction(() => {
      const stmt = primaryDb.prepare(`
        INSERT INTO daily_mis_entries (
          date, emp_id, emp_code, name, master_designation, current_designation, standard_rate, worked_rate, variance, attendance_qty
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, emp_id) DO UPDATE SET
          current_designation = excluded.current_designation,
          standard_rate = excluded.standard_rate,
          worked_rate = excluded.worked_rate,
          variance = excluded.variance,
          attendance_qty = excluded.attendance_qty
      `);

      for (const entry of entries) {
        if (!entry.emp_id) continue;
        stmt.run(
          date,
          entry.emp_id,
          entry.emp_code || '',
          entry.name || '',
          entry.master_designation || '',
          entry.current_designation || '',
          entry.standard_rate || 0,
          entry.worked_rate || 0,
          entry.variance || 0,
          entry.attendance_qty ?? 1
        );
      }
    })();
    
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTransactionHistory: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const module_type = String(args.module_type || args.moduleType || 'K').toUpperCase();
  const db = module_type === 'P' ? statutoryDb : primaryDb;

  const { targetModule, startDate, endDate, empId, departmentId, divisionId, locationId, groupId, classId, categoryId, designationId, batchId, limit, offset } = args;

  let tableName = '';
  if (targetModule === 'CANTEEN') tableName = 'canteen_punches';
  else if (targetModule === 'ROKDA') tableName = 'rokda_entries';
  else if (targetModule === 'MIS') tableName = 'mis_entries';
  else return res.status(400).json({ error: 'Invalid config' });

  let sql = `SELECT t.*, e.emp_code, e.name as emp_name 
             FROM ${tableName} t 
             LEFT JOIN employees e ON t.emp_id = e.id 
             WHERE 1=1`;
             
  if (targetModule === 'CANTEEN') {
    sql = `SELECT t.*, t.punch_time as date, e.emp_code, e.name as emp_name 
           FROM ${tableName} t 
           LEFT JOIN employees e ON t.emp_id = e.id 
           WHERE 1=1`;
  }
             
  const params: any[] = [];
  const countParams: any[] = [];
  let whereClauses = "";

  const dateField = targetModule === 'CANTEEN' ? 't.punch_time' : 't.date';
  
  if (startDate) {
    whereClauses += ` AND date(${dateField}) >= date(?)`;
    params.push(startDate);
    countParams.push(startDate);
  }
  if (endDate) {
    whereClauses += ` AND date(${dateField}) <= date(?)`;
    params.push(endDate);
    countParams.push(endDate);
  }
  if (empId) {
    whereClauses += ` AND t.emp_id = ?`;
    params.push(empId);
    countParams.push(empId);
  }
  if (departmentId) {
    whereClauses += ` AND e.department_id = ?`;
    params.push(departmentId);
    countParams.push(departmentId);
  }
  if (divisionId) {
    whereClauses += ` AND e.division_id = ?`;
    params.push(divisionId);
    countParams.push(divisionId);
  }
  if (locationId) {
    whereClauses += ` AND e.location_id = ?`;
    params.push(locationId);
    countParams.push(locationId);
  }
  if (groupId) {
    whereClauses += ` AND e.group_id = ?`;
    params.push(groupId);
    countParams.push(groupId);
  }
  if (classId) {
    whereClauses += ` AND e.class_id = ?`;
    params.push(classId);
    countParams.push(classId);
  }
  if (categoryId) {
    whereClauses += ` AND e.category_id = ?`;
    params.push(categoryId);
    countParams.push(categoryId);
  }
  if (designationId) {
    whereClauses += ` AND e.designation_id = ?`;
    params.push(designationId);
    countParams.push(designationId);
  }
  if (batchId) {
    whereClauses += ` AND t.batch_id LIKE ?`;
    params.push(`%${batchId}%`);
    countParams.push(`%${batchId}%`);
  }
  
  sql += whereClauses;
  sql += ` ORDER BY t.id DESC LIMIT ? OFFSET ?`;
  params.push(limit || 100, offset || 0);

  try {
    const data = db.prepare(sql).all(...params);
    
    // Get total count
    let countSql = `SELECT COUNT(*) as total 
                    FROM ${tableName} t
                    LEFT JOIN employees e ON t.emp_id = e.id 
                    WHERE 1=1`;
                    
    countSql += whereClauses;
    const totalRow = db.prepare(countSql).get(...countParams) as { total: number };
    
    res.json({ data, total: totalRow.total });
  } catch (err: any) {
    logError(db, 'ERROR', 'Could not get transaction history', err);
    res.status(500).json({ error: err.message });
  }
};

export const updateTransaction: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const module_type = String(args.module_type || args.moduleType || 'K').toUpperCase();
  const db = module_type === 'P' ? statutoryDb : primaryDb;

  const { targetModule, id, updateData } = args;

  let tableName = '';
  if (targetModule === 'CANTEEN') tableName = 'canteen_punches';
  else if (targetModule === 'ROKDA') tableName = 'rokda_entries';
  else if (targetModule === 'MIS') tableName = 'mis_entries';
  else return res.status(400).json({ error: 'Invalid config' });

  // Check payroll_lock before modifying!
  // Find date for transaction
  const row = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  const dateStr = targetModule === 'CANTEEN' ? row.punch_time : row.date;
  if (dateStr) {
     const [year, month] = dateStr.split('-');
     const mmYear = `${month}-${year}`;
     const lock = db.prepare(`SELECT status FROM payroll_lock WHERE month_year = ?`).get(mmYear) as any;
     if (lock && lock.status === 'FINALIZED') {
        return res.status(403).json({ error: `Cannot modify: ${mmYear} is finalized.` });
     }
  }

  // Generate update sets
  const setParts = [];
  const values = [];
  for (const key of Object.keys(updateData)) {
     setParts.push(`${key} = ?`);
     values.push(updateData[key]);
  }
  
  if (setParts.length === 0) return res.json({ status: 'no changes' });
  
  setParts.push("modified_at = CURRENT_TIMESTAMP");
  values.push(id);

  try {
    const sql = `UPDATE ${tableName} SET ${setParts.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);
    res.json({ status: 'success' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const bulkDeleteTransactions: CommandHandler = (ctx, args) => {
  return ctx.res.status(403).json({ error: 'System Policy Violation: Bulk deletion is strictly prohibited for transaction records.' });
};

export const saveTransactionEntry: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  try {
             // Keep logic limited to Module K only
             const db = primaryDb;
             const payload = args.payload;
             
             if (!payload) {
               return res.status(400).json({ error: "Payload missing" });
             }
             if (!payload.transaction_type) {
               return res.status(400).json({ error: "Invalid transaction type" });
             }
             if (!payload.amount || isNaN(parseFloat(payload.amount))) {
               return res.status(400).json({ error: "Invalid amount" });
             }

             // Handle either emp_id + head_id OR emp_code + head_name (bulk upload case)
             let finalEmpId = payload.emp_id;
             let finalHeadId = payload.head_id;
             const empCode = payload.emp_code;
             const headName = payload.head_name;

             if (!finalEmpId && empCode) {
                const emp = db.prepare('SELECT id FROM employees WHERE emp_code = ?').get(empCode) as any;
                if (!emp) return res.status(400).json({ error: `Employee not found: ${empCode}` });
                finalEmpId = emp.id;
             }
             if (!finalHeadId && headName) {
                const head = db.prepare('SELECT id FROM salary_heads WHERE name = ?').get(headName) as any;
                if (!head) return res.status(400).json({ error: `Salary head not found: ${headName}` });
                finalHeadId = head.id;
             }

             const dateStr = payload.date || new Date().toISOString().split('T')[0];
             const monthYearStr = payload.salary_month_year || `${dateStr.substring(5,7)}-${dateStr.substring(0,4)}`;

             if (payload.id) {
               db.prepare(`
                 UPDATE salary_transactions SET
                   transaction_type = ?, date = ?, salary_month_year = ?, emp_id = ?, head_id = ?, amount = ?, reason = ?, remark = ?, authorised_by = ?, is_bulk_entry = ?
                 WHERE id = ?
               `).run(
                 payload.transaction_type,
                 dateStr,
                 monthYearStr,
                 finalEmpId,
                 finalHeadId,
                 payload.amount,
                 payload.reason || '',
                 payload.remark || '',
                 payload.authorised_by || null,
                 payload.is_bulk_entry || 0,
                 payload.id
               );
               syncEarningTransactionToP('update', payload.id as number, primaryDb, statutoryDb);
             } else {
               const result = db.prepare(`
                 INSERT INTO salary_transactions (
                   transaction_type, date, salary_month_year, emp_id, head_id, amount, reason, remark, authorised_by, is_bulk_entry
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               `).run(
                 payload.transaction_type,
                 dateStr,
                 monthYearStr,
                 finalEmpId,
                 finalHeadId,
                 payload.amount,
                 payload.reason || '',
                 payload.remark || '',
                 payload.authorised_by || null,
                 payload.is_bulk_entry || 0
               );
               syncEarningTransactionToP('create', result.lastInsertRowid as number, primaryDb, statutoryDb);
             }
            
             // Return Result<String, String> like format JSON-safe
             res.json("Transaction entry saved successfully");
          } catch (error: any) {
             console.error('[save_transaction_entry] Error:', error);
             res.status(500).json({ error: error.message });
          
}
};

export const getEarningHistory: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  try {
            const db = (args.moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
            let baseSql = `FROM salary_transactions st 
                           JOIN employees e ON st.emp_id = e.id 
                           JOIN salary_heads sh ON st.head_id = sh.id 
                           LEFT JOIN employees auth ON st.authorised_by = auth.id 
                           WHERE 1=1`;
            const params: any[] = [];
            
            if (args.transactionType) {
                baseSql += " AND st.transaction_type = ?";
                params.push(args.transactionType);
            }
            if (args.employeeId) {
                baseSql += " AND st.emp_id = ?";
                params.push(args.employeeId);
            }
            if (args.wageMonth && args.wageYear) {
                const formattedMonthYear = `${args.wageMonth.toString().padStart(2, '0')}-${args.wageYear}`;
                baseSql += " AND st.salary_month_year = ?";
                params.push(formattedMonthYear);
            } else if (args.fromDate && args.toDate) {
                baseSql += " AND st.date BETWEEN ? AND ?";
                params.push(args.fromDate);
                params.push(args.toDate);
            }
            
            // Get total count
            const countSql = `SELECT COUNT(*) as total ${baseSql}`;
            const countRow = db.prepare(countSql).get(...params) as any;
            const total = countRow ? countRow.total : 0;

            const limit = args.limit || 50;
            const page = args.page || 1;
            const offset = (page - 1) * limit;

            const dataSql = `SELECT st.*, COALESCE(e.name, NULLIF(trim(COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, '')), '')) as emp_name, e.emp_code, sh.name as head_name, sh.allocation_type, COALESCE(auth.name, NULLIF(trim(COALESCE(auth.first_name, '') || ' ' || COALESCE(auth.last_name, '')), '')) as authorizer_name 
                             ${baseSql} 
                             ORDER BY st.created_at DESC LIMIT ? OFFSET ?`;
            const rows = db.prepare(dataSql).all(...params, limit, offset);
            
            res.json({
              data: rows,
              total: total,
              page: page,
              limit: limit
            });
          } catch (error: any) {
             console.error('[get_earning_history] Error:', error);
             res.status(500).json({ error: error.message });
          
}
};

export const bulkUploadTransactions: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { records, transactionType, moduleType } = args;
            const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;

            const insert = db.prepare(`
                INSERT INTO salary_transactions (
                    transaction_type, date, salary_month_year, emp_id, head_id, amount, reason, authorised_by, remark, is_bulk_entry
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `);

            const findEmp = db.prepare("SELECT id FROM employees WHERE emp_code = ? OR name = ? LIMIT 1");
            const findHead = db.prepare("SELECT id FROM salary_heads WHERE name = ? LIMIT 1");
            const findAuth = db.prepare("SELECT id FROM employees WHERE name = ? LIMIT 1");

            const transaction = db.transaction((recs) => {
                for (const row of recs) {
                    const emp = findEmp.get(row.emp_code || row.EmployeeCode, row.emp_name || row.EmployeeName) as any;
                    const head = findHead.get(row.head_name || row.SalaryHead) as any;
                    const auth = findAuth.get(row.authorised_by_name || row.Authorizer) as any;

                    if (emp && head) {
                        const res = insert.run(
                            transactionType,
                            row.date || new Date().toISOString().split('T')[0],
                            row.salary_month_year || row.MonthYear,
                            emp.id,
                            head.id,
                            row.amount || 0,
                            row.reason || '',
                            auth ? auth.id : null,
                            row.remark || ''
                        );
                        if (db === primaryDb) {
                            syncEarningTransactionToP('create', res.lastInsertRowid as number, primaryDb, statutoryDb);
                        }
                    }
                }
            });

            try {
                transaction(records);
                res.json({ status: 'success' });
            } catch (error: any) {
                console.error('[bulk_upload_transactions] Error:', error);
                res.status(500).json({ error: error.message });
            
}
};

export const bulkInsertTransactions: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { payload, moduleType } = args;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;

          const insert = db.prepare(`
              INSERT INTO salary_transactions (
                  transaction_type, date, salary_month_year, emp_id, head_id, amount, reason, authorised_by, remark, is_bulk_entry
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `);

          let successCount = 0;
          let failedCount = 0;

          const transaction = db.transaction((recs: any[]) => {
              for (const row of recs) {
                  try {
                    let finalEmpId = row.emp_id;
                    let finalHeadId = row.head_id;
                    let finalAuthId = row.authorised_by;

                    if (!finalEmpId && row.emp_code) {
                        const emp = db.prepare('SELECT id FROM employees WHERE emp_code = ?').get(row.emp_code) as any;
                        if (emp) finalEmpId = emp.id;
                    }
                    if (!finalHeadId && row.head_name) {
                        const head = db.prepare("SELECT id FROM salary_heads WHERE name = ? LIMIT 1").get(row.head_name) as any;
                        if (head) finalHeadId = head.id;
                    }
                    if (!finalAuthId && row.authorised_by_name) {
                        const auth = db.prepare("SELECT id FROM employees WHERE name = ? LIMIT 1").get(row.authorised_by_name) as any;
                        if (auth) finalAuthId = auth.id;
                    }

                    if (finalEmpId && finalHeadId) {
                        const res = insert.run(
                            row.transaction_type,
                            row.date || new Date().toISOString().split('T')[0],
                            row.salary_month_year,
                            finalEmpId,
                            finalHeadId,
                            row.amount || 0,
                            row.reason || '',
                            finalAuthId || null,
                            row.remark || ''
                        );
                        if (db === primaryDb) {
                            try {
                              syncEarningTransactionToP('create', res.lastInsertRowid as number, primaryDb, statutoryDb);
                            } catch (e) {
                              // ignore
                            }
                        }
                        successCount++;
                    } else {
                        failedCount++;
                    }
                  } catch (e) {
                      failedCount++;
                  }
              }
          });

          try {
              transaction(payload);
              res.json({ status: 'success', successCount, failedCount });
          } catch (error: any) {
              console.error('[bulk_insert_transactions] Error:', error);
              res.status(500).json({ error: error.message });
          
}
};

export const saveArrear: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { data, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          const keys = Object.keys(data);
          const sql = `INSERT INTO arrears (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
          db.prepare(sql).run(...keys.map(k => sanitizeData(data[k])));
          res.json({ status: 'success' });
          
};

export const productionEntryCrud: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { operation, id, data, page, limit, search, emp_id, head_id, quantity, date } = args;
          const { ProductionEntryService } = require('./domains/transactions/production-entry/service');
          const service = new ProductionEntryService(primaryDb);
          
          if (operation === 'list') {
            const result = service.getList(parseInt(page || '1'), parseInt(limit || '50'), search || '');
            res.json({ success: true, ...result });
          } else if (operation === 'get') {
            const result = service.getById(id);
            if (!result) return res.status(404).json({ success: false, error: 'Not found' });
            res.json({ success: true, data: result });
          } else if (operation === 'create') {
            const resultId = service.create(data, req.headers['x-user-id'] || 'SYSTEM');
            res.json({ success: true, id: resultId });
          } else if (operation === 'update') {
            service.update(id, data, req.headers['x-user-id'] || 'SYSTEM');
            res.json({ success: true });
          } else if (operation === 'update_status') {
            service.updateStatus(id, data.status, req.headers['x-user-id'] || 'SYSTEM');
            res.json({ success: true });
          } else if (operation === 'delete') {
            service.delete(id);
            res.json({ success: true });
          } else if (operation === 'config_details') {
            const result = service.getHeadsForEmployee(Number(emp_id));
            res.json({ success: true, data: result });
          } else if (operation === 'calculate_rate') {
            const result = service.calculateRate(head_id, Number(quantity), date);
            res.json({ success: true, data: result });
          
}
};

export const pieceRateCrud: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const db = primaryDb; // Assuming K module for Piece Rates initially
  const { operation, data, id, page = 1, limit = 50, search = '' } = args;

  try {
    if (operation === 'list') {
      let sql = 'SELECT * FROM piece_rates';
      let countSql = 'SELECT COUNT(*) as total FROM piece_rates';
      const params: any[] = [];
      const countParams: any[] = [];

      if (search) {
        const searchCondition = ' WHERE item_name LIKE ? OR department LIKE ?';
        const searchPattern = `%${search}%`;
        sql += searchCondition;
        countSql += searchCondition;
        params.push(searchPattern, searchPattern);
        countParams.push(searchPattern, searchPattern);
      }

      const offset = (Math.max(1, page as number) - 1) * (limit as number);
      sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const records = db.prepare(sql).all(...params);
      const { total } = db.prepare(countSql).get(...countParams) as any;

      res.json({ data: records, total });
    } else if (operation === 'create') {
      const keys = Object.keys(data);
      const sql = `INSERT INTO piece_rates (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
      db.prepare(sql).run(...keys.map(k => data[k]));
      res.json({ status: 'success' });
    } else if (operation === 'update') {
      const keys = Object.keys(data).filter(k => k !== 'id');
      const sql = `UPDATE piece_rates SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
      db.prepare(sql).run(...keys.map(k => data[k]), id);
      res.json({ status: 'success' });
    } else if (operation === 'delete') {
      db.prepare('DELETE FROM piece_rates WHERE id = ?').run(id);
      res.json({ status: 'success' });
    } else {
      res.status(400).json({ error: 'Unknown operation' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
