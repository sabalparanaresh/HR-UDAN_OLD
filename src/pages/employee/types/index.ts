import { z } from 'zod';

const employeeSchema = z.object({
  // General Info
  emp_code: z.string().min(1, "Employee Code is required"),
  biometric_id: z.string().optional(),
  first_name: z.string().min(1, "First Name is required"),
  middle_name: z.string().optional(),
  last_name: z.string().optional(),
  full_name_aadhar: z.string().min(1, "Full Name as per Aadhar is required"),
  father_husband_guardian_name: z.string().min(1, "Father / Husband / Guardian Name is required"),
  gender: z.enum(["Male", "Female", "Other"]),
  marital_status: z.enum(["Unmarried", "Married", "Divorced", "Widow/Widower"]),
  dob: z.string().min(1, "Birth Date is required"),
  religion: z.string().optional(),
  blood_group: z.string().optional(),
  qualification: z.string().optional(),
  is_differently_abled: z.boolean().optional(),
  disability_type: z.array(z.string()).optional(),
  referenced_by: z.string().optional(),

  // Contact Info
  mobile: z.string().regex(/^\d{10}$/, "Mobile number must be exactly 10 digits").optional().or(z.literal('')),
  mobile2: z.string().regex(/^\d{10}$/, "Mobile number must be exactly 10 digits").optional().or(z.literal('')),
  email: z.string().email("Invalid email").optional().or(z.literal('')),
  cug_mobile: z.string().optional(),
  
  current_address: z.string().optional(),
  current_pincode: z.string().optional(),
  current_post_office: z.string().optional(),
  current_district: z.string().optional(),
  current_state: z.string().optional(),
  
  is_perm_same_as_current: z.boolean().optional(),
  
  perm_address: z.string().min(1, "Address is required"),
  perm_pincode: z.string().optional(),
  perm_post_office: z.string().optional(),
  perm_district: z.string().optional(), // Using this for District as per existing code
  perm_state: z.string().optional(),
  
  // Organisational Info
  group_id: z.string().optional(),
  department_id: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Designation is required"),
  designation_id: z.string().optional(),
  employment_type: z.string().optional(),
  employment_type_id: z.string().optional(),
  location_id: z.string().optional(),
  class_id: z.string().optional(),
  category_id: z.string().optional(),
  division_id: z.string().optional(),
  shift_id: z.string().optional(),

  // Documents & IDs
  aadhar_no: z.string().min(1, "Aadhar Number is required"),
  pan_no: z.string().optional(),
  driving_licence: z.string().optional(),
  passport_no: z.string().optional(),
  voter_id: z.string().optional(),
  uan_no: z.string().optional(),
  pf_number: z.string().optional(),
  pf_joining_date: z.string().optional(),
  pf_exit_date: z.string().optional(),
  pf_exit_reason: z.string().optional(),
  eps_exempt: z.boolean().optional(),
  gratuity_eligible_date: z.string().optional(),
  is_fte_contract: z.boolean().optional(),
  esi_ip_number: z.string().optional(),
  esi_joining_date: z.string().optional(),
  pf_history: z.array(z.object({
    pf_number: z.string(),
    pf_joining_date: z.string(),
    pf_exit_date: z.string().optional(),
    pf_exit_reason: z.string().optional()
  })).optional(),
  esi_history: z.array(z.object({
    esi_ip_number: z.string(),
    esi_joining_date: z.string()
  })).optional(),
  voluntary_pf_applicable: z.boolean().optional(),
  voluntary_pf_type: z.enum(["Percentage", "Amount"]).optional(),
  voluntary_pf_value: z.number().optional().nullable().or(z.literal(0)),

  // Payment Details
  payment_mode: z.enum(["Bank Transfer", "Cash", "Cheque"]).optional(),
  ifsc_code: z.string().optional(),
  bank_name: z.string().optional(),
  account_no: z.string().optional(),
  as_per_bank_name: z.string().optional(),
  bank_effective_date: z.string().optional(),
  bank_history: z.array(z.object({
    ifsc_code: z.string(),
    bank_name: z.string(),
    account_no: z.string(),
    as_per_bank_name: z.string(),
    bank_effective_date: z.string()
  })).optional(),

  // Employment Status
  employee_status: z.string().optional(),
  employee_status_id: z.string().optional(),
  photo_path: z.string().optional(),
  joining_date: z.string().min(1, "Joining Date is required"),
  book_joining_date: z.string().optional(),
  leaving_date: z.string().optional(),

  // Assignment
  reporting_employee_id: z.string().optional(),
  parent_employee_id: z.string().optional(),

  // Wages & Weekly Off
  wage_type: z.string().optional(),
  wage_amount: z.number().optional().nullable().or(z.literal(0)),
  wage_effective_from: z.string().optional(),
  working_day_type_id: z.string().optional(),
  weekly_off: z.string().optional(),
  weekly_off_effective_date: z.string().optional(),
  salary_process_sequence: z.number().optional().nullable().or(z.literal(0)),
  basic_salary: z.number().optional().nullable().or(z.literal(0)),
  hra: z.number().optional().nullable().or(z.literal(0)),
  conveyance: z.number().optional().nullable().or(z.literal(0)),
  special_allowance: z.number().optional().nullable().or(z.literal(0)),

  // Vigilance
  is_pf_covered: z.boolean().optional(),
  is_esi_covered: z.boolean().optional(),
  blacklist_status: z.boolean().optional(),
  blacklist_remarks: z.string().optional(),
  blacklist_effective_date: z.string().optional(),
  blacklist_authorizer_id: z.number().optional().nullable(),
  blacklist_authorizer_name: z.string().optional(),

  // Pakka Module Specific
  slab_id: z.string().optional(),
  // wage_amount is already defined above, but we keep it here for clarity if needed
  // however, Zod doesn't allow duplicate keys. We'll remove statutory_rate.
  
  hasChildren: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (!data.parent_employee_id && data.hasChildren) {
    if (data.wage_type !== 'Monthly') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Root employees must have 'Monthly' wage type",
        path: ['wage_type'],
      });
    }
    if (data.salary_process_sequence !== 99) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Root employees must have Salary Process Sequence set to 99",
        path: ['salary_process_sequence'],
      });
    }
  }
});

type EmployeeData = z.infer<typeof employeeSchema>;

interface SelectOption {
  value: string;
  label: string;
}

const processEmployeeList = (emps: any[]) => {
  const processedEmps = (Array.isArray(emps) ? emps : []).map((e: any) => ({
    ...e,
    name: e.name || [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') || 'N/A'
  }));
  return processedEmps;
};

interface SlabComponent {
  id?: number;
  salary_head_id: number;
  calculation_type: 'FIXED' | 'PERCENT_CTC' | 'PERCENT_HEAD' | 'RESIDUAL';
  parent_head_id?: number;
  value: number;
}

interface SalarySlab {
  id: number;
  name: string;
  slab_name?: string;
  components: string | SlabComponent[];
}

interface SalaryHead {
  id: number;
  name: string;
}

export type { EmployeeData, SelectOption, SlabComponent, SalarySlab, SalaryHead };
export { employeeSchema };
