import fs from 'fs';

const routerFilePath = 'src-server/domains/employee/routes.ts';
let content = fs.readFileSync(routerFilePath, 'utf8');

const newRoutes = `
import { 
  syncEmployeeToPakka, getPSalaryDetailsForK, savePSalaryDetailsForK,
  getLeaveCreditPreview, postLeaveCredits, saveEmployeeAsset, checkDuplicate,
  bulkEmployeeUpsert, recordSalaryRevision, getSalaryRevisionHistory,
  getOpenGrievances, searchEmployees, resolveGrievance, getEmployeeRecord,
  getNextEmployeeCode, checkMinWage, getAssetDepositData, saveAsset,
  saveDeposit, returnAsset, getFfClearance, processWaterfallDistribution
} from '../../commands/employee.js';

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
`;

if (!content.includes('/cmd/syncEmployeeToPakka')) {
  fs.writeFileSync(routerFilePath, content + "\n" + newRoutes);
  console.log("Updated employee routes");
}
