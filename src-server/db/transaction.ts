import Database from 'better-sqlite3';

export function runInTransaction<T>(db: Database.Database, action: () => T): T {
  const tx = db.transaction(action);
  return tx();
}

export function setupWAL(db: Database.Database) {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
}
