import fs from 'fs';

let router = fs.readFileSync('src-server/legacyRouter.ts', 'utf8');
let cmdIndex = fs.readFileSync('src-server/commands/index.ts', 'utf8');

const endpointsToDomains = {
  canteen: [
    'get_canteen_master_data',
    'update_canteen_override',
    'calculate_canteen_deductions',
    'get_canteen_transactions',
    'sync_canteen_punches',
    'bulk_save_canteen_punches'
  ],
  loans: [
    'get_loan_applications',
    'calculate_loan_eligibility',
    'check_active_loans',
    'create_loan_application',
    'override_and_approve_loan',
    'update_loan_status',
    'generate_amortisation_schedule',
    'get_loan_amortization',
    'update_emi_dynamic'
  ],
  banking: [
    'get_bank_excel_configs',
    'save_bank_excel_config',
    'delete_bank_excel_config',
    'reserve_bank_reference_numbers',
    'generate_bank_excel',
    'get_processed_salary_for_bank'
  ],
  financials: [
    'get_existing_advances',
    'post_advance_transactions',
    'get_cash_transactions',
    'add_cash_payment',
    'reverse_cash_payment',
    'get_cash_payment_history',
    'calculate_bulk_advance',
    'get_advance_eligible_amount',
    'commit_bulk_advance'
  ],
  statutory: [
    'get_statutory_settings',
    'list_statutory_settings',
    'save_statutory_settings',
    'delete_statutory_setting',
    'calculate_ptax',
    'get_gratuity_ledger',
    'sync_salary_slabs_to_p'
  ]
};

for (const [domainName, cases] of Object.entries(endpointsToDomains)) {
  let fileContent = `import { CommandHandler } from './types.js';\n`;
  let addedExports = [];

  for (const caseName of cases) {
    const match = router.match(new RegExp(`case '${caseName}':[\\s\\S]*?break;`));
    if (match) {
      let block = match[0];
      
      const paramName = caseName.split('_').map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');
      
      let fnBody = block.replace(new RegExp(`case '${caseName}':\\s*\\{?`), '');
      fnBody = fnBody.replace(/break;$/, '');
      if (fnBody.trim().endsWith('}')) {
          fnBody = fnBody.trim().slice(0, -1);
      }
      
      const isAsync = fnBody.includes('await ') ? 'async ' : '';
      const newFn = `\nexport const ${paramName}: CommandHandler = ${isAsync}(ctx, args) => {\n  const { primaryDb, statutoryDb, res, req } = ctx;\n  ${fnBody}\n};\n`;
      
      fileContent += newFn;
      
      router = router.replace(block, `// Extracted ${caseName} to COMMAND_MAP`);
      addedExports.push({ key: caseName, fn: paramName });
    }
  }

  // write newly created domain module file
  if (addedExports.length > 0) {
    fs.writeFileSync(`src-server/commands/${domainName}.ts`, fileContent);
    // add import to index
    cmdIndex = `import * as ${domainName} from './${domainName}.js';\n` + cmdIndex;
    
    // Check if COMMAND_MAP has a space
    let indexImportsMatch = cmdIndex.match(/export const COMMAND_MAP[^;]*};/m);
    if (indexImportsMatch) {
      let mapBlock = indexImportsMatch[0];
      let newMapEntries = addedExports.map(e => `  '${e.key}': ${domainName}.${e.fn},`).join('\n');
      
      // we insert right before closing bracket of COMMAND_MAP
      let newMapBlock = mapBlock.replace(/(};)/, `${newMapEntries}\n};`);
      cmdIndex = cmdIndex.replace(mapBlock, newMapBlock);
    }
  }
}

fs.writeFileSync('src-server/commands/index.ts', cmdIndex);
fs.writeFileSync('src-server/legacyRouter_backup2.ts', router);
fs.writeFileSync('src-server/legacyRouter.ts', router);

console.log("Modular extraction to multiple commands completed!");
