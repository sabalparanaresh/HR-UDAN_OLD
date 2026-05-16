import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Database,
  Search,
  AlertTriangle,
  Info,
  X
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BulkEmployeeUploadProps {
  onSuccess: () => void;
  currentMode: string;
}

const MANDATORY_FIELDS = [
  'emp_code', 
  'first_name', 
  'full_name_aadhar', 
  'father_husband_guardian_name', 
  'dob', 
  'department', 
  'designation', 
  'aadhar_no', 
  'joining_date'
];

const FULL_TEMPLATE_FIELDS = [
  // General Info
  'emp_code', 'biometric_id', 'first_name', 'middle_name', 'last_name', 
  'full_name_aadhar', 'father_husband_guardian_name', 'gender', 'marital_status', 
  'dob', 'religion', 'blood_group', 'qualification', 'is_differently_abled', 'disability_type', 
  'mobile', 'mobile2', 'email', 'cug_mobile',
  
  // Organisational Info
  'group', 'department', 'designation', 'employment_type', 'location', 
  'class', 'category', 'division', 'shift', 'grade', 'employee_status',
  
  // IDs & Documents
  'aadhar_no', 'pan_no', 'voter_id', 'uan_no', 'pf_number', 'esi_ip_number', 'passport_no', 'driving_licence',
  
  // Payment & Wages
  'payment_mode', 'ifsc_code', 'account_no', 'bank_name', 'as_per_bank_name', 'bank_effective_date',
  'wage_type', 'wage_amount', 'slab_name', 'working_day_type', 'wage_effective_from',
  'statutory_wage_type', 'statutory_wage_amount',
  'pf_contribution_active', 'esi_contribution_active',
  'voluntary_pf_applicable', 'voluntary_pf_type', 'voluntary_pf_value',
  
  // Dates
  'joining_date', 'book_joining_date', 'leaving_date', 'esi_joining_date', 'pf_joining_date', 'pf_exit_date', 'pf_exit_reason',
  
  // Reporting & Hierarchy
  'reporting_to_emp_code', 'parent_emp_code', 'salary_process_sequence', 'weekly_off', 'weekly_off_effective_date',

  // Addresses
  'is_perm_same_as_current', 'perm_address', 'perm_pincode', 'perm_district', 'perm_state',
  'current_address', 'current_pincode', 'current_district', 'current_state'
];

const DATABASE_FIELD_MAP: Record<string, string> = {
  'group': 'group_id',
  'department': 'department_id',
  'designation': 'designation_id',
  'location': 'location_id',
  'division': 'division_id',
  'category': 'category_id',
  'class': 'class_id',
  'employment_type': 'employment_type_id',
  'employee_status': 'employee_status_id',
  'shift': 'shift_id',
  'grade': 'grade_id',
  'slab_name': 'slab_id',
  'working_day_type': 'working_day_type_id',
  'statutory_wage_type': 'statutory_wage_type',
  'statutory_wage_amount': 'statutory_wage_amount',
  'reporting_to_emp_code': 'reporting_employee_id',
  'parent_emp_code': 'parent_employee_id',
  'pf_contribution_active': 'is_pf_covered',
  'esi_contribution_active': 'is_esi_covered'
};

export default function BulkEmployeeUpload({ onSuccess, currentMode }: BulkEmployeeUploadProps) {
  const [data, setData] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<number, string[]>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);
  const [masters, setMasters] = useState<Record<string, any[]>>({});
  const [statutorySlabs, setStatutorySlabs] = useState<any[]>([]);
  const [companyConfig, setCompanyConfig] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchMasters = async () => {
      const tables = [
        'groups', 'departments', 'designations', 'locations', 'org_hierarchy', 
        'categories', 'classes', 'employment_types', 'employee_statuses', 
        'shifts', 'grades', 'salary_slabs', 'working_day_types', 'employees'
      ];
      
      const newMasters: Record<string, any[]> = {};
      for (const table of tables) {
        try {
          const res = await invoke<any[]>('master_crud', {
            tableName: table,
            operation: 'list',
            moduleType: currentMode
          });
          newMasters[table] = res;
        } catch (e) {
          if (table !== 'employees') console.error(`Failed to fetch master: ${table}`, e);
        }
      }
      setMasters(newMasters);

      // Fetch Company Config
      try {
        const config = await invoke<any>('get_company_config', { moduleType: currentMode });
        setCompanyConfig(config);
      } catch (e) {
        console.error("Failed to fetch company config", e);
      }
    };
    fetchMasters();
  }, [currentMode]);

  const downloadTemplate = () => {
    // Create header row with mandatory indicators
    const headers = FULL_TEMPLATE_FIELDS.map(f => MANDATORY_FIELDS.includes(f) ? `${f}*` : f);
    
    // Create a sample data row
    const sampleRow = FULL_TEMPLATE_FIELDS.map(f => {
      if (f === 'emp_code') return 'EMP001';
      if (f === 'biometric_id') return '1001';
      if (f === 'first_name') return 'John';
      if (f === 'middle_name') return 'Quincy';
      if (f === 'last_name') return 'Doe';
      if (f === 'full_name_aadhar') return 'John Q Doe';
      if (f === 'father_husband_guardian_name') return 'Senior Doe';
      if (f === 'gender') return 'Male';
      if (f === 'marital_status') return 'Married';
      if (f === 'dob') return '1990-01-01';
      if (f === 'department') return 'Maintenance';
      if (f === 'designation') return 'Fitter';
      if (f === 'group') return 'Main Group';
      if (f === 'division') return 'Unit 1';
      if (f === 'location') return 'Factory A';
      if (f === 'aadhar_no') return '123456789012';
      if (f === 'joining_date') return '2023-01-01';
      if (f === 'wage_type') return 'Monthly';
      if (f === 'statutory_wage_type') return 'Monthly';
      if (f === 'statutory_wage_amount') return '18000';
      if (f === 'pf_contribution_active') return 'Yes';
      if (f === 'esi_contribution_active') return 'Yes';
      if (f === 'mobile') return '9876543210';
      if (f === 'employment_type') return 'Permanent';
      if (f === 'employee_status') return 'Active';
      if (f === 'is_differently_abled') return 'No';
      if (f === 'voluntary_pf_applicable') return 'No';
      if (f === 'is_perm_same_as_current') return 'No';
      return '';
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employee Template");
    
    XLSX.writeFile(wb, `HR_UDAN_Employee_Template_${currentMode}.xlsx`);
    toast.success("Excel template downloaded successfully");
  };

  const validateRecords = (records: any[]) => {
    const newErrors: Record<number, string[]> = {};
    
    records.forEach((rec, idx) => {
      const errs: string[] = [];
      
      // Check mandatory fields
      MANDATORY_FIELDS.forEach(field => {
        if (!rec[field] || String(rec[field]).trim() === '') {
          errs.push(`${field} is required`);
        }
      });

      // Mobile check (10 digits)
      if (rec.mobile && !/^\d{10}$/.test(String(rec.mobile))) {
        errs.push('Mobile must be 10 digits');
      }

      // Statutory Wage Type validation
      if (rec.statutory_wage_type) {
        const swt = String(rec.statutory_wage_type).trim().toLowerCase();
        if (swt !== 'monthly' && swt !== 'daily') {
          errs.push('statutory_wage_type must be Monthly or Daily');
        }
      }

      // Date format check (YYYY-MM-DD)
      const dateFields = ['dob', 'joining_date'];
      dateFields.forEach(f => {
        if (rec[f] && !/^\d{4}-\d{2}-\d{2}$/.test(String(rec[f]))) {
          errs.push(`${f} must be YYYY-MM-DD`);
        }
      });

      if (errs.length > 0) {
        newErrors[idx] = errs;
      }
    });

    setErrors(newErrors);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) {
        setIsParsing(false);
        return;
      }

      try {
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];

        if (rawData.length === 0) {
          toast.error("The file is empty");
          setIsParsing(false);
          return;
        }

        // Clean keys (convert to lowercase, remove * and trailing spaces)
        const cleanedData = rawData.map((row: any) => {
          const newRow: any = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.toLowerCase().replace('*', '').trim().replace(/\s+/g, '_');
            newRow[cleanKey] = row[key];
          });
          return newRow;
        });

        setData(cleanedData);
        validateRecords(cleanedData);
        setIsParsing(false);
        toast.success(`Successfully loaded ${cleanedData.length} records`);
      } catch (err) {
        console.error('File Parsing Error:', err);
        toast.error('Failed to parse file. Make sure it is a valid Excel file.');
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read file');
      setIsParsing(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleUpdateField = (idx: number, field: string, value: any) => {
    const newData = [...data];
    newData[idx] = { ...newData[idx], [field]: value };
    setData(newData);
    validateRecords(newData);
  };

  const handleCommit = async () => {
    if (Object.keys(errors).length > 0) {
      const errorRows = Object.keys(errors);
      toast.error(`Please fix validation errors in ${errorRows.length} rows before committing. First error at row ${Number(errorRows[0]) + 1}`);
      return;
    }

    setIsCommitting(true);
    setUploadProgress({ current: 0, total: data.length });
    
    // Resolve Names/Codes to IDs
    const resolvedData = data.map(rec => {
      const resolved = { ...rec };
      
      const mapping: Record<string, string> = {
        'group': 'groups',
        'department': 'departments',
        'designation': 'designations',
        'location': 'org_hierarchy',
        'division': 'org_hierarchy',
        'category': 'categories',
        'class': 'classes',
        'employment_type': 'employment_types',
        'employee_status': 'employee_statuses',
        'shift': 'shifts',
        'grade': 'grades',
        'slab_name': 'salary_slabs',
        'working_day_type': 'working_day_types'
      };

      for (const [field, table] of Object.entries(mapping)) {
        if (rec[field]) {
          const rawValue = String(rec[field]).trim();
          const nameValue = rawValue.toLowerCase();
          const list = masters[table] || [];
          
          let found = list.find(m => {
            if (table === 'org_hierarchy') {
              const typeToMatch = field === 'location' ? 'Location' : 'Division';
              return m.type === typeToMatch && (m.name || '').toLowerCase().trim() === nameValue;
            }
            return (m.name || m.slab_name || '').toLowerCase().trim() === nameValue;
          });

          // Fallback: If not found by name, try to match by numeric ID (Excel often converts IDs to 2.0)
          if (!found && !isNaN(parseFloat(rawValue))) {
            const numericId = Math.floor(parseFloat(rawValue));
            found = list.find(m => m.id === numericId);
          }

          if (found) {
            resolved[DATABASE_FIELD_MAP[field]] = found.id;
            // Also store the Name for TEXT fields if applicable
            if (field === 'designation' || field === 'employment_type' || field === 'employee_status') {
              resolved[field] = found.name;
            }
          } else if (field === 'designation' || field === 'employment_type' || field === 'employee_status') {
            // If not found in master list, we still keep the string but warn or just let it be
            resolved[field] = rec[field];
          }
        }
      }

      // Resolve Employee Code based lookups
      const allEmps = masters['employees'] || [];
      if (rec['reporting_to_emp_code']) {
        const found = allEmps.find(e => String(e.emp_code).trim().toLowerCase() === String(rec['reporting_to_emp_code']).trim().toLowerCase());
        if (found) resolved['reporting_employee_id'] = found.id;
      }
      if (rec['parent_emp_code']) {
        const found = allEmps.find(e => String(e.emp_code).trim().toLowerCase() === String(rec['parent_emp_code']).trim().toLowerCase());
        if (found) resolved['parent_employee_id'] = found.id;
      }

      // Resolve Booleans
      const boolFields = ['is_differently_abled', 'voluntary_pf_applicable', 'is_perm_same_as_current', 'pf_contribution_active', 'esi_contribution_active'];
      boolFields.forEach(f => {
        if (rec[f] !== undefined && rec[f] !== "") {
          const v = String(rec[f]).toLowerCase().trim();
          resolved[DATABASE_FIELD_MAP[f] || f] = (v === 'yes' || v === 'true' || v === '1') ? 1 : 0;
        }
      });

      return resolved;
    });

    try {
      const CHUNK_SIZE = 500;
      const chunks = [];
      for (let i = 0; i < resolvedData.length; i += CHUNK_SIZE) {
        chunks.push(resolvedData.slice(i, i + CHUNK_SIZE));
      }

      let totalSyncCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        setUploadProgress({ current: i * CHUNK_SIZE, total: data.length });
        const result = await invoke<any>('bulk_employee_upsert', { 
          records: chunks[i], 
          moduleType: currentMode 
        });
        if (result?.syncCount) totalSyncCount += result.syncCount;
      }

      setUploadProgress(null);
      const message = `Successfully uploaded ${data.length} employees. ${totalSyncCount > 0 ? `${totalSyncCount} employees synced to Module P.` : 'No records met sync criteria for Module P.'}`;
      toast.success(message);
      
      // Auto-Statutory-Sync is now handled server-side in the bifurcation logic
      // within bulk_employee_upsert to ensure atomic consistency and strict validation.

      onSuccess();
      setData([]);
    } catch (error: any) {
      console.error('Commit Error:', error);
      toast.error(`Import failed at batch progress: ${error.message || 'Unknown error'}`);
    } finally {
      setIsCommitting(false);
      setUploadProgress(null);
    }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className="space-y-6">
      {/* Upload Header */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-6 textile-card bg-white border-l-4 border-l-primary-navy shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-primary-navy border border-app-border shadow-inner">
            <Database size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary-navy">Bulk Employee Onboarding</h2>
            <p className="text-sm text-text-muted italic">Sync multi-record rosters from Excel/CSV templates</p>
          </div>
        </div>
        
        <div className="flex gap-3 shrink-0">
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 border-2 border-primary-navy text-primary-navy font-bold rounded-lg hover:bg-slate-50 transition-all text-sm"
          >
            <Download size={18} />
            Download Template
          </button>
          
          <label className="flex items-center gap-2 px-4 py-2 bg-primary-navy text-white font-bold rounded-lg hover:bg-slate-800 transition-all cursor-pointer text-sm shadow-md">
            <Upload size={18} />
            {isParsing ? 'Parsing...' : 'Upload Data'}
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden" 
            />
          </label>
        </div>
      </div>

      {/* Preview Grid */}
      {data.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-primary-navy flex items-center gap-2 uppercase tracking-wide text-xs">
                <FileText size={16} />
                Validation Preview ({data.length} Records)
              </h3>
              {errorCount > 0 ? (
                <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-red-100 shadow-sm animate-pulse">
                  <AlertTriangle size={14} />
                  {errorCount} Rows with Errors
                </div>
              ) : (
                <div className="bg-primary-green/10 text-primary-green px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-primary-green/20">
                  <CheckCircle2 size={14} />
                  All Data Validated
                </div>
              )}
            </div>
            
            {isCommitting ? (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 px-6 py-2 bg-slate-100 text-primary-navy font-bold rounded-lg transition-all shadow-md">
                  <Loader2 className="animate-spin" size={18} />
                  Processing...
                </div>
                {uploadProgress && (
                  <p className="text-[10px] font-bold text-primary-navy animate-pulse">
                    Uploading: {uploadProgress.current} / {uploadProgress.total} records
                  </p>
                )}
              </div>
            ) : (
              <button 
                onClick={handleCommit}
                disabled={isCommitting || errorCount > 0}
                className="flex items-center gap-2 px-6 py-2 bg-primary-green text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
              >
                <CheckCircle2 size={18} />
                Commit to Database
              </button>
            )}
          </div>

          <div className="textile-card bg-white border-app-border overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b-2 border-app-border z-10">
                  <tr>
                    <th className="p-3 text-left textile-header text-xs uppercase w-16">Row</th>
                    <th className="p-3 text-left textile-header text-xs uppercase w-20">Status</th>
                    {MANDATORY_FIELDS.map(col => (
                      <th key={col} className="p-3 text-left textile-header text-xs uppercase min-w-[150px]">
                        {col} <span className="text-red-500">*</span>
                      </th>
                    ))}
                    <th className="p-3 text-left textile-header text-xs uppercase min-w-[150px]">Mobile</th>
                    <th className="p-3 text-left textile-header text-xs uppercase min-w-[200px]">Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 italic-muted">
                  {data.slice(0, 300).map((row, idx) => {
                    const rowErrors = errors[idx] || [];
                    const hasError = rowErrors.length > 0;
                    
                    return (
                      <tr key={idx} className={cn(hasError ? "bg-red-50/30" : "hover:bg-slate-50/50 transition-colors")}>
                        <td className="p-3 text-xs font-mono text-text-muted">{idx + 1}</td>
                        <td className="p-3">
                          {hasError ? (
                            <div className="group relative cursor-help">
                              <AlertCircle className="text-red-500" size={18} />
                              <div className="absolute left-full ml-2 top-0 hidden group-hover:block z-50 bg-slate-900 text-white p-3 rounded-lg text-[10px] w-64 shadow-2xl animate-in zoom-in-95">
                                <p className="font-bold mb-1 uppercase tracking-tight text-red-400">Validation Failures:</p>
                                <ul className="list-disc list-inside space-y-0.5 opacity-90 font-sans">
                                  {rowErrors.map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                              </div>
                            </div>
                          ) : (
                            <CheckCircle2 className="text-primary-green" size={18} />
                          )}
                        </td>
                        {MANDATORY_FIELDS.map(col => (
                          <td key={col} className="p-2">
                            <input 
                              type="text"
                              value={row[col] || ''}
                              onChange={(e) => handleUpdateField(idx, col, e.target.value)}
                              className={cn(
                                "w-full p-2 text-sm bg-transparent border-b-2 border-transparent focus:border-primary-navy outline-none transition-all rounded-sm",
                                rowErrors.some(e => e.toLowerCase().includes(col.toLowerCase())) && "border-red-300 bg-red-50/50"
                              )}
                            />
                          </td>
                        ))}
                        <td className="p-2">
                          <input 
                            type="text"
                            value={row.mobile || ''}
                            onChange={(e) => handleUpdateField(idx, 'mobile', e.target.value)}
                            className={cn(
                              "w-full p-2 text-sm bg-transparent border-b-2 border-transparent focus:border-primary-navy outline-none transition-all rounded-sm",
                              rowErrors.some(e => e.toLowerCase().includes('mobile')) && "border-red-300 bg-red-50/50"
                            )}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text"
                            value={row.perm_address || ''}
                            onChange={(e) => handleUpdateField(idx, 'perm_address', e.target.value)}
                            className="w-full p-2 text-sm bg-transparent border-b-2 border-transparent focus:border-primary-navy outline-none transition-all rounded-sm"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {data.length > 300 && (
                    <tr>
                      <td colSpan={MANDATORY_FIELDS.length + 4} className="p-4 text-center bg-slate-50 text-text-muted font-bold text-xs">
                        AND {data.length - 300} MORE RECORDS... (Display limited to first 300 for performance)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-50 p-3 border-t border-app-border flex items-center justify-between">
              <p className="text-[10px] font-bold text-text-muted uppercase">
                <Info size={12} className="inline mr-1" />
                Table shows mandatory and key fields only. All fields from the CSV are used for the upload.
              </p>
              <button 
                onClick={() => setData([])}
                className="text-[10px] font-bold text-red-500 uppercase hover:underline"
              >
                Clear All Records
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {data.length === 0 && !isParsing && (
        <div className="flex flex-col items-center justify-center p-20 textile-card bg-white border-app-border space-y-4 shadow-sm border-dashed">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-primary-navy/30">
            <Upload size={32} />
          </div>
          <div className="text-center">
            <p className="text-primary-navy font-bold">No data loaded</p>
            <p className="text-sm text-text-muted">Download the template and upload your employee CSV file to get started.</p>
          </div>
        </div>
      )}
    </div>
  );
}
