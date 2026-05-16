import fs from 'fs';

let router = fs.readFileSync('src-server/legacyRouter.ts', 'utf8');
let cmdIndex = fs.readFileSync('src-server/commands/index.ts', 'utf8');

const endpointsToExistingDomains = {
  attendance: [
    'get_attendance_logs',
    'save_biometric_logs',
    'bulk_generate_attendance',
    'update_punch',
    'update_shift',
    'bulk_upload_attendance_excel',
    'save_manual_attendance',
    'legacy_attendance_placeholder',
    'bulk_attendance_v2_legacy',
    'legacy_ghost_punches_placeholder'
  ],
  payroll: [
    'piece_rate_crud',
    'process_payroll',
    'get_final_payroll',
    'process_waterfall_distribution',
    'get_payroll_preview',
    'toggle_salary_lock',
    'bulk_salary_lock',
    'export_final_payroll',
    'lock_final_payroll'
  ],
  crud: [
    'save_transaction_entry',
    'get_earning_history',
    'bulk_upload_transactions',
    'bulk_insert_transactions',
    'save_arrear',
    'production_entry_crud'
  ],
  masterData: [
    'get_master_usage',
    'delete_org_unit',
    'get_last_sync_time',
    'get_department_settings',
    'save_department_settings',
    'get_department_rates',
    'save_department_rate',
    'delete_department_rate',
    'get_dept_settings',
    'get_dept_standard_rates',
    'get_last_sync_timestamp',
    'update_local_record'
  ],
  general: [
    'verify_identity',
    'reset_password_with_token',
    'get_connection_status'
  ],
  employee: [
    'get_employee_record',
    'get_next_employee_code',
    'check_min_wage',
    'get_asset_deposit_data',
    'save_asset',
    'save_deposit',
    'return_asset',
    'get_ff_clearance'
  ]
};

for (const [domainName, cases] of Object.entries(endpointsToExistingDomains)) {
  let domainFilePath = `src-server/commands/${domainName}.ts`;
  let fileContent = fs.readFileSync(domainFilePath, 'utf8');
  let addedExports = [];

  for (const caseName of cases) {
    const match = router.match(new RegExp(`case '${caseName}':[\\s\\S]*?break;`));
    if (match) {
      let block = match[0];
      const paramName = caseName.split('_').map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');
      
      let fnBody = block.replace(new RegExp(`case '${caseName}':\\s*\\{?`), '');
      fnBody = fnBody.replace(/break;$/, '');
      if (fnBody.trim().endsWith('}')) { fnBody = fnBody.trim().slice(0, -1); }
      
      const isAsync = fnBody.includes('await ') ? 'async ' : '';
      const newFn = `\nexport const ${paramName}: CommandHandler = ${isAsync}(ctx, args) => {\n  const { primaryDb, statutoryDb, res, req } = ctx;\n  ${fnBody}\n};\n`;
      
      fileContent += newFn;
      router = router.replace(block, `// Extracted ${caseName} to COMMAND_MAP`);
      addedExports.push({ key: caseName, fn: paramName });
    }
  }

  if (addedExports.length > 0) {
    fs.writeFileSync(domainFilePath, fileContent);
    let indexImportsMatch = cmdIndex.match(/export const COMMAND_MAP[^;]*};/m);
    if (indexImportsMatch) {
      let mapBlock = indexImportsMatch[0];
      let newMapEntries = addedExports.map(e => `  '${e.key}': ${domainName}.${e.fn},`).join('\n');
      let newMapBlock = mapBlock.replace(/(};)/, `${newMapEntries}\n};\n`);
      cmdIndex = cmdIndex.replace(mapBlock, newMapBlock);
    }
  }
}

// Any totally weird ones left
const remainingDomains = {
  excel: [
    'distribute_report',
    'generate_enterprise_excel',
    'generate_salary_register_excel'
  ],
  pincode: [
    'get_pincode_settings',
    'save_pincode_settings',
    'get_pincode_records',
    'fetch_pincode_details'
  ],
  rokda: [
    'save_mis_voucher',
    'get_next_rokda_token'
  ]
};

for (const [domainName, cases] of Object.entries(remainingDomains)) {
  let fileContent = `import { CommandHandler } from './types.js';\n`;
  let addedExports = [];

  for (const caseName of cases) {
    const match = router.match(new RegExp(`case '${caseName}':[\\s\\S]*?break;`));
    if (match) {
      let block = match[0];
      const paramName = caseName.split('_').map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');
      
      let fnBody = block.replace(new RegExp(`case '${caseName}':\\s*\\{?`), '');
      fnBody = fnBody.replace(/break;$/, '');
      if (fnBody.trim().endsWith('}')) { fnBody = fnBody.trim().slice(0, -1); }
      
      const isAsync = fnBody.includes('await ') ? 'async ' : '';
      const newFn = `\nexport const ${paramName}: CommandHandler = ${isAsync}(ctx, args) => {\n  const { primaryDb, statutoryDb, res, req } = ctx;\n  ${fnBody}\n};\n`;
      
      fileContent += newFn;
      router = router.replace(block, `// Extracted ${caseName} to COMMAND_MAP`);
      addedExports.push({ key: caseName, fn: paramName });
    }
  }

  if (addedExports.length > 0) {
    fs.writeFileSync(`src-server/commands/${domainName}.ts`, fileContent);
    cmdIndex = `import * as ${domainName} from './${domainName}.js';\n` + cmdIndex;
    let indexImportsMatch = cmdIndex.match(/export const COMMAND_MAP[^;]*};/m);
    if (indexImportsMatch) {
      let mapBlock = indexImportsMatch[0];
      let newMapEntries = addedExports.map(e => `  '${e.key}': ${domainName}.${e.fn},`).join('\n');
      let newMapBlock = mapBlock.replace(/(};)/, `${newMapEntries}\n};\n`);
      cmdIndex = cmdIndex.replace(mapBlock, newMapBlock);
    }
  }
}

fs.writeFileSync('src-server/commands/index.ts', cmdIndex);
fs.writeFileSync('src-server/legacyRouter.ts', router);

console.log("Remaining modules extracted!");
