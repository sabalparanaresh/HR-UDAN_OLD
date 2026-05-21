import fs from 'fs';

let content = fs.readFileSync('src-server/commands/index.ts', 'utf8');

const toRemove = [
  "'get_payroll_analytics'",
  "'transaction_crud'",
  "'get_transaction_history'",
  "'update_transaction'",
  "'bulk_delete_transactions'"
];

const lines = content.split('\n');
const newLines = lines.filter(line => {
  for (const str of toRemove) {
    if (line.includes(str)) return false;
  }
  return true;
});

fs.writeFileSync('src-server/commands/index.ts', newLines.join('\n'));
