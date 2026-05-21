import fs from 'fs';

const routerFilePath = 'src-server/domains/master-data/routes.ts';
let content = fs.readFileSync(routerFilePath, 'utf8');

const newRoutes = `
import { masterCrud, getMasterUsage, getMasterData } from '../../commands/masterData.js';

masterDataRouter.post('/crud-command', (req, res) => masterCrud({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
masterDataRouter.post('/usage-command', (req, res) => getMasterUsage({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
masterDataRouter.post('/get-master-data', (req, res) => getMasterData({ primaryDb: (req as any).primaryDb, statutoryDb: (req as any).statutoryDb, req, res }, req.body));
`;

if (!content.includes('/crud-command')) {
  // Try placing it right below the definition
  if (content.includes("export const masterDataRouter = express.Router();")) {
    content = content.replace("export const masterDataRouter = express.Router();", "export const masterDataRouter = express.Router();\n" + newRoutes);
  } else {
    content = content + "\n" + newRoutes;
  }
  fs.writeFileSync(routerFilePath, content);
  console.log("Updated master-data routes");
}
