import fs from 'fs';

let content = fs.readFileSync('src-server/domains/payroll/routes.ts', 'utf-8');

// 1. Remove re-declarations inside ctx destructuring: `res, req` or `res,req`
content = content.replace(/const {([^}]+)} = ctx;/g, (match, inner) => {
   let parts = inner.split(',').map(s => s.trim());
   parts = parts.filter(p => p !== 'res' && p !== 'req');
   if (parts.length === 0) return '';
   return `const { ${parts.join(', ')} } = ctx;`;
});

// 2. Fix the require('../domains/piece-rate/service') -> require('../../domains/piece-rate/service')
content = content.replace("require('../domains/piece-rate/service')", "require('../../domains/piece-rate/service.js')");

// 3. Fix imports at the top
content = content.replace("'../services/PayrollEngineK.js'", "'../../services/PayrollEngineK.js'");
content = content.replace("'../utils/logger.js'", "'../../utils/logger.js'");
content = content.replace("'../services/PayrollEngine.js'", "'../../services/PayrollEngine.js'");
content = content.replace("'../utils/helpers.js'", "'../../utils/helpers.js'");

fs.writeFileSync('src-server/domains/payroll/routes.ts', content);
