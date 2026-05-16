import fs from 'fs';
import path from 'path';

const filesToFix = [
  'src/components/reports/ReportLayout.tsx',
  'src/components/CompanySettings.tsx',
  'src/components/grid/DataGridP.tsx',
  'src/components/grid/BaseGrid.tsx',
  'src/components/grid/DataGridK.tsx',
  'src/pages/hr-settings/PincodeMaster.tsx',
  'src/pages/transactions/VariableSalaryEntry.tsx',
  'src/pages/transactions/AttendanceEntry.tsx',
  'src/pages/user-management/SystemConnection.tsx',
  'src/pages/employee/EmployeeMaster.tsx',
  'src/lib/rbac.ts'
];

filesToFix.forEach(file => {
  const fullPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/currentUser\?\.role === 'Super Admin' \|\| currentUser\?\.name === 'Rajesh Kumar' \|\| currentUser\?\.username === 'superadmin'/g, "currentUser?.role === 'SUPERADMIN'");
    content = content.replace(/currentUser\?\.role === 'Super Admin' \|\| currentUser\?\.name === 'Rajesh Kumar'/g, "currentUser?.role === 'SUPERADMIN'");
    content = content.replace(/user\.role === 'SuperAdmin' \|\| user\.role === 'Super Admin' \|\| user\.name === 'Rajesh Kumar'/g, "user?.role === 'SUPERADMIN'");
    content = content.replace(/user\?\.role === 'SuperAdmin' \|\| user\?\.role === 'Super Admin' \|\| user\?\.name === 'Rajesh Kumar'/g, "user?.role === 'SUPERADMIN'");
    fs.writeFileSync(fullPath, content);
    console.log('Fixed', file);
  }
});
