import fs from 'fs';
fs.copyFileSync('server.ts', 'src-server/legacyRouter.ts');
console.log('Copied');
