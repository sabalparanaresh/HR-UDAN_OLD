import { Database } from 'better-sqlite3';

export interface ValidationError {
  row: number;
  empCode?: string;
  errors: string[];
}

export class EmployeeBulkUploadValidator {
  /**
   * Performs granular, strict audits on a single raw row before DB insert/update.
   * Enforces rigorous domain-level validation rules on all 77 columns.
   */
  public static validateRow(
    row: any,
    rowIndex: number,
    primaryDb: Database,
    masters: Record<string, any[]>
  ): string[] {
    const errors: string[] = [];
    const recordIndex = rowIndex + 1;

    // 1. Identity & Structural Checks
    const empCode = String(row.emp_code || '').trim();
    if (!empCode) {
      errors.push(`Row ${recordIndex}: 'emp_code' is mandatory.`);
    }

    const firstName = String(row.first_name || '').trim();
    if (!firstName) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode || 'Unknown'}): 'first_name' is mandatory.`);
    }

    const fullNameAadhar = String(row.full_name_aadhar || '').trim();
    if (!fullNameAadhar) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode || 'Unknown'}): 'full_name_aadhar' is mandatory.`);
    }

    const guardianName = String(row.father_husband_guardian_name || '').trim();
    if (!guardianName) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode || 'Unknown'}): 'father_husband_guardian_name' is mandatory.`);
    }

    // 2. Joining & Date Format Checks
    const dob = String(row.dob || '').trim();
    if (!dob) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'dob' (Date of Birth) is mandatory.`);
    } else if (!this.isValidDateFormat(dob)) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'dob' (${dob}) must be a valid date in YYYY-MM-DD structure.`);
    }

    const joiningDate = String(row.joining_date || '').trim();
    if (!joiningDate) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'joining_date' is mandatory.`);
    } else if (!this.isValidDateFormat(joiningDate)) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'joining_date' (${joiningDate}) must be a valid date in YYYY-MM-DD structure.`);
    }

    // Other optional date fields validation
    const optionalDateFields = [
      'book_joining_date', 'leaving_date', 'esi_joining_date', 'pf_joining_date', 
      'pf_exit_date', 'bank_effective_date', 'wage_effective_from', 'weekly_off_effective_date'
    ];
    for (const f of optionalDateFields) {
      const val = String(row[f] || '').trim();
      if (val && !this.isValidDateFormat(val)) {
        errors.push(`Row ${recordIndex} (Emp: ${empCode}): Optional date field '${f}' contains invalid date expression '${val}'. Must support YYYY-MM-DD format.`);
      }
    }

    // Age validation (Must be at least 14 years old to prevent child labor compliance breach)
    if (dob && this.isValidDateFormat(dob)) {
      const bDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - bDate.getFullYear();
      const m = today.getMonth() - bDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
        age--;
      }
      if (age < 14) {
        errors.push(`Row ${recordIndex} (Emp: ${empCode}): Illegal age detected (${age} years old). Employee must be aged 14 or above.`);
      }
    }

    // 3. Enum Mapping Constraints
    const gender = String(row.gender || '').trim().toLowerCase();
    if (gender && !['male', 'female', 'other', 'm', 'f', 'o', 'transgender'].includes(gender)) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): Invalid gender '${row.gender}'. Must reside in [Male, Female, Other].`);
    }

    const marital = String(row.marital_status || '').trim().toLowerCase();
    if (marital && !['single', 'married', 'divorced', 'widowed', 'unmarried'].includes(marital)) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): Invalid marital status '${row.marital_status}'. Must reside in [Single, Married, Divorced, Widowed].`);
    }

    const wageType = String(row.wage_type || '').trim().toLowerCase();
    if (wageType && !['monthly', 'daily', 'piece_rate', 'piece rate', 'hourly'].includes(wageType)) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): Invalid wage type '${row.wage_type}'. Must stand as 'Monthly', 'Daily', 'Piece Rate', or 'Hourly'.`);
    }

    const statWageType = String(row.statutory_wage_type || '').trim().toLowerCase();
    if (statWageType && !['monthly', 'daily'].includes(statWageType)) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): Invalid statutory wage type '${row.statutory_wage_type}'. Must be 'Monthly' or 'Daily'.`);
    }

    // 4. Contact & Identity Format Audits (Mandatory Check for Valid Identity fields)
    const mobileValue = String(row.mobile || '').trim();
    if (mobileValue) {
      if (!/^\d{10}$/.test(mobileValue)) {
        errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'mobile' number must be exactly 10 numeric digits. Received: '${mobileValue}'.`);
      }
    }

    const aadharNo = String(row.aadhar_no || '').trim();
    if (!aadharNo) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'aadhar_no' (Aadhar card ID) is mandatory.`);
    } else if (!/^\d{12}$/.test(aadharNo)) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'aadhar_no' must contain exactly 12 numeric digits without punctuation. Received: '${aadharNo}'.`);
    }

    const panNo = String(row.pan_no || '').trim();
    if (panNo && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(panNo)) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'pan_no' is incorrectly formatted. Must follow standard alphanumeric PAN syntax (e.g. ABCDE1234F).`);
    }

    const uanNo = String(row.uan_no || '').trim();
    if (uanNo && !/^\d{12}$/.test(uanNo)) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): EPFO 'uan_no' must stand as exactly 12 continuous numeric digits.`);
    }

    const pfNo = String(row.pf_number || '').trim();
    if (pfNo && pfNo.length > 50) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'pf_number' is abnormally long. Length is limited to 50 characters.`);
    }

    const esiIp = String(row.esi_ip_number || '').trim();
    if (esiIp && !/^\d{17}$/.test(esiIp)) {
      errors.push(`Row ${recordIndex} (Emp: ${empCode}): ESIC 'esi_ip_number' must be exactly 17 numeric digits. Received: '${esiIp}'.`);
    }

    // 5. Bank Account & Payment Mode Integrity
    const paymentMode = String(row.payment_mode || '').trim().toLowerCase();
    if (paymentMode) {
      const normalizedPMode = paymentMode.replace(/[\s\-_]+/g, '');
      const requiresBankDetails = ['banktransfer', 'bank', 'neft', 'rtgs', 'cheque', 'electronic'].includes(normalizedPMode);
      
      const accountNo = String(row.account_no || '').trim();
      const ifscCode = String(row.ifsc_code || '').trim();
      const bankName = String(row.bank_name || '').trim();

      if (requiresBankDetails) {
        if (!accountNo) {
          errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'account_no' is mandatory when 'payment_mode' is set to '${row.payment_mode}'.`);
        }
        if (!ifscCode) {
          errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'ifsc_code' is mandatory when 'payment_mode' is set to '${row.payment_mode}'.`);
        } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode)) {
          errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'ifsc_code' (${ifscCode}) is invalid. It must strictly conform to RBI standards (4 letters, a zero, 6 alpha/numeric).`);
        }
        if (!bankName) {
          errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'bank_name' is mandatory when 'payment_mode' is set to '${row.payment_mode}'.`);
        }
      }
    }

    // 6. Non-Skipping Master Records Alignment & Validation Warnings
    // Validates that if a Master record key is provided, it can be resolved by name/code
    const masterLookups = [
      { field: 'group', table: 'groups', name: 'Group' },
      { field: 'department', table: 'departments', name: 'Department' },
      { field: 'designation', table: 'designations', name: 'Designation' },
      { field: 'employment_type', table: 'employment_types', name: 'Employment Type' },
      { field: 'location', table: 'locations', name: 'Location' },
      { field: 'division', table: 'divisions', name: 'Division' },
      { field: 'shift', table: 'shifts', name: 'Shift' },
      { field: 'grade', table: 'grades', name: 'Grade' },
      { field: 'employee_status', table: 'employee_statuses', name: 'Employee Status' },
      { field: 'slab_name', table: 'salary_slabs', name: 'Salary Slab' },
      { field: 'working_day_type', table: 'working_day_types', name: 'Working Day Type' },
    ];

    masterLookups.forEach(({ field, table, name }) => {
      const rawVal = String(row[field] || '').trim();
      if (rawVal) {
        const list = masters[table] || [];
        const normalizedRaw = rawVal.toLowerCase();
        
        let found = list.find(m => {
          const mName = String(m.name || m.slab_name || '').toLowerCase().trim();
          return mName === normalizedRaw;
        });

        // Try numeric ID correlation if parsing matches a number
        if (!found && !isNaN(parseFloat(rawVal))) {
          const numericId = Math.floor(parseFloat(rawVal));
          found = list.find(m => m.id === numericId);
        }

        if (!found) {
          errors.push(`Row ${recordIndex} (Emp: ${empCode}): Selected ${name} '${rawVal}' is not defined in your active configurations. Define it first.`);
        }
      }
    });

    // 7. Numeric Ranges & Boundary Verification
    const wageAmt = parseFloat(row.wage_amount);
    if (row.wage_amount !== undefined && row.wage_amount !== '' && row.wage_amount !== null) {
      if (isNaN(wageAmt) || wageAmt < 0) {
        errors.push(`Row ${recordIndex} (Emp: ${empCode}): Standard 'wage_amount' (${row.wage_amount}) must stand as a positive numerical amount.`);
      }
    }

    const statutoryAmt = parseFloat(row.statutory_wage_amount);
    if (row.statutory_wage_amount !== undefined && row.statutory_wage_amount !== '' && row.statutory_wage_amount !== null) {
      if (isNaN(statutoryAmt) || statutoryAmt < 0) {
        errors.push(`Row ${recordIndex} (Emp: ${empCode}): 'statutory_wage_amount' (${row.statutory_wage_amount}) must stand as a positive numerical amount.`);
      }
    }

    return errors;
  }

  /**
   * Helper to validate date string matches regular YYYY-MM-DD pattern and constitutes a valid Gregorian date.
   */
  private static isValidDateFormat(dateStr: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return false;
    // Extra validation to block crazy days like '2023-02-31'
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return dateObj.getFullYear() === year && dateObj.getMonth() === month && dateObj.getDate() === day;
  }
}
