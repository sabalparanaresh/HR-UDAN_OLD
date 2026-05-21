import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const cmds = [
  "sync_employee_to_pakka",
  "get_p_salary_details_for_k",
  "save_p_salary_details_for_k",
  "get_leave_credit_preview",
  "post_leave_credits",
  "save_employee_asset",
  "check_duplicate",
  "bulk_employee_upsert",
  "record_salary_revision",
  "get_salary_revision_history",
  "get_open_grievances",
  "search_employees",
  "resolve_grievance",
  "get_employee_record",
  "get_next_employee_code",
  "check_min_wage",
  "get_asset_deposit_data",
  "save_asset",
  "save_deposit",
  "return_asset",
  "get_ff_clearance",
  "process_waterfall_distribution"
];

function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function replaceInvokeWithFetchApi(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  if (content.includes('invoke(') || content.includes('invokeCommand(') || content.includes('invokeCommand as invoke') || content.includes('invokeCommand<')) {
    if (!content.includes('fetchApi')) {
      content = content.replace(
        /import\s+\{\s*invokeCommand\s+as\s+invoke\s*\}\s+from\s+[^;]+;/,
        "import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';"
      );
      content = content.replace(
        /import\s+\{\s*invokeCommand\s*\}\s+from\s+[^;]+;/,
        "import { invokeCommand, fetchApi } from '../../services/apiClient';"
      );
    }
  }

  cmds.forEach(cmd => {
    const camelCmd = toCamelCase(cmd);
    
    // Simplest replacement possible
    let regex1 = new RegExp("await\\\\s+invoke(?:Command)?(?:<[^>]+>)?\\\\(\\\\s*['\\\"]" + cmd + "['\\\"]\\\\s*,\\\\s*(\\\\{[\\\\s\\\\S]*?\\\\})\\\\s*\\\\)", "g");
    content = content.replace(regex1, "await fetchApi('/api/employee/cmd/" + camelCmd + "', { method: 'POST', body: JSON.stringify($1) })");
    
    let regex2 = new RegExp("invoke(?:Command)?(?:<[^>]+>)?\\\\(\\\\s*['\\\"]" + cmd + "['\\\"]\\\\s*,\\\\s*(\\\\{[\\\\s\\\\S]*?\\\\})\\\\s*\\\\)", "g");
    content = content.replace(regex2, "fetchApi('/api/employee/cmd/" + camelCmd + "', { method: 'POST', body: JSON.stringify($1) })");

    let regex3 = new RegExp("await\\\\s+invoke(?:Command)?(?:<[^>]+>)?\\\\(\\\\s*['\\\"]" + cmd + "['\\\"]\\\\s*\\\\)", "g");
    content = content.replace(regex3, "await fetchApi('/api/employee/cmd/" + camelCmd + "', { method: 'POST' })");

    let regex4 = new RegExp("await\\\\s+this\\\\.call(?:<[^>]+>)?\\\\(\\\\s*['\\\"]" + cmd + "['\\\"]\\\\s*,\\\\s*(\\\\{[\\\\s\\\\S]*?\\\\})\\\\s*\\\\)", "g");
    content = content.replace(regex4, "await fetchApi('/api/employee/cmd/" + camelCmd + "', { method: 'POST', body: JSON.stringify($1) })");

    let regex5 = new RegExp("this\\\\.call(?:<[^>]+>)?\\\\(\\\\s*['\\\"]" + cmd + "['\\\"]\\\\s*,\\\\s*(\\\\{[\\\\s\\\\S]*?\\\\})\\\\s*\\\\)", "g");
    content = content.replace(regex5, "fetchApi('/api/employee/cmd/" + camelCmd + "', { method: 'POST', body: JSON.stringify($1) })");
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log('Updated frontend:', filePath);
  }
}

walkDir('src/pages', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
walkDir('src/components', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
walkDir('src/hooks', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
walkDir('src/services', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
if (fs.existsSync('src/App.tsx')) replaceInvokeWithFetchApi('src/App.tsx');
