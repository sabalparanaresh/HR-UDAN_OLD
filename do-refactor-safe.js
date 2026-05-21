import fs from 'fs';

let content = fs.readFileSync('src/pages/transactions/AttendanceEntry.tsx', 'utf8');

// Ensure fetchApi is imported
if (!content.includes('fetchApi')) {
  content = content.replace("import { invokeCommand as invoke } from '../../services/apiClient';", "import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';");
}

let replacements = 0;

function safeReplace(search, replacement) {
  let oldContent = content;
  content = content.split(search).join(replacement);
  if (oldContent !== content) replacements++;
}

safeReplace("await invoke<AttendanceLog[]>('get_attendance_logs', {", "await fetchApi<AttendanceLog[]>('/api/attendance/logs?module_type=' + currentMode + '&filters=' + encodeURIComponent(JSON.stringify(filters || {})), {");
// Above is a little crude, but we know it's a GET, so we can just replace the whole invoke block for GET logs.

// Wait, the better way is to replace the precise lines by using multi-line string matching or regex that is strict.
