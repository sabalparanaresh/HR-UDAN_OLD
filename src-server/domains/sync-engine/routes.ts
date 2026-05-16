import { Router, Request, Response } from 'express';
import { SyncEngineService } from './service.js';

export const syncengineRouter = Router();

syncengineRouter.post('/state', async (req: Request, res: Response) => {
  const { status } = req.body;
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  
  if (!primaryDb || !statutoryDb) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  primaryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('connection_status', ?)").run(status);
  statutoryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('connection_status', ?)").run(status);
  
  const nowStr = new Date().toISOString();
  primaryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_cloud_sync', ?)").run(nowStr);
  statutoryDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_cloud_sync', ?)").run(nowStr);

  const syncService = new SyncEngineService(primaryDb, statutoryDb);

  if (status === 'CONNECTED') {
    // Process sync queue
    await syncService.processQueue();
    // Refresh P-module data snapshot in K-module
    syncService.refreshPCacheInK();
  }

  res.json({ status: 'success', connected: status === 'CONNECTED' });
});

syncengineRouter.get('/state', (req: Request, res: Response) => {
  const primaryDb = (req as any).primaryDb;
  const row = primaryDb.prepare("SELECT value FROM settings WHERE key = 'connection_status'").get();
  res.json({ connected: row?.value === 'CONNECTED' });
});

syncengineRouter.post('/trigger', async (req: Request, res: Response) => {
  const { entity_type, entity_id, operation, payload } = req.body;
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  
  const syncService = new SyncEngineService(primaryDb, statutoryDb);
  syncService.enqueue(entity_type, entity_id, operation, payload);
  await syncService.processQueue();
  
  res.json({ status: 'success' });
});

syncengineRouter.post('/checksum', async (req: Request, res: Response) => {
  const primaryDb = (req as any).primaryDb;
  const statutoryDb = (req as any).statutoryDb;
  
  const syncService = new SyncEngineService(primaryDb, statutoryDb);
  const result = syncService.validateChecksums();
  res.json({ status: 'success', data: result });
});
