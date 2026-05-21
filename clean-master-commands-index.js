import fs from 'fs';

let content = fs.readFileSync('src-server/commands/index.ts', 'utf8');

const toRemove = [
  "'get_dept_settings'",
  "'get_dept_standard_rates'",
  "'get_pincode_records'",
  "'bulk_bank_import'",
  "'bulk_bank_master_upsert'",
  "'bulk_pincode_upsert'",
  "'get_ogd_records'",
  "'get_ogd_bank_list'",
  "'get_ogd_bank_branches'",
  "'bulk_upload_departments'",
  "'bulk_upload_standard_rates'",
  "'clear_org_data'",
  "'save_rokda_voucher'"
];

const lines = content.split('\n');
const newLines = lines.filter(line => {
  for (const str of toRemove) {
    if (line.includes(str)) return false;
  }
  return true;
});

fs.writeFileSync('src-server/commands/index.ts', newLines.join('\n'));
