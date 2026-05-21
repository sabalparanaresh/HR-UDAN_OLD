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

  const cmds = [
    "verify_security_key",
    "execute_report_query",
    "fetch_pincode_details",
    "distribute_report",
    "get_p_salary_details_for_k",
    "save_p_salary_details_for_k",
    "delete_org_unit",
    "save_department_settings",
    "save_department_rate",
    "get_master_usage",
    "generate_enterprise_excel",
    "generate_salary_register_excel",
    "get_cash_payment_history",
    "add_cash_payment",
    "reverse_cash_payment",
    "production_entry_crud",
    "get_aadhar_consent_data",
    
    // some others missed
    "get_attendance_logs",
    "fetch_biometric_logs",
    "save_biometric_logs",
    "save_manual_attendance",
    "resolve_attendance_anomalies",
    "bulk_attendance_v2"
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
    /await\s+invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*,\s*([a-zA-Z0-9_]+)\s*\)/g,
    (match, cmd, argsStr) => {
      if (cmds.includes(cmd)) {
        return "await fetchApi('/api/system/cmd/" + toCamelCase(cmd) + "', { method: 'POST', body: JSON.stringify(" + argsStr + ") })";
      }
      return match;
    }
  );

  content = content.replace(
    /invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*,\s*([a-zA-Z0-9_]+)\s*\)/g,
    (match, cmd, argsStr) => {
      if (cmds.includes(cmd) && !match.startsWith('await')) {
        return "fetchApi('/api/system/cmd/" + toCamelCase(cmd) + "', { method: 'POST', body: JSON.stringify(" + argsStr + ") })";
      }
      return match;
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log('Updated frontend variable usages:', filePath);
  }
}

walkDir('src/pages', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
walkDir('src/components', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
walkDir('src/hooks', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
walkDir('src/services', (filePath) => { if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) replaceInvokeWithFetchApi(filePath); });
