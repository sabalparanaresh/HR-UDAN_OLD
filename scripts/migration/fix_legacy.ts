import fs from 'fs';

let content = fs.readFileSync('src-server/legacyRouter.ts', 'utf-8');

// I need to export `setupDb`, `primaryDb`, `statutoryDb`, `dbState`, `setupRoutes` safely without startServer encapsulation if needed.
// Easiest is to change `async function startServer() {` to `export async function startLegacyServer(app: express.Application, isVite: boolean) {`
content = content.replace('async function startServer() {', 'export async function startLegacyServer(app: any, isVite: boolean) {');
content = content.replace('const app = express();', '');
content = content.replace('const PORT = 3000;', '');

// Delete setupRoutes and setupErrorHandling inside startLegacyServer where it listens
content = content.replace(/   const isProduction = process\.env\.NODE_ENV[\s\S]*?setupErrorHandling\(app, server, primaryDb\);\n}/, 'return { primaryDb, statutoryDb, dbState, setupRoutes };\n}');

fs.writeFileSync('src-server/legacyRouter.ts', content);
console.log('Fixed legacy router');
