import { mapKeys, toSnakeCase, sanitizeData } from '../../src-server/legacyRouter.js';
import { isKConnected } from '../utils/syncCircuitBreaker.js';
import { CommandHandler } from './types.js';

export const getStatutorySettings: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { type, moduleType } = args;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
          try {
            const row = db.prepare("SELECT * FROM statutory_settings WHERE type = ? ORDER BY effective_date DESC LIMIT 1").get(type) as any;
            res.json(row || null);
          } catch (error: any) {
            console.error('[get_statutory_settings] Error:', error);
            res.status(500).json({ error: error.message });
          
}
};

export const listStatutorySettings: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { type, moduleType } = args;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
          try {
            const rows = db.prepare("SELECT * FROM statutory_settings WHERE type = ? ORDER BY effective_date DESC").all(type);
            res.json(rows);
          } catch (error: any) {
            console.error('[list_statutory_settings] Error:', error);
            res.status(500).json({ error: error.message });
          
}
};

export const saveStatutorySettings: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { type, config: configData, moduleType, id } = args;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
          try {
            const config = configData.config;
            const effective_date = configData.effective_date;
            
            if (id) {
              db.prepare("UPDATE statutory_settings SET config = ?, effective_date = ? WHERE id = ?")
                .run(JSON.stringify(config || {}), effective_date, id);
            } else {
              db.prepare("INSERT INTO statutory_settings (type, config, effective_date) VALUES (?, ?, ?)")
                .run(type, JSON.stringify(config || {}), effective_date);
            }

            // Sync to Statutory if we are in K
            if ((moduleType || args.module_type) === 'K' && isKConnected(primaryDb)) {
               try {
                   if (id) {
                       statutoryDb.prepare("UPDATE statutory_settings SET config = ?, effective_date = ? WHERE type = ? AND effective_date = ?")
                           .run(JSON.stringify(config || {}), effective_date, type, effective_date); 
                       // Upsert basically, but we might not have the ID in statutory. Let's delete and insert to be safe, or just insert if not exists.
                       statutoryDb.prepare("DELETE FROM statutory_settings WHERE type = ?").run(type);
                       statutoryDb.prepare("INSERT INTO statutory_settings (type, config, effective_date) VALUES (?, ?, ?)").run(type, JSON.stringify(config || {}), effective_date);
                   } else {
                       statutoryDb.prepare("DELETE FROM statutory_settings WHERE type = ?").run(type);
                       statutoryDb.prepare("INSERT INTO statutory_settings (type, config, effective_date) VALUES (?, ?, ?)")
                         .run(type, JSON.stringify(config || {}), effective_date);
                   }
               } catch (syncErr) {
                   console.error("Mirror sync err", syncErr);
               }
            }
            
            res.json({ status: 'success' });
          } catch (error: any) {
            console.error('[save_statutory_settings] Error:', error);
            res.status(500).json({ error: error.message });
          
}
};

export const deleteStatutorySetting: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { id, moduleType } = args;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
          try {
            let deletedType: string | null = null;
            if ((moduleType || args.module_type) === 'K' && isKConnected(primaryDb)) {
               const row = primaryDb.prepare("SELECT type FROM statutory_settings WHERE id = ?").get(id) as any;
               if (row) deletedType = row.type;
            }

            db.prepare("DELETE FROM statutory_settings WHERE id = ?").run(id);

            if ((moduleType || args.module_type) === 'K' && isKConnected(primaryDb) && deletedType) {
                statutoryDb.prepare("DELETE FROM statutory_settings WHERE type = ?").run(deletedType);
            }

            res.json({ status: 'success' });
          } catch (error: any) {
            console.error('[delete_statutory_setting] Error:', error);
            res.status(500).json({ error: error.message });
          
}
};

export const calculatePtax: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { grossEarning, state, moduleType } = args;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
          try {
            const row = db.prepare("SELECT config FROM statutory_settings WHERE type = 'PTAX' ORDER BY effective_date DESC LIMIT 1").get() as any;
            
            if (row) {
              const config = JSON.parse(row.config);
              if (config.slabs && Array.isArray(config.slabs)) {
                for (const slab of config.slabs) {
                  const from = slab.from || 0;
                  const to = slab.to || Infinity;
                  const amount = slab.amount || 0;
                  
                  if (grossEarning > from && grossEarning <= to) {
                    return res.json(amount);
                  }
                }
              }
            }
          } catch (e) {
            console.error("Error calculating PT:", e);
          }
          res.json(0);
          
};

export const getGratuityLedger: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { empId, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          try {
            const records = db.prepare('SELECT * FROM gratuity_provisions WHERE emp_id = ? ORDER BY month_year DESC').all(empId);
            res.json(records);
          } catch (e: any) {
            console.error('[get_gratuity_ledger] error', e);
            res.status(500).json({ error: e.message });
          
}
};

export const syncSalarySlabsToP: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { slabs } = args;
          const status = primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get() as any;
          if (status?.value === 'DISCONNECTED') {
            return res.status(403).json({ error: 'Sync blocked: System is in DISCONNECTED state' });
          }

          try {
            const columnsInfoStatutory = statutoryDb.prepare(`PRAGMA table_info(salary_slabs)`).all() as any[];
            const validColumnsStatutory = columnsInfoStatutory.map(c => c.name);

            const transaction = statutoryDb.transaction((syncSlabs) => {
              for (const slab of syncSlabs) {
                const snakeSlab = mapKeys(slab, toSnakeCase);
                const { name, ...otherData } = snakeSlab;
                
                // Keep only existing columns
                const filteredData: any = {};
                for (const col of validColumnsStatutory) {
                    if (otherData[col] !== undefined && col !== 'id' && col !== 'name') {
                        filteredData[col] = otherData[col];
                    }
                }
                
                // Stringify components if it's an object/array
                if (filteredData.components && typeof filteredData.components !== 'string') {
                    filteredData.components = JSON.stringify(filteredData.components);
                }

                const keys = Object.keys(filteredData);
                const existing = statutoryDb.prepare('SELECT id FROM salary_slabs WHERE name = ?').get(name) as any;
                
                if (existing) {
                  if (keys.length > 0) {
                      const sql = `UPDATE salary_slabs SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE name = ?`;
                      statutoryDb.prepare(sql).run(...keys.map(k => sanitizeData(filteredData[k])), name);
                  }
                } else {
                  const sql = `INSERT INTO salary_slabs (name, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`;
                  const values = [name, ...keys.map(k => sanitizeData(filteredData[k]))];
                  statutoryDb.prepare(sql).run(...values);
                }
              }
            });
            transaction(slabs);
            res.json({ status: 'success' });
          } catch (err: any) {
            console.error('[Sync Salary Slabs Error]', err);
            res.status(500).json({ error: err.message });
          
}
};
