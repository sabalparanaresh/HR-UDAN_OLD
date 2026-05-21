import fs from 'fs';

const content = fs.readFileSync('src-server/domains/payroll/routes.ts', 'utf8');

const newRoutes = `
import { postAdvanceTransactions } from '../../commands/financials.js';

payrollRouter.post('/advance/post', (req, res) => postAdvanceTransactions({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
`;

if (!content.includes('/advance/post')) {
  fs.writeFileSync('src-server/domains/payroll/routes.ts', content + newRoutes);
}
