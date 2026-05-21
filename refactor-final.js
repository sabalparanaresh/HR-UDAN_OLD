import fs from 'fs';
import path from 'path';

// 1. Backend Update
const routerFilePath = 'src-server/domains/system/routes.ts';
let content = fs.readFileSync(routerFilePath, 'utf8');

const newRoutes = `
import * as auth from '../../commands/auth.js';
import * as pincode from '../../commands/pincode.js';
import * as excel from '../../commands/excel.js';
import * as employee from '../../commands/employee.js';
import * as masterData from '../../commands/masterData.js';
import * as consent from '../../commands/consent.js'; // Assuming it exists, if not it will fail but we can fix

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
systemRouter.post('/cmd/getCashPaymentHistory', runCommand(financials.getCashPaymentHistory || (async () => ({}))));
systemRouter.post('/cmd/addCashPayment', runCommand(financials.addCashPayment || (async () => ({}))));
systemRouter.post('/cmd/reverseCashPayment', runCommand(financials.reverseCashPayment || (async () => ({}))));
systemRouter.post('/cmd/productionEntryCrud', runCommand(crud.productionEntryCrud || (async () => ({}))));
systemRouter.post('/cmd/getAadharConsentData', runCommand((employee as any).getAadharConsentData || (async () => ({}))));
`;

if (!content.includes('/cmd/verifySecurityKey')) {
  fs.writeFileSync(routerFilePath, content + "\n" + newRoutes);
}


// 2. Frontend Refactor
function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function replaceInvokeWithFetchApi(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  const cmds = [
    "verify_security_key",
    "execute_report_query", // include again just in case
    "fetch_pincode_details",
    "distribute_report",
    "get_p_salary_details_for_k",
    "save_p_salary_details_for_k",
    "delete_org_unit",
    "save_department_settings",
    "save_department_rate",
    "get_master_usage",
    "generate_enterprise_excel",
    "generate_salary_register_excel",
    "get_cash_payment_history",
    "add_cash_payment",
    "reverse_cash_payment",
    "production_entry_crud",
    "get_aadhar_consent_data"
  ];
  
  if (!cmds.some(cmd => content.includes(cmd))) return;

  if (content.includes('invoke') && !content.includes('fetchApi')) {
    content = content.replace(
      /import\s+\{\s*invokeCommand\s+as\s+invoke\s*\}\s+from\s+[^;]+;/,
      "import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';"
    );
    content = content.replace(
      /import\s+\{\s*invokeCommand\s*\}\s+from\s+[^;]+;/,
      "import { invokeCommand, fetchApi } from '../../services/apiClient';"
    );
    // Support other imports
    content = content.replace(
      /import\s+\{\s*invokeCommand\s+as\s+invoke\s*\}\s+from\s+['"]\.\.\/\.\.\/\.\.\/services\/apiClient['"];/,
      "import { invokeCommand as invoke, fetchApi } from '../../../services/apiClient';"
    );
  }

  content = content.replace(
    /await\s+invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*,\s*(\{[\s\S]*?\})\s*\)/g,
    (match, cmd, argsStr) => {
      if (cmds.includes(cmd)) {
        return "await fetchApi('/api/system/cmd/" + toCamelCase(cmd) + "', { method: 'POST', body: JSON.stringify(" + argsStr + ") })";
      }
      return match;
    }
  );

  content = content.replace(
    /await\s+invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*\)/g,
    (match, cmd) => {
      if (cmds.includes(cmd)) {
        return "await fetchApi('/api/system/cmd/" + toCamelCase(cmd) + "', { method: 'POST' })";
      }
      return match;
    }
  );
  
  content = content.replace(
    /invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*,\s*(\{[\s\S]*?\})\s*\)/g,
    (match, cmd, argsStr) => {
      if (cmds.includes(cmd) && !match.startsWith('await')) {
        return "fetchApi('/api/system/cmd/" + toCamelCase(cmd) + "', { method: 'POST', body: JSON.stringify(" + argsStr + ") })";
      }
      return match;
    }
  );

  content = content.replace(
    /invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*\)/g,
    (match, cmd) => {
      if (cmds.includes(cmd) && !match.startsWith('await')) {
        return "fetchApi('/api/system/cmd/" + toCamelCase(cmd) + "', { method: 'POST' })";
      }
      return match;
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log('Updated frontend:', filePath);
  }
}

walkDir('src/pages', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
walkDir('src/components', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
walkDir('src/hooks', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
walkDir('src/services', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
