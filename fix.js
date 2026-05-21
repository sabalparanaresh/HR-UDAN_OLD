import fs from 'fs';

let content = fs.readFileSync('src-server/domains/payroll/routes.ts', 'utf-8');

// 1. Rename res to _res in the express parameter
content = content.replace(/payrollRouter.post\('(.+?)', \(req: any, res\) => \{/g, "payrollRouter.post('$1', (req: any, _res) => {\n  const res = _res;");

// 2. Change closing }; to }); for the route handlers.
// The easiest way to reliably do this is replacing ^};$ with });
// Wait, they might have trailing spaces.
content = content.replace(/^};$/gm, '});');

fs.writeFileSync('src-server/domains/payroll/routes.ts', content);
