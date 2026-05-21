import fs from 'fs';
let content = fs.readFileSync('src-server/domains/rpc/routes.ts', 'utf8');
content += "\n});\n";
fs.writeFileSync('src-server/domains/rpc/routes.ts', content);
