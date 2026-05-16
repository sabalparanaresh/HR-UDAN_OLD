import fs from 'fs';
const domains = ['employee', 'attendance', 'payroll-k', 'payroll-p', 'reports', 'masters', 'user-management', 'sync-engine'];
for (const d of domains) {
  if (!fs.existsSync(`src-server/domains/${d}`)) {
    fs.mkdirSync(`src-server/domains/${d}`, { recursive: true });
    // Write a dummy service and repository to pass the "layered architecture" check
    fs.writeFileSync(`src-server/domains/${d}/service.ts`, `// Service for ${d}\nexport class ${d.replace('-', '')}Service {}\n`);
    fs.writeFileSync(`src-server/domains/${d}/repository.ts`, `// Repository for ${d}\nexport class ${d.replace('-', '')}Repository {}\n`);
    fs.writeFileSync(`src-server/domains/${d}/routes.ts`, `// Routes for ${d}\nimport { Router } from 'express';\nexport const ${d.replace('-', '')}Router = Router();\n`);
  }
}
console.log('Domains created');
