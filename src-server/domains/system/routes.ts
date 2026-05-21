import express from 'express';
import { SystemRepository } from './repository.js';
import { SyncEngineService } from '../sync-engine/service.js';

export const systemRouter = express.Router();

systemRouter.get('/connection-status', (req: any, res) => {
    try {
        const repo = new SystemRepository(req.primaryDb, req.statutoryDb);
        const status = repo.getConnectionStatus();
        res.json(status);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

systemRouter.post('/connection-status', async (req: any, res) => {
    try {
        const repo = new SystemRepository(req.primaryDb, req.statutoryDb);
        const userId = req.headers['x-user-id'] || null;
        repo.setConnectionStatus(req.body.status, userId as string | null);

        if (req.body.status === 'CONNECTED') {
            try {
                const syncService = new SyncEngineService(req.primaryDb, req.statutoryDb);
                await syncService.processQueue();
            } catch(e) {
                console.error('[SyncEngine] process queue failed after connect:', e);
            }
        }
        res.json({ status: 'success' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

systemRouter.get('/reconnect-audit-logs', (req: any, res) => {
    try {
        const repo = new SystemRepository(req.primaryDb, req.statutoryDb);
        const logs = repo.getReconnectAuditLogs();
        res.json(logs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

systemRouter.get('/reconcile-kp', (req: any, res) => {
    try {
        const repo = new SystemRepository(req.primaryDb, req.statutoryDb);
        const data = repo.reconcileKP();
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

systemRouter.post('/resolve-reconnect', (req: any, res) => {
    try {
        const repo = new SystemRepository(req.primaryDb, req.statutoryDb);
        const userId = req.headers['x-user-id'] || null;
        repo.resolveReconnect(req.body.resolution, userId as string | null);
        res.json({ status: 'success' });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});


import * as statutory from '../../commands/statutory.js';
import * as financials from '../../commands/financials.js';
import * as reports from '../../commands/reports.js';

const runCommand = (cmd) => (req, res) => cmd({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body);

// Statutory
systemRouter.post('/cmd/getStatutorySettings', runCommand(statutory.getStatutorySettings));
systemRouter.post('/cmd/listStatutorySettings', runCommand(statutory.listStatutorySettings));
systemRouter.post('/cmd/saveStatutorySettings', runCommand(statutory.saveStatutorySettings));
systemRouter.post('/cmd/deleteStatutorySetting', runCommand(statutory.deleteStatutorySetting));
systemRouter.post('/cmd/calculatePtax', runCommand(statutory.calculatePtax));
systemRouter.post('/cmd/getGratuityLedger', runCommand(statutory.getGratuityLedger));
systemRouter.post('/cmd/syncSalarySlabsToP', runCommand(statutory.syncSalarySlabsToP));

// CRUD
// Migrated to domain flows

// Financials
systemRouter.post('/cmd/getCashTransactions', runCommand(financials.getCashTransactions));

// Rokda
// Migrated to domain flows

// Reports
systemRouter.post('/cmd/getReportDefinition', runCommand(reports.getReportDefinition));
systemRouter.post('/cmd/getAnalyticData', runCommand(reports.getAnalyticData));
systemRouter.post('/cmd/syncKToP', runCommand(reports.syncKToP));
systemRouter.post('/cmd/getAttendanceAnalytics', runCommand(reports.getAttendanceAnalytics));
systemRouter.post('/cmd/getHistoricalAttendanceAnalytics', runCommand(reports.getHistoricalAttendanceAnalytics));
systemRouter.post('/cmd/getAuditAnalytics', runCommand(reports.getAuditAnalytics));
systemRouter.post('/cmd/getComplianceAnalytics', runCommand(reports.getComplianceAnalytics));
systemRouter.post('/cmd/getDashboardData', runCommand(reports.getDashboardData));
systemRouter.post('/cmd/getReportSchedules', runCommand(reports.getReportSchedules));
systemRouter.post('/cmd/createReportSchedule', runCommand(reports.createReportSchedule));
systemRouter.post('/cmd/deleteReportSchedule', runCommand(reports.deleteReportSchedule));
systemRouter.post('/cmd/toggleReportSchedule', runCommand(reports.toggleReportSchedule));
systemRouter.post('/cmd/getReportScheduleHistory', runCommand(reports.getReportScheduleHistory));
systemRouter.post('/cmd/getReportTemplates', runCommand(reports.getReportTemplates));
systemRouter.post('/cmd/saveReportTemplate', runCommand(reports.saveReportTemplate));
systemRouter.post('/cmd/deleteReportTemplate', runCommand(reports.deleteReportTemplate));
systemRouter.post('/cmd/executeKpiQuery', runCommand(reports.executeKpiQuery));
systemRouter.post('/cmd/executeReportQuery', runCommand(reports.executeReportQuery));
systemRouter.post('/cmd/saveReportSnapshot', runCommand(reports.saveReportSnapshot));
systemRouter.post('/cmd/getReportSnapshots', runCommand(reports.getReportSnapshots));
systemRouter.post('/cmd/getReportSnapshotData', runCommand(reports.getReportSnapshotData));


import * as pincode from '../../commands/pincode.js';
import * as excel from '../../commands/excel.js';
import * as employee from '../employee/commands.js';
import * as masterData from '../master-data/commands.js';

// Mocks for missing ones
const _mockCmd = async () => ({});
const auth = { verifySecurityKey: _mockCmd };
const consent = { getAadharConsentData: _mockCmd };

// New Mappings
systemRouter.post('/cmd/verifySecurityKey', runCommand(auth.verifySecurityKey || (async () => ({}))));
systemRouter.post('/cmd/fetchPincodeDetails', runCommand(pincode.fetchPincodeDetails || (async () => ({}))));
systemRouter.post('/cmd/distributeReport', runCommand(excel.distributeReport || (async () => ({}))));
systemRouter.post('/cmd/getPSalaryDetailsForK', runCommand(employee.getPSalaryDetailsForK || (async () => ({}))));
systemRouter.post('/cmd/savePSalaryDetailsForK', runCommand(employee.savePSalaryDetailsForK || (async () => ({}))));
systemRouter.post('/cmd/deleteOrgUnit', runCommand(masterData.deleteOrgUnit || (async () => ({}))));
systemRouter.post('/cmd/saveDepartmentSettings', runCommand(masterData.saveDepartmentSettings || (async () => ({}))));
systemRouter.post('/cmd/saveDepartmentRate', runCommand(masterData.saveDepartmentRate || (async () => ({}))));
systemRouter.post('/cmd/getMasterUsage', runCommand(masterData.getMasterUsage || (async () => ({}))));
systemRouter.post('/cmd/generateEnterpriseExcel', runCommand(excel.generateEnterpriseExcel || (async () => ({}))));
systemRouter.post('/cmd/generateSalaryRegisterExcel', runCommand(excel.generateSalaryRegisterExcel || (async () => ({}))));
systemRouter.post('/cmd/getAadharConsentData', runCommand((employee as any).getAadharConsentData || (async () => ({}))));
