import fs from 'fs';

let content = fs.readFileSync('src/pages/transactions/AttendanceEntry.tsx', 'utf8');
const searchString = "await fetchApi('/api/attendance/bulk-generate-v2', { method: 'POST', body: JSON.stringify({ fromDate: format(bulkStartDate, 'yyyy-MM-dd'), toDate: format(bulkEndDate, 'yyyy-MM-dd'), filters: { departmentId: bulkDeptId || undefined, locationId: bulkLocId || undefined, categoryId: bulkCatId || undefined, groupId: bulkGroupId || undefined }, module_type: currentMode }) })";

// The script replaced the invoke call. It used global replace with /g on regex.
// Wait, the regex had `\s*` which might have matched LOTS of spaces, or something else.
// But we can see if we can just find React component code in the file.
let match = content.match(/import React/);
if (match) {
  console.log("Found import React at index: " + match.index);
} else {
  console.log("Could not find import React");
}
