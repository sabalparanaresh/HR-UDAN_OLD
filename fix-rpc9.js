import fs from 'fs';

let content = fs.readFileSync('src-server/domains/rpc/routes.ts', 'utf8');

// Fix array syntax errors
content = content.replace("rpcRouter.get('/api/master-data', '/api/statutory/master-data'],", "rpcRouter.get(['/api/master-data', '/api/statutory/master-data'],");
content = content.replace("rpcRouter.get('/api/:table', '/api/statutory/:table'],", "rpcRouter.get(['/api/:table', '/api/statutory/:table'],");
content = content.replace("rpcRouter.post('/api/:table', '/api/statutory/:table'],", "rpcRouter.post(['/api/:table', '/api/statutory/:table'],");
content = content.replace("rpcRouter.post('/api/:table/bulk', '/api/statutory/:table/bulk'],", "rpcRouter.post(['/api/:table/bulk', '/api/statutory/:table/bulk'],");
content = content.replace("rpcRouter.get('/api/master/usage/:table/:id', '/api/statutory/master/usage/:table/:id'],", "rpcRouter.get(['/api/master/usage/:table/:id', '/api/statutory/master/usage/:table/:id'],");
content = content.replace("rpcRouter.delete('/api/:table/:id', '/api/statutory/:table/:id'],", "rpcRouter.delete(['/api/:table/:id', '/api/statutory/:table/:id'],");

// Also there was an error about duplicate `primaryDb` on line 64 and `statutoryDb` on line 65
// Let's just strip 'const primaryDb =' completely and replace them carefully
const pDBStr = "  const primaryDb = (req as any).primaryDb;\n  const statutoryDb = (req as any).statutoryDb;\n  const dbState = (req as any).dbState;\n";
content = content.split(pDBStr).join("");
// Now add them back exactly once after every req, res =>
content = content.replace(/=> \{\n/g, "=> {\n" + pDBStr);

fs.writeFileSync('src-server/domains/rpc/routes.ts', content);
