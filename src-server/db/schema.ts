
export const SCHEMAS = [
  `CREATE TABLE IF NOT EXISTS statutory_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    config TEXT NOT NULL,
    effective_date TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    username TEXT UNIQUE,
    password_hash TEXT,
    password TEXT, -- Legacy compatibility
    role_id INTEGER,
    status TEXT DEFAULT 'ACTIVE',
    login_attempts INTEGER DEFAULT 0,
    is_locked INTEGER DEFAULT 0,
    lock_until DATETIME,
    mobile_number TEXT,
    birth_date DATE,
    secret_question_1 TEXT,
    secret_answer_1 TEXT,
    secret_question_2 TEXT,
    secret_answer_2 TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    description TEXT,
    is_system INTEGER DEFAULT 0,
    module_scope TEXT DEFAULT 'BOTH',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER,
    module TEXT,
    menu_group TEXT,
    page_key TEXT,
    can_view INTEGER DEFAULT 0,
    can_insert INTEGER DEFAULT 0,
    can_edit INTEGER DEFAULT 0,
    can_delete INTEGER DEFAULT 0,
    FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_role_permissions_lookup ON role_permissions(role_id, module, page_key)`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    token TEXT UNIQUE,
    expires_at DATETIME,
    is_used INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS salary_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_type TEXT CHECK(transaction_type IN ('EARNING', 'DEDUCTION')),
      date DATE DEFAULT CURRENT_DATE,
      salary_month_year TEXT NOT NULL, -- Format: MM-YYYY
      emp_id INTEGER NOT NULL,
      head_id INTEGER NOT NULL, -- References salary_heads
      amount REAL NOT NULL,
      reason TEXT,
      authorised_by INTEGER, -- References employees(id)
      remark TEXT,
      payment_mode TEXT,
      is_bulk_entry BOOLEAN DEFAULT 0,
      k_ref_id INTEGER,
      ref_process_date TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(emp_id) REFERENCES employees(id),
      FOREIGN KEY(head_id) REFERENCES salary_heads(id),
      FOREIGN KEY(authorised_by) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS company_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    company_name TEXT,
    alias TEXT,
    phone TEXT,
    address1 TEXT,
    address2 TEXT,
    state TEXT,
    city TEXT,
    pincode TEXT,
    email TEXT,
    date_of_incorporation TEXT,
    cin TEXT,
    lin TEXT,
    pf_reg_no TEXT,
    esi_reg_no TEXT,
    lwf_account_no TEXT,
    factory_license_no TEXT,
    factory_registration_no TEXT,
    udyog_aadhaar_reg_no TEXT,
    gst_no TEXT,
    tan TEXT,
    pan TEXT,
    activity TEXT,
    bank_accounts TEXT,
    emp_id_prefix TEXT,
    emp_id_suffix TEXT,
    emp_id_manual_entry INTEGER,
    emp_id_auto_increment INTEGER,
    emp_id_padding INTEGER,
    emp_id_start_number INTEGER,
    biometric_ip TEXT,
    biometric_port INTEGER,
    comm_key TEXT,
    connection_type TEXT,
    connection_string TEXT,
    db_name TEXT,
    db_user TEXT,
    db_password TEXT,
    procedure_name TEXT,
    device_entry_type TEXT,
    table_name TEXT,
    col_employee_code TEXT,
    col_punch_time TEXT,
    col_punch_type TEXT,
    auto_fetch INTEGER,
    fetch_interval INTEGER,
    signatory_name TEXT,
    designation TEXT,
    signatories TEXT,
    payroll_adjustment_head TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_code TEXT UNIQUE,
    biometric_id TEXT,
    name TEXT,
    first_name TEXT,
    middle_name TEXT,
    last_name TEXT,
    full_name_aadhar TEXT,
    father_husband_guardian_name TEXT,
    gender TEXT,
    dob TEXT,
    marital_status TEXT,
    religion TEXT,
    blood_group TEXT,
    qualification TEXT,
    is_differently_abled INTEGER DEFAULT 0,
    disability_type TEXT,
    referenced_by TEXT,
    mobile TEXT,
    mobile2 TEXT,
    email TEXT,
    cug_mobile TEXT,
    current_address TEXT,
    current_pincode TEXT,
    current_post_office TEXT,
    current_district TEXT,
    current_state TEXT,
    perm_address TEXT,
    perm_pincode TEXT,
    perm_post_office TEXT,
    perm_district TEXT,
    perm_state TEXT,
    is_perm_same_as_current INTEGER DEFAULT 0,
    photo_url TEXT,
    photo_path TEXT,
    signature_url TEXT,
    wage_type TEXT,
    wage_amount REAL,
    status INTEGER DEFAULT 1,
    is_pf_covered INTEGER DEFAULT 1,
    is_esi_covered INTEGER DEFAULT 1,
    blacklist_status INTEGER DEFAULT 0,
    blacklist_remarks TEXT,
    blacklist_effective_date TEXT,
    blacklist_authorizer_id INTEGER,
    blacklist_authorizer_name TEXT,
    slab_id INTEGER,
    department_id INTEGER,
    location_id INTEGER,
    category_id INTEGER,
    division_id INTEGER,
    group_id INTEGER,
    class_id INTEGER,
    designation TEXT,
    designation_id INTEGER,
    grade TEXT,
    grade_id INTEGER,
    joining_date TEXT,
    employment_type TEXT,
    employment_type_id INTEGER,
    shift_id INTEGER,
    aadhar_no TEXT,
    pan_no TEXT,
    passport_no TEXT,
    uan_no TEXT,
    working_day_type_id TEXT,
    basic_salary REAL,
    hra REAL,
    conveyance REAL,
    special_allowance REAL,
    bank_name TEXT,
    account_no TEXT,
    ifsc_code TEXT,
    driving_licence TEXT,
    voter_id TEXT,
    esi_ip_number TEXT,
    esi_joining_date TEXT,
    pf_number TEXT,
    pf_joining_date TEXT,
    pf_exit_date TEXT,
    pf_exit_reason TEXT,
    pf_history TEXT,
    esi_history TEXT,
    voluntary_pf_applicable INTEGER DEFAULT 0,
    voluntary_pf_type TEXT,
    voluntary_pf_value REAL,
    payment_mode TEXT,
    as_per_bank_name TEXT,
    bank_effective_date TEXT,
    bank_history TEXT,
    employee_status TEXT DEFAULT 'Active',
    employee_status_id INTEGER,
    book_joining_date TEXT,
    leaving_date TEXT,
    reporting_employee_id INTEGER,
    wage_effective_from TEXT,
    weekly_off TEXT,
    weekly_off_effective_date TEXT,
    parent_employee_id INTEGER,
    salary_process_sequence INTEGER,
    eps_exempt INTEGER DEFAULT 0,
    gratuity_eligible_date TEXT,
    is_fte_contract INTEGER DEFAULT 0,
    statutory_rate REAL,
    statutory_wage_type TEXT,
    statutory_wage_amount REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS waterfall_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,
    child_id INTEGER,
    month TEXT,
    pool_before REAL,
    deduction REAL,
    pool_after REAL,
    distribution_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    module_type TEXT,
    FOREIGN KEY(parent_id) REFERENCES employees(id),
    FOREIGN KEY(child_id) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS leave_balances (
    emp_id INTEGER,
    leave_config_id INTEGER,
    balance REAL,
    PRIMARY KEY (emp_id, leave_config_id)
  )`,
  `CREATE TABLE IF NOT EXISTS wage_attendance_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER,
    date TEXT,
    punch_in TEXT,
    punch_out TEXT,
    total_time_mins INTEGER DEFAULT 0,
    worked_mins INTEGER DEFAULT 0,
    outside_mins INTEGER DEFAULT 0,
    shift_id INTEGER,
    attendance_value REAL,
    manual_entry INTEGER DEFAULT 0,
    status TEXT,
    is_missed_punch INTEGER DEFAULT 0,
    leave_adjusted_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS statutory_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER,
    month TEXT,
    name TEXT,
    statutory_attendance REAL,
    gross_earning REAL,
    pf_contribution REAL,
    esi_contribution REAL,
    net_statutory REAL,
    wage_rate REAL,
    fixed_components REAL,
    sync_date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS employee_shift_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER,
    shift_id INTEGER,
    effective_from DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TRIGGER IF NOT EXISTS trg_employees_shift_insert
   AFTER INSERT ON employees
   WHEN NEW.shift_id IS NOT NULL
   BEGIN
     INSERT INTO employee_shift_history (emp_id, shift_id, effective_from)
     VALUES (NEW.id, NEW.shift_id, CURRENT_TIMESTAMP);
   END;`,
  `CREATE TRIGGER IF NOT EXISTS trg_employees_shift_update
   AFTER UPDATE OF shift_id ON employees
   WHEN OLD.shift_id IS NOT NEW.shift_id OR OLD.shift_id IS NULL
   BEGIN
     INSERT INTO employee_shift_history (emp_id, shift_id, effective_from)
     VALUES (NEW.id, NEW.shift_id, CURRENT_TIMESTAMP);
   END;`,
  `CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER,
    month TEXT,
    type_name TEXT,
    actual_attendance REAL,
    statutory_attendance REAL,
    actual_earning REAL,
    pf REAL,
    esi REAL,
    loan_emi REAL,
    canteen_deduction REAL,
    net_payable REAL,
    statutory_gross REAL,
    adjusted_diff REAL,
    status TEXT DEFAULT 'Committed',
    approved_by INTEGER,
    locked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(emp_id, month, type_name)
  )`,
  `CREATE TABLE IF NOT EXISTS banks (
    ifsc TEXT PRIMARY KEY,
    bank_name TEXT,
    branch TEXT,
    sync_status TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    group_id INTEGER, 
    name TEXT, 
    description TEXT, 
    status INTEGER, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, name)
  )`,
  `CREATE TABLE IF NOT EXISTS org_hierarchy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Location', 'Division')),
    parent_id INTEGER,
    description TEXT,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, type, parent_id),
    FOREIGN KEY (parent_id) REFERENCES org_hierarchy(id)
  )`,
  `CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT UNIQUE, 
    description TEXT, 
    status INTEGER, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS divisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    location_id INTEGER NOT NULL,
    name TEXT UNIQUE, 
    description TEXT, 
    status INTEGER, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(location_id) REFERENCES locations(id)
  )`,
  `CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    description TEXT,
    status INTEGER,
    group_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT UNIQUE, 
    description TEXT, 
    status INTEGER, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT UNIQUE, 
    description TEXT, 
    status INTEGER, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS designations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT UNIQUE, 
    skill_level TEXT, 
    job_description TEXT, 
    status INTEGER, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS machines (id TEXT PRIMARY KEY, name TEXT)`,
  `CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT, 
    description TEXT, 
    is24_hour_cycle INTEGER, 
    start_time TEXT DEFAULT '08:00',
    end_time TEXT DEFAULT '20:00',
    allocation_type TEXT DEFAULT 'KP',
    total_working_hours REAL DEFAULT 12.0,
    grace_period_mins INTEGER DEFAULT 15,
    rules TEXT, 
    status INTEGER, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS salary_heads (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT UNIQUE, 
    type TEXT, 
    is_deduction INTEGER DEFAULT 0,
    system_head TEXT,
    base_on TEXT,
    is_part_of_ctc INTEGER DEFAULT 1,
    status INTEGER DEFAULT 1, 
    applicability TEXT,
    allocation_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS salary_rate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER,
    type TEXT CHECK(type IN ('WAGE', 'STATUTORY')),
    previous_amount REAL,
    amount REAL,
    effective_date TEXT,
    revision_type TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(emp_id) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS final_payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_code TEXT,
    name TEXT,
    category TEXT,
    class TEXT,
    location TEXT,
    division TEXT,
    group_name TEXT,
    department TEXT,
    designation TEXT,
    reporting_name TEXT,
    month_year TEXT,
    working_day_type TEXT,
    wage_type TEXT,
    wage_rate REAL,
    working_days REAL,
    k_attendance REAL,
    k_gross_wage REAL,
    k_other_earnings TEXT, -- JSON
    k_gross_payable REAL,
    k_deductions TEXT, -- JSON
    k_net_payable REAL, -- Net Payable K
    statutory_rate REAL,
    head_wise_rates TEXT, -- JSON
    p_working_days REAL,
    p_attendance REAL,
    p_gross_wage REAL,
    p_ctc_heads TEXT, -- JSON
    p_other_earnings_kp TEXT, -- JSON
    p_gross_statutory_payable REAL,
    p_deductions TEXT, -- JSON
    net_payable_final REAL,
    payment_mode TEXT,
    ifsc TEXT,
    bank_name TEXT,
    account_no TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'DRAFT'
  )`,
  `CREATE TABLE IF NOT EXISTS loan_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, allowed_classes TEXT, allowed_categories TEXT, interest_rate REAL, interest_applicability TEXT, flexibility_in_policy INTEGER DEFAULT 0, status INTEGER, slabs TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS weekly_off (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT, effective_from TEXT, allocation_type TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS pincode_master (id INTEGER PRIMARY KEY AUTOINCREMENT, pincode TEXT, statename TEXT, districtname TEXT, officename TEXT, last_updated DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(pincode, officename))`,
  `CREATE TABLE IF NOT EXISTS department_settings (department_id INTEGER PRIMARY KEY, default_location_id INTEGER, default_division_id INTEGER, default_class_id INTEGER, default_category_id INTEGER, default_shift_id INTEGER, default_reporting_employee_id INTEGER)`,
  `CREATE TABLE IF NOT EXISTS standard_rates (id INTEGER PRIMARY KEY AUTOINCREMENT, department_id INTEGER, designation_id INTEGER, standard_rate REAL, manpower INTEGER, effective_date TEXT, FOREIGN KEY(designation_id) REFERENCES designations(id))`,
  `CREATE TABLE IF NOT EXISTS salary_slabs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, min_amount REAL, max_amount REAL, status INTEGER, components TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS working_day_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL, 
    mode TEXT NOT NULL DEFAULT 'FIXED',
    fixed_days REAL,
    formula TEXT,
    is_statutory_uniform INTEGER DEFAULT 0,
    allocation_type TEXT DEFAULT 'KP',
    status INTEGER DEFAULT 1, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    description TEXT,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS employment_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    description TEXT,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS employee_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    description TEXT,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS holidays (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, name TEXT, status INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS leave_configurations (id INTEGER PRIMARY KEY AUTOINCREMENT, leave_name TEXT, credit_type TEXT, leave_value REAL, multiplier REAL, min_attendance_threshold REAL, min_service_requirement_value REAL, min_service_requirement_unit TEXT, credit_trigger TEXT, adjustment_priority INTEGER, status INTEGER)`,
  `CREATE TABLE IF NOT EXISTS arrears (id INTEGER PRIMARY KEY AUTOINCREMENT, emp_id TEXT, source_month TEXT, target_month TEXT, arrear_amount REAL, remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS attendance_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, emp_id INTEGER, emp_code TEXT, emp_name TEXT, department_name TEXT, designation_name TEXT, shift_name TEXT, shift_id INTEGER, machine_name TEXT, date TEXT, punch_in TEXT, punch_out TEXT, total_time_mins INTEGER, worked_mins INTEGER, outside_mins INTEGER, attendance_value REAL, status TEXT, is_missed_punch INTEGER, blacklist_status INTEGER, punches TEXT)`,
  `CREATE TABLE IF NOT EXISTS loan_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, application_date TEXT, emp_id INTEGER, loan_type_id INTEGER, loan_amount REAL, no_of_emi INTEGER, emi_amount REAL, start_month_year TEXT, payment_mode TEXT, guarantor_id INTEGER, reason TEXT, remarks TEXT, status TEXT DEFAULT 'PENDING')`,
  `CREATE TABLE IF NOT EXISTS loan_amortisation (id INTEGER PRIMARY KEY AUTOINCREMENT, loan_app_id INTEGER, emi_no INTEGER, month_year TEXT, planned_amount REAL, actual_paid_amount REAL, status TEXT, payment_type TEXT, transaction_ref TEXT, remarks TEXT, authorised_by TEXT)`,
  `CREATE TABLE IF NOT EXISTS grievance_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    criticality TEXT,
    resolution_limit_days INTEGER,
    escalation_thresholds TEXT,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS grievances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    category_id INTEGER,
    description TEXT,
    is_anonymous INTEGER DEFAULT 0,
    expected_resolution_date TEXT,
    status TEXT DEFAULT 'OPEN',
    resolution_notes TEXT,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS rokda_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_date TEXT,
    department_id INTEGER,
    shift INTEGER,
    reporting_employee_id INTEGER,
    authorizer_id INTEGER,
    total_count INTEGER,
    total_amount REAL,
    status TEXT DEFAULT 'GENERATED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS rokda_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER,
    token_code TEXT,
    worker_name TEXT,
    designation TEXT,
    in_time TEXT,
    out_time TEXT,
    amount REAL,
    FOREIGN KEY(voucher_id) REFERENCES rokda_vouchers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS mis_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_date TEXT,
    shift INTEGER,
    running_machines REAL,
    reporting_employee_id INTEGER,
    department_id INTEGER,
    total_standard_amount REAL,
    total_worked_amount REAL,
    total_variance REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS mis_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER,
    emp_id INTEGER,
    token_code TEXT,
    worker_name TEXT,
    designation TEXT,
    master_designation TEXT,
    current_designation TEXT,
    standard_rate REAL,
    worked_rate REAL,
    variance REAL,
    FOREIGN KEY(voucher_id) REFERENCES mis_vouchers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS canteen_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_ip TEXT,
    device_port INTEGER,
    status TEXT DEFAULT 'Disconnected',
    connection_type TEXT,
    connection_string TEXT,
    db_name TEXT,
    db_user TEXT,
    db_password TEXT,
    procedure_name TEXT,
    device_entry_type TEXT,
    table_name TEXT,
    col_emp_code TEXT,
    col_punch_time TEXT,
    col_punch_type TEXT,
    auto_fetch INTEGER,
    fetch_interval INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS canteen_time_windows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    start_time TEXT,
    end_time TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS canteen_punches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER,
    punch_time TEXT,
    source TEXT,
    window_id INTEGER,
    is_valid INTEGER DEFAULT 1,
    FOREIGN KEY(emp_id) REFERENCES employees(id),
    FOREIGN KEY(window_id) REFERENCES canteen_time_windows(id)
  )`,
  `CREATE TABLE IF NOT EXISTS canteen_deductions_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER,
    month TEXT,
    total_deduction REAL,
    consumption_count INTEGER,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(emp_id) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS canteen_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name TEXT NOT NULL,
    benefit_type TEXT NOT NULL,
    discount_rate REAL DEFAULT 0,
    dish_rate REAL DEFAULT 0,
    effective_date TEXT,
    categories TEXT,
    classes TEXT,
    groups TEXT,
    departments TEXT,
    designations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS earnings_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER,
    head_id INTEGER,
    month TEXT,
    amount REAL,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(emp_id) REFERENCES employees(id),
    FOREIGN KEY(head_id) REFERENCES salary_heads(id)
  )`,
  `CREATE TABLE IF NOT EXISTS deductions_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER,
    head_id INTEGER,
    month TEXT,
    amount REAL,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(emp_id) REFERENCES employees(id),
    FOREIGN KEY(head_id) REFERENCES salary_heads(id)
  )`,
  `CREATE TABLE IF NOT EXISTS salary_locks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT,
    emp_id INTEGER,
    module_type TEXT,
    is_locked INTEGER DEFAULT 0,
    locked_by_id INTEGER,
    locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    snapshot_wage_rate REAL,
    snapshot_bank_acc TEXT,
    snapshot_ifsc TEXT,
    snapshot_config TEXT, -- Stores working day config at time of lock
    UNIQUE(month, emp_id, module_type),
    FOREIGN KEY(emp_id) REFERENCES employees(id),
    FOREIGN KEY(locked_by_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS payroll_lock (
    month_year TEXT PRIMARY KEY,
    status TEXT,
    input_hash TEXT,
    locked_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS employee_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER,
    item_description TEXT,
    serial_number TEXT,
    issue_date TEXT,
    value REAL,
    expected_return_date TEXT,
    status TEXT DEFAULT 'Issued',
    returned_date TEXT,
    FOREIGN KEY(emp_id) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS employee_deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER,
    description TEXT,
    amount REAL,
    payment_date TEXT,
    status TEXT DEFAULT 'Paid',
    FOREIGN KEY(emp_id) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS bank_excel_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_name TEXT,
    columns_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS bank_transfer_references (
    bank_name TEXT PRIMARY KEY,
    last_reference_number INTEGER NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS advance_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    emp_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_mode TEXT CHECK(payment_mode IN ('CASH', 'BANK')),
    wage_month TEXT NOT NULL, -- MM-YYYY
    status TEXT DEFAULT 'DRAFT',
    is_pushed_to_transfer BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(emp_id) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS bank_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    bank_name TEXT,
    account_no TEXT,
    ifsc_code TEXT,
    transfer_type TEXT DEFAULT 'SALARY', -- SALARY, ADVANCE, ARREAR
    status TEXT DEFAULT 'PENDING',
    batch_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(emp_id) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT,
    message TEXT,
    stack TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    action TEXT,
    entity TEXT,
    entity_id TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS employee_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    operation TEXT,
    payload TEXT,
    status TEXT DEFAULT 'PENDING',
    retries INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    operation TEXT,
    status TEXT,
    error TEXT,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data TEXT,
    new_data TEXT,
    changed_by TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS audit_amendment_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    reference_id INTEGER,
    amendment_reason TEXT,
    previous_value TEXT,
    new_value TEXT,
    user_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TRIGGER IF NOT EXISTS trg_audit_log_prevent_update
   BEFORE UPDATE ON audit_log
   BEGIN
     SELECT RAISE(ABORT, 'Updates to audit_log are strictly prohibited.');
   END;`,
  `CREATE TRIGGER IF NOT EXISTS trg_audit_log_prevent_delete
   BEFORE DELETE ON audit_log
   BEGIN
     SELECT RAISE(ABORT, 'Deletions from audit_log are strictly prohibited.');
   END;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_emp_code ON employees (emp_code)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_name ON shifts (name)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_slabs_name ON salary_slabs (name)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_atd_emp_date ON attendance_logs(emp_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id)`,
  `CREATE INDEX IF NOT EXISTS idx_employees_location ON employees(location_id)`,
  `CREATE INDEX IF NOT EXISTS idx_employees_division ON employees(division_id)`,
  `CREATE INDEX IF NOT EXISTS idx_employees_category ON employees(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_employees_designation ON employees(designation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_salary_transactions_emp ON salary_transactions(emp_id)`,
  `CREATE INDEX IF NOT EXISTS idx_salary_transactions_head_id ON salary_transactions(head_id)`,
  `CREATE INDEX IF NOT EXISTS idx_salary_transactions_month ON salary_transactions(salary_month_year)`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_logs_emp ON attendance_logs(emp_id)`,
  `CREATE INDEX IF NOT EXISTS idx_attendance_logs_date ON attendance_logs(date)`,
  `CREATE INDEX IF NOT EXISTS idx_payroll_emp_month ON payroll(emp_id, month)`,
  `CREATE INDEX IF NOT EXISTS idx_final_payroll_month ON final_payroll(month_year)`,
  `CREATE INDEX IF NOT EXISTS idx_final_payroll_emp_code ON final_payroll(emp_code)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_unique_pending ON sync_queue (entity_type, entity_id, operation) WHERE status = 'PENDING'`,
  `CREATE INDEX IF NOT EXISTS idx_employee_sync_queue_status ON employee_sync_queue(status)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id)`,
  `CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)`,
  `CREATE INDEX IF NOT EXISTS idx_standard_rates_dept_des ON standard_rates(department_id, designation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_wage_attendance_transactions_emp ON wage_attendance_transactions(emp_id)`,
  `CREATE INDEX IF NOT EXISTS idx_wage_attendance_transactions_date ON wage_attendance_transactions(date)`,
  `CREATE INDEX IF NOT EXISTS idx_leave_balances_emp ON leave_balances(emp_id)`,
  `CREATE INDEX IF NOT EXISTS idx_canteen_deductions_cache_emp_month ON canteen_deductions_cache(emp_id, month)`,
  `CREATE INDEX IF NOT EXISTS idx_salary_locks_month_emp ON salary_locks(month, emp_id, module_type)`,
  `CREATE TABLE IF NOT EXISTS gratuity_provisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER,
    month_year TEXT,
    base_salary_snapshot REAL,
    accrued_amount REAL,
    cumulative_provision REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(emp_id) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS earnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_date TEXT,
    salary_year INTEGER,
    salary_month INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS daily_mis_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    emp_id INTEGER NOT NULL,
    emp_code TEXT,
    name TEXT,
    master_designation TEXT,
    current_designation TEXT,
    standard_rate REAL,
    worked_rate REAL,
    variance REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, emp_id)
  )`
];

export const MIGRATIONS = [
  `ALTER TABLE shifts ADD COLUMN start_time TEXT DEFAULT '08:00'`,
  `ALTER TABLE shifts ADD COLUMN end_time TEXT DEFAULT '20:00'`,
  `ALTER TABLE shifts ADD COLUMN total_working_hours REAL DEFAULT 12.0`,
  `ALTER TABLE shifts ADD COLUMN grace_period_mins INTEGER DEFAULT 15`,
  `ALTER TABLE company_config ADD COLUMN signatories TEXT`,
  `ALTER TABLE company_config ADD COLUMN payroll_adjustment_head TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance_logs(emp_id, date)`,
  `ALTER TABLE attendance_logs ADD COLUMN applied_shift_id INTEGER`,
  `CREATE INDEX IF NOT EXISTS idx_earnings_salary_period ON earnings (salary_year, salary_month)`,
  `CREATE INDEX IF NOT EXISTS idx_earnings_date ON earnings (transaction_date)`,
  `ALTER TABLE salary_transactions ADD COLUMN k_ref_id INTEGER`,
  `CREATE TRIGGER IF NOT EXISTS trg_employees_insert AFTER INSERT ON employees
   BEGIN
     INSERT INTO sync_queue (entity_type, entity_id, operation)
     VALUES ('employees', NEW.id, 'INSERT');
   END;`,
  `CREATE TRIGGER IF NOT EXISTS trg_employees_update AFTER UPDATE ON employees
   BEGIN
     INSERT OR IGNORE INTO sync_queue (entity_type, entity_id, operation)
     VALUES ('employees', NEW.id, 'UPDATE');
   END;`,
  `CREATE TRIGGER IF NOT EXISTS trg_salary_tx_insert AFTER INSERT ON salary_transactions
   BEGIN
     INSERT INTO sync_queue (entity_type, entity_id, operation)
     VALUES ('salary_transactions', NEW.id, 'INSERT');
   END;`,
  `CREATE TRIGGER IF NOT EXISTS trg_salary_tx_update AFTER UPDATE ON salary_transactions
   BEGIN
     INSERT OR IGNORE INTO sync_queue (entity_type, entity_id, operation)
     VALUES ('salary_transactions', NEW.id, 'UPDATE');
   END;`,
   `DELETE FROM holidays WHERE rowid NOT IN (SELECT MIN(rowid) FROM holidays GROUP BY date)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date)`,
  `CREATE INDEX IF NOT EXISTS idx_salary_transactions_created_at ON salary_transactions(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_salary_transactions_emp_id ON salary_transactions(emp_id)`,
  `CREATE INDEX IF NOT EXISTS idx_salary_transactions_type ON salary_transactions(transaction_type)`,
  `CREATE TABLE IF NOT EXISTS canteen_employee_benefits (
    emp_id INTEGER PRIMARY KEY,
    rule_id INTEGER,
    benefit_type TEXT DEFAULT 'Full Deduction',
    is_manual_override INTEGER DEFAULT 0,
    rate_override REAL,
    FOREIGN KEY(emp_id) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS cash_transactions (
    id TEXT PRIMARY KEY,
    source_ref_id TEXT,
    emp_id INTEGER,
    emp_code TEXT,
    name TEXT,
    department TEXT,
    designation TEXT,
    photo TEXT,
    wage_month TEXT,
    type TEXT,
    total_amount REAL,
    paid_amount REAL DEFAULT 0,
    balance_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'UNPAID',
    module_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(emp_id) REFERENCES employees(id)
  )`,
  `CREATE TABLE IF NOT EXISTS cash_payment_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT NOT NULL,
    amount REAL NOT NULL,
    action TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(transaction_id) REFERENCES cash_transactions(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cash_txn_status ON cash_transactions(wage_month, type, module_type)`,
  `CREATE INDEX IF NOT EXISTS idx_cash_payment_entry_txn ON cash_payment_entries(transaction_id)`,
  `ALTER TABLE cash_transactions ADD COLUMN source_ref_id TEXT`,
  `ALTER TABLE cash_transactions ADD COLUMN paid_amount REAL DEFAULT 0`,
  `ALTER TABLE cash_transactions ADD COLUMN balance_amount REAL DEFAULT 0`,
  `ALTER TABLE cash_transactions ADD COLUMN status TEXT DEFAULT 'UNPAID'`,
  `UPDATE cash_transactions SET balance_amount = total_amount WHERE balance_amount = 0`,
  `CREATE TRIGGER IF NOT EXISTS trg_cash_payment_insert
   AFTER INSERT ON cash_payment_entries
   BEGIN
     UPDATE cash_transactions
     SET paid_amount = paid_amount + NEW.amount,
         balance_amount = total_amount - (paid_amount + NEW.amount),
         status = CASE 
                    WHEN (total_amount - (paid_amount + NEW.amount)) <= 0 THEN 'PAID'
                    WHEN (paid_amount + NEW.amount) > 0 THEN 'PARTIAL'
                    ELSE 'UNPAID'
                  END
     WHERE id = NEW.transaction_id;
   END;`,
  `CREATE TRIGGER IF NOT EXISTS trg_cash_payment_delete
   AFTER DELETE ON cash_payment_entries
   BEGIN
     UPDATE cash_transactions
     SET paid_amount = paid_amount - OLD.amount,
         balance_amount = total_amount - (paid_amount - OLD.amount),
         status = CASE 
                    WHEN (total_amount - (paid_amount - OLD.amount)) <= 0 THEN 'PAID'
                    WHEN (paid_amount - OLD.amount) > 0 THEN 'PARTIAL'
                    ELSE 'UNPAID'
                  END
     WHERE id = OLD.transaction_id;
   END;`,
  `CREATE TABLE IF NOT EXISTS report_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    module_type TEXT NOT NULL,
    base_table TEXT NOT NULL,
    columns_json TEXT NOT NULL,
    filters_json TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS report_snapshots (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    snapshot_date TEXT NOT NULL,
    data_json TEXT NOT NULL,
    module_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(template_id) REFERENCES report_templates(id)
  )`,
  `CREATE TABLE IF NOT EXISTS employee_monthly_wage_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER NOT NULL,
    posting_date TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    gross_amount REAL NOT NULL,
    deduction_amount REAL NOT NULL,
    net_amount REAL NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    UNIQUE(source_type, source_id)
  )`,
  `ALTER TABLE company_config ADD COLUMN db_name TEXT`,
  `ALTER TABLE company_config ADD COLUMN db_user TEXT`,
  `ALTER TABLE company_config ADD COLUMN db_password TEXT`,
  `ALTER TABLE company_config ADD COLUMN procedure_name TEXT`,
  `ALTER TABLE canteen_config ADD COLUMN connection_type TEXT`,
  `ALTER TABLE canteen_config ADD COLUMN connection_string TEXT`,
  `ALTER TABLE canteen_config ADD COLUMN db_name TEXT`,
  `ALTER TABLE canteen_config ADD COLUMN db_user TEXT`,
  `ALTER TABLE canteen_config ADD COLUMN db_password TEXT`,
  `ALTER TABLE canteen_config ADD COLUMN procedure_name TEXT`,
  `ALTER TABLE canteen_config ADD COLUMN device_entry_type TEXT`,
  `ALTER TABLE canteen_config ADD COLUMN table_name TEXT`,
  `ALTER TABLE canteen_config ADD COLUMN col_emp_code TEXT`,
  `ALTER TABLE canteen_config ADD COLUMN col_punch_time TEXT`,
  `ALTER TABLE canteen_config ADD COLUMN col_punch_type TEXT`,
  `ALTER TABLE canteen_config ADD COLUMN auto_fetch INTEGER`,
  `ALTER TABLE canteen_config ADD COLUMN fetch_interval INTEGER`,
  `UPDATE roles SET module_scope = 'BOTH' WHERE name = 'SUPERADMIN'`
];
