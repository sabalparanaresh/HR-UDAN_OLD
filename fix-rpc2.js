import fs from 'fs';

let content = fs.readFileSync('src-server/domains/rpc/routes.ts', 'utf8');

content = content.replace(/rpcRouter\.get\('\/api\/master-data', '\/api\/statutory\/master-data'\],/g, "rpcRouter.get(['/api/master-data', '/api/statutory/master-data'],");
content = content.replace(/rpcRouter\.get\('\/api\/:table', '\/api\/statutory\/:table'\],/g, "rpcRouter.get(['/api/:table', '/api/statutory/:table'],");
content = content.replace(/rpcRouter\.post\('\/api\/:table', '\/api\/statutory\/:table'\],/g, "rpcRouter.post(['/api/:table', '/api/statutory/:table'],");
content = content.replace(/rpcRouter\.post\('\/api\/:table\/bulk', '\/api\/statutory\/:table\/bulk'\],/g, "rpcRouter.post(['/api/:table/bulk', '/api/statutory/:table/bulk'],");
content = content.replace(/rpcRouter\.get\('\/api\/master\/usage\/:table\/:id', '\/api\/statutory\/master\/usage\/:table\/:id'\],/g, "rpcRouter.get(['/api/master/usage/:table/:id', '/api/statutory/master/usage/:table/:id'],");
content = content.replace(/rpcRouter\.delete\('\/api\/:table\/:id', '\/api\/statutory\/:table\/:id'\],/g, "rpcRouter.delete(['/api/:table/:id', '/api/statutory/:table/:id'],");

fs.writeFileSync('src-server/domains/rpc/routes.ts', content);
