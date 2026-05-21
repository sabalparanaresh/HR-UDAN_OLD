import fs from 'fs';

let content = fs.readFileSync('src-server/domains/rpc/routes.ts', 'utf8');
content = content.replace(/\s*}$/, "\n");
fs.writeFileSync('src-server/domains/rpc/routes.ts', content);
