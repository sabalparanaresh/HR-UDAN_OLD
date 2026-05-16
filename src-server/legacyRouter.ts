import { DuckDBAnalyticsRepo } from './services/DuckDBAnalytics.js';
import express from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import duckdb from 'duckdb';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { Worker } from 'worker_threads';
import { CONFIG } from './config.js';
import { SCHEMAS, MIGRATIONS } from './db/schema.js';
import { runPostSetupMigrations } from './db/migrations.js';
import { CRUD_TABLE_WHITELIST } from './db/whitelists.js';
import { Mapper } from './utils/mapper.js';
import { logError } from './utils/logger.js';
import { recalculateCanteenRules } from './utils/canteen.js';
import { EmployeeSchema, SalaryHeadSchema, TransactionSchema } from './validation/index.js';
import { Employee, SalaryHead } from './types/index.js';
import { COMMAND_MAP } from './commands/index.js';
import { CommandContext } from './commands/types.js';
import { formulaEngine } from '../src/utils/calculation/FormulaEngine.js';
import { PayrollEngineK } from './services/PayrollEngineK.js';
import { PayrollEngineP } from './services/PayrollEngineP.js';
import ExcelJS from 'exceljs';
import cronParser from 'cron-parser';

const ASSETS_DIR = path.join(process.cwd(), 'assets', 'photos');

const apiKeyMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-header'] || req.headers['x-api-key'] || req.headers['x-app-token'] || req.query.api_key;
  
  // Log received API key to aid debugging
  if (apiKey) {
      console.log(`[apiKeyMiddleware] Received API Key: ${apiKey.toString().substring(0, 5)}...`);
  } else {
      console.log(`[apiKeyMiddleware] No API Key provided by client`);
  }

  const expectedKey = CONFIG.API_KEY;
  
  if (!apiKey || apiKey !== expectedKey) {
    if (!CONFIG.IS_PRODUCTION) {
      console.warn(`[Security] Invalid API Key attempt from ${req.ip} to ${req.path}. Expected: ${expectedKey}, Got: ${apiKey}`);
      // In dev, allow the request if the header is missing or mismatched for resilience
      return next();
    }
    return res.status(403).json({ 
      error: 'Forbidden: Invalid API Key', 
      message: `The x-api-key header is missing or incorrect.` 
    });
  }
  next();
};

export function toSnakeCase(str: string) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function toCamelCase(str: string) {
  return str.replace(/([-_][a-z])/g, group =>
    group.toUpperCase().replace('-', '').replace('_', '')
  );
}

export function mapKeys(obj: any, mapper: (s: string) => string): any {
  if (Array.isArray(obj)) return obj.map(v => mapKeys(v, mapper));
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      acc[mapper(key)] = mapKeys(obj[key], mapper);
      return acc;
    }, {} as any);
  }
  return obj;
}

export const sanitizeData = (val: any): any => {
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val === null || val === undefined || (typeof val === 'number' && isNaN(val))) return null;
  if (typeof val === 'object' && !(val instanceof Date)) {
    return JSON.stringify(val);
  }
  if (val instanceof Date) return val.toISOString();
  return val;
};

// Prevent process crash on EPIPE and other common errors
process.on('uncaughtException', (err: any) => {
  if (err.code === 'EPIPE') return;
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Ignore EPIPE on stdout/stderr
process.stdout.on('error', (err: any) => {
  if (err.code === 'EPIPE') return;
});
process.stderr.on('error', (err: any) => {
  if (err.code === 'EPIPE') return;
});

// --- Helper Functions ---
function calculateBifurcation(ctc: number, components: any[], salaryHeads: any[]) {
    const results: Record<string, number> = {};
    const headAmounts: Record<number, number> = {};
    let totalNonResidual = 0;

    // First pass for non-residual (FIXED, PERCENT_CTC, PERCENT_HEAD)
    components.filter((c: any) => c.calculation_type !== 'RESIDUAL').forEach((comp: any) => {
        const head = salaryHeads.find(h => h.id === comp.salary_head_id);
        let amount = 0;

        if (comp.calculation_type === 'FIXED') {
            amount = comp.value;
        } else if (comp.calculation_type === 'PERCENT_CTC') {
            amount = (ctc * comp.value) / 100;
        } else if (comp.calculation_type === 'PERCENT_HEAD' && comp.parent_head_id) {
            const parentAmt = headAmounts[comp.parent_head_id] || 0;
            amount = (parentAmt * comp.value) / 100;
        }

        const roundedAmount = Math.round(amount);
        headAmounts[comp.salary_head_id] = roundedAmount;
        totalNonResidual += roundedAmount;
        if (head) results[head.name.toUpperCase()] = roundedAmount;
    });

    // Second pass for residual components
    components.filter((c: any) => c.calculation_type === 'RESIDUAL').forEach((comp: any) => {
        const head = salaryHeads.find(h => h.id === comp.salary_head_id);
        const amount = Math.max(0, ctc - totalNonResidual);
        const roundedAmount = Math.round(amount);
        if (head) results[head.name.toUpperCase()] = roundedAmount;
    });

    return results;
}

// Map bifurcation results to employee table columns
function mapBifurcationToColumns(bifurcation: Record<string, number>) {
    const mapped: any = {
        basic_salary: 0,
        hra: 0,
        conveyance: 0,
        special_allowance: 0
    };

    for (const [headName, amount] of Object.entries(bifurcation)) {
        if (headName === 'BASIC' || headName === 'BASIC SALARY') mapped.basic_salary = amount;
        else if (headName === 'HRA' || headName === 'HOUSE RENT ALLOWANCE') mapped.hra = amount;
        else if (headName.includes('CONVEYANCE')) mapped.conveyance = amount;
        else if (headName.includes('SPECIAL ALLOWANCE')) mapped.special_allowance = amount;
    }

    return mapped;
}

function isKConnected(primaryDb: any) {
  try {
    const status = primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get() as any;
    return (status?.value || 'CONNECTED') === 'CONNECTED';
  } catch (e) {
    return true; 
  }
}

function syncSalaryHead(headData: any, primaryDb: any, statutoryDb: any) {
  if (!isKConnected(primaryDb)) return;

  try {
    const headName = headData.name;
    const fullHead = primaryDb.prepare('SELECT * FROM salary_heads WHERE name = ?').get(headName) as any;
    if (!fullHead) return;

    // Head should be synced to P unless explicitly set to K_ONLY
    const shouldMirror = fullHead.allocation_type !== 'K_ONLY';

    if (shouldMirror) {
      const existingInP = statutoryDb.prepare('SELECT id FROM salary_heads WHERE name = ?').get(headName);
      const syncKeys = Object.keys(fullHead).filter(k => k !== 'id' && k !== 'created_at');
      const syncValues = syncKeys.map(k => sanitizeData(fullHead[k]));
      
      if (existingInP) {
        const sSql = `UPDATE salary_heads SET ${syncKeys.map(k => `${k} = ?`).join(', ')} WHERE name = ?`;
        statutoryDb.prepare(sSql).run(...syncValues, headName);
      } else {
        const sSql = `INSERT INTO salary_heads (${syncKeys.join(', ')}) VALUES (${syncKeys.map(() => '?').join(', ')})`;
        statutoryDb.prepare(sSql).run(...syncValues);
      }
    } else {
      statutoryDb.prepare('DELETE FROM salary_heads WHERE name = ?').run(headName);
    }
  } catch (err) {
    logError(statutoryDb, 'ERROR', '[Sync] Error in syncSalaryHead', err);
  }
}

export function syncEarningTransactionToP(operation: 'create' | 'update' | 'delete', k_tx_id: number, primaryDb: any, statutoryDb: any) {
  if (!isKConnected(primaryDb)) return;
  try {
    if (operation === 'delete') {
      statutoryDb.prepare('DELETE FROM salary_transactions WHERE k_ref_id = ?').run(k_tx_id);
      return;
    }

    const tx = primaryDb.prepare(`
      SELECT st.*, sh.name as head_name, sh.allocation_type, sh.type as head_type, e.emp_code
      FROM salary_transactions st
      JOIN salary_heads sh ON st.head_id = sh.id
      JOIN employees e ON st.emp_id = e.id
      WHERE st.id = ?
    `).get(k_tx_id) as any;

    if (!tx || (tx.allocation_type !== 'KP' && tx.allocation_type !== 'STATUTORY')) {
      if (operation === 'update') {
        // If it was changed to non-KP, we might need to delete it from P
        statutoryDb.prepare('DELETE FROM salary_transactions WHERE k_ref_id = ?').run(k_tx_id);
      }
      return;
    }

    const empInP = statutoryDb.prepare("SELECT id FROM employees WHERE emp_code = ?").get(tx.emp_code) as any;
    const headInP = statutoryDb.prepare("SELECT id FROM salary_heads WHERE name = ?").get(tx.head_name) as any;

    if (!empInP || !headInP) return;

    if (operation === 'create') {
      statutoryDb.prepare(`
        INSERT INTO salary_transactions (
          transaction_type, date, salary_month_year, emp_id, head_id, amount, reason, remark, is_bulk_entry, k_ref_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tx.transaction_type, tx.date, tx.salary_month_year, empInP.id, headInP.id,
        tx.amount, tx.reason, tx.remark, tx.is_bulk_entry, k_tx_id
      );
    } else if (operation === 'update') {
      // It might not exist in P if it was previously non-KP and just changed to KP,
      // so we use UPSERT or check if it exists
      const existing = statutoryDb.prepare("SELECT id FROM salary_transactions WHERE k_ref_id = ?").get(k_tx_id);
      if (existing) {
        statutoryDb.prepare(`
          UPDATE salary_transactions 
          SET transaction_type=?, date=?, salary_month_year=?, emp_id=?, head_id=?, amount=?, reason=?, remark=?, is_bulk_entry=?
          WHERE k_ref_id = ?
        `).run(
          tx.transaction_type, tx.date, tx.salary_month_year, empInP.id, headInP.id,
          tx.amount, tx.reason, tx.remark, tx.is_bulk_entry, k_tx_id
        );
      } else {
        statutoryDb.prepare(`
          INSERT INTO salary_transactions (
            transaction_type, date, salary_month_year, emp_id, head_id, amount, reason, remark, is_bulk_entry, k_ref_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          tx.transaction_type, tx.date, tx.salary_month_year, empInP.id, headInP.id,
          tx.amount, tx.reason, tx.remark, tx.is_bulk_entry, k_tx_id
        );
      }
    }
  } catch (err) {
    logError(statutoryDb, 'ERROR', '[Sync] Error in syncEarningTransactionToP', err);
  }
}


// --- SSE Event System for Tauri Emulator ---
let eventClients: { id: number; res: any }[] = [];
const salaryProcessingCache = new Map<string, any[]>();
const emitEvent = (event: string, payload: any) => {
  const data = JSON.stringify({ event, payload });
  eventClients.forEach(c => c.res.write(`data: ${data}\n\n`));
};

async function initializeApp(app: express.Application) {
  app.use(compression());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.text({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }
  app.use('/assets', express.static(path.join(process.cwd(), 'assets')));

  // Request logging middleware
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API Request] ${req.method} ${req.path}`);
    }
    next();
  });
}

function setupSSE(app: express.Application) {
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    eventClients.push(newClient);

    req.on('close', () => {
      eventClients = eventClients.filter(c => c.id !== clientId);
    });
  });
}

function setupErrorHandling(app: express.Application, server: any, db: any) {
  // Handle potential server-level errors
  server.on('error', (err: any) => {
    if (err.code === 'EPIPE') {
      // Ignore EPIPE errors as they usually mean the client disconnected
      return;
    }
    console.error('Server error:', err);
  });

  // Final generic error handler for Express
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.code === 'EPIPE') return;
    if (res.headersSent) return next(err);
    logError(db, 'ERROR', '[Express Error Handler]', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });
}

export async function startLegacyServer(app: any, isVite: boolean) {
  
  
  const dbState = { isReady: false };

  // Start listening immediately to prevent platform "Starting Server" HTML response
  const server = app.listen(3000, '0.0.0.0', () => {
    console.log(`Tauri-Emulator Server running on http://localhost:${3000}`);
  });

  await initializeApp(app);
  setupSSE(app);

  const primaryDb = new Database('data/primary.db', { timeout: 5000 });
  const statutoryDb = new Database('data/statutory.db', { timeout: 5000 });

  // DuckDB initialization will be called after migrations
  // DuckDBAnalyticsRepo.init();


  primaryDb.pragma('journal_mode = WAL');
  statutoryDb.pragma('journal_mode = WAL');
  primaryDb.pragma('synchronous = NORMAL');
  statutoryDb.pragma('synchronous = NORMAL');
  primaryDb.pragma('foreign_keys = ON');
  statutoryDb.pragma('foreign_keys = ON');
  
  setInterval(() => {
    try {
      // Use PASSIVE checkpoint to prevent DB locking risks
      primaryDb.pragma('wal_checkpoint(PASSIVE)');
      statutoryDb.pragma('wal_checkpoint(PASSIVE)');
    } catch (e) {
      console.warn("WAL checkpoint failed", e);
    }
  }, 10 * 60 * 1000);

  setInterval(DuckDBAnalyticsRepo.refreshMaterializedViews, 5 * 60 * 1000); // 5 minutes

  setInterval(async () => {
    try {
      const { SyncEngineService } = await import('./domains/sync-engine/service.js');
      const syncService = new SyncEngineService(primaryDb, statutoryDb);
      if (syncService.isConnected()) {
        await syncService.processQueue();
      }
    } catch (e: any) {
      console.warn("Sync queue process interval failed:", e.message);
    }
  }, 15000); // Check sync queue every 15 seconds

  // Global Mutex for heavy processes
  const isSystemProcessing = false;

  const setupDb = async () => {
    try {
      for (const schema of SCHEMAS) {
        primaryDb.exec(schema);
        statutoryDb.exec(schema);
      }
    } catch (err) {
      console.error('[DB Initialization Failure] Fatal error during schema creation:', err);
      process.exit(1);
    }

    // RUN MIGRATIONS
    for (const migration of MIGRATIONS) {
      try {
        primaryDb.exec(migration);
      } catch (err: any) {
        if (!err.message?.includes('duplicate column name') && !err.message?.includes('already exists')) {
          console.error('[Database Migration Failure] Fatal error during primary schema migration:', err);
          process.exit(1);
        }
      }
      try {
        statutoryDb.exec(migration);
      } catch (err: any) {
        if (!err.message?.includes('duplicate column name') && !err.message?.includes('already exists')) {
          console.error('[Database Migration Failure] Fatal error during statutory schema migration:', err);
          process.exit(1);
        }
      }
    }

    // DYNAMIC AUDIT TRIGGERS FOR BOTH MODULES
    const setupAuditTriggers = (db: Database, dbName: string) => {
      try {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('audit_log', 'audit_amendment_log', 'sync_log', 'sync_queue', 'employee_sync_queue', 'payroll_lock', 'system_logs')").all() as {name: string}[];
        for (const t of tables) {
          const table = t.name;
          const columnsInfo = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
          if (!columnsInfo.length) continue;
          
          let pkColumn = columnsInfo.find(c => c.pk)?.name || 'id';
          if (table === 'leave_balances') pkColumn = 'emp_id'; // compound pk handling workaround

          const chunkArray = (arr: any[], size: number): any[][] => arr.length ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [];
          const chunks = chunkArray(columnsInfo, 30);
          
          const buildJsonObj = (chunks: any[][], prefix: string) => {
            if (chunks.length === 0) return "'{}'";
            const objStrs = chunks.map(chunk => `json_object(${chunk.map(c => `\'${c.name}\', ${prefix}.${c.name}`).join(', ')})`);
            return objStrs.reduce((acc, str) => `json_patch(${acc}, ${str})`);
          };

          const newColsObjStr = buildJsonObj(chunks, 'NEW');
          const oldColsObjStr = buildJsonObj(chunks, 'OLD');

          const hasCreatedBy = columnsInfo.some(c => c.name === 'created_by');
          const hasModifiedBy = columnsInfo.some(c => c.name === 'modified_by');
          const hasDeletedBy = columnsInfo.some(c => c.name === 'deleted_by');

          const createdByField = hasCreatedBy ? `NEW.created_by` : `NULL`;
          const modifiedByField = hasModifiedBy ? `NEW.modified_by` : `NULL`;
          const deletedByField = hasDeletedBy ? `OLD.deleted_by` : `NULL`;
          
          try {
            // INSERT
            db.exec(`
              CREATE TRIGGER IF NOT EXISTS trg_${table}_audit_insert AFTER INSERT ON ${table}
              BEGIN
                INSERT INTO audit_log (table_name, record_id, action, new_data, changed_by) 
                VALUES ('${table}', NEW.${pkColumn}, 'INSERT', ${newColsObjStr}, ${createdByField});
              END;
            `);
          } catch(e: any) { console.warn('insert trigger err:', e.message) }

          try {
            // UPDATE
            db.exec(`
              CREATE TRIGGER IF NOT EXISTS trg_${table}_audit_update AFTER UPDATE ON ${table}
              BEGIN
                INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by) 
                VALUES ('${table}', NEW.${pkColumn}, 'UPDATE', ${oldColsObjStr}, ${newColsObjStr}, ${modifiedByField});
              END;
            `);
          } catch(e: any) { console.warn('update trigger err:', e.message) }

          try {
            // DELETE (Hard delete tracking)
            db.exec(`
              CREATE TRIGGER IF NOT EXISTS trg_${table}_audit_delete AFTER DELETE ON ${table}
              BEGIN
                INSERT INTO audit_log (table_name, record_id, action, old_data, changed_by) 
                VALUES ('${table}', OLD.${pkColumn}, 'DELETE', ${oldColsObjStr}, ${deletedByField});
              END;
            `);
          } catch(e: any) { console.warn('delete trigger err:', e.message) }
        }
      } catch (e: any) {
        console.warn(`[Audit] Failed to setup dynamic audit triggers for ${dbName}:`, e.message);
      }
    };

    setupAuditTriggers(primaryDb, 'Primary');
    setupAuditTriggers(statutoryDb, 'Statutory');

    // CREATE DYNAMIC SYNC TRIGGERS FOR K -> P CIRCUIT BREAKER (PRIMARY ONLY)
    const SYNC_MIRROR_TABLES = [
      'employees', 'departments', 'designations', 'settings', 'locations', 'divisions', 'groups', 
      'categories', 'classes', 'shifts', 'salary_heads', 'salary_slabs', 'banks', 'users', 
      'roles', 'role_permissions', 'company_config', 'attendance_logs', 'salary_transactions', 'working_day_types',
      'banks', 'employee_shift_history', 'leave_balances', 'leave_configurations', 'canteen_time_windows', 'canteen_rules'
    ];
    
    for (const table of SYNC_MIRROR_TABLES) {
      try {
        let pkColumn = 'id';
        if (table === 'banks') pkColumn = 'ifsc';
        if (table === 'settings') pkColumn = 'key';
        if (table === 'leave_balances') pkColumn = 'emp_id'; // Composite PK, but just using emp_id for queue is fine

        primaryDb.exec(`
          CREATE TRIGGER IF NOT EXISTS trg_${table}_k_insert AFTER INSERT ON ${table}
          BEGIN
            INSERT INTO sync_queue (entity_type, entity_id, operation) VALUES ('${table}', NEW.${pkColumn}, 'INSERT');
          END;
        `);
        primaryDb.exec(`
          CREATE TRIGGER IF NOT EXISTS trg_${table}_k_update AFTER UPDATE ON ${table}
          BEGIN
            INSERT OR IGNORE INTO sync_queue (entity_type, entity_id, operation) VALUES ('${table}', NEW.${pkColumn}, 'UPDATE');
          END;
        `);
        primaryDb.exec(`
          CREATE TRIGGER IF NOT EXISTS trg_${table}_k_delete AFTER DELETE ON ${table}
          BEGIN
            INSERT INTO sync_queue (entity_type, entity_id, operation) VALUES ('${table}', OLD.${pkColumn}, 'DELETE');
          END;
        `);
      } catch (e: any) {
        if (!e.message?.includes('no such column')) {
          console.warn(`[Sync Engine] Warning: Could not create sync triggers for table ${table}:`, e.message);
        }
      }
    }

    // Add Primary-Only columns to Primary Salary Heads
    try {
      const dbList = [primaryDb, statutoryDb];
      for (const tDb of dbList) {
        if (!tDb) continue;
        const txColumns = tDb.prepare("PRAGMA table_info(salary_transactions)").all() as any[];
        const txColumnNames = txColumns.map(c => c.name);
        if (!txColumnNames.includes('ref_process_date')) {
          tDb.exec("ALTER TABLE salary_transactions ADD COLUMN ref_process_date TEXT");
        }
      }

      const headColumnsPrimary = primaryDb.prepare("PRAGMA table_info(salary_heads)").all() as any[];
      const headColumnNamesPrimary = headColumnsPrimary.map(c => c.name);
      if (!headColumnNamesPrimary.includes('applicability')) {
        primaryDb.exec("ALTER TABLE salary_heads ADD COLUMN applicability TEXT");
      }
      if (!headColumnNamesPrimary.includes('allocation_type')) {
        primaryDb.exec("ALTER TABLE salary_heads ADD COLUMN allocation_type TEXT CHECK(allocation_type IN ('K_ONLY', 'KP', 'STATUTORY')) DEFAULT 'KP'");
      }

      // Also ensure statutoryDb has allocation_type for mirrored records
      const headColumnsStatutory = statutoryDb.prepare("PRAGMA table_info(salary_heads)").all() as any[];
      const headColumnNamesStatutory = headColumnsStatutory.map(c => c.name);
      if (!headColumnNamesStatutory.includes('allocation_type')) {
        statutoryDb.exec("ALTER TABLE salary_heads ADD COLUMN allocation_type TEXT CHECK(allocation_type IN ('K_ONLY', 'KP', 'STATUTORY')) DEFAULT 'KP'");
      }
    } catch(e) {
      console.error("[Database] Failed to add columns for salary_heads", e);
    }

    // Migration: Ensure employees table has emp_code and other fields
    const dbs = [primaryDb, statutoryDb];
    for (const db of dbs) {
      // Add unique indexes for master tables to prevent duplication in existing databases
      try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_location_name ON locations(name)"); } catch(e) {}
      try { 
        db.exec("DROP INDEX IF EXISTS idx_unique_division_name");
        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_division_name ON divisions(name)"); 
      } catch(e) {}
      try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_category_name ON categories(name)"); } catch(e) {}
      try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_class_name ON classes(name)"); } catch(e) {}
      try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_group_name ON groups(name)"); } catch(e) {}
      try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_dept_name ON departments(group_id, name)"); } catch(e) {}
      try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_designation_name ON designations(name)"); } catch(e) {}
      try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_salary_head_name ON salary_heads(name)"); } catch(e) {}

      const columns = db.prepare("PRAGMA table_info(employees)").all() as any[];
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('emp_code')) {
        db.exec("ALTER TABLE employees ADD COLUMN emp_code TEXT");
      }
      if (!columnNames.includes('first_name')) {
        db.exec("ALTER TABLE employees ADD COLUMN first_name TEXT");
      }
      if (!columnNames.includes('last_name')) {
        db.exec("ALTER TABLE employees ADD COLUMN last_name TEXT");
      }
      if (!columnNames.includes('slab_id')) {
        db.exec("ALTER TABLE employees ADD COLUMN slab_id INTEGER");
      }
      if (!columnNames.includes('wage_amount')) {
        db.exec("ALTER TABLE employees ADD COLUMN wage_amount REAL");
      }
      if (!columnNames.includes('bank_name')) {
        db.exec("ALTER TABLE employees ADD COLUMN bank_name TEXT");
      }
      if (!columnNames.includes('department_id')) db.exec("ALTER TABLE employees ADD COLUMN department_id INTEGER");
      if (!columnNames.includes('location_id')) db.exec("ALTER TABLE employees ADD COLUMN location_id INTEGER");

      // Migration for groups table
      const groupColumns = db.prepare("PRAGMA table_info(groups)").all() as any[];
      const groupColumnNames = groupColumns.map(c => c.name);
      if (!groupColumnNames.includes('group_id')) {
        db.exec("ALTER TABLE groups ADD COLUMN group_id INTEGER");
      }
      if (!columnNames.includes('category_id')) db.exec("ALTER TABLE employees ADD COLUMN category_id INTEGER");
      if (!columnNames.includes('division_id')) db.exec("ALTER TABLE employees ADD COLUMN division_id INTEGER");
      if (!columnNames.includes('group_id')) db.exec("ALTER TABLE employees ADD COLUMN group_id INTEGER");
      if (!columnNames.includes('class_id')) db.exec("ALTER TABLE employees ADD COLUMN class_id INTEGER");
      if (!columnNames.includes('designation_id')) db.exec("ALTER TABLE employees ADD COLUMN designation_id INTEGER");
      if (!columnNames.includes('shift_id')) db.exec("ALTER TABLE employees ADD COLUMN shift_id INTEGER");
      if (!columnNames.includes('pf_number')) db.exec("ALTER TABLE employees ADD COLUMN pf_number TEXT");
      if (!columnNames.includes('pf_joining_date')) db.exec("ALTER TABLE employees ADD COLUMN pf_joining_date TEXT");
      if (!columnNames.includes('pf_exit_date')) db.exec("ALTER TABLE employees ADD COLUMN pf_exit_date TEXT");
      if (!columnNames.includes('pf_exit_reason')) db.exec("ALTER TABLE employees ADD COLUMN pf_exit_reason TEXT");
      if (!columnNames.includes('pf_history')) db.exec("ALTER TABLE employees ADD COLUMN pf_history TEXT");
      
      // Migration for salary_heads table
      const headColumns = db.prepare("PRAGMA table_info(salary_heads)").all() as any[];
      const headColumnNames = headColumns.map(c => c.name);
      if (!headColumnNames.includes('system_head')) db.exec("ALTER TABLE salary_heads ADD COLUMN system_head TEXT");
      if (!headColumnNames.includes('applicability')) db.exec("ALTER TABLE salary_heads ADD COLUMN applicability TEXT");
      if (!headColumnNames.includes('base_on')) db.exec("ALTER TABLE salary_heads ADD COLUMN base_on TEXT");
      if (!headColumnNames.includes('is_part_of_ctc')) db.exec("ALTER TABLE salary_heads ADD COLUMN is_part_of_ctc INTEGER DEFAULT 1");
      if (!headColumnNames.includes('is_deduction')) db.exec("ALTER TABLE salary_heads ADD COLUMN is_deduction INTEGER DEFAULT 0");

      // Seed default Advance head if missing in Primary
      if (db === primaryDb) {
        const hasAdv = db.prepare("SELECT id FROM salary_heads WHERE name = ?").get('ADVANCE');
        if (!hasAdv) {
          db.prepare(`
            INSERT INTO salary_heads (name, type, is_deduction, system_head, status, applicability)
            VALUES ('ADVANCE', 'DEDUCTION', 1, 'ADVANCE', 1, 'KP')
          `).run();
          // Also sync to statutory if KP
          try { 
            statutoryDb.prepare(`
              INSERT INTO salary_heads (name, type, is_deduction, system_head, status)
              VALUES ('ADVANCE', 'DEDUCTION', 1, 'ADVANCE', 1)
            `).run();
          } catch(e) {}
        }
      }

      if (!columnNames.includes('aadhar_no')) db.exec("ALTER TABLE employees ADD COLUMN aadhar_no TEXT");
      if (!columnNames.includes('pan_no')) db.exec("ALTER TABLE employees ADD COLUMN pan_no TEXT");
      if (!columnNames.includes('uan_no')) db.exec("ALTER TABLE employees ADD COLUMN uan_no TEXT");
      if (!columnNames.includes('esi_ip_number')) db.exec("ALTER TABLE employees ADD COLUMN esi_ip_number TEXT");
      if (!columnNames.includes('esi_joining_date')) db.exec("ALTER TABLE employees ADD COLUMN esi_joining_date TEXT");
      if (!columnNames.includes('full_name_aadhar')) db.exec("ALTER TABLE employees ADD COLUMN full_name_aadhar TEXT");
      if (!columnNames.includes('father_husband_guardian_name')) db.exec("ALTER TABLE employees ADD COLUMN father_husband_guardian_name TEXT");
      if (!columnNames.includes('gender')) db.exec("ALTER TABLE employees ADD COLUMN gender TEXT");
      if (!columnNames.includes('marital_status')) db.exec("ALTER TABLE employees ADD COLUMN marital_status TEXT");
      if (!columnNames.includes('dob')) db.exec("ALTER TABLE employees ADD COLUMN dob TEXT");
      if (!columnNames.includes('joining_date')) db.exec("ALTER TABLE employees ADD COLUMN joining_date TEXT");
      if (!columnNames.includes('mobile')) db.exec("ALTER TABLE employees ADD COLUMN mobile TEXT");
      if (!columnNames.includes('mobile2')) db.exec("ALTER TABLE employees ADD COLUMN mobile2 TEXT");
      if (!columnNames.includes('email')) db.exec("ALTER TABLE employees ADD COLUMN email TEXT");
      if (!columnNames.includes('account_no')) db.exec("ALTER TABLE employees ADD COLUMN account_no TEXT");
      if (!columnNames.includes('ifsc_code')) db.exec("ALTER TABLE employees ADD COLUMN ifsc_code TEXT");
      
      // New columns from main.rs alignment
      if (!columnNames.includes('biometric_id')) db.exec("ALTER TABLE employees ADD COLUMN biometric_id TEXT");
      if (!columnNames.includes('middle_name')) db.exec("ALTER TABLE employees ADD COLUMN middle_name TEXT");
      if (!columnNames.includes('religion')) db.exec("ALTER TABLE employees ADD COLUMN religion TEXT");
      if (!columnNames.includes('blood_group')) db.exec("ALTER TABLE employees ADD COLUMN blood_group TEXT");
      if (!columnNames.includes('qualification')) db.exec("ALTER TABLE employees ADD COLUMN qualification TEXT");
      if (!columnNames.includes('is_differently_abled')) db.exec("ALTER TABLE employees ADD COLUMN is_differently_abled INTEGER DEFAULT 0");
      if (!columnNames.includes('disability_type')) db.exec("ALTER TABLE employees ADD COLUMN disability_type TEXT");
      if (!columnNames.includes('referenced_by')) db.exec("ALTER TABLE employees ADD COLUMN referenced_by TEXT");
      if (!columnNames.includes('mobile2')) db.exec("ALTER TABLE employees ADD COLUMN mobile2 TEXT");
      if (!columnNames.includes('cug_mobile')) db.exec("ALTER TABLE employees ADD COLUMN cug_mobile TEXT");
      if (!columnNames.includes('current_address')) db.exec("ALTER TABLE employees ADD COLUMN current_address TEXT");
      if (!columnNames.includes('current_pincode')) db.exec("ALTER TABLE employees ADD COLUMN current_pincode TEXT");
      if (!columnNames.includes('current_district')) db.exec("ALTER TABLE employees ADD COLUMN current_district TEXT");
      if (!columnNames.includes('current_post_office')) db.exec("ALTER TABLE employees ADD COLUMN current_post_office TEXT");
      if (!columnNames.includes('current_state')) db.exec("ALTER TABLE employees ADD COLUMN current_state TEXT");
      if (!columnNames.includes('perm_address')) db.exec("ALTER TABLE employees ADD COLUMN perm_address TEXT");
      if (!columnNames.includes('perm_pincode')) db.exec("ALTER TABLE employees ADD COLUMN perm_pincode TEXT");
      if (!columnNames.includes('perm_post_office')) db.exec("ALTER TABLE employees ADD COLUMN perm_post_office TEXT");
      if (!columnNames.includes('perm_district')) db.exec("ALTER TABLE employees ADD COLUMN perm_district TEXT");
      if (!columnNames.includes('perm_state')) db.exec("ALTER TABLE employees ADD COLUMN perm_state TEXT");
      if (!columnNames.includes('is_perm_same_as_current')) db.exec("ALTER TABLE employees ADD COLUMN is_perm_same_as_current INTEGER DEFAULT 0");
      if (!columnNames.includes('photo_url')) db.exec("ALTER TABLE employees ADD COLUMN photo_url TEXT");
      if (!columnNames.includes('photo_path')) db.exec("ALTER TABLE employees ADD COLUMN photo_path TEXT");
      if (!columnNames.includes('signature_url')) db.exec("ALTER TABLE employees ADD COLUMN signature_url TEXT");
      if (!columnNames.includes('blacklist_remarks')) db.exec("ALTER TABLE employees ADD COLUMN blacklist_remarks TEXT");
      if (!columnNames.includes('blacklist_effective_date')) db.exec("ALTER TABLE employees ADD COLUMN blacklist_effective_date TEXT");
      if (!columnNames.includes('blacklist_authorizer_id')) db.exec("ALTER TABLE employees ADD COLUMN blacklist_authorizer_id INTEGER");
      if (!columnNames.includes('blacklist_authorizer_name')) db.exec("ALTER TABLE employees ADD COLUMN blacklist_authorizer_name TEXT");
      if (!columnNames.includes('designation')) db.exec("ALTER TABLE employees ADD COLUMN designation TEXT");
      if (!columnNames.includes('eps_exempt')) db.exec("ALTER TABLE employees ADD COLUMN eps_exempt INTEGER DEFAULT 0");
      if (!columnNames.includes('gratuity_eligible_date')) db.exec("ALTER TABLE employees ADD COLUMN gratuity_eligible_date TEXT");
      if (!columnNames.includes('is_fte_contract')) db.exec("ALTER TABLE employees ADD COLUMN is_fte_contract INTEGER DEFAULT 0");

      // Migration for gratuity_provisions table (Statutory only)
      if (db === statutoryDb) {
        db.exec(`CREATE TABLE IF NOT EXISTS gratuity_provisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          emp_id INTEGER,
          month_year TEXT,
          base_salary_snapshot REAL,
          accrued_amount REAL,
          cumulative_provision REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(emp_id) REFERENCES employees(id)
        )`);
      }

      // Migration for salary_locks table
      const lockColumns = db.prepare("PRAGMA table_info(salary_locks)").all() as any[];
      const lockColumnNames = lockColumns.map(c => c.name);
      if (!lockColumnNames.includes('snapshot_config')) {
        db.exec("ALTER TABLE salary_locks ADD COLUMN snapshot_config TEXT");
      }
      if (!lockColumnNames.includes('snapshot_wage_rate')) {
        db.exec("ALTER TABLE salary_locks ADD COLUMN snapshot_wage_rate REAL");
      }
      if (!lockColumnNames.includes('snapshot_bank_acc')) {
        db.exec("ALTER TABLE salary_locks ADD COLUMN snapshot_bank_acc TEXT");
      }
      if (!lockColumnNames.includes('snapshot_ifsc')) {
        db.exec("ALTER TABLE salary_locks ADD COLUMN snapshot_ifsc TEXT");
      }
      if (!columnNames.includes('grade')) db.exec("ALTER TABLE employees ADD COLUMN grade TEXT");
      if (!columnNames.includes('employment_type')) db.exec("ALTER TABLE employees ADD COLUMN employment_type TEXT");
      if (!columnNames.includes('passport_no')) db.exec("ALTER TABLE employees ADD COLUMN passport_no TEXT");
      if (!columnNames.includes('working_day_type_id')) db.exec("ALTER TABLE employees ADD COLUMN working_day_type_id TEXT");
      if (!columnNames.includes('basic_salary')) db.exec("ALTER TABLE employees ADD COLUMN basic_salary REAL");
      if (!columnNames.includes('hra')) db.exec("ALTER TABLE employees ADD COLUMN hra REAL");
      if (!columnNames.includes('conveyance')) db.exec("ALTER TABLE employees ADD COLUMN conveyance REAL");
      if (!columnNames.includes('special_allowance')) db.exec("ALTER TABLE employees ADD COLUMN special_allowance REAL");
      if (!columnNames.includes('bank_name')) db.exec("ALTER TABLE employees ADD COLUMN bank_name TEXT");
      if (!columnNames.includes('driving_licence')) db.exec("ALTER TABLE employees ADD COLUMN driving_licence TEXT");
      if (!columnNames.includes('voter_id')) db.exec("ALTER TABLE employees ADD COLUMN voter_id TEXT");
      if (!columnNames.includes('esi_history')) db.exec("ALTER TABLE employees ADD COLUMN esi_history TEXT");
      if (!columnNames.includes('voluntary_pf_applicable')) db.exec("ALTER TABLE employees ADD COLUMN voluntary_pf_applicable INTEGER DEFAULT 0");
      if (!columnNames.includes('voluntary_pf_type')) db.exec("ALTER TABLE employees ADD COLUMN voluntary_pf_type TEXT");
      if (!columnNames.includes('voluntary_pf_value')) db.exec("ALTER TABLE employees ADD COLUMN voluntary_pf_value REAL");
      if (!columnNames.includes('payment_mode')) db.exec("ALTER TABLE employees ADD COLUMN payment_mode TEXT");
      if (!columnNames.includes('as_per_bank_name')) db.exec("ALTER TABLE employees ADD COLUMN as_per_bank_name TEXT");
      if (!columnNames.includes('bank_effective_date')) db.exec("ALTER TABLE employees ADD COLUMN bank_effective_date TEXT");
      if (!columnNames.includes('bank_history')) db.exec("ALTER TABLE employees ADD COLUMN bank_history TEXT");
      if (!columnNames.includes('employee_status')) db.exec("ALTER TABLE employees ADD COLUMN employee_status TEXT DEFAULT 'Active'");
      if (!columnNames.includes('book_joining_date')) db.exec("ALTER TABLE employees ADD COLUMN book_joining_date TEXT");
      if (!columnNames.includes('leaving_date')) db.exec("ALTER TABLE employees ADD COLUMN leaving_date TEXT");
      if (!columnNames.includes('reporting_employee_id')) db.exec("ALTER TABLE employees ADD COLUMN reporting_employee_id INTEGER");
      if (!columnNames.includes('wage_effective_from')) db.exec("ALTER TABLE employees ADD COLUMN wage_effective_from TEXT");
      if (!columnNames.includes('weekly_off')) db.exec("ALTER TABLE employees ADD COLUMN weekly_off TEXT");
      if (!columnNames.includes('weekly_off_effective_date')) db.exec("ALTER TABLE employees ADD COLUMN weekly_off_effective_date TEXT");
      if (!columnNames.includes('parent_employee_id')) db.exec("ALTER TABLE employees ADD COLUMN parent_employee_id INTEGER");
      if (!columnNames.includes('salary_process_sequence')) db.exec("ALTER TABLE employees ADD COLUMN salary_process_sequence INTEGER");
      if (!columnNames.includes('created_at')) db.exec("ALTER TABLE employees ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
      if (!columnNames.includes('is_pf_covered')) db.exec("ALTER TABLE employees ADD COLUMN is_pf_covered INTEGER DEFAULT 1");
      if (!columnNames.includes('is_esi_covered')) db.exec("ALTER TABLE employees ADD COLUMN is_esi_covered INTEGER DEFAULT 1");

      // Migration for shifts table
      const shiftColumns = db.prepare("PRAGMA table_info(shifts)").all() as any[];
      const shiftColumnNames = shiftColumns.map(c => c.name);
      if (!shiftColumnNames.includes('is24_hour_cycle')) db.exec("ALTER TABLE shifts ADD COLUMN is24_hour_cycle INTEGER DEFAULT 1");
      
      // Migration for payroll table
      const payrollColumns = db.prepare("PRAGMA table_info(payroll)").all() as any[];
      const payrollColumnNames = payrollColumns.map(c => c.name);
      if (!payrollColumnNames.includes('statutory_gross')) db.exec("ALTER TABLE payroll ADD COLUMN statutory_gross REAL");
      if (!payrollColumnNames.includes('adjusted_diff')) db.exec("ALTER TABLE payroll ADD COLUMN adjusted_diff REAL");
      if (!payrollColumnNames.includes('status')) db.exec("ALTER TABLE payroll ADD COLUMN status TEXT DEFAULT 'Committed'");
      if (!payrollColumnNames.includes('approved_by')) db.exec("ALTER TABLE payroll ADD COLUMN approved_by INTEGER");
      if (!payrollColumnNames.includes('locked_at')) db.exec("ALTER TABLE payroll ADD COLUMN locked_at DATETIME");
      if (!payrollColumnNames.includes('breakdown')) db.exec("ALTER TABLE payroll ADD COLUMN breakdown TEXT");

      // Migration for salary_heads table (Part 2)
      const headColumns2 = db.prepare("PRAGMA table_info(salary_heads)").all() as any[];
      const headColumnNames2 = headColumns2.map(c => c.name);
      if (!headColumnNames2.includes('allocation_type')) {
        db.exec("ALTER TABLE salary_heads ADD COLUMN allocation_type TEXT CHECK(allocation_type IN ('K_ONLY', 'KP', 'STATUTORY')) DEFAULT 'KP'");
      }
      // Migrations for report_templates table
      try {
        const rptCols = db.prepare("PRAGMA table_info(report_templates)").all() as any[];
        const rptColNames = rptCols.map(c => c.name);
        if (!rptColNames.includes('config_json')) db.exec("ALTER TABLE report_templates ADD COLUMN config_json TEXT");
        if (!rptColNames.includes('is_system')) db.exec("ALTER TABLE report_templates ADD COLUMN is_system INTEGER DEFAULT 0");
        if (!rptColNames.includes('shared_with_roles')) db.exec("ALTER TABLE report_templates ADD COLUMN shared_with_roles TEXT");
      } catch (e) {}

      db.exec(`CREATE TABLE IF NOT EXISTS report_schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        template_id TEXT NOT NULL,
        module_type TEXT NOT NULL,
        schedule_cron TEXT NOT NULL,
        last_run DATETIME,
        next_run DATETIME,
        status TEXT DEFAULT 'ACTIVE',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.exec(`CREATE TABLE IF NOT EXISTS report_schedule_history (
        id TEXT PRIMARY KEY,
        schedule_id TEXT NOT NULL,
        run_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL,
        file_path TEXT,
        error_message TEXT,
        FOREIGN KEY(schedule_id) REFERENCES report_schedules(id)
      )`);
    }

    // Migration for final_payroll table (Primary ONLY)
    primaryDb.exec(`CREATE TABLE IF NOT EXISTS final_payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_code TEXT,
      name TEXT,
      category TEXT,
      class TEXT,
      location TEXT,
      division TEXT,
      group_name TEXT,
      department TEXT,
      designation TEXT,
      reporting_name TEXT,
      month_year TEXT,
      working_day_type TEXT,
      wage_type TEXT,
      wage_rate REAL,
      working_days REAL,
      k_attendance REAL,
      k_gross_wage REAL,
      k_other_earnings TEXT,
      k_gross_payable REAL,
      k_deductions TEXT,
      k_net_payable REAL,
      statutory_rate REAL,
      head_wise_rates TEXT,
      p_working_days REAL,
      p_attendance REAL,
      p_gross_wage REAL,
      p_ctc_heads TEXT,
      p_other_earnings_kp TEXT,
      p_gross_statutory_payable REAL,
      p_deductions TEXT,
      net_payable_final REAL,
      payment_mode TEXT,
      ifsc TEXT,
      bank_name TEXT,
      account_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'DRAFT'
    )`);

    try {
      const pCols = primaryDb.prepare("PRAGMA table_info(final_payroll)").all() as any[];
      const pColNames = pCols.map(c => c.name);
      if (pColNames.includes('target_earned')) {
        primaryDb.exec("ALTER TABLE final_payroll RENAME COLUMN target_earned TO k_net_payable");
      }
    } catch(e) {}

    // Migration for salary_rate_history table
    for (const db of dbs) {
      db.exec(`CREATE TABLE IF NOT EXISTS salary_rate_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emp_id INTEGER,
        type TEXT CHECK(type IN ('WAGE', 'STATUTORY')),
        previous_amount REAL,
        amount REAL,
        effective_date TEXT,
        revision_type TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(emp_id) REFERENCES employees(id)
      )`);

      const columns = db.prepare("PRAGMA table_info(salary_rate_history)").all() as any[];
      const names = columns.map(c => c.name);
      if (!names.includes('previous_amount')) db.exec("ALTER TABLE salary_rate_history ADD COLUMN previous_amount REAL");
      if (!names.includes('revision_type')) db.exec("ALTER TABLE salary_rate_history ADD COLUMN revision_type TEXT");
      if (!names.includes('remarks')) db.exec("ALTER TABLE salary_rate_history ADD COLUMN remarks TEXT");
    }

    // Migration for company_config table
    for (const db of dbs) {
      const configColumns = db.prepare("PRAGMA table_info(company_config)").all() as any[];
      const configColumnNames = configColumns.map(c => c.name);
      const expectedConfigColumns = [
        'company_name', 'alias', 'phone', 'address1', 'address2', 'state', 'city', 'pincode', 'email',
        'date_of_incorporation', 'cin', 'lin', 'pf_reg_no', 'esi_reg_no', 'lwf_account_no',
        'factory_license_no', 'factory_registration_no', 'udyog_aadhaar_reg_no', 'gst_no', 'tan', 'pan',
        'activity', 'bank_accounts', 'emp_id_prefix', 'emp_id_suffix', 'emp_id_manual_entry',
        'emp_id_auto_increment', 'emp_id_padding', 'emp_id_start_number', 'biometric_ip', 'biometric_port',
        'comm_key', 'connection_type', 'connection_string', 'device_entry_type', 'table_name',
        'col_employee_code', 'col_punch_time', 'col_punch_type', 'auto_fetch', 'fetch_interval',
        'signatory_name', 'designation'
      ];
      for (const col of expectedConfigColumns) {
        if (!configColumnNames.includes(col)) {
          db.exec(`ALTER TABLE company_config ADD COLUMN ${col} ${col.includes('port') || col.includes('entry') || col.includes('increment') || col.includes('padding') || col.includes('number') || col.includes('fetch') || col.includes('interval') ? 'INTEGER' : 'TEXT'}`);
        }
      }
    }

    // Migration for users table
    for (const db of dbs) {
      const columns = db.prepare("PRAGMA table_info(users)").all() as any[];
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('login_attempts')) {
        db.exec("ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0");
      }
    }

    // Migration for piece rate tables in K Module
    primaryDb.exec(`
      CREATE TABLE IF NOT EXISTS piece_rate_heads (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          calculation_type TEXT CHECK(calculation_type IN ('SLAB', 'FIXED')) DEFAULT 'FIXED',
          applicability TEXT CHECK(applicability IN ('UNIVERSAL', 'EMPLOYEE_WISE')) DEFAULT 'UNIVERSAL',
          unit_of_measurement TEXT,
          fixed_rate REAL,
          effective_date TEXT,
          status INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS piece_rate_slabs (
          id TEXT PRIMARY KEY,
          head_id TEXT,
          min_pieces INTEGER,
          max_pieces INTEGER,
          rate REAL,
          effective_date TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT,
          FOREIGN KEY(head_id) REFERENCES piece_rate_heads(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS piece_rate_employee_mapping (
          id TEXT PRIMARY KEY,
          head_id TEXT,
          emp_id INTEGER,
          fixed_rate REAL,
          effective_date TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_by TEXT,
          FOREIGN KEY(head_id) REFERENCES piece_rate_heads(id) ON DELETE CASCADE,
          FOREIGN KEY(emp_id) REFERENCES employees(id) ON DELETE CASCADE
      );
    `);


    // Migration for working_day_types table
    for (const db of dbs) {
      const columns = db.prepare("PRAGMA table_info(working_day_types)").all() as any[];
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('mode')) {
        db.exec("ALTER TABLE working_day_types ADD COLUMN mode TEXT NOT NULL DEFAULT 'FIXED'");
      }
      if (!columnNames.includes('fixed_days')) {
        db.exec("ALTER TABLE working_day_types ADD COLUMN fixed_days REAL");
      }
      if (!columnNames.includes('formula')) {
        db.exec("ALTER TABLE working_day_types ADD COLUMN formula TEXT");
      }
      if (!columnNames.includes('is_statutory_uniform')) {
        db.exec("ALTER TABLE working_day_types ADD COLUMN is_statutory_uniform INTEGER DEFAULT 0");
      }
    }

    // Migration for wage_attendance_transactions table
    for (const db of dbs) {
      const columns = db.prepare("PRAGMA table_info(wage_attendance_transactions)").all() as any[];
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('total_time_mins')) db.exec("ALTER TABLE wage_attendance_transactions ADD COLUMN total_time_mins INTEGER DEFAULT 0");
      if (!columnNames.includes('worked_mins')) db.exec("ALTER TABLE wage_attendance_transactions ADD COLUMN worked_mins INTEGER DEFAULT 0");
      if (!columnNames.includes('outside_mins')) db.exec("ALTER TABLE wage_attendance_transactions ADD COLUMN outside_mins INTEGER DEFAULT 0");
      if (!columnNames.includes('shift_id')) db.exec("ALTER TABLE wage_attendance_transactions ADD COLUMN shift_id INTEGER");
      if (!columnNames.includes('is_missed_punch')) db.exec("ALTER TABLE wage_attendance_transactions ADD COLUMN is_missed_punch INTEGER DEFAULT 0");
      if (!columnNames.includes('created_at')) db.exec("ALTER TABLE wage_attendance_transactions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    }

    // Migration for designations table
    for (const db of dbs) {
      const columns = db.prepare("PRAGMA table_info(designations)").all() as any[];
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('skill_level')) db.exec("ALTER TABLE designations ADD COLUMN skill_level TEXT");
      if (!columnNames.includes('job_description')) db.exec("ALTER TABLE designations ADD COLUMN job_description TEXT");
    }

    // Migration for statutory_records table
    for (const db of dbs) {
      const columns = db.prepare("PRAGMA table_info(statutory_records)").all() as any[];
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('wage_rate')) db.exec("ALTER TABLE statutory_records ADD COLUMN wage_rate REAL");
      if (!columnNames.includes('fixed_components')) db.exec("ALTER TABLE statutory_records ADD COLUMN fixed_components REAL");
      if (!columnNames.includes('sync_date')) db.exec("ALTER TABLE statutory_records ADD COLUMN sync_date DATETIME DEFAULT CURRENT_TIMESTAMP");
    }

    // Migration for banks table (Refactor to minimal schema with ifsc as PK)
    for (const db of dbs) {
      const columns = db.prepare("PRAGMA table_info(banks)").all() as any[];
      const pkColumn = columns.find(c => c.pk === 1);
      
      if (pkColumn && pkColumn.name === 'id') {
        process.stdout.write(`[Database] Migrating banks table to new schema for ${db === primaryDb ? 'Primary' : 'Statutory'} DB...\n`);
        db.exec("BEGIN TRANSACTION");
        try {
          db.exec("ALTER TABLE banks RENAME TO banks_old");
          db.exec(`CREATE TABLE banks (
            ifsc TEXT PRIMARY KEY,
            bank_name TEXT,
            branch TEXT,
            sync_status TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`);
          
          // Copy data from old to new, only if ifsc is not null
          db.exec(`INSERT OR REPLACE INTO banks (ifsc, bank_name, branch, sync_status, updated_at)
                  SELECT ifsc, bank_name, branch, sync_status, updated_at FROM banks_old WHERE ifsc IS NOT NULL`);
          
          db.exec("DROP TABLE banks_old");
          db.exec("COMMIT");
          process.stdout.write("[Database] Banks table migration successful.\n");
        } catch (err) {
          db.exec("ROLLBACK");
          console.error("[Database] Banks table migration failed:", err);
        }
      }
    }

    // Migration for salary_slabs table
    for (const db of dbs) {
      const columns = db.prepare("PRAGMA table_info(salary_slabs)").all() as any[];
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('min_amount')) db.exec("ALTER TABLE salary_slabs ADD COLUMN min_amount REAL");
      if (!columnNames.includes('max_amount')) db.exec("ALTER TABLE salary_slabs ADD COLUMN max_amount REAL");
    }

    // Migration for grievances table
    for (const db of dbs) {
      const columns = db.prepare("PRAGMA table_info(grievances)").all() as any[];
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('resolution_notes')) {
        db.exec("ALTER TABLE grievances ADD COLUMN resolution_notes TEXT");
      }
      if (!columnNames.includes('resolved_at')) {
        db.exec("ALTER TABLE grievances ADD COLUMN resolved_at DATETIME");
      }
    }

    // Migration for rokda_entries table
    for (const db of dbs) {
      const columns = db.prepare("PRAGMA table_info(rokda_entries)").all() as any[];
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('designation')) {
        db.exec("ALTER TABLE rokda_entries ADD COLUMN designation TEXT");
      }
    }

    // Migration for mis_vouchers table
    for (const db of dbs) {
      const columns = db.prepare("PRAGMA table_info(mis_vouchers)").all() as any[];
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('location_id')) db.exec("ALTER TABLE mis_vouchers ADD COLUMN location_id INTEGER");
      if (!columnNames.includes('division_id')) db.exec("ALTER TABLE mis_vouchers ADD COLUMN division_id INTEGER");
      if (!columnNames.includes('group_id')) db.exec("ALTER TABLE mis_vouchers ADD COLUMN group_id INTEGER");
    }

    // Migration for mis_entries table
    for (const db of dbs) {
      const columns = db.prepare("PRAGMA table_info(mis_entries)").all() as any[];
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('token_code')) db.exec("ALTER TABLE mis_entries ADD COLUMN token_code TEXT");
      if (!columnNames.includes('worker_name')) db.exec("ALTER TABLE mis_entries ADD COLUMN worker_name TEXT");
      if (!columnNames.includes('designation')) db.exec("ALTER TABLE mis_entries ADD COLUMN designation TEXT");
    }

    // Migration for divisions table: add location_id
    for (const db of dbs) {
      const columns = db.prepare("PRAGMA table_info(divisions)").all() as any[];
      const columnNames = columns.map(c => c.name);
      if (!columnNames.includes('location_id')) {
        console.log("Migrating divisions table: adding location_id");
        db.exec("ALTER TABLE divisions ADD COLUMN location_id INTEGER");
        
        // Assign first location if available
        const firstLoc = db.prepare("SELECT id FROM locations LIMIT 1").get() as any;
        if (firstLoc) {
          db.prepare("UPDATE divisions SET location_id = ?").run(firstLoc.id);
        }
      }
    }

    // Seed/Reinstate admin user - Only if empty and not in production
    if (!CONFIG.IS_PRODUCTION) {
      const hash = await bcrypt.hash(CONFIG.ADMIN_PASSWORD, 10);
      const adminUser = primaryDb.prepare('SELECT * FROM users WHERE username = ?').get('superadmin') as any;
      
      const defaultPermissions = JSON.stringify([
        { "page": "User Management", "view": true, "addUpdate": true, "delete": true },
        { "page": "Employee Master", "view": true, "addUpdate": true, "delete": true },
        { "page": "Attendance", "view": true, "addUpdate": true, "delete": true },
        { "page": "Payroll", "view": true, "addUpdate": true, "delete": true },
        { "page": "Cost MIS", "view": true, "addUpdate": true, "delete": true }
      ]);

      let superAdminRole = primaryDb.prepare('SELECT id FROM roles WHERE name = ?').get('SUPERADMIN') as any;
      if (!superAdminRole) {
        primaryDb.prepare('INSERT INTO roles (name, description, is_system, module_scope) VALUES (?, ?, ?, ?)').run('SUPERADMIN', 'System Administrator', 1, 'BOTH');
        superAdminRole = primaryDb.prepare('SELECT id FROM roles WHERE name = ?').get('SUPERADMIN') as any;
      }
      
      const systemRoles = [
        { name: 'ADMIN', scope: 'BOTH' },
        { name: 'MANAGER', scope: 'BOTH' },
        { name: 'EXECUTIVE', scope: 'BOTH' },
        { name: 'OPERATOR', scope: 'BOTH' },
        { name: 'VIEWER', scope: 'BOTH' },
        { name: 'AUDITOR', scope: 'P' }
      ];

      for (const role of systemRoles) {
        const existing = primaryDb.prepare('SELECT id FROM roles WHERE name = ?').get(role.name) as any;
        if (!existing) {
          primaryDb.prepare('INSERT INTO roles (name, description, is_system, module_scope) VALUES (?, ?, ?, ?)').run(role.name, `System Role ${role.name}`, 1, role.scope);
        }
      }

      if (!adminUser) {
        primaryDb.prepare('INSERT INTO users (name, username, password, role_id) VALUES (?, ?, ?, ?)')
          .run('Rajesh Kumar', 'superadmin', hash, superAdminRole.id);
        console.log('[Database] Created default superadmin user');
      } else {
        primaryDb.prepare('UPDATE users SET password = ?, role_id = ? WHERE username = ?').run(hash, superAdminRole.id, 'superadmin');
        console.log('[Database] Reinstated superadmin password (Dev Mode)');
      }
    }

    // Seed pincode_master if empty - Only in non-production or if completely empty
    const pincodeCount = primaryDb.prepare('SELECT COUNT(*) as total FROM pincode_master').get() as any;
    
    // Migration for pincode_master to add id column if it doesn't exist
    try {
      const info = primaryDb.prepare("PRAGMA table_info(pincode_master)").all() as any[];
      const hasId = info.some(col => col.name === 'id');
      if (!hasId) {
        if (!CONFIG.IS_PRODUCTION) console.log('[Database] Migrating pincode_master to add id column...');
        primaryDb.transaction(() => {
          primaryDb.prepare('ALTER TABLE pincode_master RENAME TO pincode_master_old').run();
          primaryDb.prepare('CREATE TABLE pincode_master (id INTEGER PRIMARY KEY AUTOINCREMENT, pincode TEXT, statename TEXT, districtname TEXT, officename TEXT, last_updated DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(pincode, officename))').run();
          primaryDb.prepare('INSERT INTO pincode_master (pincode, statename, districtname, officename, last_updated) SELECT pincode, statename, districtname, officename, last_updated FROM pincode_master_old').run();
          primaryDb.prepare('DROP TABLE pincode_master_old').run();
          primaryDb.prepare('CREATE INDEX idx_pincode ON pincode_master(pincode)').run();
        })();
        if (!CONFIG.IS_PRODUCTION) console.log('[Database] Migration complete');
      }
      
      // Also check statutoryDb
      const statInfo = statutoryDb.prepare("PRAGMA table_info(pincode_master)").all() as any[];
      const statHasId = statInfo.some(col => col.name === 'id');
      if (!statHasId) {
        statutoryDb.transaction(() => {
          statutoryDb.prepare('ALTER TABLE pincode_master RENAME TO pincode_master_old').run();
          statutoryDb.prepare('CREATE TABLE pincode_master (id INTEGER PRIMARY KEY AUTOINCREMENT, pincode TEXT, statename TEXT, districtname TEXT, officename TEXT, last_updated DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(pincode, officename))').run();
          statutoryDb.prepare('INSERT INTO pincode_master (pincode, statename, districtname, officename, last_updated) SELECT pincode, statename, districtname, officename, last_updated FROM pincode_master_old').run();
          statutoryDb.prepare('DROP TABLE pincode_master_old').run();
          statutoryDb.prepare('CREATE INDEX idx_pincode ON pincode_master(pincode)').run();
        })();
      }
    } catch (err) {
      if (!CONFIG.IS_PRODUCTION) console.error('[Database] Pincode migration error:', err);
    }

    if (pincodeCount.total === 0 && !CONFIG.IS_PRODUCTION) {
      const stmt = primaryDb.prepare('INSERT INTO pincode_master (pincode, statename, districtname, officename) VALUES (?, ?, ?, ?)');
      const pincodes = [
        ['400001', 'Maharashtra', 'Mumbai', 'Mumbai G.P.O.'],
        ['400002', 'Maharashtra', 'Mumbai', 'Kalbadevi'],
        ['400003', 'Maharashtra', 'Mumbai', 'Mandvi'],
        ['110001', 'Delhi', 'New Delhi', 'New Delhi G.P.O.'],
        ['560001', 'Karnataka', 'Bangalore', 'Bangalore G.P.O.'],
        ['600001', 'Tamil Nadu', 'Chennai', 'Chennai G.P.O.'],
        ['700001', 'West Bengal', 'Kolkata', 'Kolkata G.P.O.'],
        ['380001', 'Gujarat', 'Ahmedabad', 'Ahmedabad G.P.O.'],
        ['395001', 'Gujarat', 'Surat', 'Surat G.P.O.'],
        ['360001', 'Gujarat', 'Rajkot', 'Rajkot G.P.O.'],
      ];
      for (const p of pincodes) {
        stmt.run(...p);
      }
      console.log('[Database] Seeded pincode_master');
    }

    primaryDb.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run("connection_status", "CONNECTED");
    statutoryDb.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run("connection_status", "CONNECTED");

    // Seed company_config
    for (const db of dbs) {
      const config = db.prepare("SELECT COUNT(*) as count FROM company_config WHERE id = 1").get() as any;
      if (config.count === 0) {
        db.prepare("INSERT INTO company_config (id, company_name) VALUES (1, ?)").run("HR-UDAN TEXTILE MILLS");
      }
    }
  };



function setupRoutes(app: express.Application, primaryDb: any, statutoryDb: any, dbState: { isReady: boolean }) {
  app.get('/api/health', (req, res) => {
    if (!dbState.isReady) {
      return res.status(503).json({ status: 'initializing', timestamp: new Date().toISOString() });
    }
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Tauri Invoke Emulator Endpoint (v1)
  app.post('/api/data-sync', apiKeyMiddleware, async (req, res) => {
    if (!dbState.isReady) {
      return res.status(503).json({ error: 'Database is still initializing' });
    }
    
    console.log("HEADERS:", req.headers);
    
    let cmd = req.body.cmd;
    let args = req.body.args || {};

    const payloadEncoding = req.headers['x-payload-encoding'] || req.headers['X-Payload-Encoding'];
    // Decode payloads
    if (payloadEncoding === 'hex') {
      try {
        const hexString = typeof req.body === 'string' ? req.body : req.body.data;
        const decoded = Buffer.from(hexString, 'hex').toString('utf-8');
        const parsed = JSON.parse(decoded);
        cmd = parsed.cmd;
        args = parsed.args || {};
      } catch (err) {
        return res.status(400).json({ error: 'Invalid hex encoded body', details: err.message, body: req.body });
      }
    } else if (typeof req.body === 'string' && req.body.length > 0 && !req.body.startsWith('{')) {
      try {
        const key = "waf-bypass";
        const bodyStr = req.body.trim();
        const binary = Buffer.from(bodyStr, 'base64').toString('binary');
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        }
        const decoded = Buffer.from(bytes).toString('utf-8');
        const parsed = JSON.parse(decoded);
        cmd = parsed.cmd;
        args = parsed.args || {};
      } catch (err) {
        return res.status(400).json({ error: 'WAF BYPASS FAILED' });
      }
    } else if (req.body && req.body.wdata) {
      try {
        const key = "waf-bypass";
        const binary = Buffer.from(req.body.wdata, 'base64').toString('binary');
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        }
        const decoded = Buffer.from(bytes).toString('utf-8');
        const parsed = JSON.parse(decoded);
        cmd = parsed.cmd;
        args = parsed.args || {};
      } catch (err) {
        return res.status(400).json({ error: 'Invalid wdata payload' });
      }
    } else if (typeof req.body === 'string' && req.body.length > 0) {
      try {
        let decoded = '';
        if (/^[0-9a-fA-F]+$/.test(req.body) && req.body.length % 2 === 0) {
          decoded = Buffer.from(req.body, 'hex').toString('utf-8');
        } else {
          decoded = Buffer.from(req.body, 'base64').toString('utf-8');
        }
        const parsed = JSON.parse(decoded);
        cmd = parsed.cmd;
        args = parsed.args || {};
      } catch (err) {
        return res.status(400).json({ error: 'Invalid encoded body' });
      }
    } else if (req.body && req.body.encodedBody) {
      try {
        const decoded = Buffer.from(req.body.encodedBody, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        cmd = parsed.cmd;
        args = parsed.args || {};
      } catch (err) {
        return res.status(400).json({ error: 'Invalid encoded body' });
      }
    }
    
      if (!CONFIG.IS_PRODUCTION) {
        const logArgs = JSON.stringify(args);
        console.log(`[Tauri Emulator] Command: ${cmd}`, logArgs.length > 500 ? `${logArgs.substring(0, 500)}... (truncated)` : logArgs);
        console.log(`Checking COMMAND_MAP for ${cmd}, exists:`, !!COMMAND_MAP[cmd]);
      }
      
      if (cmd === 'debug_commands') {
        const canteen_keys = Object.keys(await import('./commands/canteen.js'));
        return res.json({ commands: Object.keys(COMMAND_MAP), canteen_keys });
      }

      try {
        const handler = COMMAND_MAP[cmd];
        if (handler) {
          const ctx: CommandContext = { primaryDb, statutoryDb, res, req };
          await handler(ctx, args);
          return; // Stop processing further in this request
        }
        
        res.status(404).json({ error: `Command ${cmd} not implemented in emulator` });
    } catch (err: any) {
      console.error('[Tauri Emulator Error]', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // Generic API routes for backward compatibility with fetch(getUrl(...))
  app.get(['/api/master-data', '/api/statutory/master-data'], apiKeyMiddleware, (req, res) => {
    if (!CONFIG.IS_PRODUCTION) console.log(`[Emulator API] GET master-data`);
    const module_type = req.path.startsWith('/api/statutory') ? 'P' : 'K';
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
      };
      res.json(data);
    } catch (err) {
      res.json({
        departments: [],
        employees: [],
        locations: [],
        divisions: [],
        groups: [],
        categories: [],
        classes: [],
        designations: [],
        machines: [],
        shifts: [],
      });
    }
  });

  app.get(['/api/:table', '/api/statutory/:table'], apiKeyMiddleware, (req, res) => {
    const table_name = req.params.table;
    if (!CONFIG.IS_PRODUCTION) console.log(`[Emulator API] GET ${table_name}`);
    if (!table_name || table_name === 'undefined') {
      return res.status(400).json({ error: 'Table name is required or undefined' });
    }

    if (!CRUD_TABLE_WHITELIST.includes(table_name)) {
      return res.status(403).json({ error: 'Access denied. Unauthorized table.' });
    }

    const module_type = req.path.startsWith('/api/statutory') ? 'P' : 'K';
    const db = module_type === 'P' ? statutoryDb : primaryDb;
    
    try {
      const rows = db.prepare(`SELECT * FROM ${table_name}`).all();
      res.json(rows);
    } catch (err) {
      console.error(`[Emulator API] Error fetching table ${table_name}:`, err);
      res.status(404).json({ error: `Table ${table_name} not found` });
    }
  });

  app.post(['/api/:table', '/api/statutory/:table'], apiKeyMiddleware, (req, res) => {
    const table_name = req.params.table;
    if (!CONFIG.IS_PRODUCTION) console.log(`[Emulator API] POST ${table_name}`, JSON.stringify(req.body));
    if (!table_name || table_name === 'undefined') {
      return res.status(400).json({ error: 'Table name is required or undefined' });
    }

    if (!CRUD_TABLE_WHITELIST.includes(table_name)) {
      return res.status(403).json({ error: 'Access denied. Unauthorized table.' });
    }

    const module_type = req.path.startsWith('/api/statutory') ? 'P' : 'K';
    
    if (module_type === 'P') {
      const status = primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get() as any;
      if (status && status.value === 'CONNECTED') {
         return res.status(403).json({ error: 'Manual writes to Statutory (P) are blocked while Connected to K.' });
      }
    }

    const db = module_type === 'P' ? statutoryDb : primaryDb;
    const data = req.body;

    try {
      const keys = Object.keys(data).filter(k => k !== 'id');
      if (data.id) {
        // Upsert logic
        const existing = db.prepare(`SELECT id FROM ${table_name} WHERE id = ?`).get(data.id);
        if (existing) {
          const sql = `UPDATE ${table_name} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
          db.prepare(sql).run(...keys.map(k => data[k]), data.id);
        } else {
          const allKeys = Object.keys(data);
          const sql = `INSERT INTO ${table_name} (${allKeys.join(', ')}) VALUES (${allKeys.map(() => '?').join(', ')})`;
          db.prepare(sql).run(...Object.values(data));
        }
      } else {
        const sql = `INSERT INTO ${table_name} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
        db.prepare(sql).run(...Object.values(data));
      }
      res.json({ status: 'success' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save data' });
    }
  });

  app.post(['/api/:table/bulk', '/api/statutory/:table/bulk'], apiKeyMiddleware, (req, res) => {
    const table_name = req.params.table;

    if (!CRUD_TABLE_WHITELIST.includes(table_name)) {
      return res.status(403).json({ error: 'Access denied. Unauthorized table.' });
    }

    const module_type = req.path.startsWith('/api/statutory') ? 'P' : 'K';
    
    if (module_type === 'P') {
      const status = primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get() as any;
      if (status && status.value === 'CONNECTED') {
         return res.status(403).json({ error: 'Manual writes to Statutory (P) are blocked while Connected to K.' });
      }
    }

    const db = module_type === 'P' ? statutoryDb : primaryDb;
    const records = req.body.records || req.body;

    try {
      if (Array.isArray(records) && records.length > 0) {
        const keys = Object.keys(records[0]);
        const sql = `INSERT OR IGNORE INTO ${table_name} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
        const insert = db.prepare(sql);
        const transaction = db.transaction((recs) => {
          for (const rec of recs) insert.run(...Object.values(rec));
        });
        transaction(records);
      }
      res.json({ status: 'success' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to bulk save data' });
    }
  });

  app.get(['/api/master/usage/:table/:id', '/api/statutory/master/usage/:table/:id'], apiKeyMiddleware, (req, res) => {
    const { table, id } = req.params;
    const module_type = req.path.startsWith('/api/statutory') ? 'P' : 'K';
    const db = module_type === 'P' ? statutoryDb : primaryDb;

    try {
      let count = 0;
      if (table === 'shifts') {
        const atLogCount = db.prepare('SELECT count(*) as c FROM attendance_logs WHERE shift_id = ?').get(id) as any;
        const txCount = db.prepare('SELECT count(*) as c FROM wage_attendance_transactions WHERE shift_id = ?').get(id) as any;
        count = (atLogCount?.c || 0) + (txCount?.c || 0);
      } else if (table === 'salary_slabs') {
        // If the slab is tied to any employee who has generated payroll, it's considered in use
        const usageCount = db.prepare(`
           SELECT count(*) as c FROM payroll p
           JOIN employees e ON p.emp_id = e.id
           WHERE e.slab_id = ?
        `).get(id) as any;
        count = usageCount?.c || 0;
      }
      // Can add other tables here
      res.json({ usageCount: count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete(['/api/:table/:id', '/api/statutory/:table/:id'], apiKeyMiddleware, (req, res) => {
    const { table, id } = req.params;

    if (!CRUD_TABLE_WHITELIST.includes(table)) {
      return res.status(403).json({ error: 'Access denied. Unauthorized table.' });
    }

    const module_type = req.path.startsWith('/api/statutory') ? 'P' : 'K';
    
    if (module_type === 'P') {
      const status = primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get() as any;
      if (status && status.value === 'CONNECTED') {
         return res.status(403).json({ error: 'Manual writes to Statutory (P) are blocked while Connected to K.' });
      } else {
        // Disconnected - record as amendment!
        const oldData = statutoryDb.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
        if (oldData) {
          statutoryDb.prepare(`
            INSERT INTO audit_amendment_log 
            (entity, entity_id, reference_id, amendment_reason, previous_value, new_value, user_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            table,
            id,
            null,
            'Local Deletion in Audit Mode',
            JSON.stringify(oldData),
            'DELETED',
            (req as any).user ? (req as any).user.username : 'system'
          );
          return res.json({ status: 'success', message: 'Delete recorded as Audit Amendment.' });
        }
      }
    }

    const db = module_type === 'P' ? statutoryDb : primaryDb;

    try {
      if (table === 'shifts') {
        const atLogCount = db.prepare('SELECT count(*) as c FROM attendance_logs WHERE shift_id = ?').get(id) as any;
        const txCount = db.prepare('SELECT count(*) as c FROM wage_attendance_transactions WHERE shift_id = ?').get(id) as any;
        const count = (atLogCount?.c || 0) + (txCount?.c || 0);
        if (count > 0) {
           return res.status(400).json({ error: 'This shift has existing punches and cannot be hard deleted.' });
        }
      }

      if (table === 'salary_heads') {
         const txCount = db.prepare('SELECT count(*) as c FROM salary_transactions WHERE head_id = ?').get(id) as any;
         if (txCount && txCount.c > 0) {
            return res.status(400).json({ error: 'Cannot delete this salary head because it is used in one or more transactions.' });
         }
      }

      if (table === 'employees') {
         const atLogCount = db.prepare('SELECT count(*) as c FROM attendance_logs WHERE emp_id = ?').get(id) as any;
         const txCount = db.prepare('SELECT count(*) as c FROM salary_transactions WHERE emp_id = ?').get(id) as any;
         const payrollCount = db.prepare('SELECT count(*) as c FROM payroll WHERE emp_id = ?').get(id) as any;
         if ((atLogCount?.c || 0) + (txCount?.c || 0) + (payrollCount?.c || 0) > 0) {
             db.prepare('UPDATE employees SET status = 0 WHERE id = ?').run(id);
             return res.json({ status: 'success', message: 'Employee has been deactivated instead of deleted to protect historical integrity.' });
         }
      }
      
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
      res.json({ status: 'success' });
    } catch (err) {
      logError(db, 'ERROR', `Failed to delete data from ${table} (ID: ${id})`, err);
      res.status(500).json({ error: 'Failed to delete data' });
    }
  });

  // REST APIS removed, logic migrated to IPC

  // Catch-all for unhandled API routes moved to server.ts
} // End of setupRoutes

  setupDb().then(() => {
    runPostSetupMigrations(primaryDb, statutoryDb);
    primaryDb.pragma('wal_checkpoint(TRUNCATE)');
    statutoryDb.pragma('wal_checkpoint(TRUNCATE)');
    DuckDBAnalyticsRepo.init();
    setTimeout(() => DuckDBAnalyticsRepo.refreshMaterializedViews(() => {}), 2000);

    // --- RE3000 SCHEDULING ENGINE ---
    setInterval(async () => {
       const now = new Date();
       const runSchedulesForDb = async (db: Database, type: string) => {
         try {
           const schedules = db.prepare(`SELECT * FROM report_schedules WHERE status = 'ACTIVE'`).all() as any[];
           for (const schedule of schedules) {
             if (!schedule.next_run || new Date(schedule.next_run) <= now) {
                // RUN Report
                const historyId = `HIST-${Date.now()}`;
                const timestamp = now.toISOString();
                try {
                  const template = db.prepare(`SELECT * FROM report_templates WHERE id = ?`).get(schedule.template_id) as any;
                  if (!template) throw new Error("Template not found");
                  
                  let columns = [];
                  let filters = [];
                  try { columns = template.columns_json ? JSON.parse(template.columns_json) : []; } catch(e){}
                  try { filters = template.filters_json ? JSON.parse(template.filters_json) : []; } catch(e){}
                  
                  let selectCols = columns.map((c: any) => c.field === '*' ? '*' : `"${c.field.replace(/"/g, '""')}"`).join(', ');
                  if (!selectCols) selectCols = '*';
                  
                  let query = `SELECT ${selectCols} FROM "${template.base_table.replace(/"/g, '""')}"`;
                  const params: any[] = [];
                  if (filters && filters.length > 0) {
                      const whereClauses: string[] = [];
                      filters.forEach((f: any) => {
                        const safeField = `"${f.field.replace(/"/g, '""')}"`;
                        if (f.operator === 'equals') { whereClauses.push(`${safeField} = ?`); params.push(f.value); }
                        else if (f.operator === 'contains') { whereClauses.push(`${safeField} LIKE ?`); params.push(`%${f.value}%`); }
                      });
                      if (whereClauses.length > 0) query += ' WHERE ' + whereClauses.join(' AND ');
                  }
                  
                  const data = db.prepare(query).all(...params) as any[];
                  
                  const workbook = new ExcelJS.Workbook();
                  workbook.creator = 'HR-UDAN Scheduler';
                  const sheet = workbook.addWorksheet(template.name.substring(0, 31) || 'Report');
                  sheet.columns = columns.map((c: any) => ({ header: c.field, key: c.field, width: Math.max(15, c.field.length + 5) }));
                  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
                  data.forEach((row: any) => { sheet.addRow(row); });
                  
                  const exportsDir = path.join(process.cwd(), 'exports', type);
                  if (!fs.existsSync(exportsDir)) { fs.mkdirSync(exportsDir, { recursive: true }); }
                  const fileName = `${schedule.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.xlsx`;
                  const filePath = path.join(exportsDir, fileName);
                  await workbook.xlsx.writeFile(filePath);
                  
                  db.prepare(`INSERT INTO report_schedule_history (id, schedule_id, run_timestamp, status, file_path) VALUES (?, ?, ?, ?, ?)`).run(historyId, schedule.id, timestamp, 'SUCCESS', filePath);
                } catch(e: any) {
                  db.prepare(`INSERT INTO report_schedule_history (id, schedule_id, run_timestamp, status, error_message) VALUES (?, ?, ?, ?, ?)`).run(historyId, schedule.id, timestamp, 'FAILED', e.message);
                }
                
                // UPDATE next_run
                try {
                  const checkCron = (cronParser as any).parseExpression(schedule.schedule_cron);
                  const nextRun = checkCron.next().toISOString();
                  db.prepare(`UPDATE report_schedules SET last_run = ?, next_run = ? WHERE id = ?`).run(now.toISOString(), nextRun, schedule.id);
                } catch(e) {}
             }
           }
         } catch(e) {} // table might not exist immediately
       };
       runSchedulesForDb(primaryDb, 'K');
       runSchedulesForDb(statutoryDb, 'P');
    }, 60000); // 1 minute interval

    dbState.isReady = true;
    if (!CONFIG.IS_PRODUCTION) console.log('[Database] Setup completed successfully');
  }).catch(err => {
    logError(primaryDb, 'FATAL', '[Database Setup Error] Fatal error during initialization', err);
    process.exit(1);
  });

  setupRoutes(app, primaryDb, statutoryDb, dbState);
  
  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(process.cwd(), 'dist'));
  return { primaryDb, statutoryDb, dbState, setupRoutes, server };
}
