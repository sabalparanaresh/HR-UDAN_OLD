import fs from 'fs';

const lines = fs.readFileSync('src-server/legacyRouter.ts', 'utf-8').split('\n');

const newLines = lines.slice(0, 7886);
newLines.push('  return { primaryDb, statutoryDb, dbState, setupRoutes, server };');
newLines.push('}');
newLines.push('');

fs.writeFileSync('src-server/legacyRouter.ts', newLines.join('\n'));
console.log('Fixed');
