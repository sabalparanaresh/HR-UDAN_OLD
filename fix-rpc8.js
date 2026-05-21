import fs from 'fs';

let content = fs.readFileSync('src-server/domains/rpc/routes.ts', 'utf8');

// The easiest way is to remove all of them first, then inject them back exactly once per route.

content = content.replace(/\s*const primaryDb = \(req as any\)\.primaryDb;\s*const statutoryDb = \(req as any\)\.statutoryDb;\s*const dbState = \(req as any\)\.dbState;/g, "");

content = content.replace(/rpcRouter\.(get|post|delete)\(\[?(.*?)\]?, (.*?)\(req, res\) => \{/g, 
"rpcRouter.$1($2, $3(req, res) => {\n  const primaryDb = (req as any).primaryDb;\n  const statutoryDb = (req as any).statutoryDb;\n  const dbState = (req as any).dbState;\n");

content = content.replace(/rpcRouter\.post\('\/api\/data-sync', apiKeyMiddleware, \(req, res, next\) => bridgeGuardMiddleware\(\(req as any\)\.primaryDb\)\(req, res, next\), async \(req, res\) => \{/g, 
"rpcRouter.post('/api/data-sync', apiKeyMiddleware, (req, res, next) => bridgeGuardMiddleware((req as any).primaryDb)(req, res, next), async (req, res) => {\n  const primaryDb = (req as any).primaryDb;\n  const statutoryDb = (req as any).statutoryDb;\n  const dbState = (req as any).dbState;\n");

// wait, the generic routes have array of strings logic like:
// rpcRouter.get(['/api/master-data', '/api/statutory/master-data'], apiKeyMiddleware, (req, res) => {
// so the regex `rpcRouter\.(get|post|delete)\(` might have an issue with them.

// Let's just fix it properly by replacing the block of constants entirely:
// Wait, I already fixed the string literals array with `fix-rpc2.js`.
fs.writeFileSync('src-server/domains/rpc/routes.ts', content);
