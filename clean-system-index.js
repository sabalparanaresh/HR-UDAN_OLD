import fs from 'fs';

let content = fs.readFileSync('src-server/commands/index.ts', 'utf8');

const toRemove = [
  "'get_statutory_settings'",
  "'list_statutory_settings'",
  "'save_statutory_settings'",
  "'delete_statutory_setting'",
  "'calculate_ptax'",
  "'get_gratuity_ledger'",
  "'sync_salary_slabs_to_p'",
  "'piece_rate_crud'",
  "'get_cash_transactions'",
  "'get_next_rokda_token'",
  "'save_mis_voucher'",
  "'get_report_definition'",
  "'get_analytic_data'",
  "'sync_k_to_p'",
  "'get_attendance_analytics'",
  "'get_historical_attendance_analytics'",
  "'get_audit_analytics'",
  "'get_compliance_analytics'",
  "'get_dashboard_data'",
  "'get_report_schedules'",
  "'create_report_schedule'",
  "'delete_report_schedule'",
  "'toggle_report_schedule'",
  "'get_report_schedule_history'",
  "'get_report_templates'",
  "'save_report_template'",
  "'delete_report_template'",
  "'execute_kpi_query'",
  "'execute_report_query'",
  "'save_report_snapshot'",
  "'get_report_snapshots'",
  "'get_report_snapshot_data'"
];

const lines = content.split('\n');
const newLines = lines.filter(line => {
  for (const str of toRemove) {
    if (line.includes(str)) return false;
  }
  return true;
});

fs.writeFileSync('src-server/commands/index.ts', newLines.join('\n'));
