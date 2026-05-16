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
