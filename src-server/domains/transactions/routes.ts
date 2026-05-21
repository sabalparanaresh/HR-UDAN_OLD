import express from 'express';
import { TransactionsService } from './service.js';

export const transactionsRouter = express.Router();

transactionsRouter.post('/rokda/next-token', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new TransactionsService(primaryDb, statutoryDb);
    
    const moduleType = (req.body.moduleType || req.body.module_type || 'K').toUpperCase() as 'K'|'P';
    const nextToken = service.getNextRokdaToken(req.body.prefix, moduleType);
    
    res.json({ success: true, nextToken });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

transactionsRouter.post('/rokda/voucher', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new TransactionsService(primaryDb, statutoryDb);
    
    const moduleType = (req.body.moduleType || req.body.module_type || 'K').toUpperCase() as 'K'|'P';
    const id = service.saveRokdaVoucher(req.body.voucher, req.body.entries, moduleType);
    
    res.json({ success: true, id, status: 'success' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

transactionsRouter.post('/mis/voucher', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new TransactionsService(primaryDb, statutoryDb);
    
    const moduleType = (req.body.moduleType || req.body.module_type || 'K').toUpperCase() as 'K'|'P';
    const id = service.saveMisVoucher(req.body.voucher, req.body.entries, moduleType);
    
    res.json({ success: true, id, status: 'success' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

transactionsRouter.get('/cash', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const moduleType = (req.query.moduleType || req.query.module_type || 'K') as 'K'|'P';
    const db = moduleType === 'P' ? statutoryDb : primaryDb;

    const txns = db.prepare(`
      SELECT *, balance_amount as balance
      FROM cash_transactions
      WHERE module_type = ?
    `).all(moduleType) as any[];

    res.json(txns);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

transactionsRouter.post('/cash/payment', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const moduleType = (req.body.moduleType || req.body.module_type || 'K') as 'K'|'P';
    const db = moduleType === 'P' ? statutoryDb : primaryDb;

    const { transaction_id, amount, user, action } = req.body;

    try {
      db.prepare('BEGIN IMMEDIATE').run();
      db.prepare(`
        INSERT INTO cash_payment_entries (transaction_id, amount, action, created_by)
        VALUES (?, ?, ?, ?)
      `).run(transaction_id, amount, action || 'Payment', user || 'System');
      
      db.prepare('COMMIT').run();
      res.json({ status: 'success' });
    } catch (e: any) {
      db.prepare('ROLLBACK').run();
      res.status(500).json({ error: e.message });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

transactionsRouter.post('/cash/reverse', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const moduleType = (req.body.moduleType || req.body.module_type || 'K') as 'K'|'P';
    const db = moduleType === 'P' ? statutoryDb : primaryDb;

    const { transaction_id, user } = req.body;

    try {
      db.prepare('BEGIN IMMEDIATE').run();
      const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) as paid FROM cash_payment_entries WHERE transaction_id = ?`).get(transaction_id) as any;
      if (row && row.paid > 0) {
        db.prepare(`
          INSERT INTO cash_payment_entries (transaction_id, amount, action, created_by)
          VALUES (?, ?, ?, ?)
        `).run(transaction_id, -row.paid, 'Reversal', user || 'System');
      }
      db.prepare('COMMIT').run();
      res.json({ status: 'success' });
    } catch (e: any) {
      db.prepare('ROLLBACK').run();
      res.status(500).json({ error: e.message });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

transactionsRouter.post('/cash/history', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const moduleType = (req.body.moduleType || req.body.module_type || 'K') as 'K'|'P';
    const db = moduleType === 'P' ? statutoryDb : primaryDb;

    const { transaction_id } = req.body;
    const history = db.prepare(`
      SELECT * FROM cash_payment_entries
      WHERE transaction_id = ?
      ORDER BY created_at DESC
    `).all(transaction_id);

    res.json(history);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// We need to keep production_entry and other stuff or merge it later if not done already
// production entry routes export from other folder
import { productionEntryRouter } from './production-entry/routes.js';
transactionsRouter.use('/production-entry', productionEntryRouter);

export default transactionsRouter;
