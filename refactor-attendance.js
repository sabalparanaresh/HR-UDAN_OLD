import fs from 'fs';

let content = fs.readFileSync('src/pages/transactions/AttendanceEntry.tsx', 'utf8');

// replace get_attendance_logs
content = content.replace(/await invoke<AttendanceLog\[\]>\('get_attendance_logs', \{\n\s*filters,\n\s*moduleType: currentMode\n\s*\}\)/g, 
"await fetchApi<AttendanceLog[]>(`/api/attendance/logs?module_type=\${currentMode}&filters=\${encodeURIComponent(JSON.stringify(filters))}`)");

// replace fetch_biometric_logs
content = content.replace(/await invoke<any\[\]>\('fetch_biometric_logs', \{ \n\s*moduleType: currentMode \n\s*\}\)/g, 
"await fetchApi<any[]>(`/api/attendance/biometric/sync?module_type=\${currentMode}`)");

// replace save_biometric_logs
content = content.replace(/await invoke<any>\('save_biometric_logs', \{ \n\s*logs: biometricLogs,\n\s*moduleType: currentMode \n\s*\}\)/g, 
"await fetchApi<any>('/api/attendance/biometric/save', { method: 'POST', body: JSON.stringify({ logs: biometricLogs, module_type: currentMode }) })");

// replace process_attendance
content = content.replace(/await invoke\('process_attendance', \{\n\s*fromDate: filters.fromDate,\n\s*toDate: filters.toDate,\n\s*moduleType: currentMode\n\s*\}\)/g, 
"await fetchApi('/api/attendance/process', { method: 'POST', body: JSON.stringify({ fromDate: filters.fromDate, toDate: filters.toDate, module_type: currentMode }) })");

// replace save_manual_attendance single punch
content = content.replace(/await invoke\('save_manual_attendance', \{\n\s*empId: selectedEmployee,\n\s*date: manualPunchDate,\n\s*punchIn: manualPunchIn \|\| null,\n\s*punchOut: manualPunchOut \|\| null,\n\s*shiftId: manualShiftId \|\| null,\n\s*moduleType: currentMode\n\s*\}\)/g, 
"await fetchApi('/api/attendance/manual-punch', { method: 'POST', body: JSON.stringify({ empId: selectedEmployee, date: manualPunchDate, punchIn: manualPunchIn || null, punchOut: manualPunchOut || null, shiftId: manualShiftId || null, module_type: currentMode }) })");

// replace bulk_attendance_v2
content = content.replace(/await invoke<any>\('bulk_attendance_v2', \{\n\s*fromDate: format\(bulkStartDate, 'yyyy-MM-dd'\),\n\s*toDate: format\(bulkEndDate, 'yyyy-MM-dd'\),\n\s*filters: \{\n\s*departmentId: bulkDeptId || undefined,\n\s*locationId: bulkLocId || undefined,\n\s*categoryId: bulkCatId || undefined,\n\s*groupId: bulkGroupId || undefined\n\s*\},\n\s*moduleType: currentMode\n\s*\}\)/g, 
"await fetchApi('/api/attendance/bulk-generate-v2', { method: 'POST', body: JSON.stringify({ fromDate: format(bulkStartDate, 'yyyy-MM-dd'), toDate: format(bulkEndDate, 'yyyy-MM-dd'), filters: { departmentId: bulkDeptId || undefined, locationId: bulkLocId || undefined, categoryId: bulkCatId || undefined, groupId: bulkGroupId || undefined }, module_type: currentMode }) })");

// replace resolve_attendance_anomalies
content = content.replace(/await invoke<any>\('resolve_attendance_anomalies', \{\n\s*moduleType: currentMode\n\s*\}\)/g, 
"await fetchApi('/api/attendance/resolve-anomalies', { method: 'POST' })");

fs.writeFileSync('src/pages/transactions/AttendanceEntry.tsx', content);
