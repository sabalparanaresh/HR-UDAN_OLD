import fs from 'fs';

const routerFilePath = 'src-server/domains/system/routes.ts';
let content = fs.readFileSync(routerFilePath, 'utf8');

const newRoutes = `
import * as statutory from '../../commands/statutory.js';
import * as crud from '../../commands/crud.js';
import * as financials from '../../commands/financials.js';
import * as rokda from '../../commands/rokda.js';
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
systemRouter.post('/cmd/pieceRateCrud', runCommand(crud.pieceRateCrud));

// Financials
systemRouter.post('/cmd/getCashTransactions', runCommand(financials.getCashTransactions));

// Rokda
systemRouter.post('/cmd/getNextRokdaToken', runCommand(rokda.getNextRokdaToken));
systemRouter.post('/cmd/saveMisVoucher', runCommand(rokda.saveMisVoucher));

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
`;

if (!content.includes('/cmd/getStatutorySettings')) {
  fs.writeFileSync(routerFilePath, content + "\n" + newRoutes);
}
