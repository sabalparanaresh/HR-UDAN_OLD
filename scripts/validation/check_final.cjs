const fs = require('fs');

const routerContent = fs.readFileSync('src-server/legacyRouter.ts', 'utf8');
const indexContent = fs.readFileSync('src-server/commands/index.ts', 'utf8');

const cases = routerContent.match(/case '([^']+)':/g) || [];
const caseKeys = cases.map(c => c.match(/case '([^']+)':/)[1]);

const cmds = indexContent.match(/  '([^']+)':/g) || [];
const cmdKeys = new Set(cmds.map(c => c.match(/'([^']+)'/)[1]));

const caseKeysSet = new Set(caseKeys);

const missingInIndex = [...caseKeysSet].filter(c => !cmdKeys.has(c));

console.log("Cases in legacyRouter not in COMMAND_MAP:");
console.log(missingInIndex);
