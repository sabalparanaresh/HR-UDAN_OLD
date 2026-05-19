import { ReportContext, ReportResult } from '../../../../types';
import { AadharConsentData } from './types';

export const resolveAadharConsent = async (context: ReportContext): Promise<ReportResult> => {
  // Placeholder for real DB or API call using context.filters
  // In a real implementation this would call invoke('get_aadhar_consent_data', { filters: context.filters, module_type: context.moduleType })
  
  const mockData: AadharConsentData = {
    employee_name: "MD SHAKIL ANSARI",
    employee_code: "10097",
    department_name: "GREY BAT-CBR-MERC-CPB",
    designation_name: "INCHARGE",
    company_name: "DURGA PROCESSORS PRIVATE LIMITED.",
    current_date: "16-05-2026",
    ref_number: "DURGA/112023/10097",
  };

  return {
    data: [mockData],
    columns: [], // Not used for forms
    metadata: {
      template: 'form',
      company_name: mockData.company_name
    }
  };
};
