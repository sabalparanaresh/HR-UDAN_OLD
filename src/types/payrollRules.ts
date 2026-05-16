export type KSalaryCalculationSource = 'EMPLOYEE_MASTER' | 'DAILY_MIS';

export interface CompanyPayrollRules {
  id?: number;
  k_salary_calculation_source: KSalaryCalculationSource;
  updated_at?: string;
  created_at?: string;
}
