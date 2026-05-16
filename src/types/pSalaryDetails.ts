export interface PSalaryDetailsDTO {
  id?: number;
  employee_id: number;
  effective_from: string;
  statutory_working_day_type: string;
  statutory_wage_type: string;
  statutory_base_rate: number;
  salary_head_json: string; // JSON string of Record<string, number> where head id -> value
  created_at?: string;
  modified_at?: string;
}

export interface PSalaryHeadConfigDTO {
  id: number;
  name: string;
  type: 'EARNING' | 'DEDUCTION';
  is_statutory: number;
  is_active: number;
}
