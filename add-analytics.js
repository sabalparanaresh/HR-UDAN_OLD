import fs from 'fs';

const content = fs.readFileSync('src-server/domains/payroll/routes.ts', 'utf8');

const newRoutes = `
import { getPayrollAnalytics } from '../../commands/reports.js';

payrollRouter.post('/analytics', (req, res) => getPayrollAnalytics({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
`;

if (!content.includes('/analytics')) {
  fs.writeFileSync('src-server/domains/payroll/routes.ts', content + newRoutes);
}
