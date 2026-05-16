import Database from 'better-sqlite3';

export class SyncEngineService {
  constructor(private primaryDb: Database, private statutoryDb: Database) {}

  public isConnected(): boolean {
    const bridgeRow = this.primaryDb.prepare("SELECT state FROM bridge_state WHERE id = 1").get() as any;
    if (bridgeRow) {
      if (bridgeRow.state === 'DISCONNECTED_AUDIT') return false;
      return bridgeRow.state === 'CONNECTED';
    }
    const row = this.primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get() as any;
    return row?.value === 'CONNECTED';
  }

  public enqueue(entity_type: string, entity_id: number | string, operation: string, payload: any) {
    const stmt = this.primaryDb.prepare(`
      INSERT INTO sync_queue (entity_type, entity_id, operation, payload, status)
      VALUES (?, ?, ?, ?, 'PENDING')
    `);
    stmt.run(entity_type, entity_id, operation, JSON.stringify(payload));
  }

  public async processQueue() {
    if (!this.isConnected()) return;

    const pending = this.primaryDb.prepare("SELECT * FROM sync_queue WHERE status = 'PENDING' OR status = 'FAILED' ORDER BY id ASC LIMIT 100").all() as any[];

    for (const item of pending) {
      if (!this.isConnected()) break; // Circuit breaker if disconnected mid-sync

      try {
        const payload = JSON.parse(item.payload || '{}');
        this.syncItem(item.entity_type, item.entity_id, item.operation, payload);
        
        // Mark success
        this.primaryDb.prepare("UPDATE sync_queue SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(item.id);
        
        // Log to sync_log
        this.primaryDb.prepare(`
          INSERT INTO sync_log (entity_type, entity_id, operation, status, error)
          VALUES (?, ?, ?, 'SUCCESS', NULL)
        `).run(item.entity_type, item.entity_id, item.operation);

      } catch (e: any) {
        console.error(`[SyncEngine] Failed to sync item ${item.id}:`, e);
        // Mark failed
        const newRetries = (item.retries || 0) + 1;
        this.primaryDb.prepare("UPDATE sync_queue SET status = 'FAILED', retries = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newRetries, item.id);
        
        this.primaryDb.prepare(`
          INSERT INTO sync_log (entity_type, entity_id, operation, status, error)
          VALUES (?, ?, ?, 'FAILED', ?)
        `).run(item.entity_type, item.entity_id, item.operation, e.message);
      }
    }
  }

  public refreshPCacheInK() {
    if (!this.isConnected()) return;
    
    // Refresh the P-module data snapshot stored in K-module for reporting purposes
    const snapshotId = `P-SNAP-${Date.now()}`;
    let pData = [];
    try {
        pData = this.statutoryDb.prepare(`SELECT * FROM statutory_records ORDER BY id DESC LIMIT 1000`).all() as any[];
    } catch(e) {}
    
    const snapshotData = JSON.stringify({ cached: true, timestamp: Date.now(), statutory_records: pData });

    try {
        this.primaryDb.prepare(`
            INSERT OR REPLACE INTO report_snapshots (id, template_id, snapshot_date, data_json, module_type)
            VALUES (?, 'P_MODULE_CACHE', date('now'), ?, 'P')
        `).run(snapshotId, snapshotData);
    } catch(e) {
        console.error("Failed to update P module cache in primary DB", e);
    }
  }

  private syncItem(entity_type: string, entity_id: number | string, operation: string, payload: any) {
    let pkColumn = 'id';
    if (entity_type === 'banks') pkColumn = 'ifsc';
    if (entity_type === 'settings') pkColumn = 'key';
    if (entity_type === 'leave_balances') pkColumn = 'emp_id';

    if (operation === 'DELETE') {
      const stmt = this.statutoryDb.prepare(`DELETE FROM ${entity_type} WHERE ${pkColumn} = ?`);
      stmt.run(entity_id);
      return;
    }

    if (operation === 'INSERT' || operation === 'UPDATE') {
      let finalPayload = payload || {};
      
      // If payload is empty, dynamically fetch the current record from primaryDb
      if (Object.keys(finalPayload).length === 0) {
        try {
          const record = this.primaryDb.prepare(`SELECT * FROM ${entity_type} WHERE ${pkColumn} = ?`).get(entity_id);
          if (!record) return; // Record was deleted before we could sync it
          finalPayload = record;
        } catch (e) {
          console.error(`[SyncEngine] Failed to fetch record for ${entity_type} ID ${entity_id}`, e);
          return;
        }
      }

      const keys = Object.keys(finalPayload);
      if (keys.length === 0) return;

      const placeholders = keys.map(() => '?').join(', ');
      const setKeys = keys.map(k => `${k} = EXCLUDED.${k}`).join(', ');

      const query = `
        INSERT INTO ${entity_type} (${keys.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT(${pkColumn}) DO UPDATE SET ${setKeys}
      `;
      
      const values = keys.map(k => finalPayload[k]);
      this.statutoryDb.prepare(query).run(...values);
    }
  }

  public validateChecksums() {
    // Basic row count checksum for core tables
    const tables = ['employees', 'departments', 'designations', 'locations'];
    const results = [];
    
    for (const table of tables) {
      let pCount = -1;
      let sCount = -1;
      try { pCount = (this.primaryDb.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any).c; } catch(e){}
      try { sCount = (this.statutoryDb.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any).c; } catch(e){}
      
      results.push({
        table,
        primaryCount: pCount,
        statutoryCount: sCount,
        match: pCount === sCount
      });
    }
    
    return results;
  }
}