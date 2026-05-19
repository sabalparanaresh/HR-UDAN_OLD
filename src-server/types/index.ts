/**
 * Base Database Interfaces (Snake Case)
 */

export interface DbEmployee {
  id?: number;
  emp_code: string;
  biometric_id?: string;
  name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  full_name_aadhar?: string;
  father_husband_guardian_name?: string;
  gender?: string;
  dob?: string;
  marital_status?: string;
  religion?: string;
  blood_group?: string;
  qualification?: string;
  is_differently_abled?: number;
  disability_type?: string;
  referenced_by?: string;
  mobile?: string;
  mobile2?: string;
  email?: string;
  cug_mobile?: string;
  current_address?: string;
  current_pincode?: string;
  current_post_office?: string;
  current_district?: string;
  current_state?: string;
  perm_address?: string;
  perm_pincode?: string;
  perm_post_office?: string;
  perm_district?: string;
  perm_state?: string;
  is_perm_same_as_current?: number;
  photo_url?: string;
  photo_path?: string;
  signature_url?: string;
  wage_type?: string;
  wage_amount?: number;
  status?: number;
  is_pf_covered?: number;
  is_esi_covered?: number;
  blacklist_status?: number;
  blacklist_remarks?: string;
  blacklist_effective_date?: string;
  blacklist_authorizer_id?: number;
  blacklist_authorizer_name?: string;
  slab_id?: number;
  department_id?: number;
  location_id?: number;
  category_id?: number;
  division_id?: number;
  group_id?: number;
  class_id?: number;
  designation?: string;
  designation_id?: number;
  grade?: string;
  grade_id?: number;
  joining_date?: string;
  employment_type?: string;
  employment_type_id?: number;
  shift_id?: number;
  aadhar_no?: string;
  pan_no?: string;
  passport_no?: string;
  uan_no?: string;
  working_day_type_id?: string;
  basic_salary?: number;
  hra?: number;
  conveyance?: number;
  special_allowance?: number;
  bank_name?: string;
  account_no?: string;
  ifsc_code?: string;
  driving_licence?: string;
  voter_id?: string;
  esi_ip_number?: string;
  esi_joining_date?: string;
  pf_number?: string;
  pf_joining_date?: string;
  pf_exit_date?: string;
  pf_exit_reason?: string;
  pf_history?: string;
  esi_history?: string;
  voluntary_pf_applicable?: number;
  voluntary_pf_type?: string;
  voluntary_pf_value?: number;
  payment_mode?: string;
  as_per_bank_name?: string;
  bank_effective_date?: string;
  bank_history?: string;
  employee_status?: string;
  employee_status_id?: number;
  book_joining_date?: string;
  leaving_date?: string;
  reporting_employee_id?: number;
  wage_effective_from?: string;
  weekly_off?: string;
  weekly_off_effective_date?: string;
  parent_employee_id?: number;
  salary_process_sequence?: number;
  statutory_rate?: number;
  statutory_wage_type?: string;
  statutory_wage_amount?: number;
  created_at?: string;
}

export interface DbSalaryHead {
  id?: number;
  name: string;
  type?: string;
  is_deduction?: number;
  system_head?: string;
  base_on?: string;
  is_part_of_ctc?: number;
  status?: number;
  created_at?: string;
  applicability?: string;
  allocation_type?: string;
}

export interface DbAttendancePunch {
  id?: number;
  attendance_log_id: number;
  punch_time: string;
  punch_type: string;
  device_id?: string;
}

export interface DbAttendanceLog {
  id?: number;
  emp_id: number;
  emp_code?: string;
  emp_name?: string;
  department_name?: string;
  designation_name?: string;
  shift_name?: string;
  shift_id?: number;
  machine_name?: string;
  date: string;
  punch_in?: string;
  punch_out?: string;
  total_time_mins?: number;
  worked_mins?: number;
  outside_mins?: number;
  attendance_value?: number;
  status?: string;
  is_missed_punch?: number;
  blacklist_status?: number;
  punches?: string;
}

export interface DbPayrollRecord {
  id?: number;
  emp_id: number;
  month: string;
  type_name: string;
  actual_attendance?: number;
  statutory_attendance?: number;
  actual_earning?: number;
  pf?: number;
  esi?: number;
  loan_emi?: number;
  canteen_deduction?: number;
  net_payable?: number;
  statutory_gross?: number;
  adjusted_diff?: number;
  status?: string;
  approved_by?: number;
  locked_at?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Domain Interfaces (Camel Case)
 */

export interface Employee {
  id?: number;
  empCode: string;
  biometricId?: string;
  name?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullNameAadhar?: string;
  fatherHusbandGuardianName?: string;
  gender?: string;
  dob?: string;
  maritalStatus?: string;
  religion?: string;
  bloodGroup?: string;
  qualification?: string;
  isDifferentlyAbled?: boolean;
  disabilityType?: string[];
  referencedBy?: string;
  mobile?: string;
  mobile2?: string;
  email?: string;
  cugMobile?: string;
  currentAddress?: string;
  currentPincode?: string;
  currentPostOffice?: string;
  currentDistrict?: string;
  currentState?: string;
  permAddress?: string;
  permPincode?: string;
  permPostOffice?: string;
  permDistrict?: string;
  permState?: string;
  isPermSameAsCurrent?: boolean;
  photoUrl?: string;
  photoPath?: string;
  signatureUrl?: string;
  wageType?: string;
  wageAmount?: number;
  status?: number;
  isPfCovered?: number;
  isEsiCovered?: number;
  blacklistStatus?: number;
  blacklistRemarks?: string;
  blacklistEffectiveDate?: string;
  blacklistAuthorizerId?: number;
  blacklistAuthorizerName?: string;
  slabId?: number;
  departmentId?: number;
  locationId?: number;
  categoryId?: number;
  divisionId?: number;
  groupId?: number;
  classId?: number;
  designation?: string;
  designationId?: number;
  grade?: string;
  gradeId?: number;
  joiningDate?: string;
  employmentType?: string;
  employmentTypeId?: number;
  shiftId?: number;
  aadharNo?: string;
  panNo?: string;
  passportNo?: string;
  uanNo?: string;
  workingDayTypeId?: string;
  basicSalary?: number;
  hra?: number;
  conveyance?: number;
  specialAllowance?: number;
  bankName?: string;
  accountNo?: string;
  ifscCode?: string;
  drivingLicence?: string;
  voterId?: string;
  esiIpNumber?: string;
  esiJoiningDate?: string;
  pfNumber?: string;
  pfJoiningDate?: string;
  pfExitDate?: string;
  pfExitReason?: string;
  pfHistory?: string;
  esiHistory?: string;
  voluntaryPfApplicable?: boolean;
  voluntaryPfType?: string;
  voluntaryPfValue?: number;
  paymentMode?: string;
  asPerBankName?: string;
  bankEffectiveDate?: string;
  bankHistory?: string;
  employeeStatus?: string;
  employeeStatusId?: number;
  bookJoiningDate?: string;
  leavingDate?: string;
  reportingEmployeeId?: number;
  wageEffectiveFrom?: string;
  weeklyOff?: string;
  weeklyOffEffectiveDate?: string;
  parentEmployeeId?: number;
  salaryProcessSequence?: number;
  statutoryRate?: number;
  statutoryWageType?: string;
  statutoryWageAmount?: number;
  createdAt?: string;
}

export interface SalaryHead {
  id?: number;
  name: string;
  type?: string;
  isDeduction?: boolean;
  systemHead?: string;
  baseOn?: string;
  isPartOfCtc?: boolean;
  status?: number;
  createdAt?: string;
  applicability?: string;
  allocationType?: string;
}

export interface AttendanceLog {
  id?: number;
  empId: number;
  empCode?: string;
  empName?: string;
  departmentName?: string;
  designationName?: string;
  shiftName?: string;
  shiftId?: number;
  machineName?: string;
  date: string;
  punchIn?: string;
  punchOut?: string;
  totalTimeMins?: number;
  workedMins?: number;
  outsideMins?: number;
  attendanceValue?: number;
  status?: string;
  isMissedPunch?: boolean;
  blacklistStatus?: number;
  punches?: string;
}

export interface PayrollRecord {
  id?: number;
  empId: number;
  month: string;
  typeName: string;
  actualAttendance?: number;
  statutoryAttendance?: number;
  actualEarning?: number;
  pf?: number;
  esi?: number;
  loanEmi?: number;
  canteenDeduction?: number;
  netPayable?: number;
  statutoryGross?: number;
  adjustedDiff?: number;
  status?: string;
  approvedBy?: number;
  lockedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
