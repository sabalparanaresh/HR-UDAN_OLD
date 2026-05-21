import express from 'express';
import { EmployeeService } from './service.js';

export const employeeRouter = express.Router();

employeeRouter.get('/', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new EmployeeService(primaryDb, statutoryDb);
    
    // allow sending module_type via header or query param
    const moduleType = (req.headers['x-module-type'] as string || req.query.module_type as string || 'K').toUpperCase() as 'K'|'P';
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const rows = service.getList(moduleType, offset, limit);
    res.json(rows);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

employeeRouter.get('/:id', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new EmployeeService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.query.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    const row = service.getById(req.params.id, moduleType);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

employeeRouter.post('/', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new EmployeeService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.body.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    service.create(req.body, moduleType);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

employeeRouter.put('/:id', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new EmployeeService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.body.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    service.update(req.params.id, req.body, moduleType);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

employeeRouter.delete('/', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new EmployeeService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.body.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    // We expect ids array in body
    const ids = req.body.ids || [];
    for (const id of ids) {
       service.delete(id, moduleType);
    }
    
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

employeeRouter.delete('/:id', (req, res) => {
  try {
    const primaryDb = (req as any).primaryDb;
    const statutoryDb = (req as any).statutoryDb;
    const service = new EmployeeService(primaryDb, statutoryDb);
    
    const moduleType = (req.headers['x-module-type'] as string || req.body.module_type as string || 'K').toUpperCase() as 'K'|'P';
    
    service.delete(req.params.id, moduleType);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


import { 
  syncEmployeeToPakka, getPSalaryDetailsForK, savePSalaryDetailsForK,
  getLeaveCreditPreview, postLeaveCredits, saveEmployeeAsset, checkDuplicate,
  bulkEmployeeUpsert, recordSalaryRevision, getSalaryRevisionHistory,
  getOpenGrievances, searchEmployees, resolveGrievance, getEmployeeRecord,
  getNextEmployeeCode, checkMinWage, getAssetDepositData, saveAsset,
  saveDeposit, returnAsset, getFfClearance, processWaterfallDistribution
} from './commands.js';

const runCommand = (cmd) => (req, res) => cmd({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body);

employeeRouter.post('/cmd/syncEmployeeToPakka', runCommand(syncEmployeeToPakka));
employeeRouter.post('/cmd/getPSalaryDetailsForK', runCommand(getPSalaryDetailsForK));
employeeRouter.post('/cmd/savePSalaryDetailsForK', runCommand(savePSalaryDetailsForK));
employeeRouter.post('/cmd/getLeaveCreditPreview', runCommand(getLeaveCreditPreview));
employeeRouter.post('/cmd/postLeaveCredits', runCommand(postLeaveCredits));
employeeRouter.post('/cmd/saveEmployeeAsset', runCommand(saveEmployeeAsset));
employeeRouter.post('/cmd/checkDuplicate', runCommand(checkDuplicate));
employeeRouter.post('/cmd/bulkEmployeeUpsert', runCommand(bulkEmployeeUpsert));
employeeRouter.post('/cmd/recordSalaryRevision', runCommand(recordSalaryRevision));
employeeRouter.post('/cmd/getSalaryRevisionHistory', runCommand(getSalaryRevisionHistory));
employeeRouter.post('/cmd/getOpenGrievances', runCommand(getOpenGrievances));
employeeRouter.post('/cmd/searchEmployees', runCommand(searchEmployees));
employeeRouter.post('/cmd/resolveGrievance', runCommand(resolveGrievance));
employeeRouter.post('/cmd/getEmployeeRecord', runCommand(getEmployeeRecord));
employeeRouter.post('/cmd/getNextEmployeeCode', runCommand(getNextEmployeeCode));
employeeRouter.post('/cmd/checkMinWage', runCommand(checkMinWage));
employeeRouter.post('/cmd/getAssetDepositData', runCommand(getAssetDepositData));
employeeRouter.post('/cmd/saveAsset', runCommand(saveAsset));
employeeRouter.post('/cmd/saveDeposit', runCommand(saveDeposit));
employeeRouter.post('/cmd/returnAsset', runCommand(returnAsset));
employeeRouter.post('/cmd/getFfClearance', runCommand(getFfClearance));
employeeRouter.post('/cmd/processWaterfallDistribution', runCommand(processWaterfallDistribution));
