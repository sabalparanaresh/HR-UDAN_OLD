import fs from 'fs';

let content = fs.readFileSync('src-server/commands/index.ts', 'utf8');

const toRemove = [
  "'save_daily_mis_batch'",
  "'get_earning_history'"
];

const lines = content.split('\n');
const newLines = lines.filter(line => {
  for (const str of toRemove) {
    if (line.includes(str)) return false;
  }
  return true;
});

fs.writeFileSync('src-server/commands/index.ts', newLines.join('\n'));

// Now fix the hooks
function repair(file) {
  let text = fs.readFileSync(file, 'utf8');
  if (text.includes('invoke(') && !text.includes('fetchApi')) {
    text = text.replace(
      "import { invokeCommand as invoke }",
      "import { invokeCommand as invoke, fetchApi }"
    );
  }

  // useDailyMIS.ts
  text = text.replace(
    /await invoke([<][^>]+[>])?\('transaction_crud',\s*(\{[\s\S]*?\})\)/g,
    "await fetchApi$1('/api/payroll/transaction/crud', { method: 'POST', body: JSON.stringify($2) })"
  );
  
  text = text.replace(
    /await invoke\('save_daily_mis_batch',\s*(\{[\s\S]*?\})\)/g,
    "await fetchApi('/api/payroll/transaction/save-daily-mis-batch', { method: 'POST', body: JSON.stringify($1) })"
  );

  // useEarningsHistory.ts
  text = text.replace(
    /await invoke([<][^>]+[>])?\('get_earning_history',\s*(\{[\s\S]*?\})\)/g,
    "await fetchApi$1('/api/payroll/transaction/earning-history', { method: 'POST', body: JSON.stringify($2) })"
  );
  
  fs.writeFileSync(file, text);
}

repair('src/hooks/useDailyMIS.ts');
repair('src/hooks/useEarningsHistory.ts');
