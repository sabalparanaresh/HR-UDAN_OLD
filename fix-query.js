const fs = require('fs');

function fixQueryString(filePath) {
  if (fs.existsSync(filePath)) {
    let text = fs.readFileSync(filePath, 'utf8');
    text = text.replace(/req\.query\.employeeId as string/g, 'req.query.employeeId as any');
    text = text.replace(/req\.query\.machineId as string/g, 'req.query.machineId as any');
    text = text.replace(/req\.query\.dept as string/g, 'req.query.dept as any');
    text = text.replace(/req\.query\.employeeId as string \[\]/g, 'req.query.employeeId as any');
    fs.writeFileSync(filePath, text, 'utf8');
  }
}

fixQueryString('src-server/domains/piece-rate/routes.ts');
fixQueryString('src-server/legacyRouter.ts');
console.log('Fixed query strings');
