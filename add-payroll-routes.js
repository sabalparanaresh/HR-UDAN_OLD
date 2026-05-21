import fs from 'fs';

const content = fs.readFileSync('src-server/domains/payroll/routes.ts', 'utf8');

const newRoutes = `
import { 
  transactionCrud, bulkInsertTransactions, saveTransactionEntry, 
  getTransactionHistory, updateTransaction, bulkDeleteTransactions, saveArrear 
} from '../../commands/crud.js';

payrollRouter.post('/transaction/crud', (req, res) => transactionCrud({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
payrollRouter.post('/transaction/bulk-insert', (req, res) => bulkInsertTransactions({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
payrollRouter.post('/transaction/save', (req, res) => saveTransactionEntry({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
payrollRouter.post('/transaction/history', (req, res) => getTransactionHistory({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
payrollRouter.post('/transaction/update', (req, res) => updateTransaction({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
payrollRouter.post('/transaction/bulk-delete', (req, res) => bulkDeleteTransactions({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
payrollRouter.post('/transaction/save-arrear', (req, res) => saveArrear({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
`;

if (!content.includes('/transaction/crud')) {
  fs.writeFileSync('src-server/domains/payroll/routes.ts', content + newRoutes);
}
