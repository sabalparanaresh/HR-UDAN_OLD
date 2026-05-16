const fs = require('fs');

const routerContent = fs.readFileSync('src-server/legacyRouter.ts', 'utf8');

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

casesToExtract.forEach(c => {
  const match = routerContent.match(new RegExp(`case '${c}':[\\s\\S]*?break;`));
  if (match) {
    console.log(`Matched ${c}, length: ${match[0].length}`);
  }
});
