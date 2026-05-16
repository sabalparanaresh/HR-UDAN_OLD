import { Database } from 'better-sqlite3';
import { BaseRepository } from '../base.repository';

export class EmployeeRepository extends BaseRepository<any> {
  constructor(primaryDb: Database, statutoryDb: Database) {
    super(primaryDb, statutoryDb);
  }

  // Rule 18 & 19: Employee records never hard delete.
  deactivateEmployee(id: number, userId: string, moduleType: 'K' | 'P') {
    const db = this.getDb(moduleType);
    
    db.transaction(() => {
      const oldData = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
      if (!oldData) throw new Error('Employee not found');

      db.prepare('UPDATE employees SET status = 0 WHERE id = ?').run(id);

      // K sync to P
      if (this.isKConnected() && moduleType === 'K') {
        try { 
          this.statutoryDb.prepare('UPDATE employees SET status = 0 WHERE id = ?').run(id); 
        } catch(e) {}
      }

      this.logAudit(db, 'employees', id, 'UPDATE', userId, oldData, { ...(oldData as any), status: 0 });
    })();
  }

  findById(id: number, moduleType: 'K' | 'P') {
     const db = this.getDb(moduleType);
     return db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  }

  // Returns paginated employees, omitting deactivated if requested
  listEmployees(moduleType: 'K' | 'P', { showInactive = false, limit = 50, offset = 0 } = {}) {
     const db = this.getDb(moduleType);
     const statusFilter = showInactive ? '' : 'WHERE status = 1';
     return db.prepare(`SELECT * FROM employees ${statusFilter} ORDER BY id ASC LIMIT ? OFFSET ?`).all(limit, offset);
  }
}
