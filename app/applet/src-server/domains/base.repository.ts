import { Database } from 'better-sqlite3';

export abstract class BaseRepository<T> {
  protected primaryDb: Database;
  protected statutoryDb: Database;

  constructor(primaryDb: Database, statutoryDb: Database) {
    this.primaryDb = primaryDb;
    this.statutoryDb = statutoryDb;
  }

  protected getDb(moduleType: 'K' | 'P'): Database {
    return moduleType === 'P' ? this.statutoryDb : this.primaryDb;
  }

  protected isKConnected(): boolean {
    try {
      const row = this.primaryDb.prepare("SELECT 1 FROM company_config LIMIT 1").get();
      return !!row;
    } catch {
      return false;
    }
  }

  // Base audit log method to ensure immutability rule
  protected logAudit(db: Database, tableName: string, recordId: number, action: 'INSERT' | 'UPDATE' | 'DELETE', userId: string, oldData?: any, newData?: any) {
    db.prepare(`
      INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      tableName,
      recordId,
      action,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      userId
    );
  }
}
