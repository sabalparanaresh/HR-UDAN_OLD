import fs from 'fs';
import path from 'path';

const content = fs.readFileSync('src-server/legacyRouter.ts', 'utf8');

// The file has several parts:
// 1. Imports
// 2. Middlewares (apiKeyMiddleware)
// 3. Helpers (toSnakeCase, etc.)
// 4. SSE Events
// 5. Setup functions (initializeApp, setupSSE, setupErrorHandling, startLegacyServer)
// 6. Generic Routes inside setupRoutes

fs.writeFileSync('src-server/db/bootstrap.ts', '');
fs.writeFileSync('src-server/domains/system/rpcRouter.ts', '');
fs.writeFileSync('src-server/services/sse.ts', '');
