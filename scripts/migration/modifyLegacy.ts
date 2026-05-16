import fs from 'fs';

let content = fs.readFileSync('src-server/legacyRouter.ts', 'utf-8');

// We want to export setupRoutes
content = content.replace('function setupRoutes', 'export function setupRoutes');

// We also want to prevent the file from kicking off startServer() since it's just a module now.
content = content.replace('startServer();', '// startServer();');

fs.writeFileSync('src-server/legacyRouter.ts', content);
console.log('legacyRouter exported');
