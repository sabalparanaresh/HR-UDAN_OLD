import fs from 'fs';

let text = fs.readFileSync('src/hooks/useAdvanceSimulation.ts', 'utf8');

if (text.includes('invoke(') && !text.includes('fetchApi')) {
  text = text.replace(
    "import { invokeCommand as invoke } from '../services/apiClient';",
    "import { invokeCommand as invoke, fetchApi } from '../services/apiClient';"
  );
}

text = text.replace(
  /await invoke\('post_advance_transactions',\s*(\{[\s\S]*?\})\)/g,
  "await fetchApi('/api/payroll/advance/post', { method: 'POST', body: JSON.stringify($1) })"
);

fs.writeFileSync('src/hooks/useAdvanceSimulation.ts', text);
