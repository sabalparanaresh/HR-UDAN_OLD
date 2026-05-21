import fs from 'fs';

let content = fs.readFileSync('src-server/domains/employee/repository.ts', 'utf8');

// Replace escaped backticks
content = content.replace(/\\`/g, "`");
// Replace escaped dollars
content = content.replace(/\\\$/g, "$");

fs.writeFileSync('src-server/domains/employee/repository.ts', content);
