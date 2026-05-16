/**
 * Service to resolve template variables for Excel Sheet generation
 */
import { BankAccountConfig } from '../hooks/useBankAccountConfig';

export interface ResolveVariablesParams {
  colField: string;
  bankConfig: BankAccountConfig | null;
  employeeBankName: string | null;
  referenceNumberStr: string | null;
}

export function resolveTemplateVariable({ colField, bankConfig, employeeBankName, referenceNumberStr }: ResolveVariablesParams): string {
  if (!bankConfig) return '';

  switch (colField) {
    case 'CMS_CLIENT_CODE':
      return bankConfig.cms_client_code || '';
    case 'CMS_PRODUCT_CODE':
      return bankConfig.cms_product_code || '';
    case 'ACCOUNT_NO':
      return bankConfig.account_no || '';
    case 'IFSC_CODE':
      return bankConfig.ifsc_code || '';
    case 'PAYMENT_TYPE_IDENTIFIER':
      // Compare Employee Bank Name vs Company Bank Name
      const isSameBank = employeeBankName && bankConfig.bank && employeeBankName.trim().toLowerCase() === bankConfig.bank.trim().toLowerCase();
      return isSameBank 
        ? (bankConfig.payment_type_identifier_same_bank || '')
        : (bankConfig.payment_type_identifier_other_bank || '');
    case 'REFERENCE_START_NO':
      return referenceNumberStr || bankConfig.reference_start_no || '';
    default:
      return '';
  }
}
