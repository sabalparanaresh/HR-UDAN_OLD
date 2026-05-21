import express from 'express';
import { MasterDataService } from './service.js';

export const masterDataRouter = express.Router();

import { masterCrud, getMasterUsage, getMasterData } from '../../commands/masterData.js';

masterDataRouter.post('/crud-command', (req, res) => masterCrud({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
masterDataRouter.post('/usage-command', (req, res) => getMasterUsage({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
masterDataRouter.post('/get-master-data', (req, res) => getMasterData({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));


masterDataRouter.get('/:table', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new MasterDataService(primaryDb, statutoryDb);
    
    // allow sending module_type via header or query param
    const moduleType = (req.headers['x-module-type'] as string || req.query.module_type as string || 'K').toUpperCase() as 'K'|'P';
    const limit = parseInt(req.query.limit as string) || 1000;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const rows = service.getList(req.params.table, moduleType, offset, limit);
    res.json(rows);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

masterDataRouter.get('/:table/:id', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new MasterDataService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.query.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    const row = service.getById(req.params.table, req.params.id, moduleType);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

masterDataRouter.post('/:table', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new MasterDataService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.body.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    service.create(req.params.table, req.body, moduleType);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

masterDataRouter.put('/:table/:id', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new MasterDataService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.body.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    service.update(req.params.table, req.params.id, req.body, moduleType);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

masterDataRouter.delete('/:table/:id', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new MasterDataService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.body.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    service.delete(req.params.table, req.params.id, moduleType);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


import { 
  getDeptSettings, getDeptStandardRates, getPincodeRecords, bulkBankImport,
  bulkBankMasterUpsert, bulkPincodeUpsert, getOgdRecords, getOgdBankList,
  getOgdBankBranches, bulkUploadDepartments, bulkUploadStandardRates, clearOrgData
} from '../../commands/masterData.js';

const runCommand = (cmd) => (req, res) => cmd({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body);

masterDataRouter.post('/cmd/getDeptSettings', runCommand(getDeptSettings));
masterDataRouter.post('/cmd/getDeptStandardRates', runCommand(getDeptStandardRates));
masterDataRouter.post('/cmd/getPincodeRecords', runCommand(getPincodeRecords));
masterDataRouter.post('/cmd/bulkBankImport', runCommand(bulkBankImport));
masterDataRouter.post('/cmd/bulkBankMasterUpsert', runCommand(bulkBankMasterUpsert));
masterDataRouter.post('/cmd/bulkPincodeUpsert', runCommand(bulkPincodeUpsert));
masterDataRouter.post('/cmd/getOgdRecords', runCommand(getOgdRecords));
masterDataRouter.post('/cmd/getOgdBankList', runCommand(getOgdBankList));
masterDataRouter.post('/cmd/getOgdBankBranches', runCommand(getOgdBankBranches));
masterDataRouter.post('/cmd/bulkUploadDepartments', runCommand(bulkUploadDepartments));
masterDataRouter.post('/cmd/bulkUploadStandardRates', runCommand(bulkUploadStandardRates));
masterDataRouter.post('/cmd/clearOrgData', runCommand(clearOrgData));
