import fs from 'fs';

let content = fs.readFileSync('src-server/legacyRouter.ts', 'utf-8');
content = content.replace(/from '\.\/src-server\//g, "from './");
fs.writeFileSync('src-server/legacyRouter.ts', content);
console.log('Fixed relative paths');
