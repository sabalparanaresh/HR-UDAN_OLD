import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace("import { startLegacyServer } from './src-server/legacyRouter.js';", 
  "import { bootstrapDatabase } from './src-server/db/bootstrap.js';\nimport { rpcRouter, setupLegacyEventStream } from './src-server/domains/rpc/routes.js';");

content = content.replace("startLegacyServer(app, false).then(({ primaryDb, statutoryDb, dbState, setupRoutes, server }: any) => {", 
  "bootstrapDatabase().then(({ primaryDb, statutoryDb, dbState }: any) => {\n  setupLegacyEventStream(app);");

content = content.replace("app.use('/api', (req, res, next) => {",
  "app.use('/api', (req, res, next) => {"); // Just checking if it exists

content = content.replace("// Mount Domain Routers (New layered architecture)", 
  "// Mount Domain Routers (New layered architecture)\n  app.use('/', rpcRouter);");

fs.writeFileSync('server.ts', content);
