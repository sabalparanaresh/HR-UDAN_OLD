import { Database } from 'better-sqlite3';
import { BaseRepository } from '../base.repository';

export class SyncEngineRepository extends BaseRepository<any> {
  constructor(primaryDb: Database, statutoryDb: Database) {
    super(primaryDb, statutoryDb);
  }

  getPendingQueueItems(limit: number = 1000) {
    return this.primaryDb.prepare(`
      SELECT * FROM sync_queue 
      WHERE status = 'PENDING' OR (status = 'FAILED' AND retries < 3)
      ORDER BY updated_at ASC
      LIMIT ?
    `).all(limit) as any[];
  }

  markQueueProcessing(ids: number[]) {
    if (ids.length === 0) return;
    this.primaryDb.transaction(() => {
      const stmt = this.primaryDb.prepare(`UPDATE sync_queue SET status = 'PROCESSING' WHERE id = ?`);
      for (const id of ids) {
        stmt.run(id);
      }
    })();
  }

  markQueueCompleted(id: number, entityType: string, entityId: number, operation: string) {
    this.primaryDb.transaction(() => {
      this.primaryDb.prepare(`UPDATE sync_queue SET status = 'COMPLETED', retries = retries + 1 WHERE id = ?`).run(id);
      this.primaryDb.prepare(`INSERT INTO sync_log (entity_type, entity_id, operation, status) VALUES (?, ?, ?, 'SUCCESS')`)
        .run(entityType, entityId, operation);
    })();
  }

  markQueueFailed(id: number, entityType: string, entityId: number, operation: string, error: string) {
    this.primaryDb.transaction(() => {
      this.primaryDb.prepare(`UPDATE sync_queue SET status = 'FAILED', retries = retries + 1 WHERE id = ?`).run(id);
      this.primaryDb.prepare(`INSERT INTO sync_log (entity_type, entity_id, operation, status, error) VALUES (?, ?, ?, 'FAILED', ?)`)
        .run(entityType, entityId, operation, error);
    })();
  }

  // Raw data push only, no derived calculation. 
  syncEntityToStatutory(entityType: string, entityId: number, operation: string, payload: any) {
    if (!this.isKConnected()) throw new Error("K module must be connected to sync to P module.");
    
    // Only raw sync
    // Delegate actual deletion, update, insertion
    if (operation === 'DELETE') {
       this.statutoryDb.prepare(`DELETE FROM ${entityType} WHERE id = ?`).run(entityId);
    } else {
       const keys = Object.keys(payload);
       const cols = keys.join(', ');
       const placeholders = keys.map(() => '?').join(', ');
       const updates = keys.map(k => `${k} = excluded.${k}`).join(', ');
       
       this.statutoryDb.prepare(`
         INSERT INTO ${entityType} (${cols}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates}
       `).run(...Object.values(payload));
    }
  }
}
