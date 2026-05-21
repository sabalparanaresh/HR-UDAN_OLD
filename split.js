import fs from 'fs';
import path from 'path';

let content = fs.readFileSync('src-server/legacyRouter.ts', 'utf8');

// We will split this huge file into three files:
// 1. src-server/middleware/apiKey.ts
// 2. src-server/db/bootstrap.ts
// 3. src-server/domains/rpc/routes.ts

const matchApiKey = content.match(/const apiKeyMiddleware = \([\s\S]*?\n\};/);
if (matchApiKey) {
  let apiKeyCode = matchApiKey[0];
  apiKeyCode = `import { CONFIG } from '../config.js';\nimport express from 'express';\n\nexport ${apiKeyCode}`;
  fs.mkdirSync('src-server/middleware', { recursive: true });
  fs.writeFileSync('src-server/middleware/apiKey.ts', apiKeyCode);
  console.log("Wrote apiKey.ts");
}

let helpersCode = `
import { isKConnected } from '../utils/helpers.js';
import { logError } from '../utils/logger.js';
export function syncSalaryHead(headData: any, primaryDb: any, statutoryDb: any) {
  if (!isKConnected(primaryDb)) return;

  try {
    const headName = headData.name;
    const fullHead = primaryDb.prepare('SELECT * FROM salary_heads WHERE name = ?').get(headName) as any;
    if (!fullHead) return;

    // Head should be synced to P unless explicitly set to K_ONLY
    const shouldMirror = fullHead.allocation_type !== 'K_ONLY';

    if (shouldMirror) {
      primaryDb.prepare("INSERT OR IGNORE INTO sync_queue (entity_type, entity_id, operation) VALUES ('salary_heads', ?, 'UPDATE')").run(fullHead.id);
    } else {
      primaryDb.prepare("INSERT OR IGNORE INTO sync_queue (entity_type, entity_id, operation) VALUES ('salary_heads', ?, 'DELETE')").run(fullHead.id);
    }
  } catch (err) {
    logError(primaryDb, 'ERROR', '[Sync] Error in syncSalaryHead', err);
  }
}

export function syncEarningTransactionToP(operation: 'create' | 'update' | 'delete', k_tx_id: number, primaryDb: any, statutoryDb: any) {
  if (!isKConnected(primaryDb)) return;
  try {
    if (operation === 'delete') {
      primaryDb.prepare("INSERT OR IGNORE INTO sync_queue (entity_type, entity_id, operation) VALUES ('salary_transactions', ?, 'DELETE')").run(k_tx_id);
      return;
    }

    const tx = primaryDb.prepare(\`
      SELECT st.*, sh.name as head_name, sh.allocation_type, sh.type as head_type, e.emp_code
      FROM salary_transactions st
      JOIN salary_heads sh ON st.head_id = sh.id
      JOIN employees e ON st.emp_id = e.id
      WHERE st.id = ?
    \`).get(k_tx_id) as any;

    if (!tx || (tx.allocation_type !== 'KP' && tx.allocation_type !== 'STATUTORY')) {
      if (operation === 'update') {
        primaryDb.prepare("INSERT OR IGNORE INTO sync_queue (entity_type, entity_id, operation) VALUES ('salary_transactions', ?, 'DELETE')").run(k_tx_id);
      }
      return;
    }

    primaryDb.prepare("INSERT OR IGNORE INTO sync_queue (entity_type, entity_id, operation) VALUES ('salary_transactions', ?, ?)").run(k_tx_id, operation === 'create' ? 'INSERT' : 'UPDATE');
  } catch (err) {
    logError(primaryDb, 'ERROR', '[Sync] Error in syncEarningTransactionToP', err);
  }
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
`;

fs.writeFileSync('src-server/domains/sync-engine/helpers.ts', helpersCode);
console.log("Wrote sync-engine/helpers.ts");

// Extract SSE
let sseCode = `
export let eventClients: { id: number; res: any }[] = [];
export const emitEvent = (event: string, payload: any) => {
  const data = JSON.stringify({ event, payload });
  eventClients.forEach(c => c.res.write(\`data: \${data}\\n\\n\`));
};
`;
fs.writeFileSync('src-server/services/sse.ts', sseCode);
console.log("Wrote sse.ts");

// The core DB Setup logic
let coreDbCode = `
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config.js';
import { SCHEMAS, MIGRATIONS } from './schema.js';
import { runPostSetupMigrations } from './migrations.js';
import { logError } from '../utils/logger.js';
import { DuckDBAnalyticsRepo } from '../services/DuckDBAnalytics.js';
import bcrypt from 'bcryptjs';
import cronParser from 'cron-parser';
import ExcelJS from 'exceljs';

export async function bootstrapDatabase() {
  const dbState = { isReady: false };
  if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
    fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
  }

  const primaryDb = new Database('data/primary.db', { timeout: 15000 });
  const statutoryDb = new Database('data/statutory.db', { timeout: 15000 });

  const { SQLiteOptimizer } = await import('./optimizer.js');
  SQLiteOptimizer.applyEnterprisePragmas(primaryDb);
  SQLiteOptimizer.applyEnterprisePragmas(statutoryDb);
  
  primaryDb.pragma('foreign_keys = ON');
  statutoryDb.pragma('foreign_keys = ON');
  SQLiteOptimizer.enableSlowQueryLog(primaryDb, 200);
  SQLiteOptimizer.enableSlowQueryLog(statutoryDb, 200);
  
  setInterval(() => {
    try {
      primaryDb.pragma('wal_checkpoint(PASSIVE)');
      statutoryDb.pragma('wal_checkpoint(PASSIVE)');
    } catch (e) {
      console.warn("WAL checkpoint failed", e);
    }
  }, 10 * 60 * 1000);

  setInterval(DuckDBAnalyticsRepo.refreshMaterializedViews, 5 * 60 * 1000);

  setInterval(async () => {
    try {
      const { SyncEngineService } = await import('../domains/sync-engine/service.js');
      const syncService = new SyncEngineService(primaryDb, statutoryDb);
      if (syncService.isConnected()) {
        await syncService.processQueue();
      }
    } catch (e: any) {
      console.warn("Sync queue process interval failed:", e.message);
    }
  }, 15000);

` + content.substring(content.indexOf('const setupDb = async () => {'), content.indexOf('setupRoutes(app, primaryDb, statutoryDb, dbState);')) + `

  await setupDb();
  runPostSetupMigrations(primaryDb, statutoryDb);
  primaryDb.pragma('wal_checkpoint(TRUNCATE)');
  statutoryDb.pragma('wal_checkpoint(TRUNCATE)');
  
  DuckDBAnalyticsRepo.init()
      .then(() => {
         console.log("DuckDB Initialized successfully, triggering view refresh...");
         return DuckDBAnalyticsRepo.refreshMaterializedViews(() => {});
      })
      .catch(e => console.error("DuckDB Init Error", e));

  return { primaryDb, statutoryDb, dbState };
}
`;

fs.writeFileSync('src-server/db/bootstrap.ts', coreDbCode);
console.log("Wrote db/bootstrap.ts");

const routesCode = `
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
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const clientId = Date.now();
    const newClient = { id: clientId, res };
    eventClients.push(newClient);
    req.on('close', () => {
      const index = eventClients.findIndex(c => c.id === clientId);
      if (index !== -1) eventClients.splice(index, 1);
    });
  });
}

const bridgeGuardMiddleware = (primaryDb: any) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

` + content.substring(content.indexOf('setupRoutes(app: express.Application'), content.indexOf('// Catch-all for unhandled API routes moved to server.ts'))
    .replace('setupRoutes(app: express.Application, primaryDb: any, statutoryDb: any, dbState: any) {', '')
    .replace(/app\.post\(/g, "rpcRouter.post(")
    .replace(/app\.get\(/g, "rpcRouter.get(")
    .replace(/app\.delete\(/g, "rpcRouter.delete(")
    .replace(/app\.put\(/g, "rpcRouter.put(")
    .replace(/app\.patch\(/g, "rpcRouter.patch(")
    .replace('// Setup a bridge guard inline middleware for updates', '');

fs.mkdirSync('src-server/domains/rpc', { recursive: true });
// Strip out that last closing brace from setupRoutes
let fc = routesCode.lastIndexOf('}');
fs.writeFileSync('src-server/domains/rpc/routes.ts', routesCode.substring(0, fc) + '\n');
console.log("Wrote rpc/routes.ts");
