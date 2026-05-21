import fs from 'fs';

let content = fs.readFileSync('src-server/domains/rpc/routes.ts', 'utf8');

// The rpcRouter needs access to db. We will create a wrapper or just replace all instances.
// wait, the easiest is to do:
// rpcRouter.use((req, res, next) => { ... })
// and in every route: const primaryDb = (req as any).primaryDb; const statutoryDb = (req as any).statutoryDb; const dbState = (req as any).dbState;

content = content.replace(/rpcRouter\.(get|post|delete)\(\[?(.*?)\]?, (.*?)\(req, res\) => \{/g, "rpcRouter.$1($2, $3(req, res) => {\n  const primaryDb = (req as any).primaryDb;\n  const statutoryDb = (req as any).statutoryDb;\n  const dbState = (req as any).dbState;\n");

content = content.replace(/rpcRouter.post\('\/api\/data-sync', apiKeyMiddleware, bridgeGuardMiddleware\(primaryDb\), async \(req, res\) => \{/g, 
"rpcRouter.post('/api/data-sync', apiKeyMiddleware, (req, res, next) => bridgeGuardMiddleware((req as any).primaryDb)(req, res, next), async (req, res) => {\n  const primaryDb = (req as any).primaryDb;\n  const statutoryDb = (req as any).statutoryDb;\n  const dbState = (req as any).dbState;\n");

fs.writeFileSync('src-server/domains/rpc/routes.ts', content);
