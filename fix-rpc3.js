import fs from 'fs';

let content = fs.readFileSync('src-server/domains/rpc/routes.ts', 'utf8');

// remove setupRoutes(...) {
content = content.replace(/setupRoutes\(app: express\.Application, primaryDb: any, statutoryDb: any, dbState: \{ isReady: boolean \}\) \{/g, "");

fs.writeFileSync('src-server/domains/rpc/routes.ts', content);
