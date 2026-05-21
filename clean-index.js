import fs from 'fs';

let content = fs.readFileSync('src-server/commands/index.ts', 'utf8');

// The lines containing " attendance."
let lines = content.split('\n');
let newLines = lines.filter(line => !line.includes(' attendance.'));

fs.writeFileSync('src-server/commands/index.ts', newLines.join('\n'));
