import * as fs from 'fs';

let router = fs.readFileSync('src-server/legacyRouter.ts', 'utf8');
let reportsFile = fs.readFileSync('src-server/commands/reports.ts', 'utf8');
let indexFile = fs.readFileSync('src-server/commands/index.ts', 'utf8');

const casesToExtract = [
  'get_attendance_analytics',
  'get_payroll_analytics',
  'get_audit_analytics',
  'get_compliance_analytics',
  'get_dashboard_data',
  'get_report_schedules',
  'create_report_schedule',
  'delete_report_schedule',
  'toggle_report_schedule',
  'get_report_schedule_history',
  'get_report_templates',
  'save_report_template',
  'delete_report_template',
  'execute_kpi_query',
  'execute_report_query',
  'save_report_snapshot',
  'get_report_snapshots',
  'get_report_snapshot_data'
];

let addedExports = [];

for (const caseName of casesToExtract) {
  const match = router.match(new RegExp(`case '${caseName}':[\\s\\S]*?break;`));
  if (match) {
    let block = match[0];
    
    // Convert to function name
    const paramName = caseName.split('_').map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');
    
    let fnBody = block.replace(new RegExp(`case '${caseName}':\\s*\\{?`), '');
    fnBody = fnBody.replace(/break;$/, '');
    if (fnBody.trim().endsWith('}')) {
        fnBody = fnBody.trim().slice(0, -1);
    }
    
    const isAsync = fnBody.includes('await ') ? 'async ' : '';

    const newFn = `export const ${paramName}: CommandHandler = ${isAsync}(ctx, args) => {\n  const { primaryDb, statutoryDb, res, req } = ctx;\n  ${fnBody}\n};\n`;
    
    reportsFile += '\n' + newFn;
    
    router = router.replace(block, `// Extracted ${caseName} to COMMAND_MAP`);
    addedExports.push({ key: caseName, fn: paramName });
  }
}

// Ensure DuckDBAnalyticsRepo and other dependencies are imported or accessible if needed
// Actually, in `legacyRouter.ts`, DuckDBAnalyticsRepo is defined inside setupRoutes. Wait!
// If DuckDBAnalyticsRepo is defined locally in `legacyRouter.ts`, extracting it directly to `reports.ts` will break because it won't find `DuckDBAnalyticsRepo`.

fs.writeFileSync('src-server/legacyRouter_backup.ts', router);
