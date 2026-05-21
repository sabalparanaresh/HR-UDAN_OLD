import express from 'express';
import { AttendanceService } from './service.js';

export const attendanceRouter = express.Router();

attendanceRouter.get('/logs', async (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new AttendanceService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.query.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    // Parse filters
    let filters: any = null;
    if (req.query.filters) {
      try { filters = JSON.parse(req.query.filters as string); } catch(e) {}
    }
    
    const result = await service.getLogs(filters, moduleType);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

attendanceRouter.post('/manual-punch', async (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new AttendanceService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.body.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    await service.saveManualAttendance(req.body, moduleType);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

attendanceRouter.post('/process', async (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new AttendanceService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.body.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    await service.processAttendance(req.body.fromDate, req.body.toDate, moduleType);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

attendanceRouter.post('/bulk-generate-v2', async (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new AttendanceService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.body.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    // This starts the worker process and returns immediately
    const dbPath = moduleType === 'P' ? 'data/statutory.db' : 'data/primary.db';
    await service.bulkGenerateV2(req.body.fromDate, req.body.toDate, req.body.filters, dbPath);
    
    res.json({ status: 'started' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

attendanceRouter.post('/cancel-bulk', async (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new AttendanceService(primaryDb, statutoryDb);
    
    await service.cancelBulkGeneration();
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

attendanceRouter.get('/biometric/sync', async (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new AttendanceService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.query.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    const result = await service.fetchBiometricLogs(moduleType);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

attendanceRouter.post('/biometric/save', async (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new AttendanceService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.body.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    const result = await service.saveBiometricLogs(req.body.logs, moduleType);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

attendanceRouter.post('/resolve-anomalies', async (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new AttendanceService(primaryDb, statutoryDb);
    
    const result = await service.resolveAnomalies();
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
