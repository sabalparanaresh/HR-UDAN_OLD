import Database from 'better-sqlite3';
import { SyncEngineService } from '../domains/sync-engine/service.js';

export class SalarySlabSyncService {
  /**
   * Automatically enqueues and syncs K-module salary slab changes to P-module.
   * If the circuit breaker is CONNECTED, it triggers real-time processing of the queue.
   */
  public static async handleSync(
    primaryDb: Database.Database,
    statutoryDb: Database.Database,
    operation: 'create' | 'update' | 'delete',
    id: number | string,
    data?: any
  ): Promise<void> {
    try {
      const syncService = new SyncEngineService(primaryDb, statutoryDb);
      const opUpper = operation.toUpperCase();

      if (opUpper === 'DELETE') {
        // Enqueue the DELETE operation
        syncService.enqueue('salary_slabs', id, 'DELETE', null);
      } else {
        // For CREATE and UPDATE, ensure we have the complete, up-to-date record from K-module.
        // This guarantees database/data integrity and prevents partial updates issues.
        let fullRow = data;
        if (!fullRow || Object.keys(fullRow).length === 0) {
          fullRow = primaryDb.prepare('SELECT * FROM salary_slabs WHERE id = ?').get(id);
        }

        if (fullRow) {
          // If the payload has complex objects (like components JSON / list) make sure they are stringified
          const payload = { ...fullRow };
          if (payload.components && typeof payload.components !== 'string') {
            payload.components = JSON.stringify(payload.components);
          }
          // Remove ID from the inserted payload to prevent conflict mapping if enqueued
          delete payload.id;

          syncService.enqueue('salary_slabs', id, opUpper, payload);
        }
      }

      // If the bridge is CONNECTED, process the queue in real-time, matching standard sync architecture
      if (syncService.isConnected()) {
        await syncService.processQueue();
      }
    } catch (err: any) {
      console.error(`[SalarySlabSyncService] Error during auto-sync for slab ID ${id}:`, err.message);
    }
  }
}
