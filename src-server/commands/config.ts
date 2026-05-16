import { CommandHandler } from './types.js';
import { mapKeys, toSnakeCase, sanitizeData } from '../utils/helpers.js';
import { logError } from '../utils/logger.js';

export const getCompanyConfig: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const module_type = args?.module_type || args?.moduleType || 'K';
  const db = module_type === 'P' ? statutoryDb : primaryDb;

  try {
    const row = db.prepare('SELECT * FROM company_config WHERE id = 1').get() as any;
    if (row) {
      const configData = { ...row };
      if (typeof configData.bank_accounts === 'string') {
        try {
          configData.bank_accounts = JSON.parse(configData.bank_accounts);
        } catch (e) {
          configData.bank_accounts = [];
        }
      }
      if (typeof configData.signatories === 'string') {
        try {
          configData.signatories = JSON.parse(configData.signatories);
        } catch (e) {
          configData.signatories = [];
        }
      }
      res.json(configData);
    } else {
      // Fallback: If not in P, try K
      if (module_type === 'P') {
        const kRow = primaryDb.prepare('SELECT * FROM company_config WHERE id = 1').get() as any;
        if (kRow) {
           const configData = { ...kRow };
           if (typeof configData.bank_accounts === 'string') {
             try { configData.bank_accounts = JSON.parse(configData.bank_accounts); } catch (e) { configData.bank_accounts = []; }
           }
           if (typeof configData.signatories === 'string') {
             try { configData.signatories = JSON.parse(configData.signatories); } catch (e) { configData.signatories = []; }
           }
           return res.json(configData);
        }
      }
      res.json(null);
    }
  } catch (err) {
    logError(db, 'ERROR', '[Config] Failed to get company config', err);
    res.status(500).json({ error: 'Failed to fetch company config' });
  }
};

export const saveCompanyConfig: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res } = ctx;
  const module_type = args?.module_type || args?.moduleType || 'K';
  const db = module_type === 'P' ? statutoryDb : primaryDb;
  const config = args?.config || {};
  const snakeData = mapKeys(config, toSnakeCase);

  // Handle bank_accounts and signatories as JSON string
  if (snakeData.bank_accounts && typeof snakeData.bank_accounts !== 'string') {
    snakeData.bank_accounts = JSON.stringify(snakeData.bank_accounts);
  }
  if (snakeData.signatories && typeof snakeData.signatories !== 'string') {
    snakeData.signatories = JSON.stringify(snakeData.signatories);
  }

  const columns = db.prepare("PRAGMA table_info(company_config)").all() as any[];
  const columnNames = columns.map(c => c.name);
  const keys = Object.keys(snakeData).filter(k => columnNames.includes(k) && k !== 'id');
  const values = keys.map(k => sanitizeData(snakeData[k]));

  try {
    const sql = `INSERT OR REPLACE INTO company_config (id, ${keys.join(', ')}) VALUES (1, ${keys.map(() => '?').join(', ')})`;
    db.prepare(sql).run(...values);

    // Mirror Sync to Statutory if in Module K
    if (module_type === 'K') {
      try {
        statutoryDb.prepare(sql).run(...values);
        console.log('[Sync] Company config mirrored to Statutory DB');
      } catch (mirrorErr) {
        logError(statutoryDb, 'WARN', '[Mirror Sync] Failed to mirror company_config', mirrorErr);
      }
    }

    res.json({ status: 'success' });
  } catch (err: any) {
    logError(db, 'ERROR', '[Config] Failed to save company config', err);
    res.status(500).json({ error: `Database error: ${err.message}` });
  }
};

export const getPayrollRules: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  try {
    const row = primaryDb.prepare('SELECT * FROM company_payroll_rules WHERE id = 1').get() as any;
    if (row) {
      res.json(row);
    } else {
      res.json({ k_salary_calculation_source: 'EMPLOYEE_MASTER' });
    }
  } catch (err) {
    logError(primaryDb, 'ERROR', '[Config] Failed to get payroll rules', err);
    res.status(500).json({ error: 'Failed to fetch payroll rules' });
  }
};

export const updatePayrollRules: CommandHandler = (ctx, args) => {
  const { primaryDb, res } = ctx;
  const { rules } = args;
  try {
    if (!rules || !rules.k_salary_calculation_source) {
       return res.status(400).json({ error: 'Invalid payload' });
    }
    
    primaryDb.prepare(`
      INSERT OR REPLACE INTO company_payroll_rules (id, k_salary_calculation_source, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
    `).run(rules.k_salary_calculation_source);
    
    res.json({ status: 'success' });
  } catch (err: any) {
    logError(primaryDb, 'ERROR', '[Config] Failed to update payroll rules', err);
    res.status(500).json({ error: `Database error: ${err.message}` });
  }
};

