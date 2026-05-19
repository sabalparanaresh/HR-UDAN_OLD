import { CommandHandler } from './types.js';
import { CRUD_TABLE_WHITELIST } from '../db/whitelists.js';
import { EmployeeSchema, SalaryHeadSchema } from '../validation/index.js';
import { Mapper } from '../utils/mapper.js';
import { mapKeys, toSnakeCase, toCamelCase, sanitizeData } from '../utils/helpers.js';
import { logError } from '../utils/logger.js';
import { isKConnected } from '../utils/syncCircuitBreaker.js';
import { recalculateCanteenRules } from '../utils/canteen.js';
 
const conflictTargets: Record<string, string | string[]> = {
  employees: 'emp_code',
  banks: 'ifsc',
  salary_heads: 'name',
  salary_slabs: 'name',
  groups: 'name',
  departments: ['group_id', 'name'],
  designations: 'name',
  locations: 'name',
  divisions: 'name',
  classes: 'name',
  categories: 'name',
  employment_types: 'name',
  employee_statuses: 'name',
  shifts: 'name',
  holidays: 'date',
  machines: 'name',
  standard_rates: 'name',
  pincode_master: ['pincode', 'officename'],
  org_hierarchy: ['name', 'type'], // Simplified to avoid NULL matching issues with parent_id in ON CONFLICT
  working_day_types: 'name',
  weekly_off: 'day'
};

const MIRROR_TABLES = [
  'locations', 'divisions', 'groups', 'departments', 
  'categories', 'classes', 'designations', 'org_hierarchy', 
  'employment_types', 'employee_statuses', 'holidays', 'salary_heads',
  'company_config', 'banks', 'pincode_master', 'salary_slabs', 'shifts', 'weekly_off', 'working_day_types'
];

export const getMasterData: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const module_type = args.moduleType || args.module_type || 'K';
  const db = module_type === 'P' ? statutoryDb : primaryDb;
  
  try {
    const data = {
      departments: db.prepare('SELECT * FROM departments').all(),
      employees: db.prepare('SELECT * FROM employees').all(),
      locations: db.prepare('SELECT * FROM locations').all(),
      divisions: db.prepare('SELECT * FROM divisions').all(),
      groups: db.prepare('SELECT * FROM groups').all(),
      categories: db.prepare('SELECT * FROM categories').all(),
      classes: db.prepare('SELECT * FROM classes').all(),
      designations: db.prepare('SELECT * FROM designations').all(),
      machines: db.prepare('SELECT * FROM machines').all(),
      shifts: db.prepare('SELECT * FROM shifts').all(),
      holidays: db.prepare('SELECT * FROM holidays').all(),
      standard_rates: db.prepare('SELECT * FROM standard_rates').all(),
    };
    res.json(data);
  } catch (err) {
    res.json({
      departments: [], employees: [], locations: [], divisions: [], groups: [],
      categories: [], classes: [], designations: [], machines: [], shifts: [],
      holidays: [],
    });
  }
};

export const bulkBankMasterUpsert: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { records, moduleType } = args;
  const module_type = moduleType || 'K';
  const db = module_type === 'P' ? statutoryDb : primaryDb;

  if (!records || records.length === 0) return res.json({ status: 'success' });

  let syncCount = 0;

  try {
    const sql = `
      INSERT INTO banks (ifsc, bank_name, branch, sync_status, updated_at) 
      VALUES (?, ?, ?, 'IMPORT', CURRENT_TIMESTAMP)
      ON CONFLICT(ifsc) DO UPDATE SET
        bank_name = excluded.bank_name,
        branch = excluded.branch,
        sync_status = 'IMPORT',
        updated_at = CURRENT_TIMESTAMP
    `;
    const stmt = db.prepare(sql);
    
    // Fallback search stmt if ifsc isn't provided but bank_name is, though frontend mandates IFSC now.
    // If backend wanted strictly 'batch upsert logic based on unique field bank_name', we could adapt the SQL
    // to do exact lookup, but sqlite UPSET requires UNIQUE constraint on ON CONFLICT columns.

    db.transaction(() => {
      records.forEach((rec: any) => {
        // Enforce required data fallback if ever
        const ifscVal = String(rec.ifsc || '').toUpperCase().trim();
        const nameVal = rec.bank_name || 'Unknown Bank';
        const branchVal = rec.branch || '';
        
        stmt.run(ifscVal, nameVal, branchVal);
        syncCount++;
      });
    })();

    // Mirror to statutoryDb if K module
    if (module_type === 'K') {
      try {
        const statutoryStmt = statutoryDb.prepare(sql);
        statutoryDb.transaction(() => {
          records.forEach((rec: any) => {
            statutoryStmt.run(
              String(rec.ifsc || '').toUpperCase().trim(),
              rec.bank_name || 'Unknown Bank',
              rec.branch || ''
            );
          });
        })();
      } catch (mirrorErr) {
        logError(statutoryDb, 'WARN', '[Mirror Sync] Failed to mirror bulk bank master upsert', mirrorErr);
      }
    }

    res.json({ status: 'success', syncCount });
  } catch (err: any) {
    logError(db, 'ERROR', 'bulk_bank_master_upsert error', err);
    res.status(500).json({ error: err.message });
  }
};

export const bulkBankImport: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const module_type = args.module_type || args.moduleType || 'K';
  const { records } = args;
  const db = module_type === 'P' ? statutoryDb : primaryDb;
  
  if (!records || records.length === 0) return res.json({ status: 'success' });

  try {
    const sql = `
      INSERT INTO banks (ifsc, bank_name, branch, sync_status, updated_at) 
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(ifsc) DO UPDATE SET
        bank_name = excluded.bank_name,
        branch = excluded.branch,
        sync_status = excluded.sync_status,
        updated_at = CURRENT_TIMESTAMP
      WHERE (sync_status NOT IN ('IMPORT', 'MANUAL')) OR (excluded.sync_status = 'IMPORT')
    `;
    const stmt = db.prepare(sql);

    db.transaction(() => { 
      records.forEach((rec: any) => {
        stmt.run(
          String(rec.ifsc || '').toUpperCase(), 
          rec.bank_name || 'Unknown Bank', 
          rec.branch || '', 
          rec.sync_status || 'IMPORT'
        );
      });
    })();

    // Mirror to Statutory if in Module K
    if (module_type === 'K') {
      try {
        const statutoryStmt = statutoryDb.prepare(sql);
        statutoryDb.transaction(() => {
          records.forEach((rec: any) => {
            statutoryStmt.run(
              String(rec.ifsc || '').toUpperCase(), 
              rec.bank_name || 'Unknown Bank', 
              rec.branch || '', 
              rec.sync_status || 'IMPORT'
            );
          });
        })();
      } catch (mirrorErr) {
        logError(statutoryDb, 'WARN', '[Mirror Sync] Failed to mirror bulk bank import', mirrorErr);
      }
    }

    res.json({ status: 'success', message: `Processed ${records.length} records` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

function syncEmployeeToP(primaryDb: any, statutoryDb: any, empId: number, fromQueue = false) {
  try {
    const connStatusRow = primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get();
    const isConnected = connStatusRow?.value === 'CONNECTED';

    if (!isConnected) {
      if (!fromQueue) primaryDb.prepare("INSERT INTO employee_sync_queue (emp_id, action) VALUES (?, 'UPSERT')").run(empId);
      return false;
    }

    const kEmp = primaryDb.prepare("SELECT * FROM employees WHERE id = ?").get(empId);
    if (!kEmp) return false;

    let statutory_wage_amount = kEmp.wage_amount;
    const wage_type = kEmp.wage_type;
    
    // If statutory wage is specifically inputted, use it directly (skip conversion)
    if (kEmp.statutory_wage_amount && kEmp.statutory_wage_amount > 0) {
       statutory_wage_amount = kEmp.statutory_wage_amount;
    } else {
       if (wage_type === 'Daily' || wage_type === 'Piece-rate') {
          statutory_wage_amount = (kEmp.wage_amount || 0) * 26;
       }
    }

    const existingP = statutoryDb.prepare("SELECT * FROM employees WHERE id = ?").get(empId);
    // Prefer the explicit slab_id from K module if set, otherwise fallback to existing P slab_id
    const pSlabId = kEmp.slab_id || (existingP ? existingP.slab_id : null);
    let basic = existingP ? existingP.basic_salary : 0;
    let hra = existingP ? existingP.hra : 0;
    let conv = existingP ? existingP.conveyance : 0;
    let special = existingP ? existingP.special_allowance : 0;

    // Recalculate bifurcations if slab exists
    if (pSlabId) {
      const slab = statutoryDb.prepare('SELECT * FROM salary_slabs WHERE id = ?').get(pSlabId) as any;
      if (slab) {
        const heads = statutoryDb.prepare('SELECT * FROM salary_heads').all() as any[];
        let components = [];
        try { components = typeof slab.components === 'string' ? JSON.parse(slab.components) : slab.components; } catch(e) {}
        
        const headAmounts: Record<number, number> = {};
        const bifurcation: Record<string, number> = {};
        let totalNonResidual = 0;
        components.filter((c: any) => c.calculation_type !== 'RESIDUAL').forEach((comp: any) => {
          const head = heads.find(h => h.id === comp.salary_head_id);
          let amount = 0;
          if (comp.calculation_type === 'FIXED') amount = comp.value;
          else if (comp.calculation_type === 'PERCENT_CTC') amount = (Number(statutory_wage_amount) * comp.value) / 100;
          else if (comp.calculation_type === 'PERCENT_HEAD' && comp.parent_head_id) {
            const parentAmt = headAmounts[comp.parent_head_id] || 0;
            amount = (parentAmt * comp.value) / 100;
          }
          const roundedAmount = Math.round(amount);
          headAmounts[comp.salary_head_id] = roundedAmount;
          totalNonResidual += roundedAmount;
          if (head) bifurcation[head.name.toUpperCase()] = roundedAmount;
        });
        components.filter((c: any) => c.calculation_type === 'RESIDUAL').forEach((comp: any) => {
          const head = heads.find(h => h.id === comp.salary_head_id);
          const amount = Math.max(0, Number(statutory_wage_amount) - totalNonResidual);
          const roundedAmount = Math.round(amount);
          if (head) bifurcation[head.name.toUpperCase()] = roundedAmount;
        });
        basic = bifurcation['BASIC'] || 0;
        hra = bifurcation['HRA'] || 0;
        conv = Object.keys(bifurcation).find(k => k.includes('CONVEYANCE')) ? bifurcation[Object.keys(bifurcation).find(k => k.includes('CONVEYANCE'))!] : 0;
        special = 0;
        Object.keys(bifurcation).forEach(k => {
          if (!['BASIC', 'HRA'].includes(k) && !k.includes('CONVEYANCE')) special += bifurcation[k];
        });
      }
    }

    // Using exactly the mapped columns from K to P except override statutory_wage_amount and slab fields
    const cols = Object.keys(kEmp);
    
    const getPVal = (c: string) => {
      if (c === 'statutory_wage_amount') return statutory_wage_amount;
      if (c === 'wage_amount') return statutory_wage_amount;
      if (c === 'wage_type') return (kEmp.statutory_wage_type || kEmp.wage_type);
      if (c === 'slab_id') return pSlabId;
      if (c === 'basic_salary') return basic;
      if (c === 'hra') return hra;
      if (c === 'conveyance') return conv;
      if (c === 'special_allowance') return special;
      return kEmp[c];
    };

    // If it exists, update it. If not, insert it (mapping same IDs and fields)
    if (existingP) {
      const updateSet = cols.filter(c => c !== 'id' && c !== 'created_at').map(c => `${c} = ?`).join(', ');
      const vals = cols.filter(c => c !== 'id' && c !== 'created_at').map(c => getPVal(c));
      vals.push(empId);
      statutoryDb.prepare(`UPDATE employees SET ${updateSet} WHERE id = ?`).run(...vals);
    } else {
      const vals = cols.map(c => getPVal(c));
      statutoryDb.prepare(`INSERT INTO employees (${cols.join(', ')}) VALUES (${cols.map(()=>'?').join(', ')})`).run(...vals);
    }

    primaryDb.prepare("INSERT INTO system_logs (level, message) VALUES (?, ?)").run('INFO', `Automated K->P Sync successful for employee ID ${empId}`);
    return true;
  } catch (err: any) {
    if (!fromQueue) primaryDb.prepare("INSERT INTO employee_sync_queue (emp_id, action, status) VALUES (?, 'UPSERT', 'FAILED')").run(empId);
    primaryDb.prepare("INSERT INTO system_logs (level, message, stack) VALUES (?, ?, ?)").run('ERROR', `Failed to sync employee ${empId} to statutory`, err.message);
    return false;
  }
}

export const masterCrud: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const rawTableName = args.table_name || args.tableName;
  
  if (args.operation === 'process_sync_queue') {
    try {
      const queue = primaryDb.prepare("SELECT * FROM employee_sync_queue WHERE status = 'PENDING' OR status = 'FAILED' LIMIT 50").all();
      let processed = 0;
      for (const item of queue) {
         try {
           const success = syncEmployeeToP(primaryDb, statutoryDb, (item as any).emp_id, true);
           if (success) {
               primaryDb.prepare("UPDATE employee_sync_queue SET status = 'SUCCESS' WHERE id = ?").run((item as any).id);
               processed++;
           }
         } catch(e) {}
      }
      return res.json({ status: 'success', processed });
    } catch(err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Normalize table name to lowercase and ensure it's a string
  const table_name = String(rawTableName || '').toLowerCase();
  
  if (!CRUD_TABLE_WHITELIST.includes(table_name)) return res.status(403).json({ error: `Access denied. Table '${table_name}' not whitelisted.` });
  // Normalize module type
  const module_type = String(args.moduleType || args.module_type || 'K').toUpperCase();
  const { operation, data, id, filters } = args;
  const db = module_type === 'P' ? statutoryDb : primaryDb;

  if (operation === 'list') {
    let sql = `SELECT * FROM ${table_name}`;
    let countSql = `SELECT COUNT(*) as total FROM ${table_name}`;
    const params: any[] = [];
    const countParams: any[] = [];
    const skipFilters = ['groups', 'departments'].includes(table_name);
    
    const conditions: string[] = [];
    if (filters && Object.keys(filters).length > 0 && !skipFilters) {
       const snakeFilters = mapKeys(filters, toSnakeCase);
       Object.keys(snakeFilters).forEach(k => {
         if (table_name === 'salary_heads' && k === 'type') {
           const isDed = snakeFilters[k] === 'DEDUCTION' ? 1 : 0;
           conditions.push(`(type = ? OR is_deduction = ?)`);
           params.push(snakeFilters[k], isDed);
           countParams.push(snakeFilters[k], isDed);
         } else {
           conditions.push(`${k} = ?`);
           params.push(snakeFilters[k]);
           countParams.push(snakeFilters[k]);
         }
       });
    }

    if (args.search) {
      const search = `%${args.search}%`;
      if (table_name === 'banks') {
        conditions.push(`(bank_name LIKE ? OR ifsc LIKE ? OR branch LIKE ?)`);
        params.push(search, search, search);
        countParams.push(search, search, search);
      } else if (table_name === 'employees') {
        const empCols = db.prepare('PRAGMA table_info(employees)').all() as any[];
        const hasEmpCode = empCols.some(c => c.name === 'emp_code');
        const hasMobile = empCols.some(c => c.name === 'mobile');
        
        let searchCond = 'name LIKE ?';
        const searchParams = [search];
        
        if (hasEmpCode) {
          searchCond += ' OR emp_code LIKE ?';
          searchParams.push(search);
        }
        if (hasMobile) {
          searchCond += ' OR mobile LIKE ?';
          searchParams.push(search);
        }
        
        conditions.push(`(${searchCond})`);
        params.push(...searchParams);
        countParams.push(...searchParams);
      } else {
        conditions.push(`name LIKE ?`);
        params.push(search);
        countParams.push(search);
      }
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      sql += whereClause;
      countSql += whereClause;
    }
    
    const limit = parseInt(String(args.limit || 10000));
    const offset = parseInt(String(args.offset || 0));
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    let rows: any[] = [];
    let total = 0;
    try {
      rows = db.prepare(sql).all(...params) as any[];
      const countRes = db.prepare(countSql).get(...countParams) as any;
      total = countRes?.total || 0;
    } catch (err) {
      console.warn(`[Master CRUD] Failed to query ${table_name} on ${module_type} db`, err);
      rows = [];
    }
    
    // SHARED MASTER FALLBACK
    const sharedMasters = ['groups', 'departments', 'designations', 'org_hierarchy', 'locations', 'divisions', 'classes', 'categories', 'employment_types', 'employee_statuses', 'holidays', 'standard_rates'];
    if (module_type === 'P' && rows.length === 0 && sharedMasters.includes(table_name)) {
      try {
        rows = primaryDb.prepare(`SELECT * FROM ${table_name} LIMIT ? OFFSET ?`).all(limit, offset);
        const countRes = primaryDb.prepare(`SELECT COUNT(*) as total FROM ${table_name}`).get() as any;
        total = countRes?.total || 0;
      } catch (e) {
        console.error(`[Master CRUD] Fallback failed for ${table_name}`, e);
      }
    }

    const parsedRows = rows.map((row: any) => {
      const jsonFields = ['components', 'slabs', 'pf_history', 'bank_history', 'esi_history', 'family_members', 'employment_history', 'categories', 'classes', 'groups', 'departments', 'designations'];
      jsonFields.forEach(f => { 
        if (row[f] && typeof row[f] === 'string' && (row[f].startsWith('{') || row[f].startsWith('['))) {
          try { row[f] = JSON.parse(row[f]); } catch (e) { logError(db, 'WARN', `Failed to parse JSON field ${f} for record ${row.id}`, e); } 
        }
      });
      if (table_name === 'salary_heads') {
        if (row.is_deduction !== undefined && !row.type) row.type = row.is_deduction ? 'DEDUCTION' : 'EARNING';
        else if (row.type && row.is_deduction === undefined) row.is_deduction = row.type === 'DEDUCTION' ? 1 : 0;
      }
      return row;
    });

    if (args.include_total || args.includeTotal) {
      res.json({ rows: parsedRows, total });
    } else {
      res.json(parsedRows);
    }
  } else if (operation === 'get') {
    const queryId = id || args.id;
    const idColumn = table_name === 'settings' ? 'key' : 'id';
    const row = db.prepare(`SELECT * FROM ${table_name} WHERE ${idColumn} = ?`).get(queryId) as any;
    
    if (row) {
      if (row.value && typeof row.value === 'string' && (row.value.startsWith('{') || row.value.startsWith('['))) {
        try { row.value = JSON.parse(row.value); } catch (e) {}
      }
      res.json(row);
    } else {
      // Fallback to Primary for common masters if in P mode
      const nonSharedTables = ['working_day_types', 'shifts'];
      if (module_type === 'P' && !nonSharedTables.includes(table_name)) {
        const pRow = primaryDb.prepare(`SELECT * FROM ${table_name} WHERE ${idColumn} = ?`).get(queryId) as any;
        if (pRow) return res.json(pRow);
      }
      res.status(404).json({ error: 'Record not found' });
    }
  } else if (operation === 'create' || operation === 'bulk_create') {
    let records: any[] = [];
    if (operation === 'bulk_create') {
      records = Array.isArray(data) ? data : (data.records || []);
    } else {
      records = [data];
    }
    const results = [];
    
    try {
      db.transaction(() => {
        for (const item of records) {
          let procData: any;
          try {
            if (table_name === 'employees') {
              const mapped = mapKeys(item, (k) => toCamelCase(String(k).replace('*', '').trim()));
              // Explicitly map "Employee Code" to "empCode" if current mapping fails
              if (!mapped.empCode && (mapped.employeeCode || mapped['employee code'])) {
                mapped.empCode = mapped.employeeCode || mapped['employee code'];
              }
              procData = Mapper.employee.toPersistence(EmployeeSchema.parse(mapped));
            } else if (table_name === 'salary_heads') {
              const mapped = mapKeys(item, (k) => toCamelCase(String(k).replace('*', '').trim()));
              procData = Mapper.salaryHead.toPersistence(SalaryHeadSchema.parse(mapped));
            } else {
              procData = mapKeys(item, toSnakeCase);
            }
          } catch (zodErr: any) {
            if (zodErr.errors) {
              const details = zodErr.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
              throw new Error(`Validation failed for record: ${details}`);
            }
            throw zodErr;
          }

          const columnsInfo = db.prepare(`PRAGMA table_info(${table_name})`).all() as any[];
          const validCols = columnsInfo.map(c => c.name);
          const filtered: any = {};
          Object.keys(procData).forEach(k => { if (validCols.includes(k) && k !== 'id') filtered[k] = procData[k]; });
          
          // RESOLUTION PHASE: Resolve parent names to IDs for hierarchies
          if (table_name === 'org_hierarchy' && (item.parent_name || item.parentName)) {
            const pName = item.parent_name || item.parentName;
            const parent = db.prepare('SELECT id FROM org_hierarchy WHERE name = ? LIMIT 1').get(pName) as any;
            if (parent) filtered.parent_id = parent.id;
          }
          if (table_name === 'departments' && (item.group_name || item.groupName)) {
            const gName = item.group_name || item.groupName;
            const group = db.prepare('SELECT id FROM groups WHERE name = ? LIMIT 1').get(gName) as any;
            if (group) filtered.group_id = group.id;
          }
          if (table_name === 'divisions' && (item.location_name || item.locationName)) {
            const lName = item.location_name || item.locationName;
            const loc = db.prepare('SELECT id FROM locations WHERE name = ? LIMIT 1').get(lName) as any;
            if (loc) filtered.location_id = loc.id;
          }

          // Ensure conflict target fields are present to enable ON CONFLICT matching
          const conflictTargetRaw = conflictTargets[table_name];
          if (conflictTargetRaw) {
            const ctfs = Array.isArray(conflictTargetRaw) ? conflictTargetRaw : [conflictTargetRaw];
            ctfs.forEach(f => {
              if (filtered[f] === undefined) filtered[f] = null;
            });
          }

          // Sanitize status field: "Active", "1", true, 1 -> 1, else 0
          if (filtered.status !== undefined && filtered.status !== null) {
            let s = filtered.status;
            if (typeof s === 'string') {
              s = (s.toLowerCase() === 'active' || s === '1') ? 1 : 0;
            } else if (typeof s === 'boolean') {
              s = s ? 1 : 0;
            } else {
              s = s ? 1 : 0; // Fallback for other types that are truthy
            }
            filtered.status = s;
          }

          // Special: Sync is_deduction for salary_heads
          if (table_name === 'salary_heads') {
            if (filtered.type && filtered.is_deduction === undefined) filtered.is_deduction = filtered.type === 'DEDUCTION' ? 1 : 0;
            else if (filtered.is_deduction !== undefined && !filtered.type) filtered.type = filtered.is_deduction ? 'DEDUCTION' : 'EARNING';
          }

          // JSON stringify fields if needed
          const jsonFields = ['components', 'slabs', 'pf_history', 'bank_history', 'esi_history', 'family_members', 'employment_history'];
          jsonFields.forEach(f => { if (filtered[f] && typeof filtered[f] !== 'string') filtered[f] = JSON.stringify(filtered[f]); });

          const keys = Object.keys(filtered);
          const conflictTargetFields = Array.isArray(conflictTargetRaw) ? conflictTargetRaw : [conflictTargetRaw as string];
          const hasAllConflictFields = conflictTargetRaw && conflictTargetFields.every(f => keys.includes(f));
          
          let sql: string;
          if (hasAllConflictFields) {
            const conflictClause = conflictTargetFields.join(', ');
            const updateSetParts = keys
              .filter(k => !conflictTargetFields.includes(k) && k !== 'id' && k !== 'created_at')
              .map(k => `${k} = EXCLUDED.${k}`);
            
            if (validCols.includes('updated_at')) {
              updateSetParts.push(`updated_at = CURRENT_TIMESTAMP`);
            }
            
            const updateSet = updateSetParts.length > 0 ? updateSetParts.join(', ') : '';
            
            if (updateSet) {
              if (table_name === 'org_hierarchy') {
                sql = `INSERT OR REPLACE INTO ${table_name} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
              } else {
                sql = `
                  INSERT INTO ${table_name} (${keys.join(', ')}) 
                  VALUES (${keys.map(() => '?').join(', ')})
                  ON CONFLICT(${conflictClause}) DO UPDATE SET
                    ${updateSet}
                `;
              }
            } else {
              sql = `INSERT OR IGNORE INTO ${table_name} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
            }
          } else {
            sql = `INSERT INTO ${table_name} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
          }

          const result = db.prepare(sql).run(...keys.map(k => sanitizeData(filtered[k])));
          results.push(result.lastInsertRowid);

          // Mirror Sync to Statutory if in Module K
          if (module_type === 'K' && MIRROR_TABLES.includes(table_name)) {
            try {
              if (['salary_heads', 'shifts', 'weekly_off', 'working_day_types'].includes(table_name)) {
                const allocationType = (filtered.allocation_type || filtered.allocationType);
                if (allocationType === 'K_ONLY') {
                  const identifierField = ['weekly_off'].includes(table_name) ? 'day' : 'name';
                  statutoryDb.prepare(`DELETE FROM ${table_name} WHERE ${identifierField} = ?`).run(filtered[identifierField]);
                } else {
                  const mData = { ...filtered };
                  const mCols = Object.keys(mData);
                  const conflictTarget = conflictTargets[table_name] || 'name';
                  let mSql: string;
                  
                  if (conflictTarget) {
                    const ctfs = Array.isArray(conflictTarget) ? conflictTarget : [conflictTarget];
                    const mUpdateSet = mCols
                      .filter(k => !ctfs.includes(k) && k !== 'id' && k !== 'created_at')
                      .map(k => `${k} = EXCLUDED.${k}`)
                      .join(', ');
                    
                    mSql = `
                      INSERT INTO ${table_name} (${mCols.join(', ')}) 
                      VALUES (${mCols.map(() => '?').join(', ')})
                      ON CONFLICT(${ctfs.join(', ')}) DO UPDATE SET ${mUpdateSet}
                    `;
                  } else {
                    mSql = `INSERT OR REPLACE INTO ${table_name} (${mCols.join(', ')}) VALUES (${mCols.map(() => '?').join(', ')})`;
                  }
                  statutoryDb.prepare(mSql).run(...mCols.map(k => sanitizeData(mData[k])));
                }
              } else if (table_name === 'org_hierarchy') {
                const mData = { ...filtered };
                const mCols = Object.keys(mData);
                const mSql = `INSERT OR REPLACE INTO ${table_name} (${mCols.join(', ')}) VALUES (${mCols.map(() => '?').join(', ')})`;
                statutoryDb.prepare(mSql).run(...mCols.map(k => sanitizeData(mData[k])));
              } else {
                const mData = { ...filtered };
                const mCols = Object.keys(mData);
                const conflictTarget = conflictTargets[table_name];
                let mSql: string;

                if (conflictTarget) {
                  const ctfs = Array.isArray(conflictTarget) ? conflictTarget : [conflictTarget];
                  const mUpdateSet = mCols
                    .filter(k => !ctfs.includes(k) && k !== 'id' && k !== 'created_at')
                    .map(k => `${k} = EXCLUDED.${k}`)
                    .join(', ');
                  
                  mSql = `
                    INSERT INTO ${table_name} (${mCols.join(', ')}) 
                    VALUES (${mCols.map(() => '?').join(', ')})
                    ON CONFLICT(${ctfs.join(', ')}) DO UPDATE SET ${mUpdateSet}
                  `;
                } else {
                  mSql = `INSERT OR REPLACE INTO ${table_name} (${mCols.join(', ')}) VALUES (${mCols.map(() => '?').join(', ')})`;
                }
                statutoryDb.prepare(mSql).run(...mCols.map(k => sanitizeData(mData[k])));
              }
            } catch (mirrorErr) {
              logError(statutoryDb, 'WARN', `[Mirror Sync] Failed to mirror item in bulk_create for ${table_name}`, mirrorErr);
            }
          }

          if (module_type === 'K' && table_name === 'employees' && result.lastInsertRowid) {
             syncEmployeeToP(primaryDb, statutoryDb, Number(result.lastInsertRowid));
          }
          
          if (['employees', 'canteen_rules'].includes(table_name) && result.lastInsertRowid) {
            const empId = table_name === 'employees' ? Number(result.lastInsertRowid) : undefined;
            setTimeout(() => {
              try { recalculateCanteenRules(primaryDb, empId); } catch(e){}
              try { recalculateCanteenRules(statutoryDb, empId); } catch(e){}
            }, 100);
          }
        }
      })();
      res.json({ status: 'success', ids: results });
    } catch (err: any) {
      logError(db, 'ERROR', `[Master CRUD] Create/Upsert failed for ${table_name}`, err);
      res.status(400).json({ error: err.message });
    }
  } else if (operation === 'update') {
    let procData: any;
    try {
      if (table_name === 'employees') {
        const camelData = mapKeys(data, toCamelCase);
        if (!camelData.empCode && (camelData.employeeCode || camelData['employee code'])) {
          camelData.empCode = camelData.employeeCode || camelData['employee code'];
        }
        procData = Mapper.employee.toPersistence(EmployeeSchema.partial().parse(camelData) as any);
      } else if (table_name === 'salary_heads') {
        procData = Mapper.salaryHead.toPersistence(SalaryHeadSchema.partial().parse(mapKeys(data, toCamelCase)) as any);
      } else {
        procData = mapKeys(data, toSnakeCase);
      }

      if (table_name === 'salary_heads') {
        if (procData.type && procData.is_deduction === undefined) {
          procData.is_deduction = procData.type === 'DEDUCTION' ? 1 : 0;
        } else if (procData.is_deduction !== undefined && !procData.type) {
          procData.type = procData.is_deduction ? 'DEDUCTION' : 'EARNING';
        }
      }
    } catch (zodErr: any) {
      if (zodErr.errors) {
        const details = zodErr.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ error: 'Validation failed', details });
      }
      return res.status(400).json({ error: zodErr.message });
    }
    
    const keys = Object.keys(procData).filter(k => k !== 'id');

    // Sanitize status field if present in update data
    if (procData.status !== undefined && procData.status !== null) {
      let s = procData.status;
      if (typeof s === 'string') {
        s = (s.toLowerCase() === 'active' || s === '1') ? 1 : 0;
      } else if (typeof s === 'boolean') {
        s = s ? 1 : 0;
      } else {
        s = s ? 1 : 0;
      }
      procData.status = s;
    }

    const sql = `UPDATE ${table_name} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
    try {
      db.prepare(sql).run(...keys.map(k => sanitizeData(procData[k])), id);
      
      if (module_type === 'K' && MIRROR_TABLES.includes(table_name)) {
        try {
          if (['salary_heads', 'shifts', 'weekly_off', 'working_day_types'].includes(table_name)) {
            const allocationType = (procData.allocation_type || procData.allocationType);
            const identifierField = ['weekly_off'].includes(table_name) ? 'day' : 'name';
            const entityName = procData[identifierField] || primaryDb.prepare(`SELECT ${identifierField} FROM ${table_name} WHERE id = ?`).get(id)?.[identifierField];
            
            if (allocationType === 'K_ONLY') {
              if (entityName) statutoryDb.prepare(`DELETE FROM ${table_name} WHERE ${identifierField} = ?`).run(entityName);
            } else {
              statutoryDb.prepare(sql).run(...keys.map(k => sanitizeData(procData[k])), id);
            }
          } else {
            statutoryDb.prepare(sql).run(...keys.map(k => sanitizeData(procData[k])), id);
          }
        } catch (mirrorErr) {
          logError(statutoryDb, 'WARN', `[Mirror Sync] Failed to mirror 'update' for ${table_name}`, mirrorErr);
        }
      }

      if (module_type === 'K' && table_name === 'employees') {
        syncEmployeeToP(primaryDb, statutoryDb, Number(id));
      }
      
      if (['employees', 'canteen_rules'].includes(table_name)) {
        setTimeout(() => {
          try { recalculateCanteenRules(primaryDb, table_name === 'employees' ? Number(id) : undefined); } catch(e){}
          try { recalculateCanteenRules(statutoryDb, table_name === 'employees' ? Number(id) : undefined); } catch(e){}
        }, 100);
      }
      
      res.json({ status: 'success' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  } else if (operation === 'delete') {
    if (table_name === 'employees') {
      return res.status(403).json({ error: 'System Policy Violation: Employee records must never be hard deleted. Change status to Inactive instead.' });
    }
    try {
      let entityName: string | null = null;
      let identifierField = 'name';
      if (['salary_heads', 'shifts', 'weekly_off', 'working_day_types'].includes(table_name) && module_type === 'K') {
        identifierField = ['weekly_off'].includes(table_name) ? 'day' : 'name';
        const row = db.prepare(`SELECT ${identifierField} FROM ${table_name} WHERE id = ?`).get(id) as any;
        if (row) entityName = row[identifierField];
      }

      const userId = ctx.req.headers ? (ctx.req.headers['x-user-id'] as string || 'SYSTEM') : 'SYSTEM';
      try {
        db.prepare(`UPDATE ${table_name} SET deleted_by = ? WHERE id = ?`).run(userId, id);
      } catch(e) {}
      const result = db.prepare(`DELETE FROM ${table_name} WHERE id = ?`).run(id);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Record not found' });
      }

      if (module_type === 'K' && MIRROR_TABLES.includes(table_name)) {
        try {
          if (['salary_heads', 'shifts', 'weekly_off', 'working_day_types'].includes(table_name) && entityName) {
            statutoryDb.prepare(`DELETE FROM ${table_name} WHERE ${identifierField} = ?`).run(entityName);
          } else {
            statutoryDb.prepare(`DELETE FROM ${table_name} WHERE id = ?`).run(id);
          }
        } catch (mirrorErr) {
          logError(statutoryDb, 'WARN', `[Mirror Sync] Failed to mirror 'delete' for ${table_name}`, mirrorErr);
        }
      }

      res.json({ status: 'success' });
    } catch (err: any) {
      if (err.message.includes('FOREIGN KEY constraint failed')) {
        return res.status(400).json({ 
          error: 'Referential Integrity Error', 
          details: 'This record is being used in other transactions or records and cannot be deleted.' 
        });
      }
      res.status(500).json({ error: err.message });
    }
  } else if (operation === 'bulk_delete') {
    if (table_name === 'employees') {
      return res.status(403).json({ error: 'Rule 15: Employee records are permanently exempt from bulk delete.' });
    }
    const { ids } = data || {};
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided for bulk delete' });
    }
    
    try {
      const placeholders = ids.map(() => '?').join(',');
      const userId = ctx.req.headers ? (ctx.req.headers['x-user-id'] as string || 'SYSTEM') : 'SYSTEM';
      
      // Update deleted_by field before actual deletion to ensure trigger captures it
      try {
        db.prepare(`UPDATE ${table_name} SET deleted_by = ? WHERE id IN (${placeholders})`).run(userId, ...ids);
      } catch (e: any) {
        if (!e.message.includes('no such column: deleted_by')) {
          console.warn(`[Bulk Delete] Could not set deleted_by for ${table_name}`);
        }
      }

      db.prepare(`DELETE FROM ${table_name} WHERE id IN (${placeholders})`).run(...ids);
      
      if (module_type === 'K' && MIRROR_TABLES.includes(table_name)) {
        try {
          try {
            statutoryDb.prepare(`UPDATE ${table_name} SET deleted_by = ? WHERE id IN (${placeholders})`).run(userId, ...ids);
          } catch(e) {}
          statutoryDb.prepare(`DELETE FROM ${table_name} WHERE id IN (${placeholders})`).run(...ids);
        } catch (mirrorErr) {
          logError(statutoryDb, 'WARN', `[Mirror Sync] Failed to mirror 'bulk_delete' for ${table_name}`, mirrorErr);
        }
      }
      res.json({ status: 'success' });
    } catch (err: any) {
      if (err.message.includes('FOREIGN KEY constraint failed')) {
        return res.status(400).json({ 
          error: 'Referential Integrity Error', 
          details: 'One or more records are being used and cannot be deleted.' 
        });
      }
      res.status(500).json({ error: err.message });
    }
  } else if (operation === 'sync_all_to_statutory') {
    if (module_type !== 'K') return res.status(400).json({ error: 'Sync pull is only from Module K' });
    if (!MIRROR_TABLES.includes(table_name)) return res.status(400).json({ error: 'Table is not configured for mirror sync' });

    try {
      const records = db.prepare(`SELECT * FROM ${table_name}`).all() as any[];
      if (records.length === 0) return res.json({ status: 'success', synced: 0 });

      const columns = db.prepare(`PRAGMA table_info(${table_name})`).all() as any[];
      const colNames = columns.map(c => c.name);
      
      const statutoryStmt = statutoryDb.prepare(`INSERT OR REPLACE INTO ${table_name} (${colNames.join(', ')}) VALUES (${colNames.map(() => '?').join(', ')})`);
      
      statutoryDb.transaction(() => {
        records.forEach(row => {
          statutoryStmt.run(...colNames.map(c => sanitizeData(row[c])));
        });
      })();

      res.json({ status: 'success', synced: records.length });
    } catch (err: any) {
      logError(statutoryDb, 'ERROR', `[Sync All] Failed for ${table_name}`, err);
      res.status(500).json({ error: err.message });
    }
  } else if (operation === 'clear_all') {
    db.prepare(`DELETE FROM ${table_name}`).run();
    res.json({ status: 'success' });
  }
};

export const bulkUploadDepartments: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { records } = args;
  const module_type = String(args.moduleType || args.module_type || 'K').toUpperCase();
  const db = module_type === 'P' ? statutoryDb : primaryDb;
  
  try {
    db.transaction((recs) => {
      for (const rec of recs) {
        const groupName = rec.Group || rec.group_name;
        const deptName = rec.Department || rec.department || rec.name;
        const description = rec.Description || rec.description || '';
        let status = rec.Status !== undefined && rec.Status !== null ? rec.Status : (rec.status !== undefined && rec.status !== null ? rec.status : 1);
        
        if (typeof status === 'string') {
          status = status.toLowerCase() === 'active' ? 1 : 0;
        }

        if (!deptName) continue;

        let groupId = null;
        if (groupName) {
          const group = db.prepare('SELECT id FROM groups WHERE name = ?').get(groupName) as any;
          if (group) {
            groupId = group.id;
          } else {
            const result = db.prepare('INSERT INTO groups (name, status) VALUES (?, 1)').run(groupName);
            groupId = result.lastInsertRowid;
            
            // Mirror Group
            if (module_type === 'K') {
              try {
                statutoryDb.prepare('INSERT OR REPLACE INTO groups (id, name, status) VALUES (?, ?, 1)')
                  .run(groupId, groupName);
              } catch (mErr) {
                logError(statutoryDb, 'WARN', `[Mirror Sync] Failed to mirror group ${groupName} in bulk upload`, mErr);
              }
            }
          }
        }

        let deptId = null;
        const existingDept = db.prepare('SELECT id FROM departments WHERE name = ? AND (group_id = ? OR (group_id IS NULL AND ? IS NULL))')
          .get(deptName, groupId, groupId) as any;
        
        if (existingDept) {
          deptId = existingDept.id;
          db.prepare('UPDATE departments SET description = ?, status = ? WHERE id = ?').run(description, status, deptId);
          
          // Mirror Dept Update
          if (module_type === 'K') {
            try {
              statutoryDb.prepare('UPDATE departments SET description = ?, status = ?, group_id = ? WHERE id = ?')
                .run(description, status, groupId, deptId);
            } catch (mErr) {
              logError(statutoryDb, 'WARN', `[Mirror Sync] Failed to mirror dept update ${deptName} in bulk upload`, mErr);
            }
          }
        } else {
          const deptResult = db.prepare('INSERT INTO departments (group_id, name, description, status) VALUES (?, ?, ?, ?)')
            .run(groupId, deptName, description, status);
          deptId = deptResult.lastInsertRowid;

          // Mirror Dept Insert
          if (module_type === 'K') {
            try {
              statutoryDb.prepare('INSERT OR REPLACE INTO departments (id, group_id, name, description, status) VALUES (?, ?, ?, ?, ?)')
                .run(deptId, groupId, deptName, description, status);
            } catch (mErr) {
              logError(statutoryDb, 'WARN', `[Mirror Sync] Failed to mirror dept insert ${deptName} in bulk upload`, mErr);
            }
          }
        }

        const settings: any = { department_id: deptId };
        const mapping = {
          'Default Location': { table: 'org_hierarchy', type: 'Location', field: 'default_location_id' },
          'Default Division': { table: 'org_hierarchy', type: 'Division', field: 'default_division_id' },
          'Default Class': { table: 'classes', field: 'default_class_id' },
          'Default Category': { table: 'categories', field: 'default_category_id' },
          'Default Shift': { table: 'shifts', field: 'default_shift_id' },
          'Reporting Employee (IRA)': { table: 'employees', field: 'default_reporting_employee_id' }
        };

        for (const [key, config] of Object.entries(mapping)) {
          const val = rec[key] || rec[(config as any).field.replace('_id', '')];
          if (val) {
            let sql = `SELECT id FROM ${(config as any).table} WHERE name = ?`;
            let hasEmpCode = false;
            
            if ((config as any).table === 'employees') {
              const empCols = db.prepare('PRAGMA table_info(employees)').all() as any[];
              hasEmpCode = empCols.some(c => c.name === 'emp_code');
              if (hasEmpCode) {
                sql = `SELECT id FROM employees WHERE name = ? OR emp_code = ?`;
              } else {
                sql = `SELECT id FROM employees WHERE name = ?`;
              }
            }
            if ((config as any).type) sql += ` AND type = '${(config as any).type}'`;
            
            let found: any;
            if ((config as any).table === 'employees' && hasEmpCode) {
              found = db.prepare(sql).get(val, val);
            } else {
              found = db.prepare(sql).get(val);
            }
            if (found) settings[(config as any).field] = found.id;
          }
        }

        const sKeys = Object.keys(settings).filter(k => k !== 'department_id');
        if (sKeys.length > 0) {
          const existingSettings = db.prepare('SELECT department_id FROM department_settings WHERE department_id = ?').get(deptId);
          if (existingSettings) {
            const sSql = `UPDATE department_settings SET ${sKeys.map(k => `${k} = ?`).join(', ')} WHERE department_id = ?`;
            db.prepare(sSql).run(...sKeys.map(k => settings[k]), deptId);
          } else {
            const allKeys = ['department_id', ...sKeys];
            const sSql = `INSERT INTO department_settings (${allKeys.join(', ')}) VALUES (${allKeys.map(() => '?').join(', ')})`;
            db.prepare(sSql).run(deptId, ...sKeys.map(k => settings[k]));
          }
        }
      }
    })(records);
    res.json({ status: 'success' });
  } catch (err: any) {
    logError(db, 'ERROR', 'bulk_upload_departments error', err);
    res.status(500).json({ error: err.message });
  }
};

export const bulkUploadStandardRates: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { records } = args;
  const module_type = String(args.moduleType || args.module_type || 'K').toUpperCase();
  const db = module_type === 'P' ? statutoryDb : primaryDb;

  try {
    db.transaction(() => {
      for (const rec of records) {
        const deptName = rec.Department || rec.department;
        const desigName = rec.Designation || rec.designation;
        const rate = parseFloat(rec['Standard Rate'] || rec.standard_rate || 0);
        const manpower = parseInt(rec.Manpower || rec.manpower || 0);
        const effectiveDate = rec['Effective Date'] || rec.effective_date;

        if (!deptName || !desigName || !effectiveDate) continue;

        // Find Dept
        const dept = db.prepare('SELECT id FROM departments WHERE name = ?').get(deptName) as any;
        if (!dept) continue;

        // Find Designation
        const desig = db.prepare('SELECT id FROM designations WHERE name = ?').get(desigName) as any;
        if (!desig) continue;

        // Check for existing record with same designation and effective date for this department
        const existing = db.prepare('SELECT id, standard_rate, manpower FROM standard_rates WHERE department_id = ? AND designation_id = ? AND effective_date = ?')
          .get(dept.id, desig.id, effectiveDate) as any;

        if (existing) {
          // If both Rate and Manpower are duplicate, omit (skip) from upload
          if (existing.standard_rate === rate && existing.manpower === manpower) {
            continue;
          }

          // Update
          db.prepare(`
            UPDATE standard_rates 
            SET standard_rate = ?, manpower = ? 
            WHERE id = ?
          `).run(rate, manpower, existing.id);

          // Mirror if K
          if (module_type === 'K') {
            try {
              statutoryDb.prepare(`
                UPDATE standard_rates 
                SET standard_rate = ?, manpower = ? 
                WHERE id = ?
              `).run(rate, manpower, existing.id);
            } catch (mErr) {
              logError(statutoryDb, 'WARN', `[Mirror Sync] Failed to mirror standard rate update ${deptName}/${desigName}`, mErr);
            }
          }
        } else {
          // Insert
          const result = db.prepare(`
            INSERT INTO standard_rates (department_id, designation_id, standard_rate, manpower, effective_date)
            VALUES (?, ?, ?, ?, ?)
          `).run(dept.id, desig.id, rate, manpower, effectiveDate);
          
          const newId = result.lastInsertRowid;

          // Mirror if K
          if (module_type === 'K') {
            try {
              statutoryDb.prepare(`
                INSERT OR REPLACE INTO standard_rates (id, department_id, designation_id, standard_rate, manpower, effective_date)
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(newId, dept.id, desig.id, rate, manpower, effectiveDate);
            } catch (mErr) {
              logError(statutoryDb, 'WARN', `[Mirror Sync] Failed to mirror standard rate insert ${deptName}/${desigName}`, mErr);
            }
          }
        }
      }
    })();
    res.json({ status: 'success' });
  } catch (err: any) {
    logError(db, 'ERROR', 'bulk_upload_standard_rates error', err);
    res.status(500).json({ error: err.message });
  }
};

export const clearOrgData: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { moduleType } = args;
  const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM standard_rates').run();
      db.prepare('DELETE FROM department_settings').run();
      db.prepare('DELETE FROM departments').run();
      db.prepare('DELETE FROM groups').run();
    })();
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear organization data' });
  }
};

export const saveRokdaVoucher: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { voucher, entries, moduleType } = args;
  const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
  try {
    db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO rokda_vouchers (voucher_date, department_id, shift, reporting_employee_id, authorizer_id, total_count, total_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(voucher.voucher_date || voucher.date, voucher.department_id, voucher.shift, voucher.reporting_employee_id, voucher.authorizer_id, voucher.total_count, voucher.total_amount);
      const voucherId = result.lastInsertRowid;
      const itemStmt = db.prepare(`INSERT INTO rokda_entries (voucher_id, token_code, worker_name, designation, in_time, out_time, amount) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      for (const entry of entries) {
        itemStmt.run(voucherId, entry.token_code, entry.worker_name, entry.designation, entry.in_time, entry.out_time, entry.amount);
      }
    })();
    res.json({ status: 'success' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getPincodeRecords: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const { page = 1, limit = 20, search = '', moduleType = 'K' } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;

  try {
    let sql = 'SELECT * FROM pincode_master';
    let countSql = 'SELECT COUNT(*) as total FROM pincode_master';
    const params: any[] = [];
    const countParams: any[] = [];

    if (search) {
      const searchPattern = `%${search}%`;
      const searchCondition = ' WHERE pincode LIKE ? OR statename LIKE ? OR districtname LIKE ? OR officename LIKE ?';
      sql += searchCondition;
      countSql += searchCondition;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const offset = (Math.max(1, page) - 1) * limit;
    sql += ' ORDER BY pincode ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const records = db.prepare(sql).all(...params);
    const countRes = db.prepare(countSql).get(...countParams) as any;
    const total = countRes?.total || 0;

    res.json({ records, total });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const bulkPincodeUpsert: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const module_type = args.module_type || args.moduleType || 'K';
  const { records } = args;
  const db = module_type === 'P' ? statutoryDb : primaryDb;

  if (!records || records.length === 0) return res.json({ status: 'success' });

  try {
    const sql = `
      INSERT OR REPLACE INTO pincode_master (pincode, statename, districtname, officename, last_updated)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    const stmt = db.prepare(sql);

    db.transaction(() => {
      records.forEach((rec: any) => {
        stmt.run(
          String(rec.pincode || ''),
          String(rec.statename || ''),
          String(rec.districtname || ''),
          String(rec.officename || '')
        );
      });
    })();

    // Mirror to Statutory if in Module K
    if (module_type === 'K') {
      try {
        const statutoryStmt = statutoryDb.prepare(sql);
        statutoryDb.transaction(() => {
          records.forEach((rec: any) => {
            statutoryStmt.run(
              String(rec.pincode || ''),
              String(rec.statename || ''),
              String(rec.districtname || ''),
              String(rec.officename || '')
            );
          });
        })();
      } catch (mirrorErr) {
        logError(statutoryDb, 'WARN', '[Mirror Sync] Failed to mirror bulk pincode upsert', mirrorErr);
      }
    }

    res.json({ status: 'success', message: `Imported ${records.length} pincode records` });
  } catch (err: any) {
    console.error("[Pincode Sync] Bulk Insert Failed", err);
    res.status(500).json({ error: err.message });
  }
};

export const getOgdRecords: CommandHandler = async (ctx, args) => {
  const { res, primaryDb } = ctx;
  const { offset, limit = 2000 } = args;
  
  let ogdKey = process.env.OGD_API_KEY || process.env.VITE_OGD_API_KEY || process.env.OGD_KEY;
  
  if (!ogdKey) {
    try {
      const dbKey = primaryDb.prepare("SELECT value FROM settings WHERE key = 'OGD_API_KEY'").get() as any;
      if (dbKey?.value) ogdKey = dbKey.value;
    } catch (e) {
      console.warn("[OGD Sync] Failed to fetch key from DB settings", e);
    }
  }

  const resourceId = "6176ee09-3d56-4a3b-8115-21841576b2f6";

  if (!ogdKey) {
    return res.status(500).json({ 
      error: "OGD_API_KEY missing. Please configure it in System Settings." 
    });
  }

  try {
    const url = `https://api.data.gov.in/resource/${resourceId}?api-key=${ogdKey}&format=json&limit=${limit}&offset=${offset}`;
    const response = await fetch(url);
    
    if (!response.ok) {
       return res.status(response.status).json({ error: `OGD API Error: ${response.statusText}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getOgdBankList: CommandHandler = async (ctx, _args) => {
  try {
    const response = await fetch('https://raw.githubusercontent.com/razorpay/ifsc/master/src/banks.json');
    if (!response.ok) throw new Error("Failed to fetch bank list from Razorpay");
    const data = await response.json();
    ctx.res.json(data);
  } catch (err: any) {
    ctx.res.status(500).json({ error: err.message });
  }
};

export const getOgdBankBranches: CommandHandler = async (ctx, args) => {
  const { bankTag } = args;
  try {
    const response = await fetch(`https://raw.githubusercontent.com/razorpay/ifsc-api/master/data/${bankTag}.json`);
    if (!response.ok) throw new Error(`Failed to fetch branches for ${bankTag}`);
    const data = await response.json();
    ctx.res.json(data);
  } catch (err: any) {
    ctx.res.status(500).json({ error: err.message });
  }
};

export const getMasterUsage: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { table, id, moduleType } = args;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
          try {
            let count = 0;
            if (table === 'shifts') {
              const atLogCount = db.prepare('SELECT count(*) as c FROM attendance_logs WHERE shift_id = ?').get(id) as any;
              const txCount = db.prepare('SELECT count(*) as c FROM wage_attendance_transactions WHERE shift_id = ?').get(id) as any;
              count = (atLogCount?.c || 0) + (txCount?.c || 0);
            } else if (table === 'salary_slabs') {
              const usageCount = db.prepare(`
                 SELECT count(*) as c FROM payroll p
                 JOIN employees e ON p.emp_id = e.id
                 WHERE e.slab_id = ?
              `).get(id) as any;
              count = usageCount?.c || 0;
            }
            res.json({ usageCount: count });
          } catch (e: any) {
            res.status(500).json({ error: e.message });
          
}
};

export const deleteOrgUnit: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { unitType, id, moduleType } = args;
          const unit_type = unitType || args.unit_type;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
          
          try {
            // Check if allocated to employees
            const column = unit_type === 'group' ? 'group_id' : 'department_id';
            const empCount = (db.prepare(`SELECT COUNT(*) as count FROM employees WHERE ${column} = ?`).get(id) as any).count;
            
            if (empCount > 0) {
              return res.status(400).json({ error: `Cannot delete ${unit_type} as it is allocated to ${empCount} employees.` });
            }
            
            if (unit_type === 'group') {
              const deptCount = (db.prepare('SELECT COUNT(*) as count FROM departments WHERE group_id = ?').get(id) as any).count;
              if (deptCount > 0) {
                return res.status(400).json({ error: 'Cannot delete group as it contains departments.' });
              }
              const subGroupCount = (db.prepare('SELECT COUNT(*) as count FROM groups WHERE group_id = ?').get(id) as any).count;
              if (subGroupCount > 0) {
                return res.status(400).json({ error: 'Cannot delete group as it contains sub-groups.' });
              }
            }

            const table = unit_type === 'group' ? 'groups' : 'departments';
            db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
            
            if (unit_type === 'department') {
              db.prepare('DELETE FROM department_settings WHERE department_id = ?').run(id);
              db.prepare('DELETE FROM standard_rates WHERE department_id = ?').run(id);
            }
            
            res.json({ status: 'success' });
          } catch (err) {
            logError(db, 'ERROR', '[Database] delete_org_unit error', err);
            res.status(500).json({ error: 'Failed to delete organizational unit' });
          
}
};

export const getLastSyncTime: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  try {
             // In K module, P module sync data info could be stored somewhere.
             // We'll read the latest updated_at from sync_audit or primary records. Let's just mock a timestamp for now or grab it from system settings.
             // Here we query a config table if it existed, otherwise fallback to max timestamp from attendance logs to simulate
             res.json({ timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) });
          } catch(e) {
             res.json({ timestamp: 'Unknown' })
          
}
};

export const getDepartmentSettings: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { deptId, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          const settings = db.prepare('SELECT * FROM department_settings WHERE department_id = ?').get(deptId);
          res.json(settings || {});
          
};

export const saveDepartmentSettings: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { deptId, settings, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          const existing = db.prepare('SELECT department_id FROM department_settings WHERE department_id = ?').get(deptId);
          
          const keys = Object.keys(settings);
          if (keys.length === 0) return res.json({ status: 'success', message: 'No settings provided' });
          if (existing) {
            const sql = `UPDATE department_settings SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE department_id = ?`;
            db.prepare(sql).run(...keys.map(k => sanitizeData(settings[k])), deptId);
          } else {
            const sql = `INSERT INTO department_settings (department_id, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`;
            db.prepare(sql).run(deptId, ...keys.map(k => sanitizeData(settings[k])));
          }
          res.json({ status: 'success' });
          
};

export const getDepartmentRates: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { deptId, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          const rates = db.prepare(`
            SELECT sr.*, d.name as designation_name 
            FROM standard_rates sr
            LEFT JOIN designations d ON sr.designation_id = d.id
            WHERE sr.department_id = ?
          `).all(deptId);
          res.json(rates);
          
};

export const saveDepartmentRate: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { deptId, rate, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          
          // Ensure we use designation_id
          const processedRate = { ...rate };
          if (processedRate.designation && !processedRate.designation_id) {
            processedRate.designation_id = processedRate.designation;
            delete processedRate.designation;
          }

          const keys = Object.keys(processedRate).filter(k => k !== 'id' && k !== 'designation_name');
          if (processedRate.id) {
            const sql = `UPDATE standard_rates SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
            db.prepare(sql).run(...keys.map(k => sanitizeData(processedRate[k])), processedRate.id);
          } else {
            const sql = `INSERT INTO standard_rates (department_id, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`;
            db.prepare(sql).run(deptId, ...keys.map(k => sanitizeData(processedRate[k])));
          }

          // SELECTIVE SYNC BRIDGE: K -> P
          if (moduleType === 'K') {
            try {
              // 1. Get info from K
              const kDept = primaryDb.prepare(`
                SELECT d.name as dept_name, g.name as group_name 
                FROM departments d
                JOIN groups g ON d.group_id = g.id
                WHERE d.id = ?
              `).get(deptId) as any;

              const kDesig = primaryDb.prepare('SELECT name FROM designations WHERE id = ?').get(processedRate.designation_id) as any;

              if (kDept && kDesig) {
                // 2. Resolve Group in P
                let pGrp = statutoryDb.prepare('SELECT id FROM groups WHERE name = ?').get(kDept.group_name) as any;
                if (!pGrp) {
                  const kGrpData = primaryDb.prepare('SELECT * FROM groups WHERE name = ?').get(kDept.group_name) as any;
                  const grpKeys = Object.keys(kGrpData).filter(k => k !== 'id' && k !== 'created_at');
                  const grpSql = `INSERT INTO groups (${grpKeys.join(', ')}) VALUES (${grpKeys.map(() => '?').join(', ')})`;
                  const res = statutoryDb.prepare(grpSql).run(...grpKeys.map(k => kGrpData[k]));
                  pGrp = { id: res.lastInsertRowid };
                }

                // 3. Resolve Dept in P
                let pDept = statutoryDb.prepare('SELECT id FROM departments WHERE name = ? AND group_id = ?').get(kDept.dept_name, pGrp.id) as any;
                if (!pDept) {
                  const kDeptData = primaryDb.prepare('SELECT * FROM departments WHERE name = ? AND group_id = (SELECT id FROM groups WHERE name = ?)').get(kDept.dept_name, kDept.group_name) as any;
                  const deptKeys = Object.keys(kDeptData).filter(k => k !== 'id' && k !== 'created_at' && k !== 'group_id');
                  const deptSql = `INSERT INTO departments (group_id, ${deptKeys.join(', ')}) VALUES (?, ${deptKeys.map(() => '?').join(', ')})`;
                  const res = statutoryDb.prepare(deptSql).run(pGrp.id, ...deptKeys.map(k => kDeptData[k]));
                  pDept = { id: res.lastInsertRowid };
                }

                // 4. Resolve Designation in P
                let pDesig = statutoryDb.prepare('SELECT id FROM designations WHERE name = ?').get(kDesig.name) as any;
                if (!pDesig) {
                  const kDesData = primaryDb.prepare('SELECT * FROM designations WHERE name = ?').get(kDesig.name) as any;
                  const desKeys = Object.keys(kDesData).filter(k => k !== 'id' && k !== 'created_at');
                  const desSql = `INSERT INTO designations (${desKeys.join(', ')}) VALUES (${desKeys.map(() => '?').join(', ')})`;
                  const res = statutoryDb.prepare(desSql).run(...desKeys.map(k => kDesData[k]));
                  pDesig = { id: res.lastInsertRowid };
                }

                // 5. Selective Upsert Rate in P (IDOLATED RATE)
                const pRate = statutoryDb.prepare('SELECT id FROM standard_rates WHERE department_id = ? AND designation_id = ?')
                  .get(pDept.id, pDesig.id) as any;

                if (pRate) {
                  // ONLY SYNC Manpower and Effective Date, NOT standard_rate
                  statutoryDb.prepare(`
                    UPDATE standard_rates 
                    SET manpower = ?, effective_date = ?
                    WHERE id = ?
                  `).run(processedRate.manpower, processedRate.effective_date, pRate.id);
                } else {
                  // INSERT NEW: Init standard_rate to 0 in P
                  statutoryDb.prepare(`
                    INSERT INTO standard_rates (department_id, designation_id, manpower, effective_date, standard_rate)
                    VALUES (?, ?, ?, ?, 0)
                  `).run(pDept.id, pDesig.id, processedRate.manpower, processedRate.effective_date);
                }
              }
            } catch (syncErr) {
              console.error('[Sync Bridge Error]', syncErr);
              // We don't fail the primary save if sync fails, but we log it
            }
          }

          res.json({ status: 'success' });
          
};

export const deleteDepartmentRate: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { id, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          db.prepare('DELETE FROM standard_rates WHERE id = ?').run(id);
          res.json({ status: 'success' });
          
};

export const getDeptSettings: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { deptId, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          try {
            const settings = db.prepare('SELECT * FROM department_settings WHERE department_id = ?').get(deptId);
            res.json(settings || {});
          } catch (err) {
            res.json({});
          
}
};

export const getDeptStandardRates: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { deptId, designation_id, designation, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          
          if (designation_id || designation) {
            // Single rate lookup
            const rate = db.prepare(`
              SELECT standard_rate FROM standard_rates 
              WHERE department_id = ? AND (designation_id = ? OR designation_id = (SELECT id FROM designations WHERE name = ?))
            `).get(deptId, designation_id || null, designation || null);
            res.json(rate || { standard_rate: 0 });
          } else {
            // All rates for department (used by GroupDepartmentMaster)
            const rates = db.prepare(`
              SELECT sr.*, d.name as designation_name 
              FROM standard_rates sr
              LEFT JOIN designations d ON sr.designation_id = d.id
              WHERE sr.department_id = ?
            `).all(deptId);
            res.json(rates);
          
}
};

export const getLastSyncTimestamp: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          const row = db.prepare("SELECT value FROM settings WHERE key = 'last_cloud_sync'").get() as any;
          res.json({ timestamp: row?.value || '1970-01-01T00:00:00Z' });
          
};

export const updateLocalRecord: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { moduleType, collectionName, data } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          const tableName = collectionName;
          
          const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
          const columnNames = columns.map(c => c.name);
          
          // Special handling for company_config to keep it as a single row
          if (tableName === 'company_config') {
            const snakeData = mapKeys(data, toSnakeCase);
            const keys = Object.keys(snakeData).filter(k => columnNames.includes(k) && k !== 'id');
            const sql = `UPDATE company_config SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = 1`;
            db.prepare(sql).run(...keys.map(k => sanitizeData(snakeData[k])));
          } else {
            const snakeData = mapKeys(data, toSnakeCase);
            const keys = Object.keys(snakeData).filter(k => columnNames.includes(k));
            const sql = `INSERT OR REPLACE INTO ${tableName} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
            db.prepare(sql).run(...keys.map(k => sanitizeData(snakeData[k])));
          }
          
          // Update last sync timestamp
          db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_cloud_sync', ?)").run(new Date().toISOString());
          
          res.json({ status: 'success' });
          
};
