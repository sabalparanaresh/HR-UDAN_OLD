import Database from 'better-sqlite3';
import { CONFIG } from '../config.js';
import { logError } from '../utils/logger.js';

export function runPostSetupMigrations(primaryDb: Database.Database, statutoryDb: Database.Database) {
  // 1. Migration for org_hierarchy
  const migrateOrgHierarchy = (db: Database.Database) => {
    try {
      // Clean up duplicates before creating index
      db.exec(`
        DELETE FROM org_hierarchy 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM org_hierarchy 
          GROUP BY name, type, IFNULL(parent_id, -1)
        )
      `);
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_org_hierarchy_name_type_parent ON org_hierarchy(name, type, IFNULL(parent_id, -1))`);
    } catch (e) {
      logError(db, 'ERROR', 'org_hierarchy index creation/cleanup failed during post-setup migration', e);
    }
  };

  migrateOrgHierarchy(primaryDb);
  migrateOrgHierarchy(statutoryDb);

  // 2. Migration for standard_rates: rename designation to designation_id if it exists as text
  const migrateStandardRates = (db: Database.Database) => {
    try {
      const info = db.prepare("PRAGMA table_info(standard_rates)").all() as any[];
      const hasDesignation = info.find(c => c.name === 'designation');
      const hasDesignationId = info.find(c => c.name === 'designation_id');
      
      if (hasDesignation && !hasDesignationId) {
        if (!CONFIG.IS_PRODUCTION) console.log("[Migration] Renaming designation to designation_id in standard_rates...");
        db.exec("ALTER TABLE standard_rates RENAME COLUMN designation TO designation_id");
      }
    } catch (e) {
      logError(db, 'ERROR', 'standard_rates migration failed', e);
    }
  };

  migrateStandardRates(primaryDb);
  migrateStandardRates(statutoryDb);

  // 3. Migration for org_hierarchy (legacy data)
  try {
    const count = primaryDb.prepare("SELECT count(*) as count FROM org_hierarchy").get() as any;
    if (count.count === 0) {
      if (!CONFIG.IS_PRODUCTION) console.log("[Migration] Migrating locations and divisions to org_hierarchy...");
      
      // Migrate locations
      const locations = primaryDb.prepare("SELECT * FROM locations").all() as any[];
      for (const loc of locations) {
        primaryDb.prepare("INSERT OR IGNORE INTO org_hierarchy (id, name, type, description, status, created_at) VALUES (?, ?, 'Location', ?, ?, ?)")
          .run(loc.id, loc.name, loc.description, loc.status, loc.created_at);
      }
      
      // Migrate divisions
      const divisions = primaryDb.prepare("SELECT * FROM divisions").all() as any[];
      for (const div of divisions) {
        const newDivId = div.id + 10000;
        primaryDb.prepare("INSERT OR IGNORE INTO org_hierarchy (id, name, type, parent_id, description, status, created_at) VALUES (?, ?, 'Division', ?, ?, ?, ?)")
          .run(newDivId, div.name, div.location_id, div.description, div.status, div.created_at);
        
        // Update employees to point to the new division ID in org_hierarchy
        primaryDb.prepare("UPDATE employees SET division_id = ? WHERE division_id = ?")
          .run(newDivId, div.id);
      }
    }
  } catch (e) {
    logError(primaryDb, 'ERROR', 'org_hierarchy migration failed', e);
  }

  // 4. Cleanup Duplicates and Enforce Constraints for salary_heads
  const cleanupSalaryHeads = (db: Database.Database) => {
    try {
      // 1. Delete duplicates keeping the lowest ID
      db.exec(`
        DELETE FROM salary_heads 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM salary_heads 
          GROUP BY name
        )
      `);
      // 2. Ensure unique index exists
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_heads_name ON salary_heads(name)`);
    } catch (err) {
      logError(db, 'ERROR', 'Error cleaning salary_heads during post-setup migration', err);
    }
  };

  cleanupSalaryHeads(primaryDb);
  cleanupSalaryHeads(statutoryDb);

  // 5. Indexing for employee search
  const createEmpSearchPriorityIndex = (db: Database.Database) => {
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_emp_search_priority ON employees(status, emp_code, name)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(emp_code)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_aadhar_name ON employees(full_name_aadhar)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_first_name ON employees(first_name)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_last_name ON employees(last_name)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_aadhar_no ON employees(aadhar_no)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_mobile ON employees(mobile)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_uan_no ON employees(uan_no)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_pf_number ON employees(pf_number)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_esi_ip_number ON employees(esi_ip_number)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_driving_licence ON employees(driving_licence)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_voter_id ON employees(voter_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_passport_no ON employees(passport_no)`);
    } catch (e) {
      logError(db, 'ERROR', 'Could not create idx_emp_search_priority', e);
    }
  };
  createEmpSearchPriorityIndex(primaryDb);
  createEmpSearchPriorityIndex(statutoryDb);

  const migrateWeeklyOff = (db: Database.Database) => {
    try {
      const info = db.prepare("PRAGMA table_info(weekly_off)").all() as any[];
      if (!info.find(c => c.name === 'allocation_type')) {
        db.exec("ALTER TABLE weekly_off ADD COLUMN allocation_type TEXT");
      }
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_off_day ON weekly_off(day)");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_working_day_types_name ON working_day_types(name)");
    } catch (e) {
      logError(db, 'ERROR', 'weekly_off or working_day_types migration failed', e);
    }
  };

  migrateWeeklyOff(primaryDb);
  migrateWeeklyOff(statutoryDb);

  // 6. Add payment_mode to salary_transactions
  const addPaymentMode = (db: Database.Database) => {
    try {
      const info = db.prepare("PRAGMA table_info(salary_transactions)").all() as any[];
      const hasPaymentMode = info.find(c => c.name === 'payment_mode');
      if (!hasPaymentMode) {
        if (!CONFIG.IS_PRODUCTION) console.log("[Migration] Adding payment_mode column to salary_transactions...");
        db.exec("ALTER TABLE salary_transactions ADD COLUMN payment_mode TEXT");
      }
    } catch(e) {
      logError(db, 'ERROR', 'Could not add payment_mode to salary_transactions', e);
    }
  };
  // 7. Migration for canteen rate changes
  const migrateCanteenRates = (db: Database.Database) => {
    try {
      const rulesInfo = db.prepare("PRAGMA table_info(canteen_rules)").all() as any[];
      if (!rulesInfo.find(c => c.name === 'dish_rate')) {
        if (!CONFIG.IS_PRODUCTION) console.log("[Migration] Adding dish_rate column to canteen_rules...");
        db.exec("ALTER TABLE canteen_rules ADD COLUMN dish_rate REAL DEFAULT 0");
      }
      if (!rulesInfo.find(c => c.name === 'effective_date')) {
        if (!CONFIG.IS_PRODUCTION) console.log("[Migration] Adding effective_date column to canteen_rules...");
        db.exec("ALTER TABLE canteen_rules ADD COLUMN effective_date TEXT");
      }
    } catch(e) {
      logError(db, 'ERROR', 'Could not add columns to canteen_rules', e);
    }
  };

  migrateCanteenRates(primaryDb);
  migrateCanteenRates(statutoryDb);

  // 8. Dynamic Audit Triggers
  const applyAuditTriggers = (db: Database.Database) => {
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('audit_log', 'audit_amendment_log', 'sync_log', 'sync_queue', 'payroll_lock', 'system_logs')").all() as {name: string}[];

      for (const table of tables) {
        const tableName = table.name;
        const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
        if (!cols.length) continue;

        const idCol = cols.find(c => c.pk > 0)?.name || cols[0].name;

        db.exec(`DROP TRIGGER IF EXISTS trg_audit_${tableName}_insert`);
        db.exec(`DROP TRIGGER IF EXISTS trg_audit_${tableName}_update`);
        db.exec(`DROP TRIGGER IF EXISTS trg_audit_${tableName}_delete`);

        const buildJsonObj = (prefix: 'NEW' | 'OLD') => {
            const chunks = [];
            for (let i = 0; i < cols.length; i += 50) {
               const chunk = cols.slice(i, i + 50);
               const args = chunk.map(c => `'${c.name}', ${prefix}.${c.name}`).join(', ');
               chunks.push(`json_object(${args})`);
            }
            if (chunks.length === 0) return '"{}"';
            if (chunks.length === 1) return chunks[0];
            
            let expr = chunks[0];
            for (let i = 1; i < chunks.length; i++) {
               expr = `json_patch(${expr}, ${chunks[i]})`;
            }
            return expr;
        };

        const newJsonObj = buildJsonObj('NEW');
        const oldJsonObj = buildJsonObj('OLD');

        db.exec(`
          CREATE TRIGGER IF NOT EXISTS trg_audit_${tableName}_insert
          AFTER INSERT ON ${tableName}
          BEGIN
            INSERT INTO audit_log (table_name, record_id, action, new_data)
            VALUES ('${tableName}', NEW.${idCol}, 'INSERT', ${newJsonObj});
          END;
        `);

        db.exec(`
          CREATE TRIGGER IF NOT EXISTS trg_audit_${tableName}_update
          AFTER UPDATE ON ${tableName}
          BEGIN
            INSERT INTO audit_log (table_name, record_id, action, old_data, new_data)
            VALUES ('${tableName}', NEW.${idCol}, 'UPDATE', ${oldJsonObj}, ${newJsonObj});
          END;
        `);

        db.exec(`
          CREATE TRIGGER IF NOT EXISTS trg_audit_${tableName}_delete
          AFTER DELETE ON ${tableName}
          BEGIN
            INSERT INTO audit_log (table_name, record_id, action, old_data)
            VALUES ('${tableName}', OLD.${idCol}, 'DELETE', ${oldJsonObj});
          END;
        `);
      }
    } catch (e) {
      logError(db, 'ERROR', 'Could not apply dynamic audit triggers', e);
    }
  };

  // 8. Add History Tracking Fields to Transaction Tables
  const addHistoryFields = (db: Database.Database) => {
    try {
      // Create canteen_entries if it doesn't exist
      db.exec(`CREATE TABLE IF NOT EXISTS canteen_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emp_id INTEGER NOT NULL,
        date TEXT,
        amount REAL DEFAULT 0,
        batch_id TEXT,
        created_by TEXT,
        modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(emp_id) REFERENCES employees(id)
      )`);

      // Map of tables to their required new columns
      const tables = [
        { name: 'canteen_punches', cols: ['date', 'amount', 'batch_id', 'created_by', 'modified_at'] },
        { name: 'rokda_entries', cols: ['emp_id', 'date', 'batch_id', 'created_by', 'modified_at'] },
        { name: 'mis_entries', cols: ['date', 'amount', 'batch_id', 'created_by', 'modified_at'] }
      ];

      for (const table of tables) {
        let info;
        try {
          info = db.prepare(`PRAGMA table_info(${table.name})`).all() as any[];
        } catch(e) { continue; } // Table might not exist

        const addCol = (colName: string, colDef: string) => {
          if (!info.find(c => c.name === colName)) {
            db.exec(`ALTER TABLE ${table.name} ADD COLUMN ${colName} ${colDef}`);
          }
        };

        if (table.cols.includes('emp_id')) addCol('emp_id', 'INTEGER');
        if (table.cols.includes('date')) addCol('date', 'TEXT');
        if (table.cols.includes('amount')) addCol('amount', 'REAL DEFAULT 0');
        if (table.cols.includes('batch_id')) addCol('batch_id', 'TEXT');
        if (table.cols.includes('created_by')) addCol('created_by', 'TEXT');
        if (table.cols.includes('modified_at')) addCol('modified_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

        db.exec(`CREATE INDEX IF NOT EXISTS idx_${table.name}_batch_id ON ${table.name}(batch_id)`);
        if (table.cols.includes('date')) {
           db.exec(`CREATE INDEX IF NOT EXISTS idx_${table.name}_date ON ${table.name}(date)`);
        }
      }
    } catch(e) {
      logError(db, 'ERROR', 'Could not add history fields to transaction tables', e);
    }
  };

  addHistoryFields(primaryDb);
  addHistoryFields(statutoryDb);

  // 9. Add attendance_qty to daily_mis_entries
  const addAttendanceQty = (db: Database.Database) => {
    try {
      const info = db.prepare("PRAGMA table_info(daily_mis_entries)").all() as any[];
      if (!info.find(c => c.name === 'attendance_qty')) {
        db.exec("ALTER TABLE daily_mis_entries ADD COLUMN attendance_qty REAL DEFAULT 1");
      }
    } catch(e) {
      logError(db, 'ERROR', 'Could not add attendance_qty to daily_mis_entries', e);
    }
  };

  addAttendanceQty(primaryDb);

  try {
    const cols = statutoryDb.prepare("PRAGMA table_info(audit_amendment_log)").all() as any[];
    if (cols.length > 0 && !cols.some(c => c.name === 'entity')) {
      // Recreate table
      statutoryDb.transaction(() => {
        statutoryDb.exec(`
          CREATE TABLE audit_amendment_log_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            reference_id INTEGER,
            amendment_reason TEXT,
            previous_value TEXT,
            new_value TEXT,
            user_id TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        // if old records exist, we'll lose them, but it's safe to drop since it was just added.
        statutoryDb.exec(`DROP TABLE audit_amendment_log`);
        statutoryDb.exec(`ALTER TABLE audit_amendment_log_new RENAME TO audit_amendment_log`);
      })();
    }
  } catch (e) {
    logError(statutoryDb, 'ERROR', 'Could not migrate audit_amendment_log', e);
  }

  // 10. Migrate Attendance Punches from JSON string to normalized table
  const migratePunches = (db: Database.Database) => {
    try {
      // Check if migration is needed by checking if attendance_punches is empty but attendance_logs has JSON punches
      const punchCount = db.prepare("SELECT COUNT(*) as c FROM attendance_punches").get() as any;
      if (punchCount.c === 0) {
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        const insertPunch = db.prepare(`
          INSERT INTO attendance_punches (attendance_log_id, punch_time, punch_type, device_id) 
          VALUES (?, ?, ?, ?)
        `);

        while (hasMore) {
          const logs = db.prepare("SELECT id, punches FROM attendance_logs WHERE punches IS NOT NULL AND punches != '[]' LIMIT ? OFFSET ?").all(limit, offset) as any[];
          if (logs.length === 0) {
            hasMore = false;
            break;
          }

          db.transaction((logsBatch: any[]) => {
            for (const log of logsBatch) {
              try {
                const punchesArray = JSON.parse(log.punches);
                for (let i = 0; i < punchesArray.length; i++) {
                  const p = punchesArray[i];
                  if (p.punch_in) {
                    insertPunch.run(log.id, p.punch_in, 'IN', p.device || 'migration');
                  }
                  if (p.punch_out) {
                    insertPunch.run(log.id, p.punch_out, 'OUT', p.device || 'migration');
                  }
                }
              } catch (parseError) {
                // Ignore parse errors on bad data
              }
            }
          })(logs);

          offset += limit;
        }
      }
    } catch(e) {
      logError(db, 'ERROR', 'Could not migrate attendance_punches', e);
    }
  };

  migratePunches(primaryDb);
  migratePunches(statutoryDb);

  applyAuditTriggers(primaryDb);
  applyAuditTriggers(statutoryDb);
}
