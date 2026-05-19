const fs = require('fs');

function replaceFileContent(filePath, findPattern, replacePattern) {
  let text = fs.readFileSync(filePath, 'utf8');
  text = text.replace(findPattern, replacePattern);
  fs.writeFileSync(filePath, text, 'utf8');
}

// 1. better-sqlite3 Database type
const dbFiles = [
  'src-server/db/transaction.ts',
  'src-server/domains/payroll/PayrollEngineK.ts',
  'src-server/domains/payroll/PayrollEngineP.ts',
  'src-server/domains/sync-engine/service.ts',
  'src-server/legacyRouter.ts',
  'src-server/middleware/audit.ts'
];

dbFiles.forEach(f => {
  if (fs.existsSync(f)) {
    let text = fs.readFileSync(f, 'utf8');
    text = text.replace(/db: Database/g, 'db: Database.Database');
    text = text.replace(/\(db: Database\)/g, '(db: Database.Database)');
    text = text.replace(/primaryDb: Database/g, 'primaryDb: Database.Database');
    text = text.replace(/statutoryDb: Database/g, 'statutoryDb: Database.Database');
    text = text.replace(/db\?: Database/g, 'db?: Database.Database');
    text = text.replace(/setupAuditTriggers = \(db: Database, /g, 'setupAuditTriggers = (db: Database.Database, ');
    text = text.replace(/setupWAL\(db: Database\)/g, 'setupWAL(db: Database.Database)');
    text = text.replace(/db: typeof Database/g, 'db: Database.Database');
    fs.writeFileSync(f, text, 'utf8');
  }
});

// 2. err in attendance.ts
replaceFileContent('src-server/commands/attendance.ts', /e\.message/g, '(e as any).message');
replaceFileContent('src-server/commands/attendance.ts', /err\.message/g, '(err as any).message');

// 3. item as any in masterData.ts
replaceFileContent('src-server/commands/masterData.ts', /item\.emp_id/g, '(item as any).emp_id');
replaceFileContent('src-server/commands/masterData.ts', /item\.id/g, '(item as any).id');

// 4. string | string[] in routes
replaceFileContent('src-server/domains/piece-rate/routes.ts', /req\.query\.employeeId/g, '(req.query.employeeId as string)');
replaceFileContent('src-server/domains/piece-rate/routes.ts', /req\.query\.machineId/g, '(req.query.machineId as string)');
replaceFileContent('src-server/legacyRouter.ts', /req\.query\.employeeId/g, '(req.query.employeeId as string)');
replaceFileContent('src-server/legacyRouter.ts', /req\.query\.dept/g, '(req.query.dept as string)');
replaceFileContent('src-server/legacyRouter.ts', /req\.query\.machineId/g, '(req.query.machineId as string)');

// 5. useAttendanceTaskListener.ts
let useAttendanceText = fs.readFileSync('src/hooks/useAttendanceTaskListener.ts', 'utf8');
useAttendanceText = useAttendanceText.replace(/listen<[^>]+>\(/g, 'tauriListen(');
useAttendanceText = useAttendanceText.replace(/listen\(/g, 'tauriListen(');
fs.writeFileSync('src/hooks/useAttendanceTaskListener.ts', useAttendanceText, 'utf8');

console.log('Fixed typescript issues in script');
