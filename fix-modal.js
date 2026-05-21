import fs from 'fs';

let content = fs.readFileSync('src/components/BulkAttendanceProgressModal.tsx', 'utf8');
content = content.replace("await invoke('cancel_bulk_attendance', {});", "await fetchApi('/api/attendance/cancel-bulk', { method: 'POST' });");

if (!content.includes('import { fetchApi }')) {
  // If fetchApi is not imported, let's fix it by importing it next to apiClient
  content = content.replace("import { invokeCommand as invoke } from '../services/apiClient';", "import { invokeCommand as invoke, fetchApi } from '../services/apiClient';");
}

fs.writeFileSync('src/components/BulkAttendanceProgressModal.tsx', content);
