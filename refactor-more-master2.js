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
    "get_dept_settings",
    "get_dept_standard_rates",
    "get_pincode_records",
    "bulk_bank_import",
    "bulk_bank_master_upsert",
    "bulk_pincode_upsert",
    "get_ogd_records",
    "get_ogd_bank_list",
    "get_ogd_bank_branches",
    "bulk_upload_departments",
    "bulk_upload_standard_rates",
    "clear_org_data",
    "save_rokda_voucher"
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
        return \`await fetchApi('/api/master-data/cmd/\${toCamelCase(cmd)}', { method: 'POST', body: JSON.stringify(\${argsStr}) })\`;
      }
      return match;
    }
  );

  content = content.replace(
    /await\s+invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*\)/g,
    (match, cmd) => {
      if (cmds.includes(cmd)) {
        return \`await fetchApi('/api/master-data/cmd/\${toCamelCase(cmd)}', { method: 'POST' })\`;
      }
      return match;
    }
  );
  
  content = content.replace(
    /invoke(?:Command)?(?:<[^>]+>)?\(\s*['"]([a-z_]+)['"]\s*,\s*(\{[\s\S]*?\})\s*\)/g,
    (match, cmd, argsStr) => {
      if (cmds.includes(cmd) && !match.startsWith('await')) {
        return \`fetchApi('/api/master-data/cmd/\${toCamelCase(cmd)}', { method: 'POST', body: JSON.stringify(\${argsStr}) })\`;
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
