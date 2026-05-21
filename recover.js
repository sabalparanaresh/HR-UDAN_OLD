import fs from 'fs';

let content = fs.readFileSync('src/pages/transactions/AttendanceEntry.tsx', 'utf8');

const replacement = "await fetchApi('/api/attendance/bulk-generate-v2', { method: 'POST', body: JSON.stringify({ fromDate: format(bulkStartDate, 'yyyy-MM-dd'), toDate: format(bulkEndDate, 'yyyy-MM-dd'), filters: { departmentId: bulkDeptId || undefined, locationId: bulkLocId || undefined, categoryId: bulkCatId || undefined, groupId: bulkGroupId || undefined }, module_type: currentMode }) })";

let original = "";

// The replacement was inserted at every empty string match.
// This means: replacement + char(0) + replacement + char(1) ...
// Actually, `String.prototype.replace` with a regex matching empty string
// inserts the replacement before the first char, between all chars, and after the last char.

let i = 0;
while (i < content.length) {
  if (content.startsWith(replacement, i)) {
    i += replacement.length;
  } else {
    original += content[i];
    i++;
  }
}

fs.writeFileSync('src/pages/transactions/AttendanceEntry.tsx.recovered', original);
console.log("Recovered length:", original.length);
