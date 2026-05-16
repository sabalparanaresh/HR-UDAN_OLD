import { CommandHandler } from './types.js';

export const getPincodeSettings: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const key = `pincode_mode_${args.moduleType || 'K'}`;
          const row = primaryDb.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
          res.json({ mode: row?.value || 'OFFLINE' });
          
};

export const savePincodeSettings: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const key = `pincode_mode_${args.moduleType || 'K'}`;
          primaryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, args.mode);
          res.json({ status: 'success' });
          
};

export const getPincodeRecords: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { page = 1, limit = 20, search = '', moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          const offset = (page - 1) * limit;
          
          let sql = 'SELECT * FROM pincode_master';
          let countSql = 'SELECT COUNT(*) as total FROM pincode_master';
          const params: any[] = [];
          
          if (search) {
            sql += ' WHERE pincode LIKE ? OR statename LIKE ? OR districtname LIKE ? OR officename LIKE ?';
            countSql += ' WHERE pincode LIKE ? OR statename LIKE ? OR districtname LIKE ? OR officename LIKE ?';
            const s = `%${search}%`;
            params.push(s, s, s, s);
          }
          
          sql += ' ORDER BY pincode ASC LIMIT ? OFFSET ?';
          const rows = db.prepare(sql).all(...params, limit, offset);
          const total = (db.prepare(countSql).get(...params) as any).total;
          
          res.json({ records: rows, total });
          
};

export const fetchPincodeDetails: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { pincode, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          const details = db.prepare('SELECT * FROM pincode_master WHERE pincode = ?').all(pincode);
          if (!details || details.length === 0) {
            return res.status(404).json({ error: 'Pincode not found in local database' });
          }
          res.json(details);
          
};
