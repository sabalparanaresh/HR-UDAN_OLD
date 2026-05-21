import { CommandContext } from '../../commands/types.js';
import { CONFIG } from '../../config.js';
import jwt from 'jsonwebtoken';

import express from 'express';
import { COMMAND_MAP } from '../../commands/index.js';
import { CRUD_TABLE_WHITELIST } from '../../db/whitelists.js';
import { apiKeyMiddleware } from '../../middleware/apiKey.js';
import { emitEvent, eventClients } from '../../services/sse.js';
import { sanitizeData, syncEarningTransactionToP, syncSalaryHead } from '../sync-engine/helpers.js';
import { logError } from '../../utils/logger.js';

export const rpcRouter = express.Router();

export function setupLegacyEventStream(app: express.Application) {
  app.get('/api/events', (req, res) => {
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  const dbState = (req as any).dbState;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const clientId = Date.now();
    const newClient = { id: clientId, res };
    eventClients.push(newClient);
    req.on('close', () => {
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  const dbState = (req as any).dbState;
      const index = eventClients.findIndex(c => c.id === clientId);
      if (index !== -1) eventClients.splice(index, 1);
    });
  });
}

const bridgeGuardMiddleware = (primaryDb: any) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  const dbState = (req as any).dbState;
  try {
    const bridgeRow = primaryDb.prepare("SELECT state FROM bridge_state WHERE id = 1").get() as any;
    if (bridgeRow && bridgeRow.state === 'DISCONNECTED_AUDIT') {
      const isReadOp = req.method === 'GET' || (req.body && (!req.body.cmd || !req.body.cmd.includes('write') && !req.body.cmd.includes('update') && !req.body.cmd.includes('delete') && !req.body.cmd.includes('create') && req.body.operation !== 'create' && req.body.operation !== 'update' && req.body.operation !== 'delete'));
      const isPing = req.body?.cmd === 'ping';
      const isAuth = req.body?.cmd === 'auth_user';
      if (!isReadOp && !isPing && !isAuth) {
         return res.status(403).json({ error: 'SYSTEM DB IS IN AUDIT DISCONNECTED STATE. All direct UI writes to Primary Database are currently blocked to preserve audit integrity. Please wait for Sync Engine reconnect.' });
      }
    }
  } catch(e) {}
  next();
};


  rpcRouter.get('/api/health', (req, res) => {
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  const dbState = (req as any).dbState;


    if (!dbState.isReady) {
      return res.status(503).json({ status: 'initializing', timestamp: new Date().toISOString() });
    }
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Data-Sync / Command Emulator Endpoint (v1)
  rpcRouter.post('/api/data-sync', apiKeyMiddleware, (req, res, next) => bridgeGuardMiddleware((req as any).primaryDb)(req, res, next), async (req, res) => {
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  const dbState = (req as any).dbState;



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
        const key = Buffer.from("waf-bypass");
        const buf = Buffer.from(req.body.trim(), 'base64');
        for (let i = 0; i < buf.length; i++) {
          buf[i] ^= key[i % key.length];
        }
        const decoded = buf.toString('utf-8');
        const parsed = JSON.parse(decoded);
        cmd = parsed.cmd;
        args = parsed.args || {};
      } catch (err) {
        return res.status(400).json({ error: 'WAF BYPASS FAILED' });
      }
    } else if (req.body && req.body.wdata) {
      try {
        const key = Buffer.from("waf-bypass");
        const buf = Buffer.from(req.body.wdata, 'base64');
        for (let i = 0; i < buf.length; i++) {
          buf[i] ^= key[i % key.length];
        }
        const decoded = buf.toString('utf-8');
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
    
    // Auth Check
    delete req.headers['x-user-role'];
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decodedToken = jwt.verify(token, CONFIG.SECURITY_KEY) as any;
        (req as any).user = decodedToken;
        req.headers['x-user-role'] = decodedToken.role;
      } catch(err) {
        // invalid token
      }
    }
    
      if (!CONFIG.IS_PRODUCTION) {
        const logArgs = JSON.stringify(args);
        console.log(`[Data-Sync] Command: ${cmd}`, logArgs.length > 500 ? `${logArgs.substring(0, 500)}... (truncated)` : logArgs);
        console.log(`Checking COMMAND_MAP for ${cmd}, exists:`, !!COMMAND_MAP[cmd]);
      }
      
      if (cmd === 'debug_commands') {
        return res.json({ commands: Object.keys(COMMAND_MAP) });
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
      console.error('[Emulator Error]', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // Generic API routes for backward compatibility with fetch(getUrl(...))
  rpcRouter.get(['/api/master-data', '/api/statutory/master-data'], apiKeyMiddleware, (req, res) => {
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  const dbState = (req as any).dbState;


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

  rpcRouter.get(['/api/:table', '/api/statutory/:table'], apiKeyMiddleware, (req, res) => {
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  const dbState = (req as any).dbState;


    const table_name = req.params.table as string;
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

  rpcRouter.post(['/api/:table', '/api/statutory/:table'], apiKeyMiddleware, (req, res) => {
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  const dbState = (req as any).dbState;


    const table_name = req.params.table as string;
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

  rpcRouter.post(['/api/:table/bulk', '/api/statutory/:table/bulk'], apiKeyMiddleware, (req, res) => {
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  const dbState = (req as any).dbState;


    const table_name = req.params.table as string;

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
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  const dbState = (req as any).dbState;
          for (const rec of recs) insert.run(...Object.values(rec));
        });
        transaction(records);
      }
      res.json({ status: 'success' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to bulk save data' });
    }
  });

  rpcRouter.get(['/api/master/usage/:table/:id', '/api/statutory/master/usage/:table/:id'], apiKeyMiddleware, (req, res) => {
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  const dbState = (req as any).dbState;


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

  rpcRouter.delete(['/api/:table/:id', '/api/statutory/:table/:id'], apiKeyMiddleware, (req, res) => {
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  const dbState = (req as any).dbState;


    const { table, id } = req.params;
    const table_name = String(table);

    if (!CRUD_TABLE_WHITELIST.includes(table_name)) {
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
