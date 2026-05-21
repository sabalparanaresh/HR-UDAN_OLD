import fs from 'fs';
fs.writeFileSync('src/pages/transactions/AttendanceEntry.tsx', fs.readFileSync('src/pages/transactions/AttendanceEntry.tsx.recovered'));
