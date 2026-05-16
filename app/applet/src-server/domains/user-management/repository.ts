import { Database } from 'better-sqlite3';
import { BaseRepository } from '../base.repository';

export class UserManagementRepository extends BaseRepository<any> {
  constructor(primaryDb: Database, statutoryDb: Database) {
    super(primaryDb, statutoryDb);
  }

  findByUsername(username: string, moduleType: 'K' | 'P') {
    const db = this.getDb(moduleType);
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  // P module maintains its own user table
  // K syncs user records to P when connected
  syncUserToP(user: any) {
    if (!this.isKConnected()) return;

    try {
      const { id, username, password, role_id, full_name, email, phone } = user;
      this.statutoryDb.prepare(`
        INSERT INTO users (id, username, password, role_id, full_name, email, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          username=excluded.username,
          password=excluded.password,
          role_id=excluded.role_id,
          full_name=excluded.full_name,
          email=excluded.email,
          phone=excluded.phone
      `).run(id, username, password, role_id, full_name, email, phone);
    } catch (error) {
      console.error("Failed to sync user to P module:", error);
    }
  }

  getRoles(moduleType: 'K' | 'P') {
    const db = this.getDb(moduleType);
    // Rule 11: Auditor role exists exclusively in P Module
    if (moduleType === 'K') {
      return db.prepare("SELECT * FROM roles WHERE name != 'Auditor'").all();
    }
    return db.prepare("SELECT * FROM roles").all();
  }
}
