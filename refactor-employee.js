import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function replaceInvokeWithFetchApi(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // We are specifically looking for Employee commands
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
  
  if (!cmds.some(cmd => content.includes(cmd))) return;

  if (content.includes('invoke') && !content.includes('fetchApi')) {
    content = content.replace(
      /import\s+\{\s*invokeCommand\s+as\s+invoke\s*\}\s+from\s+[^;]+;/,
      "import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';"
    );
    content = content.replace(
      /import\s+\{\s*invokeCommand\s*\}\s+from\s+[^;]+;/,
      "import { invokeCommand, fetchApi } from '../../services/apiClient';"
    );
  }

  content = content.replace(
    /await\s+invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*,\s*(\{[\s\S]*?\})\s*\)/g,
    (match, cmd, argsStr) => {
      if (cmds.includes(cmd)) {
        return "await fetchApi('/api/employee/cmd/" + toCamelCase(cmd) + "', { method: 'POST', body: JSON.stringify(" + argsStr + ") })";
      }
      return match;
    }
  );

  content = content.replace(
    /await\s+invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*\)/g,
    (match, cmd) => {
      if (cmds.includes(cmd)) {
        return "await fetchApi('/api/employee/cmd/" + toCamelCase(cmd) + "', { method: 'POST' })";
      }
      return match;
    }
  );
  
  content = content.replace(
    /invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*,\s*(\{[\s\S]*?\})\s*\)/g,
    (match, cmd, argsStr) => {
      if (cmds.includes(cmd) && !match.startsWith('await')) {
        return "fetchApi('/api/employee/cmd/" + toCamelCase(cmd) + "', { method: 'POST', body: JSON.stringify(" + argsStr + ") })";
      }
      return match;
    }
  );
  
  // Replace this.call for API services
  content = content.replace(
    /this\.call(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*,\s*(\{[\s\S]*?\})\s*\)/g,
    (match, cmd, argsStr) => {
      if (cmds.includes(cmd)) {
        let replacement = "fetchApi('/api/employee/cmd/" + toCamelCase(cmd) + "', { method: 'POST', body: JSON.stringify(" + argsStr + ") })";
        if (match.startsWith("await ")) replacement = "await " + replacement; // Regex doesn't match await though.
        return replacement;
      }
      return match;
    }
  );

  // one more check for await this.call
  content = content.replace(
    /await\s+this\.call(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*,\s*(\{[\s\S]*?\})\s*\)/g,
    (match, cmd, argsStr) => {
      if (cmds.includes(cmd)) {
        return "await fetchApi('/api/employee/cmd/" + toCamelCase(cmd) + "', { method: 'POST', body: JSON.stringify(" + argsStr + ") })";
      }
      return match;
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log('Updated frontend:', filePath);
  }
}

walkDir('src/pages', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
walkDir('src/components', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
walkDir('src/hooks', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
walkDir('src/services', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
