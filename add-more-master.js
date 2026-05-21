import fs from 'fs';

let content = fs.readFileSync('src-server/domains/master-data/routes.ts', 'utf8');

const newRoutes = `
import { 
  getDeptSettings, getDeptStandardRates, getPincodeRecords, bulkBankImport,
  bulkBankMasterUpsert, bulkPincodeUpsert, getOgdRecords, getOgdBankList,
  getOgdBankBranches, bulkUploadDepartments, bulkUploadStandardRates, clearOrgData,
  saveRokdaVoucher 
} from '../../commands/masterData.js';

const runCommand = (cmd) => (req, res) => cmd({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body);

masterDataRouter.post('/cmd/getDeptSettings', runCommand(getDeptSettings));
masterDataRouter.post('/cmd/getDeptStandardRates', runCommand(getDeptStandardRates));
masterDataRouter.post('/cmd/getPincodeRecords', runCommand(getPincodeRecords));
masterDataRouter.post('/cmd/bulkBankImport', runCommand(bulkBankImport));
masterDataRouter.post('/cmd/bulkBankMasterUpsert', runCommand(bulkBankMasterUpsert));
masterDataRouter.post('/cmd/bulkPincodeUpsert', runCommand(bulkPincodeUpsert));
masterDataRouter.post('/cmd/getOgdRecords', runCommand(getOgdRecords));
masterDataRouter.post('/cmd/getOgdBankList', runCommand(getOgdBankList));
masterDataRouter.post('/cmd/getOgdBankBranches', runCommand(getOgdBankBranches));
masterDataRouter.post('/cmd/bulkUploadDepartments', runCommand(bulkUploadDepartments));
masterDataRouter.post('/cmd/bulkUploadStandardRates', runCommand(bulkUploadStandardRates));
masterDataRouter.post('/cmd/clearOrgData', runCommand(clearOrgData));
masterDataRouter.post('/cmd/saveRokdaVoucher', runCommand(saveRokdaVoucher));
`;

if (!content.includes('/cmd/getDeptSettings')) {
  fs.writeFileSync('src-server/domains/master-data/routes.ts', content + "\n" + newRoutes);
}
