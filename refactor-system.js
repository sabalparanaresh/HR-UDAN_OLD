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
    "get_statutory_settings",
    "list_statutory_settings",
    "save_statutory_settings",
    "delete_statutory_setting",
    "calculate_ptax",
    "get_gratuity_ledger",
    "sync_salary_slabs_to_p",
    "piece_rate_crud",
    "get_cash_transactions",
    "get_next_rokda_token",
    "save_mis_voucher",
    "get_report_definition",
    "get_analytic_data",
    "sync_k_to_p",
    "get_attendance_analytics",
    "get_historical_attendance_analytics",
    "get_audit_analytics",
    "get_compliance_analytics",
    "get_dashboard_data",
    "get_report_schedules",
    "create_report_schedule",
    "delete_report_schedule",
    "toggle_report_schedule",
    "get_report_schedule_history",
    "get_report_templates",
    "save_report_template",
    "delete_report_template",
    "execute_kpi_query",
    "execute_report_query",
    "save_report_snapshot",
    "get_report_snapshots",
    "get_report_snapshot_data"
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
        return "await fetchApi('/api/system/cmd/" + toCamelCase(cmd) + "', { method: 'POST', body: JSON.stringify(" + argsStr + ") })";
      }
      return match;
    }
  );

  content = content.replace(
    /await\s+invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*\)/g,
    (match, cmd) => {
      if (cmds.includes(cmd)) {
        return "await fetchApi('/api/system/cmd/" + toCamelCase(cmd) + "', { method: 'POST' })";
      }
      return match;
    }
  );
  
  content = content.replace(
    /invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*,\s*(\{[\s\S]*?\})\s*\)/g,
    (match, cmd, argsStr) => {
      if (cmds.includes(cmd) && !match.startsWith('await')) {
        return "fetchApi('/api/system/cmd/" + toCamelCase(cmd) + "', { method: 'POST', body: JSON.stringify(" + argsStr + ") })";
      }
      return match;
    }
  );

  content = content.replace(
    /invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*\)/g,
    (match, cmd) => {
      if (cmds.includes(cmd) && !match.startsWith('await')) {
        return "fetchApi('/api/system/cmd/" + toCamelCase(cmd) + "', { method: 'POST' })";
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
