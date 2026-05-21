
import { isKConnected } from '../../utils/syncCircuitBreaker.js';
import { logError } from '../../utils/logger.js';
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

    const tx = primaryDb.prepare(`
      SELECT st.*, sh.name as head_name, sh.allocation_type, sh.type as head_type, e.emp_code
      FROM salary_transactions st
      JOIN salary_heads sh ON st.head_id = sh.id
      JOIN employees e ON st.emp_id = e.id
      WHERE st.id = ?
    `).get(k_tx_id) as any;

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
