import Database from 'better-sqlite3';
import fs from 'fs';

export class SQLiteOptimizer {
  /**
   * Applies enterprise-grade SQLite pragmas for performance and concurrency.
   * Ideal for 50,000+ records and bulk operations.
   */
  static applyEnterprisePragmas(db: Database.Database) {
    // Write-Ahead Logging: enables concurrent readers and writers
    db.pragma('journal_mode = WAL');
    
    // synchronous=NORMAL is highly optimized for WAL, reducing fsync calls
    db.pragma('synchronous = NORMAL');
    
    // mmap_size: memory-map up to 1GB of the database, skipping read syscalls
    db.pragma(`mmap_size = ${1024 * 1024 * 1024}`);
    
    // cache_size: negative values mean kilobytes. -200000 = ~200MB cache
    db.pragma('cache_size = -200000');
    
    // temp_store=MEMORY: keep temporary tables/indices in RAM instead of disk
    db.pragma('temp_store = MEMORY');
    
    // busy_timeout: instructs SQLite to wait (spin/sleep) internally up to 15s before SQLITE_BUSY
    db.pragma('busy_timeout = 15000');
    
    // Ensure auto-vacuum is off or incremental for predictable latency
    db.pragma('auto_vacuum = NONE');
  }

  /**
   * Enable slow query logging. Monkey-patches the prepared statement methods.
   * Do not use overly aggressive threshold in production.
   */
  static enableSlowQueryLog(db: Database.Database, thresholdMs: number = 100) {
    const originalPrepare = db.prepare.bind(db);
    db.prepare = (source: string) => {
      const stmt = originalPrepare(source);
      
      const patchMethod = (method: 'run' | 'get' | 'all') => {
        const originalMethod = stmt[method].bind(stmt);
        stmt[method] = (...args: any[]) => {
          const start = performance.now();
          const result = originalMethod(...args);
          const end = performance.now();
          const duration = end - start;
          
          if (duration > thresholdMs) {
            console.warn(`[SLOW_QUERY] ${duration.toFixed(2)}ms | ${source.substring(0, 150)}${source.length > 150 ? '...' : ''}`);
          }
          return result;
        };
      };

      patchMethod('run');
      patchMethod('get');
      patchMethod('all');

      return stmt;
    };
  }

  /**
   * Synchronous retry wrapper for SQLITE_BUSY or SQLITE_LOCKED.
   * Since we use busy_timeout=15000, we rely on SQLite's internal wait.
   * Application-level spin-locks freeze the Node.js event loop.
   */
  static withRetry<T>(operation: () => T, maxRetries = 5, backoffMs = 50): T {
    // Rely on better-sqlite3 native busy_timeout handling.
    // The previous tight-loop spinlock would unilaterally block the 
    // Node.js Event Loop for the entire duration, freezing API requests.
    return operation();
  }

  /**
   * Safe transaction wrapper with automatic retries for locks.
   */
  static executeTransaction<T>(db: Database.Database, operation: () => T): T {
    return this.withRetry(() => {
        const transaction = db.transaction(operation);
        return transaction();
    });
  }

  /**
   * Utility to check index health/coverage on the DB.
   */
  static analyzeIndexHealth(db: Database.Database): Record<string, { totalRows: number, indexCount: number }> {
    const health: Record<string, { totalRows: number, indexCount: number }> = {};
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
    
    for (const t of tables) {
      const tableName = t.name;
      try {
        const countRes = db.prepare(`SELECT COUNT(*) as c FROM ${tableName}`).get() as any;
        const idxRes = db.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='index' AND tbl_name = ?").get(tableName) as any;
        health[tableName] = {
          totalRows: countRes.c,
          indexCount: idxRes.c
        };
      } catch (e) {
        // Skip tables that can't be analyzed
      }
    }
    return health;
  }
}
