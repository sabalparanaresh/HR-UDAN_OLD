import fs from 'fs';

let content = fs.readFileSync('src-server/legacyRouter.ts', 'utf-8');
content = content.replace(/PORT/g, "3000");
fs.writeFileSync('src-server/legacyRouter.ts', content);
console.log('Fixed PORT');
