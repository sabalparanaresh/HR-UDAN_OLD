import { Database } from 'better-sqlite3';

export class EmployeeBulkUploadMapper {
  /**
   * Safely parses standard dates (ISO, common local formats, and Excel date serials).
   */
  public static parseDate(val: any): string | null {
    if (val === undefined || val === null || String(val).trim() === '') return null;
    const str = String(val).trim();

    // 1. Matches YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    // 2. Matches Excel Serial numbers (e.g. 43831 is 2020-01-01)
    if (/^\d{5}(\.\d+)?$/.test(str)) {
      const serialNum = parseFloat(str);
      const date = new Date((serialNum - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    // 3. Indian format: DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }

    // 4. Fallback native parse
    const timestamp = Date.parse(str);
    if (!isNaN(timestamp)) {
      return new Date(timestamp).toISOString().split('T')[0];
    }

    return null;
  }

  /**
   * Safely parses booleans. Handles 'Yes', 'No', 'True', 'False', numbers, etc.
   */
  public static parseBoolean(val: any, defaultValue = 0): number {
    if (val === undefined || val === null || String(val).trim() === '') return defaultValue;
    const s = String(val).toLowerCase().trim();
    if (s === 'yes' || s === 'true' || s === '1' || s === 'y' || s === 'active' || s === 'covered') {
      return 1;
    }
    return 0;
  }

  /**
   * Safely parses any numeric field, stripping symbols (currency, commas) first.
   */
  public static parseNumeric(val: any, defaultValue: number | null = null): number | null {
    if (val === undefined || val === null || String(val).trim() === '') return defaultValue;
    const cleaned = String(val).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Cleans text fields and forces 'N/A' or blank spaces representation to formal null values.
   */
  public static parseString(val: any): string | null {
    if (val === undefined || val === null) return null;
    const cleaned = String(val).trim();
    const lValue = cleaned.toLowerCase();
    if (lValue === '' || lValue === 'n/a' || lValue === 'null' || lValue === 'undefined') {
      return null;
    }
    return cleaned;
  }

  /**
   * Maps 77 raw excel columns to exact database structures.
   */
  public static mapRowToDb(
    rawRow: any,
    masters: Record<string, any[]>,
    moduleType: string
  ): any {
    // Standardize rawRow keys to match lowercase and underscores
    const row: any = {};
    Object.keys(rawRow).forEach(k => {
      const normalizedKey = k.toLowerCase().replace('*', '').trim().replace(/\s+/g, '_');
      row[normalizedKey] = rawRow[k];
    });

    const dbRow: any = {};

    // --- 1. General Info ---
    dbRow.emp_code = this.parseString(row.emp_code);
    dbRow.biometric_id = this.parseString(row.biometric_id);
    dbRow.first_name = this.parseString(row.first_name);
    dbRow.middle_name = this.parseString(row.middle_name);
    dbRow.last_name = this.parseString(row.last_name);
    
    // Auto-assemble composite legal name for the employee
    const names = [dbRow.first_name, dbRow.middle_name, dbRow.last_name].filter(Boolean);
    dbRow.name = names.length > 0 ? names.join(' ') : (this.parseString(row.name) || this.parseString(row.full_name_aadhar));
    
    dbRow.full_name_aadhar = this.parseString(row.full_name_aadhar);
    dbRow.father_husband_guardian_name = this.parseString(row.father_husband_guardian_name);
    
    // Normalize gender enum
    const genderRaw = this.parseString(row.gender);
    if (genderRaw) {
      const gLower = genderRaw.toLowerCase();
      dbRow.gender = gLower.startsWith('m') ? 'Male' : gLower.startsWith('f') ? 'Female' : 'Other';
    } else {
      dbRow.gender = null;
    }

    // Normalize marital status
    const maritalRaw = this.parseString(row.marital_status);
    if (maritalRaw) {
      const mLower = maritalRaw.toLowerCase();
      if (mLower === 'single' || mLower === 'unmarried') dbRow.marital_status = 'Single';
      else if (mLower === 'married') dbRow.marital_status = 'Married';
      else if (mLower === 'divorced') dbRow.marital_status = 'Divorced';
      else if (mLower === 'widowed') dbRow.marital_status = 'Widowed';
      else dbRow.marital_status = maritalRaw;
    } else {
      dbRow.marital_status = null;
    }

    dbRow.dob = this.parseDate(row.dob);
    dbRow.religion = this.parseString(row.religion);
    dbRow.blood_group = this.parseString(row.blood_group);
    dbRow.qualification = this.parseString(row.qualification);
    
    dbRow.is_differently_abled = this.parseBoolean(row.is_differently_abled, 0);
    dbRow.disability_type = this.parseString(row.disability_type);
    
    dbRow.mobile = this.parseString(row.mobile);
    dbRow.mobile2 = this.parseString(row.mobile2);
    dbRow.email = this.parseString(row.email);
    dbRow.cug_mobile = this.parseString(row.cug_mobile);

    // --- 2. IDs & Documents ---
    dbRow.aadhar_no = this.parseString(row.aadhar_no);
    dbRow.pan_no = this.parseString(row.pan_no)?.toUpperCase();
    dbRow.voter_id = this.parseString(row.voter_id);
    dbRow.uan_no = this.parseString(row.uan_no);
    dbRow.pf_number = this.parseString(row.pf_number);
    dbRow.esi_ip_number = this.parseString(row.esi_ip_number);
    dbRow.passport_no = this.parseString(row.passport_no);
    dbRow.driving_licence = this.parseString(row.driving_licence);

    // --- 3. Organisational Info (Strict master mapping resolves to physical ID pointers) ---
    const lookupAndSet = (fieldSrc: string, tableSrc: string, targetIdKey: string, targetNameKey?: string) => {
      const val = this.parseString(row[fieldSrc]);
      if (val) {
        const list = masters[tableSrc] || [];
        const valLower = val.toLowerCase();
        
        let found = list.find(m => {
          if (tableSrc === 'org_hierarchy') {
            const isLocation = fieldSrc === 'location';
            const matchedType = isLocation ? 'Location' : 'Division';
            return m.type === matchedType && String(m.name || '').toLowerCase().trim() === valLower;
          }
          const mName = String(m.name || m.slab_name || '').toLowerCase().trim();
          return mName === valLower;
        });

        // Try matching by numeric ID value
        if (!found && !isNaN(parseFloat(val))) {
          const numericId = Math.floor(parseFloat(val));
          found = list.find(m => m.id === numericId);
        }

        if (found) {
          dbRow[targetIdKey] = found.id;
          if (targetNameKey) {
            dbRow[targetNameKey] = found.name || found.slab_name;
          }
        } else {
          dbRow[targetIdKey] = null;
          if (targetNameKey) {
            dbRow[targetNameKey] = val; // Store literal string as custom fallback
          }
        }
      } else {
        dbRow[targetIdKey] = null;
        if (targetNameKey) {
          dbRow[targetNameKey] = fieldSrc === 'employee_status' ? 'Active' : null;
        }
      }
    };

    lookupAndSet('group', 'groups', 'group_id');
    lookupAndSet('department', 'departments', 'department_id');
    lookupAndSet('designation', 'designations', 'designation_id', 'designation');
    lookupAndSet('employment_type', 'employment_types', 'employment_type_id', 'employment_type');
    lookupAndSet('location', 'org_hierarchy', 'location_id');
    lookupAndSet('division', 'org_hierarchy', 'division_id');
    lookupAndSet('class', 'classes', 'class_id');
    lookupAndSet('category', 'categories', 'category_id');
    lookupAndSet('shift', 'shifts', 'shift_id');
    lookupAndSet('grade', 'grades', 'grade_id', 'grade');
    lookupAndSet('working_day_type', 'working_day_types', 'working_day_type_id');
    lookupAndSet('slab_name', 'salary_slabs', 'slab_id');
    lookupAndSet('employee_status', 'employee_statuses', 'employee_status_id', 'employee_status');

    // Force default active state mapping on employee status if null
    if (!dbRow.employee_status) {
      dbRow.employee_status = 'Active';
    }

    // --- 4. Payment & Wages ---
    dbRow.payment_mode = this.parseString(row.payment_mode) || 'Cash';
    dbRow.ifsc_code = this.parseString(row.ifsc_code)?.toUpperCase();
    dbRow.account_no = this.parseString(row.account_no);
    dbRow.bank_name = this.parseString(row.bank_name);
    dbRow.as_per_bank_name = this.parseString(row.as_per_bank_name) || dbRow.name;
    dbRow.bank_effective_date = this.parseDate(row.bank_effective_date);
    
    // Standard Wage Info
    dbRow.wage_type = this.parseString(row.wage_type) || 'Monthly';
    dbRow.wage_amount = this.parseNumeric(row.wage_amount, 0);
    dbRow.wage_effective_from = this.parseDate(row.wage_effective_from);

    // Statutory Wage Info (PROPER PERSISTENCE MANDATE)
    dbRow.statutory_wage_type = this.parseString(row.statutory_wage_type) || dbRow.wage_type || 'Monthly';
    dbRow.statutory_wage_amount = this.parseNumeric(row.statutory_wage_amount) || dbRow.wage_amount || 0;
    dbRow.statutory_rate = dbRow.statutory_wage_amount; // Align rates

    // PF and ESI Cover flags
    dbRow.is_pf_covered = this.parseBoolean(row.pf_contribution_active, 1);
    dbRow.is_esi_covered = this.parseBoolean(row.esi_contribution_active, 1);

    // Voluntary PF Details
    dbRow.voluntary_pf_applicable = this.parseBoolean(row.voluntary_pf_applicable, 0);
    dbRow.voluntary_pf_type = this.parseString(row.voluntary_pf_type) || 'Percentage';
    dbRow.voluntary_pf_value = this.parseNumeric(row.voluntary_pf_value, 0);

    // --- 5. Dates & Snapshots ---
    dbRow.joining_date = this.parseDate(row.joining_date);
    dbRow.book_joining_date = this.parseDate(row.book_joining_date) || dbRow.joining_date;
    dbRow.leaving_date = this.parseDate(row.leaving_date);
    dbRow.esi_joining_date = this.parseDate(row.esi_joining_date) || dbRow.joining_date;
    dbRow.pf_joining_date = this.parseDate(row.pf_joining_date) || dbRow.joining_date;
    dbRow.pf_exit_date = this.parseDate(row.pf_exit_date);
    dbRow.pf_exit_reason = this.parseString(row.pf_exit_reason);

    // --- 6. Reporting Hierarchy Temporary Keys (resolved in 2nd-pass database updates) ---
    dbRow._reporting_to_emp_code = this.parseString(row.reporting_to_emp_code);
    dbRow._parent_emp_code = this.parseString(row.parent_emp_code);

    dbRow.salary_process_sequence = this.parseNumeric(row.salary_process_sequence, 1);
    dbRow.weekly_off = this.parseString(row.weekly_off) || 'Sunday';
    dbRow.weekly_off_effective_date = this.parseDate(row.weekly_off_effective_date) || dbRow.joining_date;

    // --- 7. Address details ---
    dbRow.is_perm_same_as_current = this.parseBoolean(row.is_perm_same_as_current, 0);
    dbRow.current_address = this.parseString(row.current_address);
    dbRow.current_pincode = this.parseString(row.current_pincode);
    dbRow.current_district = this.parseString(row.current_district);
    dbRow.current_state = this.parseString(row.current_state);

    if (dbRow.is_perm_same_as_current === 1) {
      dbRow.perm_address = dbRow.current_address;
      dbRow.perm_pincode = dbRow.current_pincode;
      dbRow.perm_district = dbRow.current_district;
      dbRow.perm_state = dbRow.current_state;
    } else {
      dbRow.perm_address = this.parseString(row.perm_address);
      dbRow.perm_pincode = this.parseString(row.perm_pincode);
      dbRow.perm_district = this.parseString(row.perm_district);
      dbRow.perm_state = this.parseString(row.perm_state);
    }

    // Explicit default initialization for JSON tracking histories to prevent DB crash checks
    dbRow.pf_history = JSON.stringify([]);
    dbRow.esi_history = JSON.stringify([]);
    dbRow.bank_history = JSON.stringify([]);

    dbRow.status = this.parseBoolean(row.status, 1);

    return dbRow;
  }
}
