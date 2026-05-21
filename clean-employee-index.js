import fs from 'fs';

let content = fs.readFileSync('src-server/commands/index.ts', 'utf8');

const toRemove = [
  "'sync_employee_to_pakka'",
  "'get_p_salary_details_for_k'",
  "'save_p_salary_details_for_k'",
  "'get_leave_credit_preview'",
  "'post_leave_credits'",
  "'save_employee_asset'",
  "'check_duplicate'",
  "'bulk_employee_upsert'",
  "'record_salary_revision'",
  "'get_salary_revision_history'",
  "'get_open_grievances'",
  "'search_employees'",
  "'resolve_grievance'",
  "'get_employee_record'",
  "'get_next_employee_code'",
  "'check_min_wage'",
  "'get_asset_deposit_data'",
  "'save_asset'",
  "'save_deposit'",
  "'return_asset'",
  "'get_ff_clearance'",
  "'process_waterfall_distribution'"
];

const lines = content.split('\n');
const newLines = lines.filter(line => {
  for (const str of toRemove) {
    if (line.includes(str)) return false;
  }
  return true;
});

fs.writeFileSync('src-server/commands/index.ts', newLines.join('\n'));
