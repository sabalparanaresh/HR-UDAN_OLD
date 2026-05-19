const fs = require('fs');

const f1 = 'src-server/legacyRouter.ts';
let text = fs.readFileSync(f1, 'utf8');
text = text.replace(/const table_name = req\.params\.table;/g, 'const table_name = req.params.table as string;');
text = text.replace(/const id = req\.params\.id;/g, 'const id = req.params.id as string;');
fs.writeFileSync(f1, text, 'utf8');

const f2 = 'src-server/domains/piece-rate/routes.ts';
let text2 = fs.readFileSync(f2, 'utf8');
text2 = text2.replace(/req\.query\.machineId/g, '(req.query.machineId as string)');
fs.writeFileSync(f2, text2, 'utf8');

console.log('Fixed req params');
