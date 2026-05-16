import { RbacCache } from '../ui';

export interface User {
  id: number;
  name: string;
  username: string;
  password?: string;
  role: string;
  rbac_cache?: RbacCache;
  login_attempts: number;
  is_locked: boolean;
  available_modules?: string[];
  connection_status?: string;
  mobile_number?: string;
  birth_date?: string;
  secret_question_1?: string;
  secret_answer_1?: string;
  secret_question_2?: string;
  secret_answer_2?: string;
}

export interface Employee {
  id?: number;
  emp_code: string;
  name?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  parent_employee_id?: number | string;
  parentEmployeeId?: number | string;
  full_name_aadhar: string;
  father_husband_guardian_name: string;
  gender: string;
  marital_status: string;
  dob: string;
  religion?: string;
  blood_group?: string;
  qualification?: string;
  is_differently_abled?: boolean;
  disability_type?: string[];
  referenced_by?: string;
  mobile: string;
  mobile2?: string;
  email?: string;
  cug_mobile?: string;
  current_address?: string;
  current_pincode?: string;
  current_district?: string;
  current_state?: string;
  is_perm_same_as_current?: boolean;
  perm_address?: string;
  perm_pincode?: string;
  perm_district?: string;
  perm_state?: string;
  group_id?: string;
  department_id?: string;
  designation?: string;
  grade?: string;
  employment_type?: string;
  location_id?: string;
  class_id?: string;
  category_id?: string;
  division_id?: string;
  shift_id?: string;
  aadhar_no: string;
  pan_no?: string;
  driving_licence?: string;
  passport_no?: string;
  voter_id?: string;
  uan_no?: string;
  pf_number?: string;
  esi_ip_number?: string;
  voluntary_pf_applicable?: boolean;
  payment_mode?: string;
  ifsc_code?: string;
  bank_name?: string;
  account_no?: string;
  as_per_bank_name?: string;
  bank_effective_date?: string;
  employee_status?: string;
  photo_url?: string;
  photo_path?: string;
  signature_url?: string;
  blacklist_status?: boolean;
  blacklist_remarks?: string;
  blacklist_effective_date?: string;
  blacklist_authorizer_id?: number;
  blacklist_authorizer_name?: string;
  wage_type?: string;
  wage_amount?: number;
  wage_effective_from?: string;
  joining_date?: string;
  statutory_wage_amount?: number;
}

export interface Wage_Attendance {
  emp_id: number;
  name: string;
  actual_attendance: number;
  fixed_salary: number;
}

export interface Wage_Daily {
  emp_id: number;
  name: string;
  days_worked: number;
  daily_rate: number;
}

export interface Wage_Quantity {
  emp_id: number;
  name: string;
  units_produced: number;
  rate_per_unit: number;
}

export interface SyncPreviewItem {
  emp_id: number;
  name: string;
  type: 'Attendance' | 'Daily' | 'Quantity';
  actual_attendance: number | string;
  statutory_attendance: number;
  actual_earning: number;
  pf: number;
  esi: number;
  diff: number;
}

export interface PayrollPreview {
  emp_id: number;
  emp_code: string;
  name: string;
  department_name: string;
  designation_name: string;
  type_name: string;
  actual_attendance: number;
  statutory_attendance: number;
  actual_earning: number;
  wage_type: string;
  wage_amount: number;
  working_day_config: string;
  divisor: number;
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  gross_payable: number;
  net_payable: number;
  pf: number;
  esi: number;
  loan_emi: number;
  canteen_deduction: number;
  diff: number;
  blacklist_status?: boolean;
  adjusted_leave: number;
  balance_leave: number;
  is_locked: boolean;
  status: 'Draft' | 'Committed' | 'Approved' | 'Locked';
  statutory_gross: number;
  adjusted_diff: number;
  source_of_truth?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  status: 'Active' | 'Inactive';
}

export interface Location {
  id: string;
  name: string;
  description?: string;
  status: 'Active' | 'Inactive';
  divisions?: Division[];
}

export interface Division {
  id: string;
  location_id: string;
  name: string;
  description?: string;
  status: 'Active' | 'Inactive';
}

export interface Department {
  id: string;
  group_id: string;
  name: string;
  description?: string;
  status: 'Active' | 'Inactive';
}

export interface DepartmentSettings {
  id: string;
  department_id: string;
  default_location_id?: string;
  default_division_id?: string;
  default_class_id?: string;
  default_category_id?: string;
  default_shift_id?: string;
  default_reporting_employee_id?: string;
}

export interface DepartmentStandardRate {
  id: string;
  department_id: string;
  designation_id: string;
  standard_rate: number;
  manpower: number;
  effective_date: string;
}
