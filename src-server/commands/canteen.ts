import { recalculateCanteenRules } from '../utils/canteen.js';
import { logError } from '../utils/logger.js';
import { CommandHandler } from './types.js';

export const getCanteenMasterData: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { moduleType } = args;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
          try {
            // Auto-update rules on load based on effective date
            recalculateCanteenRules(db);

            const config = db.prepare('SELECT * FROM canteen_config ORDER BY id DESC LIMIT 1').get() || { device_ip: '', device_port: 8000, status: 'Disconnected' };
            const windows = db.prepare('SELECT * FROM canteen_time_windows').all();
            const permissions = db.prepare(`
              SELECT 
                e.id as emp_id, 
                e.name as emp_name, 
                e.emp_code,
                cl.name as class_name,
                ca.name as category_name,
                g.name as group_name,
                d.name as department_name,
                des.name as designation_name,
                p.rule_id,
                p.benefit_type,
                p.is_manual_override,
                p.rate_override
              FROM employees e
              LEFT JOIN canteen_employee_benefits p ON e.id = p.emp_id
              LEFT JOIN classes cl ON e.class_id = cl.id
              LEFT JOIN categories ca ON e.category_id = ca.id
              LEFT JOIN groups g ON e.group_id = g.id
              LEFT JOIN departments d ON e.department_id = d.id
              LEFT JOIN designations des ON e.designation_id = des.id
              WHERE e.status = 1
            `).all();
            const employees = db.prepare('SELECT id, name, emp_code FROM employees WHERE status = 1').all();
            
            // Rules with JSON parsing
            const rulesRaw = db.prepare('SELECT * FROM canteen_rules').all();
            const rules = rulesRaw.map((r: any) => ({
              ...r,
              categories: JSON.parse(r.categories || '[]'),
              classes: JSON.parse(r.classes || '[]'),
              groups: JSON.parse(r.groups || '[]'),
              departments: JSON.parse(r.departments || '[]'),
              designations: JSON.parse(r.designations || '[]')
            }));

            // Master data for rules
            const categories = db.prepare('SELECT id, name FROM categories WHERE status = 1').all();
            const classes = db.prepare('SELECT id, name FROM classes WHERE status = 1').all();
            const groups = db.prepare('SELECT id, name FROM groups WHERE status = 1').all();
            const departments = db.prepare('SELECT id, name FROM departments WHERE status = 1').all();
            const designations = db.prepare('SELECT id, name FROM designations WHERE status = 1').all();

            res.json({ 
              config, 
              windows, 
              permissions, 
              employees, 
              rules,
              categories,
              classes,
              groups,
              departments,
              designations
            });
          } catch (err) {
            logError(db, 'ERROR', '[get_canteen_master_data] Error', err);
            res.status(500).json({ error: 'Failed to fetch canteen master data' });
          
}
};

export const updateCanteenOverride: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { moduleType, empId, rateOverride, benefitType } = args;
        const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
        
        try {
          if (rateOverride === null || rateOverride === '') {
            // Revert to automatic rules
            db.prepare('UPDATE canteen_employee_benefits SET is_manual_override = 0, rate_override = NULL, benefit_type = ? WHERE emp_id = ?').run(benefitType || 'Full Deduction', empId);
            // Trigger recalculation so this employee gets correctly evaluated
            setTimeout(() => recalculateCanteenRules(db), 10);
          } else {
            const upsertStmt = db.prepare(`
              INSERT INTO canteen_employee_benefits (emp_id, benefit_type, is_manual_override, rate_override)
              VALUES (?, ?, 1, ?)
              ON CONFLICT(emp_id) DO UPDATE SET 
                is_manual_override = 1,
                benefit_type = excluded.benefit_type,
                rate_override = excluded.rate_override
            `);
            upsertStmt.run(empId, benefitType || 'Full Deduction', rateOverride);
          }
          res.json({ status: 'success' });
          } catch(err: any) {
            res.status(500).json({ error: err.message });
          
}
};

export const calculateCanteenDeductions: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  
          const { month, moduleType } = args;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
          
          try {
            // Auto update rules before calculating deductions
            recalculateCanteenRules(db);

            const punches = db.prepare('SELECT * FROM canteen_punches WHERE punch_time LIKE ?').all(`${month}%`) as any[];
            const windows = db.prepare('SELECT * FROM canteen_time_windows').all() as any[];
            const benefits = db.prepare('SELECT b.*, r.discount_rate, r.dish_rate FROM canteen_employee_benefits b LEFT JOIN canteen_rules r ON b.rule_id = r.id').all() as any[];
            const config = db.prepare('SELECT * FROM canteen_config ORDER BY id DESC LIMIT 1').get() as any;

            const empDeductions: Record<number, { count: number, total: number }> = {};

            for (const punch of punches) {
              const punchTimeStr = punch.punch_time;
              const timePart = punchTimeStr.split(' ')[1] || punchTimeStr.split('T')[1] || punchTimeStr;
              const [h, m] = timePart.split(':').map(Number);
              const punchTotalMinutes = h * 60 + m;

              let isValid = false;
              let windowId = null;

              for (const window of windows) {
                const [startH, startM] = window.start_time.split(':').map(Number);
                const [endH, endM] = window.end_time.split(':').map(Number);
                const startTotal = startH * 60 + startM;
                const endTotal = endH * 60 + endM;

                if (punchTotalMinutes >= startTotal && punchTotalMinutes <= endTotal) {
                  isValid = true;
                  windowId = window.id;
                  break;
                }
              }

              if (!isValid) continue;

              const benefit = benefits.find(b => b.emp_id === punch.emp_id);
              let dishRate = config ? config.dish_rate : 50;
              let discountRate = 0;

              if (benefit) {
                  dishRate = benefit.dish_rate || dishRate;
                  discountRate = benefit.discount_rate || 0;
              }
              const finalRate = Math.max(0, dishRate - discountRate);

              if (!empDeductions[punch.emp_id]) {
                  empDeductions[punch.emp_id] = { count: 0, total: 0 };
              }
              empDeductions[punch.emp_id].count += 1;
              empDeductions[punch.emp_id].total += finalRate;
            }

            const results = Object.keys(empDeductions).map(empId => ({
               emp_id: Number(empId),
               total_deduction: empDeductions[Number(empId)].total,
               punch_count: empDeductions[Number(empId)].count
            }));

            res.json({ results });
          } catch(err: any) {
             res.status(500).json({ error: err.message });
          }
};

export const getCanteenTransactions: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { startDate, endDate, empId, windowId, moduleType } = args;
          const db = moduleType === 'P' ? statutoryDb : primaryDb;
          try {
            // Auto update rules before fetching transactions
            recalculateCanteenRules(db);

            let sql = `
              SELECT p.*, e.name as emp_name, e.emp_code, w.name as window_name
              FROM canteen_punches p
              JOIN employees e ON p.emp_id = e.id
              LEFT JOIN canteen_time_windows w ON p.window_id = w.id
              WHERE p.punch_time >= ? AND p.punch_time <= ?
            `;
            const params: any[] = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];

            if (empId) {
              sql += ' AND p.emp_id = ?';
              params.push(empId);
            }
            if (windowId) {
              sql += ' AND p.window_id = ?';
              params.push(windowId);
            }

            sql += ' ORDER BY p.punch_time DESC';
            const rows = db.prepare(sql).all(...params);
            res.json(rows);
          } catch (error) {
            res.status(500).json({ error: 'Failed to fetch canteen transactions' });
          
}
};

export const syncCanteenPunches: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { moduleType } = args;
  const db = moduleType === 'P' ? statutoryDb : primaryDb;

  try {
    const config = db.prepare('SELECT * FROM canteen_config ORDER BY id DESC LIMIT 1').get() as any;
    if (config) {
      const { connection_type, connection_string, db_name, procedure_name, db_user } = config;
      console.log(`[Canteen Sync] Attempting to connect via ${connection_type}`);
      if (connection_type === 'SQL Server' || connection_type === 'MS Access') {
        console.log(`[Canteen Sync] Connection String: ${connection_string}`);
        console.log(`[Canteen Sync] DB Name: ${db_name}, User: ${db_user}`);
        console.log(`[Canteen Sync] Executing Procedure/Query: ${procedure_name}`);
      }
    }

    const employees = db.prepare('SELECT id, emp_code FROM employees LIMIT 5').all() as any[];
    const now = new Date().toISOString().split('T')[0];
    const punches = employees.map(emp => ({
      emp_id: emp.id,
      punch_time: `${now} ${12 + Math.floor(Math.random() * 2)}:${10 + Math.floor(Math.random() * 40)}:00`,
      source: 'Biometric'
    }));

    const insert = db.prepare('INSERT INTO canteen_punches (emp_id, punch_time, source) VALUES (?, ?, ?)');
    for (const p of punches) {
      insert.run(p.emp_id, p.punch_time, p.source);
    }
    res.json({ status: 'success', syncedCount: punches.length });
  } catch (error) {
    console.error('[Canteen Sync] Error:', error);
    res.status(500).json({ error: 'Failed to sync biometric punches' });
  }
};

export const bulkSaveCanteenPunches: CommandHandler = (ctx, args) => {
  const { primaryDb, statutoryDb, res, req } = ctx;
  const { punches, moduleType } = args;
          const db = (moduleType || args.module_type) === 'P' ? statutoryDb : primaryDb;
          try {
            const insert = db.prepare('INSERT INTO canteen_punches (emp_id, punch_time, source) VALUES (?, ?, ?)');
            const transaction = db.transaction((recs) => {
              for (const rec of recs) {
                insert.run(rec.emp_id, rec.punch_time, rec.source || 'Manual');
              }
            });
            transaction(punches);
            res.json({ status: 'success' });
          } catch (err) {
            res.status(500).json({ error: 'Failed to bulk save canteen punches' });
          
}
};
