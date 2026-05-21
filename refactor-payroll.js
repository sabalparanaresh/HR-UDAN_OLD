import fs from 'fs';
import path from 'path';

function replaceInvokeWithFetchApi(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Add fetchApi import if missing
  if (content.includes('invoke(') && !content.includes('fetchApi')) {
    content = content.replace(
      "import { invokeCommand as invoke } from '../../services/apiClient';",
      "import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';"
    );
  }

  // Replace get_payroll_analytics
  content = content.replace(
    /await invoke\('get_payroll_analytics',\s*([^)]*)\)/g,
    "await fetchApi('/api/reports/payroll-analytics', { method: 'POST', body: JSON.stringify($1) })"
  );
  
  // Actually, wait, get_payroll_analytics is in reports. So let's map it there later or now. Let's map it to payrollRouter.post('/analytics')
  content = content.replace(
    /await invoke\('get_payroll_analytics',\s*({[^}]*})\)/g,
    "await fetchApi('/api/payroll/analytics', { method: 'POST', body: JSON.stringify($1) })"
  );

  // Replace save_transaction_entry
  content = content.replace(
    /await invoke\('save_transaction_entry',\s*(\{[\s\S]*?\})\)/g,
    "await fetchApi('/api/payroll/transaction/save', { method: 'POST', body: JSON.stringify($1) })"
  );

  // Replace transaction_crud
  content = content.replace(
    /await invoke([<][^>]+[>])?\('transaction_crud',\s*(\{[\s\S]*?\})\)/g,
    "await fetchApi$1('/api/payroll/transaction/crud', { method: 'POST', body: JSON.stringify($2) })"
  );
  
  // Replace bulk_insert_transactions
  content = content.replace(
    /await invoke([<][^>]+[>])?\('bulk_insert_transactions',\s*(\{[\s\S]*?\})\)/g,
    "await fetchApi$1('/api/payroll/transaction/bulk-insert', { method: 'POST', body: JSON.stringify($2) })"
  );

  // Replace get_transaction_history
  content = content.replace(
    /await invoke([<][^>]+[>])?\('get_transaction_history',\s*(\{[\s\S]*?\})\)/g,
    "await fetchApi$1('/api/payroll/transaction/history', { method: 'POST', body: JSON.stringify($2) })"
  );

  // Replace update_transaction
  content = content.replace(
    /await invoke\('update_transaction',\s*(\{[\s\S]*?\})\)/g,
    "await fetchApi('/api/payroll/transaction/update', { method: 'POST', body: JSON.stringify($1) })"
  );

  // Replace bulk_delete_transactions
  content = content.replace(
    /await invoke\('bulk_delete_transactions',\s*(\{[\s\S]*?\})\)/g,
    "await fetchApi('/api/payroll/transaction/bulk-delete', { method: 'POST', body: JSON.stringify($1) })"
  );

  // Replace save_arrear
  content = content.replace(
    /await invoke\('save_arrear',\s*(\{[\s\S]*?\})\)/g,
    "await fetchApi('/api/payroll/transaction/save-arrear', { method: 'POST', body: JSON.stringify($1) })"
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log('Updated:', filePath);
  }
}

const files = [
  'src/pages/transactions/VariableSalaryEntry.tsx',
  'src/pages/transactions/ArrearEntry.tsx',
  'src/pages/transactions/DeductionEntry.tsx',
  'src/pages/transactions/EarningEntry.tsx',
  'src/components/table/HistoryTable.tsx',
  'src/pages/reports/PayrollAnalytics.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    replaceInvokeWithFetchApi(file);
  }
});
