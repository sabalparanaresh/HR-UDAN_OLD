import React, { useState, useEffect, useRef, memo } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Calculator, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  RefreshCw, 
  Lock, 
  Info, 
  FileSpreadsheet, 
  ShieldCheck, 
  Eye, 
  Save,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  ShieldAlert,
  Zap,
  ArrowRightLeft,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { User as UserType, Department, Location, Group, Division } from '../../types';
import { useModule } from '../../contexts/ModuleContext';
import { useHotkeys } from '../../hooks/useHotkeys';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { SearchableSelect, MultiSearchableSelect } from '../../components/common/SearchableSelect';
import { useFinalPayroll } from '../../hooks/useFinalPayroll';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type PayrollStep = 'Filtering' | 'K_Processing' | 'P_Syncing' | 'Consolidating';

const safeJsonParse = (str: any) => {
  if (typeof str === 'object' && str !== null) return str;
  if (!str) return {};
  try {
    const res = JSON.parse(str);
    return (typeof res === 'object' && res !== null) ? res : {};
  } catch (e) {
    return {};
  }
};

const EmployeeTableRow = memo(({ 
  item, 
  kLogicSource, 
  kOnlyHeads, 
  kpHeads, 
  setSelectedEmployeeSlip,
  virtualRow,
  measureElement
}: any) => {
  return (
    <tr 
      ref={measureElement}
      data-index={virtualRow.index}
      className="border-b border-app-border hover:bg-slate-50 transition-colors group cursor-pointer" 
      onClick={() => setSelectedEmployeeSlip(item)}
    >
      <td className="p-3 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-app-border" style={{ minWidth: '220px' }}>
        <div className="flex flex-col">
          <span className="font-bold text-[13px] text-primary-navy tracking-tight truncate max-w-[200px]" title={item.name}>{item.name}</span>
          <span className="text-[11px] font-mono text-text-muted mt-0.5">{item.emp_code}</span>
          <span className="text-[10px] font-semibold text-text-muted uppercase mt-1 truncate max-w-[200px]" title={item.department}>{item.department}</span>
          {item.exception && (
            <span className="text-[10px] items-center gap-1 inline-flex font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 mt-1 rounded"><AlertTriangle size={10} /> {item.exception}</span>
          )}
        </div>
      </td>
      <td className="p-3 sticky bg-white group-hover:bg-slate-50 z-10 border-r border-app-border" style={{ left: '220px', minWidth: '140px' }}>
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-text-muted uppercase tracking-tighter truncate max-w-[130px]" title={item.category}>{item.category}</span>
          <div className="h-[1px] w-full bg-slate-200 my-1.5" />
          <span className="text-[11px] font-medium text-text-muted uppercase tracking-tighter truncate max-w-[130px]" title={item.class}>{item.class}</span>
        </div>
      </td>
      <td className="p-3 bg-blue-50/5 border-r border-app-border whitespace-nowrap">
        <div className="flex flex-col space-y-1">
          {kLogicSource === 'DAILY_MIS' ? (
            <>
              <div className="flex justify-between items-center gap-4">
                <span className="text-[11px] text-text-muted uppercase tracking-wider">MIS Atd:</span>
                <span className="text-[13px] font-bold text-primary-navy">{item.k_attendance}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-[11px] text-text-muted uppercase tracking-wider">Avg Rate:</span>
                <span className="text-[13px] font-bold text-blue-600">₹{item.k_attendance && item.k_attendance > 0 ? (item.k_gross_payable / item.k_attendance).toLocaleString(undefined, {maximumFractionDigits: 2}) : '0'}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-[11px] text-text-muted uppercase tracking-wider">MIS Gross:</span>
                <span className="text-[13px] font-bold text-primary-navy">₹{item.k_gross_payable?.toLocaleString()}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center gap-4">
                <span className="text-[11px] text-text-muted uppercase tracking-wider">Atd:</span>
                <span className="text-[13px] font-bold text-primary-navy">{item.k_attendance}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-[11px] text-text-muted uppercase tracking-wider">Rate:</span>
                <span className="text-[13px] font-bold text-blue-600">₹{item.wage_rate?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-[11px] text-text-muted uppercase tracking-wider">Gross:</span>
                <span className="text-[13px] font-bold text-primary-navy">₹{item.k_gross_payable?.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
      </td>
      {kOnlyHeads.map((h: any) => {
         const earnings = safeJsonParse(item.k_other_earnings || '{}');
         const deductions = safeJsonParse(item.k_deductions || '{}');
         const val = h.type === 'EARNING' ? earnings[h.name] : deductions[h.name];
         return (
           <td key={h.id} className="p-3 bg-blue-50/5 text-right whitespace-nowrap">
             <span className={cn("text-[13px] font-semibold", h.type === 'EARNING' ? "text-primary-navy" : "text-rose-600")}>
               {val ? `₹${val.toLocaleString()}` : '-'}
             </span>
           </td>
         );
      })}
      <td className="p-3 bg-amber-50/5 border-l border-r border-app-border whitespace-nowrap">
        {item.p_attendance !== undefined ? (
          <div className="flex flex-col space-y-1">
            <div className="flex justify-between items-center gap-4">
              <span className="text-[11px] text-text-muted uppercase tracking-wider">Atd:</span>
              <span className="text-[13px] font-bold text-primary-navy">{item.p_attendance}</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-[11px] text-text-muted uppercase tracking-wider">Rate:</span>
              <span className="text-[13px] font-bold text-amber-600">₹{item.statutory_rate?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-[11px] text-text-muted uppercase tracking-wider">Gross:</span>
              <span className="text-[13px] font-bold text-primary-navy">₹{item.p_gross_statutory_payable?.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <span className="text-[11px] italic text-text-muted">Sync pending...</span>
        )}
      </td>
      {kpHeads.map((h: any) => {
         const pOther = safeJsonParse(item.p_other_earnings_kp || '{}');
         const pDeductions = safeJsonParse(item.p_deductions || '{}');
         const val = h.type === 'EARNING' ? pOther[h.name] : pDeductions[h.name];
         return (
           <td key={h.id} className="p-3 bg-amber-50/5 text-right whitespace-nowrap">
             <span className={cn("text-[13px] font-semibold", h.type === 'EARNING' ? "text-amber-700" : "text-rose-600")}>
               {val ? `₹${val.toLocaleString()}` : '-'}
             </span>
           </td>
         );
      })}
      <td className="p-4 text-right bg-blue-50/10 border-l border-app-border whitespace-nowrap">
        <span className="text-sm font-bold text-blue-700">
          ₹{ (item.k_net_payable || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
        </span>
      </td>
      <td className="p-4 text-right bg-emerald-50/30 border-l border-app-border whitespace-nowrap">
        <span className="text-sm font-bold text-emerald-700">
          ₹{ (item.net_payable_final || item.k_net_payable || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
        </span>
      </td>
      <td className="p-4 text-right bg-rose-50/30 border-l border-app-border whitespace-nowrap">
        <span className={cn("text-sm font-black", (item.k_net_payable || 0) - (item.net_payable_final || item.k_net_payable || 0) !== 0 ? 'text-rose-600' : 'text-slate-400')}>
          ₹{ ((item.k_net_payable || 0) - (item.net_payable_final || item.k_net_payable || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
        </span>
      </td>
    </tr>
  );
});

export default function SalaryProcessing({ currentUser }: { currentUser: UserType | null }) {
  const { currentMode, setMode } = useModule();
  const [currentStep, setCurrentStep] = useState<PayrollStep>('Filtering');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const canExport = true;
  const canApprove = true;

  // Payroll Results State
  const [kResults, setKResults] = useState<any[]>([]);
  const [mergedResults, setMergedResults] = useState<any[]>([]);
  
  const [gridData, setGridData] = useState<any[]>([]);
  const [kOnlyHeads, setKOnlyHeads] = useState<any[]>([]);
  const [kpHeads, setKpHeads] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [selectedEmployeeSlip, setSelectedEmployeeSlip] = useState<any>(null);
  const limit = 50;

  // Search Debouncing
  useEffect(() => {
    if (searchQuery === debouncedSearch) {
      setIsDebouncing(false);
      return;
    }
    setIsDebouncing(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setIsDebouncing(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);
  
  const fetchGridData = async (step: PayrollStep, p: number, q: string) => {
    if (step === 'Filtering' || step === 'Consolidating') return;
    const type = step === 'K_Processing' ? 'K' : 'P';
    try {
      const res = await invoke<{data: any[], total: number}>('get_paginated_salary_results', {
        month: selectedMonth, type, page: p, limit, search: q
      });
      setGridData(res.data);
      setTotalRecords(res.total);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const finalPayroll = useFinalPayroll(selectedMonth, currentStep === 'Consolidating');

  useEffect(() => {
    if (currentStep === 'K_Processing' || currentStep === 'P_Syncing') {
      fetchGridData(currentStep, page, debouncedSearch);
    } else if (currentStep === 'Consolidating' && finalPayroll.data) {
      setGridData(finalPayroll.data);
      setTotalRecords(finalPayroll.data.length);
    }
  }, [currentStep, page, debouncedSearch, finalPayroll.data]);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [selectedDivisionIds, setSelectedDivisionIds] = useState<number[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedDesignationIds, setSelectedDesignationIds] = useState<number[]>([]);

  const [isCircuitBroken, setIsCircuitBroken] = useState(false);
  const [kLogicSource, setKLogicSource] = useState<string>('EMPLOYEE_MASTER');

  // Alt + Shift + K shortcut
  useHotkeys('alt+shift+k', () => {
    setIsCircuitBroken(prev => !prev);
    toast.info(isCircuitBroken ? "K->P Bridge: RECONNECTED" : "K->P Bridge: DISCONNECTED");
  });

  useEffect(() => {
    fetchFilters();
    fetchKOnlyHeads();
    fetchPayrollRules();
  }, [currentMode]);

  const fetchPayrollRules = async () => {
    try {
      const rules = await invoke<any>('get_payroll_rules');
      if (rules && rules.k_salary_calculation_source) {
        setKLogicSource(rules.k_salary_calculation_source);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchKOnlyHeads = async () => {
    try {
      const dbHeads = await invoke<any[]>('master_crud', { tableName: 'salary_heads', operation: 'list', moduleType: 'K' });
      // In the context of Excel, "K-only head" and "KP head" are distinct.
      setKOnlyHeads(dbHeads.filter(h => h.allocation_type === 'K' || h.allocation_type === 'K_ONLY'));
      setKpHeads(dbHeads.filter(h => h.allocation_type === 'KP'));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFilters = async () => {
    try {
      const [depts, locs, grps, divs, cls, cats, desigs] = await Promise.all([
        invoke<Department[]>('master_crud', { tableName: 'departments', operation: 'list', moduleType: currentMode }),
        invoke<Location[]>('master_crud', { tableName: 'locations', operation: 'list', moduleType: currentMode }),
        invoke<Group[]>('master_crud', { tableName: 'groups', operation: 'list', moduleType: currentMode }),
        invoke<Division[]>('master_crud', { tableName: 'divisions', operation: 'list', moduleType: currentMode }),
        invoke<any[]>('master_crud', { tableName: 'classes', operation: 'list', moduleType: currentMode }),
        invoke<any[]>('master_crud', { tableName: 'categories', operation: 'list', moduleType: currentMode }),
        invoke<any[]>('master_crud', { tableName: 'designations', operation: 'list', moduleType: currentMode }),
      ]);
      setDepartments(depts);
      setLocations(locs);
      setGroups(grps);
      setDivisions(divs);
      setClasses(cls);
      setCategories(cats);
      setDesignations(desigs);
    } catch (error) {
      console.error("Filter Fetch Error:", error);
    }
  };

  const handleProcessKModule = async () => {
    setLoading(true);
    try {
      const response = await invoke<any>('calculate_k_module_wages', {
        month: selectedMonth,
        filters: {
          departmentId: selectedDeptIds.length > 0 ? selectedDeptIds : null,
          locationId: selectedLocationIds.length > 0 ? selectedLocationIds : null,
          groupId: selectedGroupIds.length > 0 ? selectedGroupIds : null,
          divisionId: selectedDivisionIds.length > 0 ? selectedDivisionIds : null,
          classId: selectedClassIds.length > 0 ? selectedClassIds : null,
          categoryId: selectedCategoryIds.length > 0 ? selectedCategoryIds : null,
          designationId: selectedDesignationIds.length > 0 ? selectedDesignationIds : null,
        }
      });
      const rawData = Array.isArray(response) ? response : response.employees;
      const validData = rawData.filter((r: any) => !r.exception);
      const exceptionCount = rawData.length - validData.length;
      
      setKResults(validData);
      setCurrentStep('K_Processing');
      
      if (response && !Array.isArray(response) && response.meta) {
        toast.success(`K-Module Processing Complete: ${validData.length} valid / ${exceptionCount} exceptions. Engine: ${response.meta.active_salary_engine} in ${response.meta.total_time_ms}ms (Query: ${response.meta.query_time_ms}ms).`);
      } else {
        toast.success(`K-Module Processing Complete: ${validData.length} valid / ${exceptionCount} exceptions.`);
      }
    } catch (error: any) {
      toast.error("K-Module Error: " + (error.error || error.message || String(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToPModule = async () => {
    if (isCircuitBroken) {
      toast.error("Bridge is Disconnected (Circuit Breaker Active). Connect to sync.");
      return;
    }
    setLoading(true);
    try {
      const pData = await invoke<any[]>('calculate_p_module_statutory', {
        month: selectedMonth,
        kResults: kResults
      });
      setMergedResults(pData);
      setCurrentStep('P_Syncing');
      toast.success(`P-Module Sync & Reverse-Calc Complete.`);
    } catch (error: any) {
      toast.error("P-Module Error: " + (error.error || error.message || String(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleConsolidateFinal = async () => {
    setProcessing(true);
    try {
      await invoke('process_payroll', {
        month: selectedMonth
      });
      toast.success("Final Consolidation & Merge Successful!");
      setCurrentStep('Consolidating');
    } catch (error: any) {
      toast.error("Consolidation Error: " + (error.error || error.message || String(error)));
    } finally {
      setProcessing(false);
    }
  };

  const generateAuditExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Final Audit Payroll');

    const baseColumns = [
      { header: 'Employee Code', key: 'emp_code', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Class', key: 'class', width: 15 },
      { header: 'Location', key: 'location', width: 15 },
      { header: 'Division', key: 'division', width: 15 },
      { header: 'Group', key: 'group_name', width: 15 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Designation', key: 'designation', width: 15 },
      { header: 'Reporting Employee', key: 'reporting_name', width: 15 },
      { header: 'Salary Month-Year', key: 'month_year', width: 15 },
      { header: 'Working Day Type', key: 'working_day_type', width: 25 },
      { header: 'Wage Type', key: 'wage_type', width: 12 },
      { header: 'Wage Rate', key: 'wage_rate', width: 12 },
      { header: 'Working Days', key: 'working_days', width: 12 },
      { header: 'K Attendance', key: 'k_attendance', width: 15 },
      { header: 'K Gross Wage Earning', key: 'k_gross_wage', width: 15 },
    ];

    const kEarningHeads = kOnlyHeads.filter(h => h.type === 'EARNING');
    const dynamicKColumns = kEarningHeads.map(h => ({
      header: `K Earning - ${h.name}`,
      key: `k_earning_${h.id}`,
      width: 15
    }));

    const middleColumns1 = [
      { header: 'K Gross Payable', key: 'k_gross_payable', width: 15 },
    ];

    const kDeductionHeads = kOnlyHeads.filter(h => h.type === 'DEDUCTION');
    const dynamicKDeductionsColumns = kDeductionHeads.map(h => ({
      header: `K Deduction - ${h.name}`,
      key: `k_deduction_${h.id}`,
      width: 15
    }));

    const middleColumns2 = [
      { header: 'Total Earned / P Module Target', key: 'k_net_payable', width: 15 },
      { header: 'Statutory Rate', key: 'statutory_rate', width: 15 },
    ];

    const ctcHeads = kpHeads.filter(h => h.is_part_of_ctc === 1);

    const dynamicHeadWiseRates = ctcHeads.map(h => ({
      header: `Head Rate - ${h.name}`,
      key: `head_rate_${h.id}`,
      width: 15
    }));

    const middleColumns3 = [
      { header: 'Statutory Working Days', key: 'p_working_days', width: 15 },
      { header: 'Statutory Attendance', key: 'p_attendance', width: 15 },
      { header: 'P Gross Wage Earning', key: 'p_gross_wage', width: 15 },
    ];

    const dynamicPCtcHeadsColumns = ctcHeads.map(h => ({
      header: `P Head wise earning - ${h.name}`,
      key: `p_ctc_${h.id}`,
      width: 15
    }));

    const dynamicPOtherEarningsColumns = kpHeads.filter(h => h.type === 'EARNING' && h.is_part_of_ctc === 0).map(h => ({
      header: `P Other Earning (KP) - ${h.name}`,
      key: `p_other_earning_kp_${h.id}`,
      width: 15
    }));

    const middleColumns4 = [
      { header: 'P Gross Statutory Payable', key: 'p_gross_statutory_payable', width: 20 },
    ];

    const dynamicPDeductionsColumns = kpHeads.filter(h => h.type === 'DEDUCTION').map(h => ({
      header: `P Deduction (KP) - ${h.name}`,
      key: `p_deduction_kp_${h.id}`,
      width: 15
    }));

    const endColumns = [
      { header: 'Net Payable', key: 'net_payable_final', width: 15 },
      { header: 'Cash Salary', key: 'cash_salary', width: 15 },
      { header: 'Bank Salary', key: 'bank_salary', width: 15 },
      { header: 'Diff (A - B)', key: 'variance_diff', width: 15 },
      { header: 'Payment Mode', key: 'payment_mode', width: 15 },
      { header: 'IFSC Code', key: 'ifsc', width: 15 },
      { header: 'Bank Name', key: 'bank_name', width: 20 },
      { header: 'Bank Account Number', key: 'account_no', width: 20 },
    ];

    worksheet.columns = [
      ...baseColumns,
      ...dynamicKColumns,
      ...middleColumns1,
      ...dynamicKDeductionsColumns,
      ...middleColumns2,
      ...dynamicHeadWiseRates,
      ...middleColumns3,
      ...dynamicPCtcHeadsColumns,
      ...dynamicPOtherEarningsColumns,
      ...middleColumns4,
      ...dynamicPDeductionsColumns,
      ...endColumns
    ];

    mergedResults.forEach(r => {
      const kEarnings = safeJsonParse(r.k_other_earnings || '{}');
      const kDeductions = safeJsonParse(r.k_deductions || '{}');
      const pOther = safeJsonParse(r.p_other_earnings_kp || '{}');
      const pDeductionsMap = safeJsonParse(r.p_deductions || '{}');
      const pCtcHeadsMap = safeJsonParse(r.p_ctc_heads || '{}');
      const headWiseMap = safeJsonParse(r.head_wise_rates || '{}');

      const row: any = { ...r };

      if (kLogicSource === 'DAILY_MIS') {
        row.wage_rate = r.k_attendance && r.k_attendance > 0 ? Number((r.k_gross_wage / r.k_attendance).toFixed(2)) : 0;
      }
      row.salary_source_engine = kLogicSource;

      // K Earnings (K_ONLY)
      kEarningHeads.forEach(h => { row[`k_earning_${h.id}`] = kEarnings[h.name] || 0; });
      // K Deductions (K_ONLY)
      kDeductionHeads.forEach(h => { row[`k_deduction_${h.id}`] = kDeductions[h.name] || 0; });

      // Head-wise Rates
      ctcHeads.forEach(h => {
        row[`head_rate_${h.id}`] = headWiseMap[h.name] || 0;
      });

      // CTC Earnings
      ctcHeads.forEach(h => {
        row[`p_ctc_${h.id}`] = pCtcHeadsMap[h.name] || 0;
      });

      // P Other Earnings (KP)
      kpHeads.filter(h => h.type === 'EARNING' && h.is_part_of_ctc === 0).forEach(h => {
        // Read from pOther first (which may contain adjustments), fallback to kEarnings if just syncing
        row[`p_other_earning_kp_${h.id}`] = pOther[h.name] || kEarnings[h.name] || 0; 
      });

      // P Deductions (KP)
      kpHeads.filter(h => h.type === 'DEDUCTION').forEach(h => {
        row[`p_deduction_kp_${h.id}`] = pDeductionsMap[h.name] || kDeductions[h.name] || 0;
      });

      // Reconciliation & Variance
      const net_final = row.net_payable_final || row.k_net_payable || 0;
      row.variance_diff = (row.k_net_payable || 0) - net_final;
      if (row.payment_mode && row.payment_mode.toLowerCase().includes('bank')) {
         row.bank_salary = net_final;
         row.cash_salary = 0;
      } else {
         row.cash_salary = net_final;
         row.bank_salary = 0;
      }      

      worksheet.addRow(row);
    });

    // Formatting
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `HRUDAN_Final_Payroll_Export_${selectedMonth}.xlsx`);
    toast.success("Final Payroll Audit Export Generated successfully");
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8 px-4 py-2 bg-slate-50 rounded-xl border border-app-border overflow-x-auto">
      {[
        { id: 'Filtering', label: '1. Filter', icon: <Filter size={14} /> },
        { id: 'K_Processing', label: '2. K-Module (Shadow)', icon: <Zap size={14} /> },
        { id: 'P_Syncing', label: '3. P-Module (Statutory)', icon: <Calculator size={14} /> },
        { id: 'Consolidating', label: '4. Final Post', icon: <CheckCircle2 size={14} /> }
      ].map((step, idx, arr) => (
        <React.Fragment key={step.id}>
          <div className={`flex items-center gap-2 ${currentStep === step.id ? 'text-primary-navy' : 'text-text-muted'}`}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all whitespace-nowrap",
              currentStep === step.id ? "border-primary-navy bg-primary-navy text-white" : "border-app-border bg-white text-text-muted"
            )}>
              {step.icon}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest hidden sm:inline ${currentStep === step.id ? 'opacity-100' : 'opacity-40'}`}>{step.label}</span>
          </div>
          {idx < arr.length - 1 && <ChevronRight size={14} className="text-app-border mx-2" />}
        </React.Fragment>
      ))}
    </div>
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: gridData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140, // Estimated height per row
    overscan: 5,
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-app-border shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-primary-navy tracking-tight">Salary Processing</h2>
          <p className="text-text-muted text-sm font-bold uppercase tracking-tight flex items-center gap-2">
            Dual-Module Workflow Engine <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-primary-navy">K ↔ P Bridge</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsCircuitBroken(!isCircuitBroken)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all border",
              isCircuitBroken ? "bg-red-50 text-red-600 border-red-100 shadow-inner" : "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm"
            )}
            title="Alt+Shift+K to toggle bridge"
          >
            <Zap size={14} className={isCircuitBroken ? "fill-red-600" : "fill-emerald-600"} />
            {isCircuitBroken ? 'Bridge: Broken' : 'Bridge: Connected'}
          </button>
          {currentStep !== 'Filtering' && (
            <button 
              onClick={() => {
                setCurrentStep('Filtering');
                setKResults([]);
                setMergedResults([]);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-text-muted rounded-lg font-bold text-[10px] uppercase hover:bg-slate-200 transition-all"
            >
              <RefreshCw size={14} /> Reset
            </button>
          )}
        </div>
      </div>

      {renderStepIndicator()}

      {currentStep === 'Filtering' && (
        <div className="space-y-6 bg-white p-8 rounded-xl border border-app-border shadow-sm animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Processing Month</label>
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-app-border rounded-lg text-sm font-bold text-primary-navy"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-app-border space-y-4">
            <div className="flex items-center gap-2 text-text-muted">
              <Filter size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Advanced Filters</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
              <MultiSearchableSelect 
                label="Location" 
                options={locations.map(l => ({ value: l.id.toString(), label: l.name }))} 
                value={selectedLocationIds.map(id => id.toString())}
                onChange={(val) => setSelectedLocationIds(val.map(id => parseInt(id)))}
              />
              <MultiSearchableSelect 
                label="Division" 
                options={divisions.map(d => ({ value: d.id.toString(), label: d.name }))} 
                value={selectedDivisionIds.map(id => id.toString())}
                onChange={(val) => setSelectedDivisionIds(val.map(id => parseInt(id)))}
              />
              <MultiSearchableSelect 
                label="Class" 
                options={classes.map(c => ({ value: c.id.toString(), label: c.name }))} 
                value={selectedClassIds.map(id => id.toString())}
                onChange={(val) => setSelectedClassIds(val.map(id => parseInt(id)))}
              />
              <MultiSearchableSelect 
                label="Category" 
                options={categories.map(c => ({ value: c.id.toString(), label: c.name }))} 
                value={selectedCategoryIds.map(id => id.toString())}
                onChange={(val) => setSelectedCategoryIds(val.map(id => parseInt(id)))}
              />
              <MultiSearchableSelect 
                label="Group" 
                options={groups.map(g => ({ value: g.id.toString(), label: g.name }))} 
                value={selectedGroupIds.map(id => id.toString())}
                onChange={(val) => setSelectedGroupIds(val.map(id => parseInt(id)))}
              />
              <MultiSearchableSelect 
                label="Department" 
                options={departments.map(d => ({ value: d.id.toString(), label: d.name }))} 
                value={selectedDeptIds.map(id => id.toString())}
                onChange={(val) => setSelectedDeptIds(val.map(id => parseInt(id)))}
              />
              <MultiSearchableSelect 
                label="Designation" 
                options={designations.map(d => ({ value: d.id.toString(), label: d.name }))} 
                value={selectedDesignationIds.map(id => id.toString())}
                onChange={(val) => setSelectedDesignationIds(val.map(id => parseInt(id)))}
              />
            </div>
          </div>

          <div className="flex justify-center pt-8">
            <button 
              onClick={handleProcessKModule}
              disabled={loading}
              className="flex items-center gap-3 px-8 py-4 bg-primary-navy text-white rounded-xl font-black text-lg hover:bg-opacity-90 transition-all shadow-xl shadow-primary-navy/20 disabled:opacity-50 group"
            >
              {loading ? <RefreshCw className="animate-spin" /> : <Zap className="group-hover:scale-110 transition-transform" /> }
              Process K-Module Wages
            </button>
          </div>
        </div>
      )}

      {(currentStep === 'K_Processing' || currentStep === 'P_Syncing' || currentStep === 'Consolidating') && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex justify-between items-center p-4 bg-primary-navy text-white rounded-xl shadow-lg">
            <div className="flex gap-4 items-center">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Status: {currentStep.replace('_', ' ')}</span>
              <div className="h-4 w-[1px] bg-white/20" />
              <span className="text-[10px] font-black uppercase tracking-widest">{currentStep === 'K_Processing' ? 'K-Only Shadow Ledger' : 'Consolidated Audit Results'}</span>
            </div>
            <div className="flex gap-2">
              {currentStep === 'K_Processing' && (
                <>
                  <button 
                    onClick={handleProcessKModule}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600/30 text-white border border-blue-400/30 rounded-lg font-black text-[10px] uppercase shadow-md hover:bg-blue-600/50 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Retry Processing
                  </button>
                  <a
                    href="/transactions/payroll-exceptions"
                    target="_blank"
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600/30 text-white border border-rose-400/30 rounded-lg font-black text-[10px] uppercase shadow-md hover:bg-rose-600/50"
                  >
                    <AlertTriangle size={14} /> View Exceptions
                  </a>
                  <button 
                    onClick={handleSyncToPModule}
                    disabled={loading || isCircuitBroken}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-primary-navy rounded-lg font-black text-[10px] uppercase shadow-md hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ArrowRightLeft size={14} /> Sync to P-Module
                  </button>
                </>
              )}
              {currentStep === 'P_Syncing' && (
                <>
                  {canExport && <button 
                    onClick={generateAuditExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-black text-[10px] uppercase shadow-md hover:bg-blue-200"
                  >
                    <FileSpreadsheet size={14} /> 1. Generate Audit Excel
                  </button>}
                  {canApprove && <button 
                    onClick={handleConsolidateFinal}
                    disabled={processing}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-black text-[10px] uppercase shadow-md hover:bg-emerald-600"
                  >
                    <Save size={14} /> 2. Post to Final Payroll
                  </button>}
                </>
              )}
              {currentStep === 'Consolidating' && (
                <span className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg font-black text-[10px] uppercase shadow-md">
                  <CheckCircle2 size={14} /> Payroll Posted successfully
                </span>
              )}
            </div>
          </div>

          {/* Audit Table */}
          <div className="bg-white rounded-xl border border-app-border shadow-sm overflow-hidden">
            {/* Table Controls */}
            <div className="p-4 border-b border-app-border flex justify-between items-center bg-slate-50">
               <div className="relative w-64">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                 <input 
                   type="text" 
                   value={searchQuery}
                   onChange={(e) => {
                     setSearchQuery(e.target.value);
                     setPage(1);
                   }}
                   placeholder="Search by Code, Name, or Department..."
                   className="w-full pl-9 pr-10 py-2 text-sm bg-white border border-app-border rounded-lg outline-none focus:border-primary-navy transition-all"
                 />
                 {isDebouncing && (
                   <div className="absolute right-3 top-1/2 -translate-y-1/2">
                     <RefreshCw size={14} className="animate-spin text-text-muted" />
                   </div>
                 )}
               </div>
               <div className="flex items-center gap-4 text-sm text-text-muted">
                 <span>Showing {totalRecords === 0 ? 0 : ((page - 1) * limit) + 1} to {Math.min(page * limit, totalRecords)} of {totalRecords}</span>
                 <div className="flex gap-1">
                   <button 
                     onClick={() => setPage(p => Math.max(1, p - 1))}
                     disabled={page === 1}
                     className="p-1 rounded hover:bg-slate-200 disabled:opacity-50"
                   >
                     <ChevronLeft size={18} />
                   </button>
                   <button 
                     onClick={() => setPage(p => p + 1)}
                     disabled={page * limit >= totalRecords}
                     className="p-1 rounded hover:bg-slate-200 disabled:opacity-50"
                   >
                     <ChevronRight size={18} />
                   </button>
                 </div>
               </div>
            </div>
            
            <div className="overflow-x-auto max-h-[60vh]" ref={parentRef}>
              <table className="w-full text-left border-collapse table-auto min-w-[2500px]">
                <thead className="sticky top-0 z-30">
                  <tr className="border-b-2 border-app-border bg-slate-50">
                    <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest sticky left-0 bg-slate-50 z-40 border-r border-app-border shadow-[1px_0_0_0_#e2e8f0]" style={{ minWidth: '220px' }}>Employee Info</th>
                    <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest sticky z-40 bg-slate-50 border-r border-app-border shadow-[1px_0_0_0_#e2e8f0]" style={{ left: '220px', minWidth: '140px' }}>Details</th>
                    
                    <th className="p-3 text-[10px] font-black text-blue-700 uppercase tracking-widest bg-blue-50/90 backdrop-blur border-r border-app-border min-w-[160px] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Zap size={14} className="text-blue-500" />
                        K Logic (Shadow)
                      </div>
                    </th>
                    {kOnlyHeads.map(h => (
                      <th key={h.id} className="p-3 text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50/90 backdrop-blur min-w-[120px] whitespace-nowrap text-right">{h.name}</th>
                    ))}
                    
                    <th className="p-3 text-[10px] font-black text-amber-700 uppercase tracking-widest bg-amber-50/90 backdrop-blur border-l border-r border-app-border min-w-[160px] whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calculator size={14} className="text-amber-500" />
                        P Logic (Statutory)
                        {!isCircuitBroken && (
                           <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] flex items-center gap-1">
                             <CheckCircle2 size={10} /> SYNC ACTIVE
                           </span>
                        )}
                        {isCircuitBroken && (
                           <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] flex items-center gap-1">
                             <Lock size={10} /> OFFLINE
                           </span>
                        )}
                      </div>
                    </th>
                    {kpHeads.map(h => (
                      <th key={h.id} className="p-3 text-[10px] font-bold text-amber-700 uppercase tracking-widest bg-amber-50/90 backdrop-blur min-w-[120px] whitespace-nowrap text-right">P {h.name}</th>
                    ))}
                    
                    <th className="p-4 text-[11px] font-black text-blue-700 uppercase tracking-widest bg-blue-50 text-right border-l border-app-border whitespace-nowrap">Net (Act)</th>
                    <th className="p-4 text-[11px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-50 text-right border-l border-app-border whitespace-nowrap">Net (Stat)</th>
                    <th className="p-4 text-[11px] font-black text-rose-700 uppercase tracking-widest bg-rose-50 text-right border-l border-app-border whitespace-nowrap">Diff (A-B)</th>
                  </tr>
                </thead>
                <tbody>
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start || 0}px` }} />
                  )}
                  {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const item = gridData[virtualRow.index];
                    return (
                      <EmployeeTableRow 
                        key={item.emp_id} 
                        item={item} 
                        kLogicSource={kLogicSource} 
                        kOnlyHeads={kOnlyHeads} 
                        kpHeads={kpHeads} 
                        setSelectedEmployeeSlip={setSelectedEmployeeSlip} 
                        virtualRow={virtualRow} 
                        measureElement={rowVirtualizer.measureElement} 
                      />
                    );
                  })}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end || 0)}px` }} />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Read Only Salary Slip Modal */}
      {selectedEmployeeSlip && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-app-border w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-app-border p-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-black">
                  {selectedEmployeeSlip.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-black text-primary-navy tracking-tight">{selectedEmployeeSlip.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-200 text-slate-700">{selectedEmployeeSlip.emp_code}</span>
                    <span className="text-[11px] font-bold uppercase text-text-muted">{selectedEmployeeSlip.department}</span>
                    <span className="text-[11px] font-semibold text-text-muted">| {selectedEmployeeSlip.category} • {selectedEmployeeSlip.class}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEmployeeSlip(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-text-muted transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-2 gap-8">
              
              {/* Left Side: K LOGIC */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
                  <div className="bg-blue-100 p-1.5 rounded-lg">
                    <Zap size={16} className="text-blue-600" />
                  </div>
                  <h4 className="text-sm font-black text-blue-700 tracking-widest uppercase">K Logic (Actuals)</h4>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  {kLogicSource === 'DAILY_MIS' ? (
                    <>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">MIS Attendance</p>
                        <p className="text-xl font-black text-primary-navy">{selectedEmployeeSlip.k_attendance}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Avg Rate</p>
                        <p className="text-xl font-black text-blue-600">₹{selectedEmployeeSlip.k_attendance && selectedEmployeeSlip.k_attendance > 0 ? (selectedEmployeeSlip.k_gross_payable / selectedEmployeeSlip.k_attendance).toLocaleString(undefined, {maximumFractionDigits: 2}) : '0'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Attendance</p>
                        <p className="text-xl font-black text-primary-navy">{selectedEmployeeSlip.k_attendance}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Wage Rate</p>
                        <p className="text-xl font-black text-blue-600">₹{selectedEmployeeSlip.wage_rate?.toLocaleString()}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <h5 className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-3 border-b border-slate-100 pb-1">Earnings</h5>
                    <div className="space-y-2.5">
                       {kOnlyHeads.filter(h => h.type === 'EARNING').map(h => {
                         const val = safeJsonParse(selectedEmployeeSlip.k_other_earnings || '{}')[h.name] || 0;
                         if (!val) return null;
                         return (
                           <div key={h.id} className="flex justify-between items-center text-sm">
                             <span className="text-text-muted font-medium">{h.name}</span>
                             <span className="font-bold text-primary-navy">₹{val.toLocaleString()}</span>
                           </div>
                         );
                       })}
                       <div className="flex justify-between items-center text-sm pt-3 mt-2 border-t border-slate-200">
                         <span className="text-[11px] uppercase font-black tracking-wider text-text-muted">Gross Amount</span>
                         <span className="text-lg font-black text-primary-navy">₹{selectedEmployeeSlip.k_gross_payable?.toLocaleString()}</span>
                       </div>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-3 border-b border-slate-100 pb-1">Deductions</h5>
                    <div className="space-y-2.5">
                       {kOnlyHeads.filter(h => h.type === 'DEDUCTION').map(h => {
                         const val = safeJsonParse(selectedEmployeeSlip.k_deductions || '{}')[h.name] || 0;
                         if (!val) return null;
                         return (
                           <div key={h.id} className="flex justify-between items-center text-sm">
                             <span className="text-text-muted font-medium">{h.name}</span>
                             <span className="font-bold text-rose-600">₹{val.toLocaleString()}</span>
                           </div>
                         );
                       })}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t-2 border-dashed border-slate-200 flex flex-col items-end">
                  <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1">Target Net (K)</p>
                  <p className="text-3xl font-black text-blue-700">₹{selectedEmployeeSlip.k_net_payable?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Right Side: P LOGIC */}
              <div className="space-y-6 relative">
                {/* Visual Separator between panels */}
                <div className="absolute -left-4 top-0 bottom-0 w-px bg-slate-200 hidden lg:block" />

                <div className="flex items-center gap-2 pb-2 border-b border-amber-100">
                  <div className="bg-amber-100 p-1.5 rounded-lg">
                    <Calculator size={16} className="text-amber-600" />
                  </div>
                  <h4 className="text-sm font-black text-amber-700 tracking-widest uppercase">P Logic (Statutory)</h4>
                  {isCircuitBroken && (
                    <span className="ml-auto px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] flex items-center gap-1 font-bold tracking-wider">
                      <Lock size={10} /> OFFLINE
                    </span>
                  )}
                  {!isCircuitBroken && (
                    <span className="ml-auto px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] flex items-center gap-1 font-bold tracking-wider">
                      <CheckCircle2 size={10} /> SYNC ACTIVE
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 bg-amber-50/70 p-4 rounded-xl border border-amber-100/60">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Statutory Atd</p>
                    <p className="text-xl font-black text-primary-navy">{selectedEmployeeSlip.p_attendance}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Stat Rate</p>
                    <p className="text-xl font-black text-amber-600">₹{selectedEmployeeSlip.statutory_rate?.toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h5 className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-3 border-b border-slate-100 pb-1">Earnings</h5>
                    <div className="space-y-2.5">
                       {kpHeads.filter(h => h.type === 'EARNING').map(h => {
                         const pOther = safeJsonParse(selectedEmployeeSlip.p_other_earnings_kp || '{}');
                         const pCtc = safeJsonParse(selectedEmployeeSlip.p_ctc_heads || '{}');
                         const kOther = safeJsonParse(selectedEmployeeSlip.k_other_earnings || '{}');
                         const val = pOther[h.name] || pCtc[h.name] || kOther[h.name] || 0;
                         if (!val) return null;
                         return (
                           <div key={h.id} className="flex justify-between items-center text-sm">
                             <span className="text-text-muted font-medium">{h.name}</span>
                             <span className="font-bold text-amber-700">₹{val.toLocaleString()}</span>
                           </div>
                         );
                       })}
                       <div className="flex justify-between items-center text-sm pt-3 mt-2 border-t border-slate-200">
                         <span className="text-[11px] uppercase font-black tracking-wider text-text-muted">Statutory Gross</span>
                         <span className="text-lg font-black text-primary-navy">₹{selectedEmployeeSlip.p_gross_statutory_payable?.toLocaleString()}</span>
                       </div>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-3 border-b border-slate-100 pb-1">Deductions</h5>
                    <div className="space-y-2.5">
                       {kpHeads.filter(h => h.type === 'DEDUCTION').map(h => {
                         const pDeductions = safeJsonParse(selectedEmployeeSlip.p_deductions || '{}');
                         const kDeductions = safeJsonParse(selectedEmployeeSlip.k_deductions || '{}');
                         const val = pDeductions[h.name] || kDeductions[h.name] || 0;
                         if (!val) return null;
                         return (
                           <div key={h.id} className="flex justify-between items-center text-sm">
                             <span className="text-text-muted font-medium">{h.name}</span>
                             <span className="font-bold text-rose-600">₹{val.toLocaleString()}</span>
                           </div>
                         );
                       })}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t-2 border-dashed border-slate-200 flex flex-col items-end">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold mb-1">Final Net Payable</p>
                  <p className="text-3xl font-black text-emerald-600">₹{(selectedEmployeeSlip.net_payable_final || selectedEmployeeSlip.k_net_payable || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-app-border p-4 px-6 flex justify-between items-center">
               <span className="text-xs font-medium text-text-muted flex items-center gap-2">
                 <ShieldCheck size={14} className="text-slate-400" />
                 Generated by HR-UDAN Statutory Engine
               </span>
               <button 
                 onClick={() => setSelectedEmployeeSlip(null)}
                 className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg text-sm transition-colors shadow-sm"
               >
                 Close Overview
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
