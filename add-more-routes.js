import fs from 'fs';

const content = fs.readFileSync('src-server/domains/payroll/routes.ts', 'utf8');

const newRoutes = `
import { saveDailyMisBatch, getEarningHistory } from '../../commands/crud.js';

payrollRouter.post('/transaction/save-daily-mis-batch', (req, res) => saveDailyMisBatch({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
payrollRouter.post('/transaction/earning-history', (req, res) => getEarningHistory({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
`;

if (!content.includes('/transaction/save-daily-mis-batch')) {
  fs.writeFileSync('src-server/domains/payroll/routes.ts', content + newRoutes);
}
