import fs from 'fs';

let content = fs.readFileSync('src-server/commands/payroll.ts', 'utf-8');

// replace imports
content = content.replace("import { CommandHandler } from './types.js';", "import express from 'express';\nexport const payrollRouter = express.Router();");

// extract functions and convert to express endpoints
const functionRegex = /export const (\w+): CommandHandler = \(ctx, args\) => \{/g;

content = content.replace(functionRegex, (match, funcName) => {
    let endpoint = funcName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    
    return `payrollRouter.post('/${endpoint}', (req: any, res) => {
  const ctx = {
     primaryDb: req.primaryDb,
     statutoryDb: req.statutoryDb,
     req,
     res
  };
  const args = req.body;`;
});

content = content.replace(/export const getPaginatedSalaryResults|\bgetPaginatedSalaryResults\b/g, 'getPaginatedSalaryResults');

fs.mkdirSync('src-server/domains/payroll', { recursive: true });
fs.writeFileSync('src-server/domains/payroll/routes.ts', content);
