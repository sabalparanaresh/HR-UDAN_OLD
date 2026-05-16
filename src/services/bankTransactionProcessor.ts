import { invoke } from '@tauri-apps/api/tauri';
import { BankAccountConfig } from '../hooks/useBankAccountConfig';
import { resolveTemplateVariable } from './templateVariableResolver';

export interface BankExcelGenerationParams {
  bankConfig: BankAccountConfig;
  exportData: any[];
  excelConfigColumns: any[];
  paymentDate: string;
  currentMode: string;
}

export async function processBankTransaction({
  bankConfig,
  exportData,
  excelConfigColumns,
  paymentDate,
  currentMode
}: BankExcelGenerationParams) {
  
  if (!bankConfig.bank) throw new Error("Configured bank name is missing.");

  // Reserve sequence numbers from backend
  const startNo = bankConfig.reference_start_no ? parseInt(bankConfig.reference_start_no, 10) : 1;
  const count = exportData.length;
  
  const assignedReferences: string[] = await invoke('reserve_bank_reference_numbers', {
    bankName: bankConfig.bank,
    count: count,
    startNo: startNo,
    moduleType: currentMode
  });

  const mappedData = exportData.map((record, index) => {
    const row: Record<string, any> = {};
    const empBankName = record.bank_name || '';
    const refNo = assignedReferences[index];

    excelConfigColumns.forEach(col => {
      let value: any = '';
      if (col.nature === 'Incremental') {
        value = index + 1;
      } else if (col.nature === 'Static') {
        value = col.staticValue || '';
      } else if (col.nature === 'Dynamic') {
        if (col.dataSource === 'Bank A/c Settings') {
          value = resolveTemplateVariable({
            colField: col.field || '',
            bankConfig,
            employeeBankName: empBankName,
            referenceNumberStr: refNo
          });
        } else {
          value = record[col.field || ''] || '';
        }
      }
      
      // Formatting
      if (col.dataType === 'Amount') {
        value = Number(value || 0).toFixed(2);
      } else if (col.dataType === 'Date' && value) {
        try {
          const dateStr = String(value);
          const [year, month, day] = dateStr.split('T')[0].split('-');
          if (col.format === 'dd-MM-yyyy') value = `${day}-${month}-${year}`;
          else if (col.format === 'MM-dd-yyyy') value = `${month}-${day}-${year}`;
          else if (col.format === 'dd/MM/yyyy') value = `${day}/${month}/${year}`;
          else value = `${day}-${month}-${year}`; // default fallback
        } catch (e) { /* ignore */ }
      }
      
      row[col.headerName] = value;
    });
    return row;
  });

  // Now hand off to actual generation
  await invoke('generate_bank_excel', {
    bank_name: bankConfig.bank,
    data: mappedData,
    payment_date: paymentDate,
    module_type: currentMode
  });

  return mappedData.length;
}
