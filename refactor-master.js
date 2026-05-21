import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function replaceInvokeWithFetchApi(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Add fetchApi import if missing
  if (content.includes('invoke') && !content.includes('fetchApi')) {
    content = content.replace(
      /import\s+\{\s*invokeCommand\s+as\s+invoke\s*\}\s+from/,
      "import { invokeCommand as invoke, fetchApi } from"
    );
    content = content.replace(
      /import\s+\{\s*invokeCommand\s*\}\s+from/,
      "import { invokeCommand, fetchApi } from"
    );
  }
  
  if (content.includes('invokeCommand') && !content.includes('fetchApi') && !content.includes('import { fetchApi }')) {
    // maybe it wasn't matched properly. Try again
    if (!content.includes('fetchApi')) {
      content = content.replace(
        "import { invokeCommand } from",
        "import { invokeCommand, fetchApi } from"
      );
    }
  }

  // Replace master_crud
  content = content.replace(
    /await invoke(?:Command)?(?:[<][^>]+[>])?\('master_crud',\s*(\{[\s\S]*?\})\)/g,
    "await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify($1) })"
  );
  
  // Try another regex if there is no await (just in Promise.all or return)
  content = content.replace(
    /invoke(?:Command)?([<][^>]+[>])?\('master_crud',\s*(\{[\s\S]*?\})\)/g,
    "fetchApi$1('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify($2) })"
  );

  // same for get_master_data
  content = content.replace(
    /invoke(?:Command)?([<][^>]+[>])?\('get_master_data',\s*(\{[\s\S]*?\})\)/g,
    "fetchApi$1('/api/master-data/get-master-data', { method: 'POST', body: JSON.stringify($2) })"
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
if (fs.existsSync('src/App.tsx')) replaceInvokeWithFetchApi('src/App.tsx');
