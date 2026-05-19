import React, { useState, useEffect, useMemo } from 'react';
import { invokeCommand } from '../../services/apiClient';

// Identity mapping for paths in web mode
const safeConvertFileSrc = (path: string) => {
  if (!path) return '';
  try {
    return path;
  } catch (e) {
    return path;
  }
};

import * as Tabs from '@radix-ui/react-tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { 
  UserCircle, 
  Save, 
  Loader2,
  X,
  MapPin,
  CheckCircle2,
  BookOpen,
  Info,
  Building2,
  FileText,
  History,
  Wallet,
  Users,
  Plus,
  Trash2,
  Upload,
  Search,
  ChevronDown,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Calculator,
  Layers,
  ShieldX
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { usePermission } from '../../hooks/useRBAC';
import { twMerge } from 'tailwind-merge';
import PincodeSearch from '../../components/form/PincodeSearch';
import EmployeeTable from '../../components/table/EmployeeTable';
import { EmployeeSearchSelect } from '../../components/form/EmployeeSearchSelect';
import SecurityLockModal from '../../components/common/SecurityLockModal';
import MinorWarningModal from '../../components/common/MinorWarningModal';
import BulkEmployeeUpload from '../../components/form/BulkEmployeeUpload';
import WaterfallHierarchy from '../../components/table/WaterfallHierarchy';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { User as UserType, Employee } from '../../types';
import { useModule } from '../../contexts/ModuleContext';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useRegisterShortcut } from '../../components/common/ShortcutProvider';
import { motion, AnimatePresence } from 'motion/react';
import { SearchableSelect, MultiSearchableSelect } from '../../components/common/SearchableSelect';

import { EmployeeFormProvider } from './EmployeeFormContext';
import GeneralTab from './components/GeneralTab';
import EmploymentTab from './components/EmploymentTab';
import WagesTab from './components/WagesTab';
import DocsTab from './components/DocsTab';
import HistoryTab from './components/HistoryTab';
import { employeeSchema, type EmployeeData, type SelectOption, type SlabComponent, type SalarySlab, type SalaryHead } from './types';

const processEmployeeList = (emps: any[]) => {
  const processedEmps = (Array.isArray(emps) ? emps : []).map((e: any) => ({
    ...e,
    name: e.name || [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') || 'N/A'
  }));
  return processedEmps;
};

export default function EmployeeMaster({ currentUser }: { currentUser: UserType | null }) {
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const { currentMode } = useModule();
  const [isLoading, setIsLoading] = useState(false);
  const [waterfallData, setWaterfallData] = useState<{ children: any[], logs: any[], totalPool: number, residual: number } | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMinorWarningOpen, setIsMinorWarningOpen] = useState(false);
  const [minorConfirmed, setMinorConfirmed] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<number | null>(null);
  const [employeesToDelete, setEmployeesToDelete] = useState<number[]>([]);
  const [isManualCodeAllowed, setIsManualCodeAllowed] = useState(true);
  const [isPermPincodeVerified, setIsPermPincodeVerified] = useState(false);
  const [isCurrentPincodeVerified, setIsCurrentPincodeVerified] = useState(false);
  const [currentPincodeResults, setCurrentPincodeResults] = useState<any[]>([]);
  const [permPincodeResults, setPermPincodeResults] = useState<any[]>([]);
  const [isCurrentManualEntry, setIsCurrentManualEntry] = useState(false);
  const [isPermManualEntry, setIsPermManualEntry] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<{
    name: string, 
    role: string, 
    dob: string, 
    aadhar_no: string, 
    mobile: string, 
    is_nominee: boolean,
    nominee_share_percent?: number,
    guardian_name?: string
  }[]>([]);
  const [employmentHistory, setEmploymentHistory] = useState<{
    company: string, 
    role: string, 
    duration_from: string, 
    duration_to: string,
    last_salary: string
  }[]>([]);
  const [bankHistory, setBankHistory] = useState<{
    ifsc_code: string,
    bank_name: string,
    account_no: string,
    as_per_bank_name: string,
    bank_effective_date: string
  }[]>([]);
  const [pfHistory, setPfHistory] = useState<{
    pf_number: string,
    pf_joining_date: string,
    pf_exit_date?: string,
    pf_exit_reason?: string
  }[]>([]);
  const [esiHistory, setEsiHistory] = useState<{
    esi_ip_number: string,
    esi_joining_date: string
  }[]>([]);

  const [salarySlabs, setSalarySlabs] = useState<SalarySlab[]>([]);
  const [salaryHeads, setSalaryHeads] = useState<SalaryHead[]>([]);
  const [syncEmployee, setSyncEmployee] = useState<any | null>(null);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [syncSlabId, setSyncSlabId] = useState<string>('');
  const [syncWageAmount, setSyncWageAmount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [workingDayTypes, setWorkingDayTypes] = useState<{id: number, name: string}[]>([]);
  const [classes, setClasses] = useState<{id: number, name: string, status: number}[]>([]);
  const [categories, setCategories] = useState<{id: number, name: string, status: number}[]>([]);
  const [locations, setLocations] = useState<{id: number, name: string, status: number}[]>([]);
  const [divisions, setDivisions] = useState<{id: number, name: string, status: number, location_id: number}[]>([]);
  const [groups, setGroups] = useState<{id: number, name: string}[]>([]);
  const [departments, setDepartments] = useState<{id: number, name: string, group_id: number}[]>([]);
  const [shifts, setShifts] = useState<{id: number, name: string}[]>([]);
  const [designations, setDesignations] = useState<{id: number, name: string, status: number}[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<{id: number, name: string}[]>([]);
  const [employeeStatuses, setEmployeeStatuses] = useState<{id: number, name: string}[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentStdRate, setCurrentStdRate] = useState<number | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const lastFetchedModeRef = React.useRef(currentMode);
  const [isExitDateLocked, setIsExitDateLocked] = useState(false);
  const [isRevisionHistoryOpen, setIsRevisionHistoryOpen] = useState(false);
  const [revisionHistory, setRevisionHistory] = useState<any[]>([]);
  const [isRevisionRecordOpen, setIsRevisionRecordOpen] = useState(false);
  const [revisionData, setRevisionData] = useState({
    newRate: 0,
    effectiveDate: '',
    revisionType: 'Annual',
    remarks: ''
  });

  const fetchRevisionHistory = async (empId: number) => {
    try {
      const history = await invokeCommand<any[]>('get_salary_revision_history', { empId, moduleType: currentMode });
      setRevisionHistory(history);
    } catch (err) {
      console.error("Failed to fetch revision history", err);
    }
  };

  const handleRecordRevision = async () => {
    if (!selectedEmployeeId) return;
    try {
      setIsLoading(true);
      await invokeCommand('record_salary_revision', {
        empId: parseInt(selectedEmployeeId),
        newRate: revisionData.newRate,
        effectiveDate: revisionData.effectiveDate,
        revisionType: revisionData.revisionType,
        remarks: revisionData.remarks,
        moduleType: currentMode
      });
      toast.success("Salary revision recorded successfully");
      setIsRevisionRecordOpen(false);
      fetchEmployees();
      fetchRevisionHistory(parseInt(selectedEmployeeId));
    } catch (error: any) {
      toast.error("Failed to record revision", { description: error?.message || error });
    } finally {
      setIsLoading(false);
    }
  };
  const [weeklyOffSource, setWeeklyOffSource] = useState<'Global' | 'Employee'>('Global');

  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const signatureInputRef = React.useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [isIfscSearching, setIsIfscSearching] = useState(false);

  // New RBAC hooks
  const canCreate = usePermission('EmployeeMaster.create');
  const canEdit = usePermission('EmployeeMaster.edit');
  const canDelete = usePermission('EmployeeMaster.delete');
  const canExport = usePermission('EmployeeMaster.export');

  useRegisterShortcut({ key: 'alt+n', description: 'Add New Employee' });
  useHotkeys('alt+n', (e) => {
    if (canCreate || canEdit) {
      e.preventDefault();
      handleAddNew();
      toast.info("Command Executed: Opening New Employee Form", {
        className: "font-mono text-[10px] uppercase tracking-widest border-primary-navy/20 bg-white/80 backdrop-blur-md"
      });
    }
  }, { globalOverride: true });

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  const form = useForm<EmployeeData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      emp_code: '',
      biometric_id: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      full_name_aadhar: '',
      father_husband_guardian_name: '',
      gender: 'Male',
      marital_status: 'Unmarried',
      dob: '',
      religion: 'Hindu',
      blood_group: '',
      qualification: 'Graduate',
      is_differently_abled: false,
      disability_type: [],
      referenced_by: '',
      mobile: '',
      mobile2: '',
      email: '',
      cug_mobile: '',
      current_address: '',
      current_pincode: '',
      current_post_office: '',
      current_district: '',
      current_state: '',
      is_perm_same_as_current: false,
      perm_address: '',
      perm_pincode: '',
      perm_post_office: '',
      perm_district: '',
      perm_state: '',
      working_day_type_id: '',
      class_id: '',
      category_id: '',
      location_id: '',
      division_id: '',
      shift_id: '',
      group_id: '',
      department_id: '',
      designation: '',
      joining_date: '',
      employment_type: 'Permanent',
      aadhar_no: '',
      pan_no: '',
      driving_licence: '',
      passport_no: '',
      voter_id: '',
      uan_no: '',
      pf_number: '',
      pf_joining_date: '',
      pf_exit_date: '',
      pf_exit_reason: '',
      eps_exempt: false,
      is_fte_contract: false,
      designation_id: '',
      employment_type_id: '',
      esi_ip_number: '',
      esi_joining_date: '',
      voluntary_pf_applicable: false,
      voluntary_pf_type: 'Percentage',
      voluntary_pf_value: 0,
      payment_mode: 'Bank Transfer',
      ifsc_code: '',
      bank_name: '',
      account_no: '',
      as_per_bank_name: '',
      bank_effective_date: '',
      employee_status: 'Active',
      book_joining_date: '',
      leaving_date: '',
      reporting_employee_id: '',
      wage_type: 'Monthly',
      wage_amount: 0,
      wage_effective_from: '',
      weekly_off: '',
      weekly_off_effective_date: '',
      parent_employee_id: '',
      salary_process_sequence: 0,
      basic_salary: 0,
      hra: 0,
      conveyance: 0,
      special_allowance: 0,
      is_pf_covered: true,
      is_esi_covered: true,
      blacklist_status: false,
      blacklist_remarks: '',
      blacklist_effective_date: '',
      blacklist_authorizer_id: null,
      blacklist_authorizer_name: '',
      slab_id: '',
      hasChildren: false,
    }
  });

  const { register, handleSubmit, setValue, watch, getValues, formState: { errors }, reset, control, trigger, clearErrors, setError, getFieldState, setFocus } = form;

  const statutoryCTC = watch('wage_amount');
  const selectedSlabId = watch('slab_id');

  const bifurcationData = useMemo(() => {
    if (currentMode !== 'P' || !selectedSlabId || !statutoryCTC) return [];

    const slab = salarySlabs.find(s => s.id.toString() === selectedSlabId);
    if (!slab) return [];

    let components: SlabComponent[] = [];
    try {
      components = typeof slab.components === 'string' ? JSON.parse(slab.components) : slab.components;
    } catch (e) {
      console.error("Failed to parse slab components", e);
      return [];
    }

    const results: { headName: string; amount: number }[] = [];
    const headAmounts: Record<number, number> = {};
    let totalNonResidual = 0;

    // First pass for non-residual (FIXED, PERCENT_CTC, PERCENT_HEAD)
    components.filter(c => c.calculation_type !== 'RESIDUAL').forEach(comp => {
      const head = salaryHeads.find(h => h.id === comp.salary_head_id);
      let amount = 0;

      if (comp.calculation_type === 'FIXED') {
        amount = comp.value;
      } else if (comp.calculation_type === 'PERCENT_CTC') {
        amount = (Number(statutoryCTC) * comp.value) / 100;
      } else if (comp.calculation_type === 'PERCENT_HEAD' && comp.parent_head_id) {
        const parentAmt = headAmounts[comp.parent_head_id] || 0;
        amount = (parentAmt * comp.value) / 100;
      }

      const roundedAmount = Math.round(amount);
      headAmounts[comp.salary_head_id] = roundedAmount;
      totalNonResidual += roundedAmount;
      results.push({
        headName: head?.name || 'Unknown',
        amount: roundedAmount
      });
    });

    // Second pass for residual components
    components.filter(c => c.calculation_type === 'RESIDUAL').forEach(comp => {
      const head = salaryHeads.find(h => h.id === comp.salary_head_id);
      const amount = Math.max(0, Number(statutoryCTC) - totalNonResidual);
      const roundedAmount = Math.round(amount);
      results.push({
        headName: head?.name || 'Unknown',
        amount: roundedAmount
      });
    });

    return results;
  }, [currentMode, selectedSlabId, statutoryCTC, salarySlabs, salaryHeads]);

  const isBifurcationValid = bifurcationData.reduce((sum, item) => sum + item.amount, 0) === Number(statutoryCTC);
  const isBifurcationExceeded = bifurcationData.filter(i => i.amount > 0).reduce((sum, item) => sum + item.amount, 0) > (Number(statutoryCTC) || 0);
  
  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
  };

  const dobValue = watch('dob');
  const joiningDateValue = watch('joining_date');
  const employmentTypeValue = watch('employment_type');
  const isFteContractValue = watch('is_fte_contract');
  const wageAmountValue = watch('wage_amount');
  const employeeAge = useMemo(() => calculateAge(dobValue), [dobValue]);

  useEffect(() => {
    if (employeeAge > 0) {
      if (employeeAge < 18) {
        setValue('employment_type', 'Apprentice/Trainee');
      }
      if (employeeAge >= 58 && !selectedEmployeeId) {
        setValue('eps_exempt', true);
      }
    }
  }, [employeeAge, setValue, selectedEmployeeId]);

  // FTE & Gratuity Logic
  useEffect(() => {
    if (employmentTypeValue === 'Fixed-Term' && !isFteContractValue) {
      setValue('is_fte_contract', true);
    }
    
    if (joiningDateValue) {
      const join = new Date(joiningDateValue);
      if (!isNaN(join.getTime())) {
        const eligibleDate = new Date(join);
        if (isFteContractValue || employmentTypeValue === 'Fixed-Term') {
          eligibleDate.setFullYear(eligibleDate.getFullYear() + 1);
        } else {
          eligibleDate.setFullYear(eligibleDate.getFullYear() + 5);
        }
        setValue('gratuity_eligible_date', eligibleDate.toISOString().split('T')[0]);
      }
    }
  }, [joiningDateValue, employmentTypeValue, isFteContractValue, setValue]);

  const nomineeShareTotal = useMemo(() => {
    return familyMembers
      .filter(m => m.is_nominee)
      .reduce((sum, m) => sum + (m.nominee_share_percent || 0), 0);
  }, [familyMembers]);

  const isNomineeShareValid = familyMembers.some(m => m.is_nominee) ? nomineeShareTotal === 100 : true;
  
  const gratuityEligibility = useMemo(() => {
    const eligibleDateStr = watch('gratuity_eligible_date');
    if (!joiningDateValue || !eligibleDateStr) return { status: 'none', days: 0 };
    const eligibleDate = new Date(eligibleDateStr);
    const today = new Date();
    const diffTime = eligibleDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return { status: 'eligible', days: 0 };
    return { status: 'not-eligible', days: diffDays };
  }, [joiningDateValue, watch('gratuity_eligible_date')]);

  const estimatedGratuity = useMemo(() => {
    const leavingDate = watch('leaving_date');
    const wageAmount = watch('wage_amount');
    if (!joiningDateValue || !leavingDate || !wageAmount) return 0;
    const join = new Date(joiningDateValue);
    const leave = new Date(leavingDate);
    if (isNaN(join.getTime()) || isNaN(leave.getTime()) || leave <= join) return 0;

    const diffDays = Math.floor((leave.getTime() - join.getTime()) / (1000 * 60 * 60 * 24));
    const completedYears = diffDays / 365.25;
    const vestingYears = isFteContractValue ? 1.0 : 4.8;

    if (completedYears < vestingYears) return 0;
    return (wageAmount * 15 / 26) * completedYears;
  }, [joiningDateValue, watch('leaving_date'), watch('wage_amount'), isFteContractValue]);

  const [gratuityLedger, setGratuityLedger] = useState<any[]>([]);

  // Sync bifurcation to form state
  useEffect(() => {
    if (currentMode === 'P' && bifurcationData.length > 0) {
      const basic = bifurcationData.find(d => d.headName.toUpperCase() === 'BASIC')?.amount || 0;
      const hra = bifurcationData.find(d => d.headName.toUpperCase() === 'HRA')?.amount || 0;
      const conv = bifurcationData.find(d => d.headName.toUpperCase().includes('CONVEYANCE'))?.amount || 0;
      
      const handledHeadNames = ['BASIC', 'HRA'];
      const others = bifurcationData.filter(d => 
        !handledHeadNames.includes(d.headName.toUpperCase()) && 
        !d.headName.toUpperCase().includes('CONVEYANCE')
      );
      const special = others.reduce((sum, item) => sum + item.amount, 0);

      setValue('basic_salary', basic);
      setValue('hra', hra);
      setValue('conveyance', conv);
      setValue('special_allowance', special);
    }
  }, [bifurcationData, currentMode, setValue]);

  const empCode = watch('emp_code');
  const [isBiometricManuallyEdited, setIsBiometricManuallyEdited] = useState(false);

  // Sync biometric_id with emp_code if not manually edited
  React.useEffect(() => {
    if (!isBiometricManuallyEdited && !selectedEmployeeId) {
      setValue('biometric_id', empCode);
    }
  }, [empCode, isBiometricManuallyEdited, setValue, selectedEmployeeId]);

  const isDifferentlyAbled = watch('is_differently_abled');
  const isPermSameAsCurrent = watch('is_perm_same_as_current');
  const currentAddress = watch('current_address');
  const currentPincode = watch('current_pincode');
  const currentDistrict = watch('current_district');
  const currentState = watch('current_state');

  const selectedLocationId = watch('location_id');
  const selectedGroupId = watch('group_id');

  useEffect(() => {
    const currentDivisionId = watch('division_id');
    if (currentDivisionId && selectedLocationId) {
      const isValid = divisions.some(d => d.id.toString() === currentDivisionId && d.location_id === Number(selectedLocationId));
      if (!isValid) {
        setValue('division_id', '');
      }
    }
  }, [selectedLocationId, divisions, setValue, watch]);
  const selectedDeptId = watch('department_id');
  const selectedDesignation = watch('designation');
  const hasChildren = employees.some(e => e.parent_employee_id === Number(selectedEmployeeId));
  const isRoot = !watch('parent_employee_id') && hasChildren;

  const basicSalary = watch('basic_salary') || 0;
  const hra = watch('hra') || 0;
  const conveyance = watch('conveyance') || 0;
  const grossSalary = basicSalary + hra + conveyance;

  const dob = watch('dob');

  React.useEffect(() => {
    if (dob && !minorConfirmed) {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        setIsMinorWarningOpen(true);
      }
    }
  }, [dob, minorConfirmed]);

  React.useEffect(() => {
    if (isPermSameAsCurrent) {
      setValue('perm_address', currentAddress || '');
      setValue('perm_pincode', currentPincode || '');
      setValue('perm_post_office', watch('current_post_office') || '');
      setValue('perm_district', currentDistrict || '');
      setValue('perm_state', currentState || '');
      setIsPermPincodeVerified(isCurrentPincodeVerified);
      setIsPermManualEntry(isCurrentManualEntry);
    }
  }, [isPermSameAsCurrent, currentAddress, currentPincode, watch('current_post_office'), currentDistrict, currentState, isCurrentPincodeVerified, isCurrentManualEntry, setValue]);

  const [employeePageIndex, setEmployeePageIndex] = useState(0);
  const [employeePageSize, setEmployeePageSize] = useState(10);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeFilters, setEmployeeFilters] = useState<any>({});

  const fetchEmployees = async (pageIndex = employeePageIndex, pageSize = employeePageSize, search = employeeSearch, filters = employeeFilters) => {
    try {
      const ts = Date.now();
      const result = await invokeCommand<any>('master_crud', { 
        tableName: 'employees', 
        operation: 'list', 
        moduleType: currentMode,
        limit: pageSize,
        offset: pageIndex * pageSize,
        search,
        filters,
        includeTotal: true,
        _v: ts 
      });
      
      const employeesList = processEmployeeList(result?.rows || []);
      setEmployees(employeesList);
      setEmployeeTotal(result?.total || 0);

      // Handle mode switch targeting
      const modeSwitchOcurred = lastFetchedModeRef.current !== currentMode;
      const targetEmpCode = modeSwitchOcurred && selectedEmployeeId ? getValues('emp_code') : null;
      lastFetchedModeRef.current = currentMode;

      if (modeSwitchOcurred && targetEmpCode) {
        const matchingEmp = employeesList.find((e: any) => e.emp_code === targetEmpCode);
        if (matchingEmp) {
          handleEdit(matchingEmp);
        } else {
          handleAddNew();
        }
      } else if (modeSwitchOcurred) {
        handleAddNew();
      }
    } catch (error) {
      toast.error("Failed to fetch employees");
    }
  };

  useEffect(() => {
    fetchEmployees(employeePageIndex, employeePageSize, employeeSearch, employeeFilters);
  }, [employeePageIndex, employeePageSize, employeeSearch, employeeFilters, currentMode]);

  const fetchData = async () => {
    try {
      const ts = Date.now();
      const [wd, cls, cat, hierarchy, grp, dpt, shft, config, des, et, es, slabs, heads, cc] = await Promise.all([
        invokeCommand<any[]>('master_crud', { tableName: 'working_day_types', operation: 'list', moduleType: currentMode, _v: ts }).catch(() => []),
        invokeCommand<any[]>('master_crud', { tableName: 'classes', operation: 'list', moduleType: currentMode, _v: ts }).catch(() => []),
        invokeCommand<any[]>('master_crud', { tableName: 'categories', operation: 'list', moduleType: currentMode, _v: ts }).catch(() => []),
        invokeCommand<any[]>('master_crud', { tableName: 'org_hierarchy', operation: 'list', moduleType: currentMode, _v: ts }).catch(() => []),
        invokeCommand<any[]>('master_crud', { tableName: 'groups', operation: 'list', moduleType: currentMode, _v: ts }).catch(() => []),
        invokeCommand<any[]>('master_crud', { tableName: 'departments', operation: 'list', moduleType: currentMode, _v: ts }).catch(() => []),
        invokeCommand<any[]>('master_crud', { tableName: 'shifts', operation: 'list', moduleType: currentMode, _v: ts }).catch(() => []),
        invokeCommand<any>('master_crud', { tableName: 'settings', operation: 'get', id: 'employee_code_manual_entry', moduleType: currentMode, _v: ts }).catch(() => ({ value: '0' })),
        invokeCommand<any[]>('master_crud', { tableName: 'designations', operation: 'list', moduleType: currentMode, _v: ts }).catch(() => []),
        invokeCommand<any[]>('master_crud', { tableName: 'employment_types', operation: 'list', moduleType: currentMode, _v: ts }).catch(() => []),
        invokeCommand<any[]>('master_crud', { tableName: 'employee_statuses', operation: 'list', moduleType: currentMode, _v: ts }).catch(() => []),
        invokeCommand<SalarySlab[]>('master_crud', { tableName: 'salary_slabs', operation: 'list', moduleType: 'P', _v: ts }).catch(() => []),
        invokeCommand<SalaryHead[]>('master_crud', { tableName: 'salary_heads', operation: 'list', moduleType: 'P', _v: ts }).catch(() => []),
        invokeCommand<any>('get_company_config', { module_type: currentMode, _v: ts }).catch(() => null)
      ]);

      setWorkingDayTypes(Array.isArray(wd) ? wd : []);
      setClasses(Array.isArray(cls) ? cls.filter((i: any) => i.status === 1) : []);
      setCategories(Array.isArray(cat) ? cat.filter((i: any) => i.status === 1) : []);
      
      const hierarchyData = Array.isArray(hierarchy) ? hierarchy : [];
      setLocations(hierarchyData.filter(h => h.type === 'Location' && h.status === 1));
      setDivisions(hierarchyData.filter(h => h.type === 'Division' && h.status === 1).map(d => ({
        ...d,
        location_id: d.parent_id 
      })));

      setGroups(Array.isArray(grp) ? grp.filter((i: any) => i.status === 1) : []);
      setDepartments(Array.isArray(dpt) ? dpt.filter((i: any) => i.status === 1) : []);
      setShifts(Array.isArray(shft) ? shft.filter((i: any) => i.status === 1) : []);
      setDesignations(Array.isArray(des) ? des.filter((i: any) => i.status === 1) : []);
      setEmploymentTypes(Array.isArray(et) ? et.filter((i: any) => i.status === 1) : []);
      setEmployeeStatuses(Array.isArray(es) ? es.filter((i: any) => i.status === 1) : []);
      setSalarySlabs(Array.isArray(slabs) ? slabs : []);
      setSalaryHeads(Array.isArray(heads) ? heads : []);
      setIsManualCodeAllowed(config?.value === '1');
      setWeeklyOffSource(cc?.weekly_off_source || 'Global');

    } catch (error) {
      toast.error("Failed to fetch master data");
    }
  };

  // Debug hook for employee state monitoring
  useEffect(() => {
    if (employees.length > 0) {
      toast.info(`Loaded ${employees.length} employees in Module [${currentMode}]`, {
        duration: 3000,
        position: 'bottom-right',
        className: 'font-mono text-[10px] uppercase'
      });
    }
  }, [employees, currentMode]);

  useEffect(() => {
    fetchData();
  }, [currentMode]);

  // Auto-populate defaults when department changes
  useEffect(() => {
    if (selectedDeptId) {
      const fetchDeptSettings = async () => {
        try {
          const settings = await invokeCommand<any>('get_dept_settings', {
            deptId: parseInt(selectedDeptId),
            moduleType: currentMode
          });
          if (settings.default_location_id) setValue('location_id', String(settings.default_location_id));
          if (settings.default_division_id) setValue('division_id', String(settings.default_division_id));
          if (settings.default_class_id) setValue('class_id', String(settings.default_class_id));
          if (settings.default_category_id) setValue('category_id', String(settings.default_category_id));
          if (settings.default_shift_id) setValue('shift_id', String(settings.default_shift_id));
          if (settings.default_reporting_employee_id) setValue('reporting_employee_id', String(settings.default_reporting_employee_id));
        } catch (error) {
          console.error("Failed to fetch dept settings");
        }
      };
      fetchDeptSettings();
    }
  }, [selectedDeptId, setValue, currentMode]);

  // Fetch standard rate when dept or designation changes
  useEffect(() => {
    if (selectedDeptId && selectedDesignation) {
      const fetchStdRate = async () => {
        try {
          const data = await invokeCommand<any>('get_dept_standard_rates', {
            deptId: parseInt(selectedDeptId),
            designation: selectedDesignation,
            moduleType: currentMode
          });
          setCurrentStdRate(data.standard_rate || null);
        } catch (error) {
          console.error("Failed to fetch standard rates");
        }
      };
      fetchStdRate();
    } else {
      setCurrentStdRate(null);
    }
  }, [selectedDeptId, selectedDesignation, currentMode]);

  useEffect(() => {
    if (selectedEmployeeId && employees.length > 0) {
      const updatedEmp = employees.find(e => e.id.toString() === selectedEmployeeId);
      if (updatedEmp && updatedEmp.emp_code === getValues('emp_code')) {
        // Only trigger update if critical payroll fields changed to refresh the UI view
        const currentWage = getValues('wage_amount');
        if (updatedEmp.wage_amount !== currentWage) {
          handleEdit(updatedEmp);
        }
      }
    }
  }, [employees, selectedEmployeeId, getValues]);

  const handleDuplicateCheck = async (field: string, value: string, label: string) => {
    if (!value) return;
    
    try {
      const result = await invokeCommand<any>('check_duplicate', {
        field,
        value,
        excludeId: selectedEmployeeId ? parseInt(selectedEmployeeId) : undefined,
        moduleType: currentMode
      });
      
      if (result.existing) {
        if (field === 'account_no') {
          const proceed = window.confirm(`${result.existing.emp_code} - ${result.existing.name} has already this bank account, do you want to proceed?`);
          if (!proceed) {
            setValue('account_no', '');
          }
        } else {
          toast.error(`${label} already exists for ${result.existing.emp_code} - ${result.existing.name}. Duplicate entry not allowed.`);
          setValue(field as any, '');
        }
      }
    } catch (error) {
      console.error("Duplicate check failed", error);
    }
  };

  const fieldLabelMap: Record<string, string> = {
    emp_code: 'Employee Code',
    biometric_id: 'Biometric ID',
    first_name: 'First Name',
    middle_name: 'Middle Name',
    last_name: 'Last Name',
    full_name_aadhar: 'Full Name (as per Aadhar)',
    father_husband_guardian_name: 'Father / Husband / Guardian Name',
    gender: 'Gender',
    marital_status: 'Marital Status',
    dob: 'Date of Birth',
    religion: 'Religion',
    blood_group: 'Blood Group',
    qualification: 'Qualification',
    is_differently_abled: 'Differently Abled Status',
    disability_type: 'Disability Type',
    referenced_by: 'Referenced By',
    mobile: 'Mobile Number',
    mobile2: 'Alternative Mobile',
    email: 'Email ID',
    cug_mobile: 'CUG Mobile',
    current_address: 'Current Address',
    current_pincode: 'Current Pincode',
    current_district: 'Current District',
    current_state: 'Current State',
    perm_address: 'Permanent Address',
    perm_pincode: 'Permanent Pincode',
    perm_district: 'Permanent District',
    perm_state: 'Permanent State',
    group_id: 'Group',
    department_id: 'Department',
    designation: 'Designation',
    employment_type: 'Employment Type',
    location_id: 'Location',
    class_id: 'Class',
    category_id: 'Category',
    division_id: 'Division',
    shift_id: 'Shift',
    aadhar_no: 'Aadhar Number',
    pan_no: 'PAN Number',
    driving_licence: 'Driving Licence',
    uan_no: 'UAN Number',
    joining_date: 'Joining Date',
    payment_mode: 'Payment Mode',
    account_no: 'Account Number',
    bank_name: 'Bank Name',
    ifsc_code: 'IFSC Code',
    blacklist_authorizer_id: 'Blacklist Authorizer',
    slab_id: 'Salary Slab'
  };

  const onInvalid = (errors: any) => {
    const errorFields = Object.keys(errors);
    if (errorFields.length > 0) {
      const firstField = errorFields[0] as keyof typeof fieldLabelMap;
      const label = fieldLabelMap[firstField] || String(firstField).replace(/_/g, ' ');
      toast.error(`Required field missing or invalid: ${label}`, {
        description: errors[firstField].message,
        duration: 5000,
        icon: <ShieldAlert className="text-red-500" size={20} />
      });
    }
  };

  const fetchWaterfall = async (empId: number) => {
    try {
      const result = await invokeCommand<any>('process_waterfall_distribution', {
        parent_id: empId,
        month: new Date().toISOString().slice(0, 7), // YYYY-MM
        moduleType: currentMode
      });
      // Fetch children details
      const children = employees.filter(e => e.parent_employee_id === empId);
      setWaterfallData({
        children,
        logs: result.logs || [],
        totalPool: result.totalPool || 0,
        residual: result.residual || 0
      });
    } catch (err) {
      console.error("Failed to fetch waterfall data:", err);
    }
  };

  useEffect(() => {
    if (selectedEmployeeId && isDrawerOpen && currentMode === 'K') {
      fetchWaterfall(parseInt(selectedEmployeeId));
    }
  }, [selectedEmployeeId, isDrawerOpen, currentMode]);

  const onSubmit = async (data: EmployeeData) => {
    setIsLoading(true);
    try {
      // CIRCUIT BREAKER: Prevent Circular References
      if (data.parent_employee_id && selectedEmployeeId) {
        if (data.parent_employee_id === selectedEmployeeId) {
          toast.error("An employee cannot be their own parent");
          setIsLoading(false);
          return;
        }

        // Deep check for circular dependency
        const checkCircular = (currentId: number, targetId: number): boolean => {
          const emp = employees.find(e => e.id === currentId);
          if (!emp || !emp.parent_employee_id) return false;
          if (Number(emp.parent_employee_id) === targetId) return true;
          return checkCircular(Number(emp.parent_employee_id), targetId);
        };

        if (checkCircular(parseInt(data.parent_employee_id), parseInt(selectedEmployeeId))) {
          toast.error("Circular dependency detected! This would create an infinite reporting loop.");
          setIsLoading(false);
          return;
        }
      }

      if (currentMode === 'P') {
        const complianceData = await invokeCommand<any>('check_min_wage', {
          amount: data.wage_amount,
          moduleType: currentMode
        });
        if (!complianceData.compliant) {
          const proceed = window.confirm("Warning: Statutory rate is below minimum wage. Proceed anyway?");
          if (!proceed) {
            setIsLoading(false);
            return;
          }
        }
      }

      const { 
        hasChildren: _hasChildren, 
        ...dataToSubmit 
      } = data;

      let finalPhotoPath = data.photo_path;
      if (photoPreview && photoPreview.startsWith('data:image')) {
        try {
          const result = await invokeCommand<any>('save_employee_asset', {
            base64: photoPreview,
            emp_code: data.emp_code
          });
          finalPhotoPath = result.path;
        } catch (assetErr) {
          console.error("Failed to save employee photo:", assetErr);
          // Continue saving master even if photo fails, or handle as needed
        }
      }

      const payload = {
        ...dataToSubmit,
        name: [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(' '),
        photo_url: photoPreview && photoPreview.startsWith('data:image') ? undefined : photoPreview,
        photo_path: finalPhotoPath,
        signature_url: signaturePreview,
        reporting_employee_id: data.reporting_employee_id ? Number(data.reporting_employee_id) : undefined,
        parent_employee_id: data.parent_employee_id ? Number(data.parent_employee_id) : undefined,
        family_members: familyMembers,
        employment_history: employmentHistory,
        bank_history: bankHistory,
        pf_history: pfHistory,
        esi_history: esiHistory,
        // Include current user ID for logging on backend
        currentUser_id: currentUser?.id,
        // Set authorizer if blacklist status is toggled and we are blacklisting
        blacklist_authorizer_id: data.blacklist_status ? (data.blacklist_authorizer_id || currentUser?.id) : undefined,
        // Pakka Module Specific
        slab_id: data.slab_id ? Number(data.slab_id) : undefined,
        wage_amount: data.wage_amount,
        mode: currentMode
      };

      // Clean payload to reduce size and avoid 413 errors – but keep empty strings to allow clearing fields
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, v]) => v !== null && v !== undefined)
      );
      
      await invokeCommand('master_crud', {
        tableName: 'employees',
        operation: selectedEmployeeId ? 'update' : 'create',
        id: selectedEmployeeId ? parseInt(selectedEmployeeId) : undefined,
        data: cleanPayload,
        moduleType: currentMode
      });

      // Success: Toast and reset
      toast.success(selectedEmployeeId ? "Employee record updated successfully" : "Employee record saved successfully", {
        icon: <CheckCircle2 className="text-green-500" size={20} />
      });
      setIsDrawerOpen(false);
      if (!selectedEmployeeId) {
        handleAddNew(); // Use centralized reset
      }
      // Refresh employee list
      fetchEmployees();
    } catch (error: any) {
      console.error("Save failed:", error);
      let errorMessage = "Failed to save employee record. Please try again.";
      
      const errStr = typeof error === 'string' ? error : (error?.message || error?.error || "");
      
      if (errStr.includes('UNIQUE constraint failed')) {
        if (errStr.includes('emp_code')) {
          errorMessage = "Employee Code already exists. Each employee must have a unique code.";
        } else if (errStr.includes('aadhar_no')) {
          errorMessage = "This Aadhar Number is already registered for another employee.";
        } else if (errStr.includes('pan_no')) {
          errorMessage = "This PAN Number is already registered for another employee.";
        } else {
          errorMessage = "A record with duplicate identifiers already exists.";
        }
      } else if (errStr.includes('FOREIGN KEY constraint failed')) {
        errorMessage = "Selection invalid: One or more selected masters (Department, Location, etc.) no longer exist.";
      } else if (errStr) {
        errorMessage = errStr;
      }

      toast.error("Operation Failed", {
        description: errorMessage,
        duration: 8000,
        icon: <ShieldAlert className="text-red-500" size={20} />
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncToPakka = async () => {
    if (!syncEmployee || !syncSlabId) {
      toast.error('Please select a salary slab');
      return;
    }

    setIsSyncing(true);
    try {
      await invokeCommand('sync_employee_to_pakka', {
        employee_id: syncEmployee.id,
        slab_id: Number(syncSlabId),
        wage_amount: syncWageAmount
      });

      toast.success('Employee synced to Pakka successfully');
      setIsSyncDialogOpen(false);
      setSyncEmployee(null);
      setSyncSlabId('');
      setSyncWageAmount(0);
    } catch (err) {
      toast.error('Failed to sync employee');
    } finally {
      setIsSyncing(false);
    }
  };

  const [isShowingHistoricalRate, setIsShowingHistoricalRate] = useState(false);
  const [baseMasterRate, setBaseMasterRate] = useState<number | null>(null);

  const handleEdit = async (emp: any) => {
    // Helper to ensure no null/undefined values are passed to controlled inputs
    const s = (val: any) => val ?? '';
    // Helper for IDs to ensure '0' or null/undefined are treated as empty string
    const sid = (val: any) => (val === 0 || val === '0' || val === null || val === undefined) ? '' : val.toString();

    setSelectedEmployeeId(emp.id.toString());
    setPhotoPreview(emp.photo_path ? safeConvertFileSrc(emp.photo_path) : (emp.photo_url || null));
    setSignaturePreview(emp.signature_url || emp.signatureUrl || null);
    setMinorConfirmed(true); // Don't warn for existing records
    const empHasChildren = employees.some(e => e.parentEmployeeId === emp.id);

    // Fetch revision history to find currently active rate (<= today)
    let activeWageAmount = currentMode === 'P' ? (emp.statutory_wage_amount || 0) : (emp.wage_amount || 0);
    let activeEffectiveFrom = s(emp.wage_effective_from);
    setIsShowingHistoricalRate(false);
    setBaseMasterRate(activeWageAmount);

    try {
      const history = await invokeCommand<any[]>('get_salary_revision_history', { empId: emp.id, moduleType: currentMode });
      setRevisionHistory(history);
      
      const today = new Date().toISOString().split('T')[0];
      const latestActive = history.find(h => h.effective_date <= today);
      
      if (latestActive) {
        if (latestActive.amount !== activeWageAmount) {
          activeWageAmount = latestActive.amount;
          activeEffectiveFrom = latestActive.effective_date;
          setIsShowingHistoricalRate(true);
        }
      }
    } catch (err) {
      console.error("Failed to fetch history in handleEdit", err);
    }

    // Fetch gratuity ledger if in P module
    if (currentMode === 'P') {
      const fetchLedger = async () => {
        try {
          const data = await invokeCommand<any[]>('get_gratuity_ledger', {
            empId: emp.id,
            moduleType: 'P'
          });
          setGratuityLedger(Array.isArray(data) ? data : []);
        } catch (e) {
          console.error('Failed to fetch gratuity ledger', e);
        }
      };
      fetchLedger();
    }
    
    // Map backend fields to form fields
    reset({
      emp_code: s(emp.emp_code),
      biometric_id: s(emp.biometric_id),
      first_name: s(emp.first_name),
      middle_name: s(emp.middle_name),
      last_name: s(emp.last_name),
      full_name_aadhar: s(emp.full_name_aadhar),
      father_husband_guardian_name: s(emp.father_husband_guardian_name),
      gender: s(emp.gender) || 'Male',
      marital_status: s(emp.marital_status) || 'Unmarried',
      dob: s(emp.dob),
      religion: s(emp.religion) || 'Hindu',
      blood_group: s(emp.blood_group),
      qualification: s(emp.qualification) || 'Graduate',
      is_differently_abled: emp.is_differently_abled === 1 || emp.is_differently_abled === true,
      disability_type: Array.isArray(emp.disability_type) ? emp.disability_type : (emp.disability_type ? emp.disability_type.split(',') : []),
      referenced_by: s(emp.referenced_by),
      mobile: s(emp.mobile),
      mobile2: s(emp.mobile2),
      email: s(emp.email),
      cug_mobile: s(emp.cug_mobile),
      current_address: s(emp.current_address),
      current_pincode: s(emp.current_pincode),
      current_post_office: s(emp.current_post_office),
      current_district: s(emp.current_district),
      current_state: s(emp.current_state),
      is_perm_same_as_current: emp.is_perm_same_as_current === 1 || emp.is_perm_same_as_current === true,
      perm_address: s(emp.perm_address),
      perm_pincode: s(emp.perm_pincode),
      perm_post_office: s(emp.perm_post_office),
      perm_district: s(emp.perm_district),
      perm_state: s(emp.perm_state),
      working_day_type_id: sid(emp.working_day_type_id),
      class_id: sid(emp.class_id),
      category_id: sid(emp.category_id),
      location_id: sid(emp.location_id),
      division_id: sid(emp.division_id),
      shift_id: sid(emp.shift_id),
      group_id: sid(emp.group_id),
      department_id: sid(emp.department_id),
      designation: s(emp.designation),
      designation_id: sid(emp.designation_id),
      photo_path: s(emp.photo_path),
      joining_date: s(emp.joining_date),
      employment_type: s(emp.employment_type) || 'Permanent',
      employment_type_id: sid(emp.employment_type_id),
      aadhar_no: s(emp.aadhar_no),
      pan_no: s(emp.pan_no),
      driving_licence: s(emp.driving_licence),
      passport_no: s(emp.passport_no),
      voter_id: s(emp.voter_id),
      uan_no: s(emp.uan_no),
      pf_number: s(emp.pf_number),
      pf_joining_date: s(emp.pf_joining_date),
      pf_exit_date: s(emp.pf_exit_date),
      pf_exit_reason: s(emp.pf_exit_reason),
      esi_ip_number: s(emp.esi_ip_number),
      esi_joining_date: s(emp.esi_joining_date),
      voluntary_pf_applicable: emp.voluntary_pf_applicable === 1 || emp.voluntary_pf_applicable === true,
      payment_mode: s(emp.payment_mode) || 'Bank Transfer',
      ifsc_code: s(emp.ifsc_code),
      bank_name: s(emp.bank_name),
      account_no: s(emp.account_no),
      as_per_bank_name: s(emp.as_per_bank_name),
      bank_effective_date: s(emp.bank_effective_date),
      employee_status: s(emp.employee_status) || 'Active',
      employee_status_id: sid(emp.employee_status_id),
      book_joining_date: s(emp.book_joining_date),
      leaving_date: s(emp.leaving_date),
      reporting_employee_id: sid(emp.reporting_employee_id),
      wage_type: currentMode === 'P' ? (s(emp.statutory_wage_type) || s(emp.wage_type) || 'Monthly') : (s(emp.wage_type) || 'Monthly'),
      wage_amount: activeWageAmount,
      wage_effective_from: activeEffectiveFrom,
      weekly_off: s(emp.weekly_off),
      weekly_off_effective_date: s(emp.weekly_off_effective_date),
      parent_employee_id: sid(emp.parent_employee_id),
      salary_process_sequence: emp.salary_process_sequence || 0,
      is_pf_covered: emp.is_pf_covered === undefined || emp.is_pf_covered === null || emp.is_pf_covered === 1 || emp.is_pf_covered === true,
      is_esi_covered: emp.is_esi_covered === undefined || emp.is_esi_covered === null || emp.is_esi_covered === 1 || emp.is_esi_covered === true,
      blacklist_status: emp.blacklist_status === 1 || emp.blacklist_status === true,
      blacklist_remarks: s(emp.blacklist_remarks),
      blacklist_effective_date: s(emp.blacklist_effective_date),
      blacklist_authorizer_id: emp.blacklist_authorizer_id,
      blacklist_authorizer_name: s(emp.blacklist_authorizer_name),
      hasChildren: empHasChildren,
      // Pakka Module Specific
      slab_id: sid(emp.slab_id),
    });
    setFamilyMembers(Array.isArray(emp.family_members) ? emp.family_members : (typeof emp.family_members === 'string' ? JSON.parse(emp.family_members) : []));
    setEmploymentHistory(Array.isArray(emp.employment_history) ? emp.employment_history : (typeof emp.employment_history === 'string' ? JSON.parse(emp.employment_history) : []));
    setBankHistory(Array.isArray(emp.bank_history) ? emp.bank_history : (typeof emp.bank_history === 'string' ? JSON.parse(emp.bank_history) : []));
    setPfHistory(Array.isArray(emp.pf_history) ? emp.pf_history : (typeof emp.pf_history === 'string' ? JSON.parse(emp.pf_history) : []));
    setEsiHistory(Array.isArray(emp.esi_history) ? emp.esi_history : (typeof emp.esi_history === 'string' ? JSON.parse(emp.esi_history) : []));
    setIsExitDateLocked(!!emp.pf_exit_date);
    setIsDrawerOpen(true);
  };

  const handleDeleteClick = (id: number) => {
    setEmployeeToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleBulkDeleteClick = (ids: number[]) => {
    setEmployeesToDelete(ids);
    setIsBulkDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    try {
      await invokeCommand('master_crud', {
        tableName: 'employees',
        operation: 'delete',
        id: employeeToDelete,
        moduleType: currentMode
      });
      toast.success("Employee record deleted successfully");
      fetchEmployees();
    } catch (error) {
      toast.error("Failed to delete employee record");
    } finally {
      setEmployeeToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (employeesToDelete.length === 0) return;
    try {
      await invokeCommand('master_crud', {
        tableName: 'employees',
        operation: 'bulk_delete',
        data: { ids: employeesToDelete },
        moduleType: currentMode
      });
      toast.success(`${employeesToDelete.length} employees deleted successfully`);
      fetchEmployees();
    } catch (error: any) {
      toast.error(`Failed to bulk delete employees: ${error}`);
    } finally {
      setEmployeesToDelete([]);
      setIsBulkDeleteModalOpen(false);
    }
  };

  const handleAddNew = async () => {
    setSelectedEmployeeId(null);
    setIsExitDateLocked(false);
    setPhotoPreview(null);
    setSignaturePreview(null);
    setMinorConfirmed(false);
    setIsBiometricManuallyEdited(false);
    setGratuityLedger([]);
    
    try {
      const [configRes, nextCodeRes] = await Promise.all([
        invokeCommand<any>('get_company_config', { moduleType: currentMode }),
        invokeCommand<{ nextCode: string }>('get_next_employee_code', { moduleType: currentMode })
      ]);

      const isManual = Boolean(configRes?.emp_id_manual_entry);
      setIsManualCodeAllowed(isManual);

      reset({
        emp_code: nextCodeRes.nextCode || '',
        biometric_id: nextCodeRes.nextCode || '',
        first_name: '',
        middle_name: '',
        last_name: '',
        full_name_aadhar: '',
      father_husband_guardian_name: '',
      gender: 'Male',
      marital_status: 'Unmarried',
      dob: '',
      religion: 'Hindu',
      blood_group: '',
      qualification: 'Graduate',
      is_differently_abled: false,
      disability_type: [],
      referenced_by: '',
      mobile: '',
      mobile2: '',
      email: '',
      cug_mobile: '',
      current_address: '',
      current_pincode: '',
      current_post_office: '',
      current_district: '',
      current_state: '',
      is_perm_same_as_current: false,
      perm_address: '',
      perm_pincode: '',
      perm_post_office: '',
      perm_district: '',
      perm_state: '',
      working_day_type_id: '',
      class_id: '',
      category_id: '',
      location_id: '',
      division_id: '',
      shift_id: '',
      group_id: '',
      department_id: '',
      designation: '',
      joining_date: '',
      employment_type: 'Permanent',
      aadhar_no: '',
      pan_no: '',
      driving_licence: '',
      passport_no: '',
      voter_id: '',
      uan_no: '',
      pf_number: '',
      pf_joining_date: '',
      pf_exit_date: '',
      pf_exit_reason: '',
      eps_exempt: false,
      is_fte_contract: false,
      designation_id: '',
      employment_type_id: '',
      esi_ip_number: '',
      esi_joining_date: '',
      voluntary_pf_applicable: false,
      voluntary_pf_type: 'Percentage',
      voluntary_pf_value: 0,
      payment_mode: 'Bank Transfer',
      ifsc_code: '',
      bank_name: '',
      account_no: '',
      as_per_bank_name: '',
      bank_effective_date: '',
      employee_status: 'Active',
      book_joining_date: '',
      leaving_date: '',
      reporting_employee_id: '',
      wage_type: 'Monthly',
      wage_amount: 0,
      wage_effective_from: '',
      weekly_off: '',
      weekly_off_effective_date: '',
      parent_employee_id: '',
      salary_process_sequence: 0,
      basic_salary: 0,
      hra: 0,
      conveyance: 0,
      special_allowance: 0,
      is_pf_covered: true,
      is_esi_covered: true,
      blacklist_status: false,
      blacklist_remarks: '',
      blacklist_effective_date: '',
      blacklist_authorizer_id: null,
      blacklist_authorizer_name: '',
      hasChildren: false,
      slab_id: '',
    });
    } catch (error) {
      console.error("Error fetching initial code/config:", error);
      toast.error("Failed to initialize employee code settings");
    }

    setFamilyMembers([]);
    setEmploymentHistory([]);
    setBankHistory([]);
    setPfHistory([]);
    setEsiHistory([]);
    setIsDrawerOpen(true);
  };

  const addFamilyMember = () => {
    setFamilyMembers([...familyMembers, { 
      name: '', 
      role: '', 
      dob: '', 
      aadhar_no: '', 
      mobile: '', 
      is_nominee: false 
    }]);
  };

  const removeFamilyMember = (index: number) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== index));
  };

  const addHistory = () => {
    setEmploymentHistory([...employmentHistory, { 
      company: '', 
      role: '', 
      duration_from: '', 
      duration_to: '',
      last_salary: ''
    }]);
  };

  const removeHistory = (index: number) => {
    setEmploymentHistory(employmentHistory.filter((_, i) => i !== index));
  };
  
  const addBankDetail = () => {
    const ifsc = watch('ifsc_code');
    const bank = watch('bank_name');
    const acc = watch('account_no');
    const name = watch('as_per_bank_name');
    const date = watch('bank_effective_date');
    
    if (!ifsc || !bank || !acc || !name || !date) {
      toast.error("Please fill all current bank details before adding to history");
      return;
    }
    
    setBankHistory([...bankHistory, { 
      ifsc_code: ifsc, 
      bank_name: bank, 
      account_no: acc, 
      as_per_bank_name: name, 
      bank_effective_date: date 
    }]);
    
    // Optional: Clear current fields after adding to history? 
    // Usually, the latest one stays in the main fields.
    toast.success("Bank detail added to history");
  };

  const removeBankDetail = (index: number) => {
    setBankHistory(bankHistory.filter((_, i) => i !== index));
  };

  const addPfRecord = () => {
    const num = watch('pf_number');
    const join = watch('pf_joining_date');
    const exit = watch('pf_exit_date');
    const reason = watch('pf_exit_reason');
    
    if (!num || !join) {
      toast.error("Please fill PF Number and Joining Date before adding to history");
      return;
    }
    
    setPfHistory([...pfHistory, { 
      pf_number: num, 
      pf_joining_date: join, 
      pf_exit_date: exit,
      pf_exit_reason: reason
    }]);
    toast.success("PF record added to history");
  };

  const removePfRecord = (index: number) => {
    setPfHistory(pfHistory.filter((_, i) => i !== index));
  };

  const addEsiRecord = () => {
    const num = watch('esi_ip_number');
    const join = watch('esi_joining_date');
    
    if (!num || !join) {
      toast.error("Please fill ESI IP Number and Joining Date before adding to history");
      return;
    }
    
    setEsiHistory([...esiHistory, { 
      esi_ip_number: num, 
      esi_joining_date: join 
    }]);
    toast.success("ESI record added to history");
  };

  const removeEsiRecord = (index: number) => {
    setEsiHistory(esiHistory.filter((_, i) => i !== index));
  };

  const themeColors = {
    accent: 'text-primary-navy',
    border: 'border-primary-navy/30',
    bg: 'bg-primary-navy/10',
    button: 'app-btn-primary',
    tabActive: 'bg-primary-navy text-white shadow-lg',
    tabHover: 'hover:bg-primary-navy/10',
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignaturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIfscSearch = async () => {
    const ifsc = watch('ifsc_code');
    if (!ifsc || ifsc.length !== 11) {
      toast.error("Please enter a valid 11-digit IFSC code");
      return;
    }

    setIsIfscSearching(true);
    try {
      const response = await fetch(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setValue('bank_name', data.BANK);
        toast.success("Bank details fetched successfully");
      } else {
        toast.error("IFSC is not found in RBI database, check again entered data or ask employee to update bank account proof for latest IFSC");
      }
    } catch (error) {
      console.error("IFSC Search Error:", error);
      toast.error("Failed to fetch bank details");
    } finally {
      setIsIfscSearching(false);
    }
  };

  const focusNextElement = (currentElement: HTMLElement) => {
    const form = currentElement.closest('.employee-master-form') || currentElement.closest('form');
    if (!form) return;

    const focusableSelector = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([type="submit"]), [tabindex="0"]';
    const focusable = Array.from(form.querySelectorAll(focusableSelector)) as HTMLElement[];
    const index = focusable.indexOf(currentElement);
    
    if (index > -1 && index < focusable.length - 1) {
      const next = focusable[index + 1] as HTMLElement;
      next.focus();
      if (next instanceof HTMLInputElement) next.select();
    }
  };

  const handleEnterToTab = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      // Allow multi-line textareas to use Enter
      if (target.tagName === 'TEXTAREA') return;
      
      // If it's a SearchableSelect container and it's closed, maybe move focus?
      // But we want Enter to open it too. 
      // If it's handled by children (stopPropagation), it won't reach here.

      // Don't intercept Enter on standard buttons that have their own actions
      if (target.tagName === 'BUTTON' && (target as HTMLButtonElement).type !== 'button') return;

      e.preventDefault();
      focusNextElement(target);
    }
  };

  const watchEmpCodeForHeader = watch('emp_code');
  const watchFirstNameForHeader = watch('first_name');
  const watchMiddleNameForHeader = watch('middle_name');
  const watchLastNameForHeader = watch('last_name');
  const watchGroupIdForHeader = watch('group_id');
  const watchDesignationForHeader = watch('designation');

  const selectedGroupNameForHeader = useMemo(() => {
    return groups.find(g => g.id.toString() === watchGroupIdForHeader)?.name || 'N/A';
  }, [watchGroupIdForHeader, groups]);

  const subHeaderText = useMemo(() => {
    if (!selectedEmployeeId) return 'New Record';
    const fullName = [watchFirstNameForHeader, watchMiddleNameForHeader, watchLastNameForHeader]
      .filter(Boolean)
      .join(' ');
    
    return `${watchEmpCodeForHeader || 'CODE N/A'}- ${fullName || 'NAME N/A'}- ${selectedGroupNameForHeader}- ${watchDesignationForHeader || 'DESIGNATION N/A'}`;
  }, [selectedEmployeeId, watchEmpCodeForHeader, watchFirstNameForHeader, watchMiddleNameForHeader, watchLastNameForHeader, selectedGroupNameForHeader, watchDesignationForHeader]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black flex items-center gap-3 text-primary-navy">
            <UserCircle size={32} />
            Employee Master
          </h2>
          <p className="text-sm font-mono text-primary-navy/70">
            MODULE K // HUMAN RESOURCE INFORMATION SYSTEM
          </p>
        </div>
        
        <div className="flex gap-3">
          {canExport && (
            <button 
              onClick={() => setIsBulkUploadOpen(!isBulkUploadOpen)}
              className="px-4 py-2 border-2 border-primary-navy text-primary-navy font-bold rounded-lg hover:bg-slate-50 transition-all text-sm flex items-center gap-2"
            >
              <Upload size={18} />
              Bulk Upload
            </button>
          )}
          {canCreate && (
            <button 
              onClick={handleAddNew}
              className="app-btn app-btn-primary flex items-center gap-2 shadow-md transition-all"
            >
              <Plus size={18} />
              Add New Employee
            </button>
          )}
        </div>
      </div>

      {isBulkUploadOpen && (
        <BulkEmployeeUpload 
          onSuccess={() => {
            setIsBulkUploadOpen(false);
            fetchData();
          }}
          currentMode={currentMode}
        />
      )}

      <EmployeeTable 
        data={employees || []}
        manualPagination={true}
        totalRecords={employeeTotal}
        pageIndex={employeePageIndex}
        pageSize={employeePageSize}
        onPaginationChange={(page, size) => { setEmployeePageIndex(page); setEmployeePageSize(size); }}
        onSearchChange={setEmployeeSearch}
        onFilterChange={setEmployeeFilters}
        departments={departments}
        designations={designations}
        locations={locations}
        divisions={divisions}
        classes={classes}
        categories={categories}
        groups={groups}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onBulkDelete={handleBulkDeleteClick}
        onSync={(emp) => {
          setSyncEmployee(emp);
          setIsSyncDialogOpen(true);
        }}
        permissions={{ page: 'employeeMaster', view: true, addUpdate: canEdit, delete: canDelete }}
        currentMode={currentMode}
      />

      {/* Salary Revision History Panel */}
      <AnimatePresence>
        {isRevisionHistoryOpen && (
          <div className="fixed inset-0 z-[60] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRevisionHistoryOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-app-border flex flex-col"
            >
              <div className="p-4 bg-primary-navy text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History size={18} />
                  <h2 className="font-bold uppercase tracking-tight text-sm">Salary Revision History</h2>
                </div>
                <button 
                  onClick={() => setIsRevisionHistoryOpen(false)} 
                  className="hover:bg-white/10 p-1 rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {revisionHistory.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-text-muted space-y-2">
                    <History size={32} className="opacity-20" />
                    <p className="text-xs font-bold uppercase">No history found</p>
                  </div>
                ) : (
                  revisionHistory.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 border border-app-border rounded-lg p-4 space-y-3 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12 group-hover:opacity-10 transition-opacity">
                        <History size={48} />
                      </div>
                      
                      <div className="flex justify-between items-start text-xs">
                        <div>
                          <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Effective Date</p>
                          <p className="font-bold text-primary-navy font-mono">{item.effective_date}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Type</p>
                          <span className="text-[10px] bg-primary-navy/10 text-primary-navy px-1.5 py-0.5 rounded font-bold uppercase">
                            {item.revision_type}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-2 border-y border-app-border/50">
                        <div>
                          <p className="text-[9px] font-bold text-text-muted uppercase">Old Rate</p>
                          <p className="text-xs font-mono line-through opacity-50">₹{(item.previous_amount || 0).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-text-muted uppercase">New Rate</p>
                          <p className="text-sm font-mono font-bold text-primary-green">₹{(item.amount || 0).toLocaleString()}</p>
                        </div>
                      </div>

                      {item.remarks && (
                        <div>
                          <p className="text-[9px] font-bold text-text-muted uppercase">Remarks</p>
                          <p className="text-xs text-primary-navy italic leading-relaxed">"{item.remarks}"</p>
                        </div>
                      )}

                      <div className="pt-2 flex justify-between items-center text-[8px] text-text-muted font-bold uppercase tracking-tighter border-t border-app-border/30">
                        <span>Recorded On: {new Date(item.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Salary Revision Modal */}
      <AnimatePresence>
        {isRevisionRecordOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-app-border"
            >
              <div className="bg-primary-navy p-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Calculator size={18} />
                  <h3 className="font-bold uppercase tracking-tight text-sm">Record Salary Revision</h3>
                </div>
                <button onClick={() => setIsRevisionRecordOpen(false)} className="hover:bg-white/10 p-1 rounded-md transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs text-text-muted leading-relaxed">
                  Recording a revision will move the current wage to the history and update the employee record. 
                  Note: You cannot record revisions for locked payroll months.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-text-muted uppercase">New Rate (*)</label>
                    <input 
                      type="number"
                      value={revisionData.newRate}
                      onChange={(e) => setRevisionData({ ...revisionData, newRate: parseFloat(e.target.value) })}
                      className="w-full bg-slate-50 border border-app-border p-2 text-sm font-mono rounded-md outline-none focus:border-primary-navy shadow-inner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-text-muted uppercase">Effective Date (*)</label>
                    <input 
                      type="date"
                      value={revisionData.effectiveDate}
                      onChange={(e) => setRevisionData({ ...revisionData, effectiveDate: e.target.value })}
                      className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-md outline-none focus:border-primary-navy shadow-inner"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <SearchableSelect 
                    label="Revision Type"
                    options={[
                      { value: "Annual", label: "Annual Revision" },
                      { value: "Promotion/ Mid-Year", label: "Promotion / Mid-Year" },
                      { value: "Correction", label: "Correction" }
                    ]}
                    value={revisionData.revisionType}
                    onChange={(val) => setRevisionData({ ...revisionData, revisionType: val })}
                    placeholder="Select Revision Type"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-muted uppercase">Remarks</label>
                  <textarea 
                    value={revisionData.remarks}
                    onChange={(e) => setRevisionData({ ...revisionData, remarks: e.target.value })}
                    rows={2}
                    placeholder="Brief objective of this revision..."
                    className="w-full bg-slate-50 border border-app-border p-2 text-xs rounded-md outline-none focus:border-primary-navy shadow-inner"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-app-border">
                  <button
                    onClick={() => setIsRevisionRecordOpen(false)}
                    className="flex-1 px-4 py-2.5 text-xs font-bold text-text-muted bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRecordRevision}
                    disabled={isLoading || !revisionData.newRate || !revisionData.effectiveDate}
                    className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-primary-navy hover:bg-opacity-90 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2 uppercase shadow-lg shadow-primary-navy/10"
                  >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Confirm Revision
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SecurityLockModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirm Deletion"
        description="This action is irreversible. Please enter the security key to delete this employee record."
      />

      <SecurityLockModal 
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Confirm Bulk Deletion"
        description={`You are about to delete ${employeesToDelete.length} employee records. This action is irreversible. Please enter the security key to proceed with bulk deletion.`}
      />

      <MinorWarningModal 
        isOpen={isMinorWarningOpen}
        onClose={() => {
          setIsMinorWarningOpen(false);
          setValue('dob', ''); // Clear the date if cancelled
        }}
        onProceed={() => {
          setMinorConfirmed(true);
          setIsMinorWarningOpen(false);
        }}
      />

      {/* Edit Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <div 
            className="absolute inset-0" 
            onClick={() => setIsDrawerOpen(false)} 
          />
          <div 
            className="relative w-full md:w-[90%] bg-app-bg h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-500 employee-master-form"
            onKeyDown={handleEnterToTab}
          >
            <div className="sticky top-0 z-10 bg-white border-b border-app-border p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-navy/10 rounded-lg flex items-center justify-center text-primary-navy">
                  <UserCircle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary-navy">
                    {selectedEmployeeId ? 'Edit Employee' : 'Add New Employee'}
                  </h3>
                  <p className="text-xs text-primary-navy/70 font-bold uppercase tracking-wide">
                    {subHeaderText}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                {!isNomineeShareValid && familyMembers.some(m => m.is_nominee) && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-red/10 border border-primary-red/20 rounded text-primary-red animate-pulse">
                    <ShieldAlert size={14} />
                    <span className="text-[10px] font-black uppercase tracking-tight">Nominee Share: {nomineeShareTotal}% (Needs 100%)</span>
                  </div>
                )}
                <button 
                  onClick={handleSubmit(onSubmit, onInvalid)}
                  disabled={isLoading || !isNomineeShareValid}
                  className={cn(
                    "app-btn flex items-center gap-2",
                    !isNomineeShareValid ? "bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300" : "app-btn-primary"
                  )}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : (isNomineeShareValid ? <Save size={18} /> : <ShieldAlert size={18} />)}
                  {selectedEmployeeId ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </div>

            <div className="p-6">
              <EmployeeFormProvider value={{
                form,
                currentMode,
                isSuperAdmin,
                photoPreview,
                signaturePreview,
                photoInputRef,
                signatureInputRef,
                handlePhotoChange,
                handleSignatureChange,
                isManualCodeAllowed,
                setIsBiometricManuallyEdited,
                employeeAge,
                isDifferentlyAbled,
                isCurrentManualEntry,
                setIsCurrentManualEntry,
                isCurrentPincodeVerified,
                setIsCurrentPincodeVerified,
                currentPincodeResults,
                setCurrentPincodeResults,
                isPermSameAsCurrent,
                isPermManualEntry,
                setIsPermManualEntry,
                isPermPincodeVerified,
                setIsPermPincodeVerified,
                permPincodeResults,
                setPermPincodeResults,
                // Employment Tab
                employeeStatuses,
                employmentTypes,
                groups,
                departments,
                designations,
                locations,
                divisions,
                categories,
                classes,
                shifts,
                employees,
                selectedGroupId,
                selectedLocationId,
                isRoot,
                gratuityEligibility,
                estimatedGratuity,
                isFteContractValue,
                // Wages Tab
                weeklyOffSource,
                selectedEmployeeId,
                workingDayTypes,
                salarySlabs,
                fetchRevisionHistory,
                setIsRevisionHistoryOpen,
                isBifurcationExceeded,
                isShowingHistoricalRate,
                revisionData,
                setRevisionData,
                setIsRevisionRecordOpen,
                bifurcationData,
                isBifurcationValid,
                gratuityLedger,
                // Docs Tab
                handleFileDownload: () => {},
                handleDuplicateCheck: async (field: string, value: string, name?: string) => false,
                isExitDateLocked,
                pfHistory,
                addPfRecord: () => setPfHistory([...pfHistory, { pf_number: watch('pf_number') || '', pf_joining_date: watch('pf_joining_date') || '' }]),
                removePfRecord: (idx) => setPfHistory(pfHistory.filter((_, i) => i !== idx)),
                esiHistory,
                addEsiRecord: () => setEsiHistory([...esiHistory, { esi_ip_number: watch('esi_ip_number') || '', esi_joining_date: watch('esi_joining_date') || '' }]),
                removeEsiRecord: (idx) => setEsiHistory(esiHistory.filter((_, i) => i !== idx)),
                bankHistory,
                addBankDetail,
                removeBankDetail: (idx) => setBankHistory(bankHistory.filter((_, i) => i !== idx)),
                isIfscSearching,
                handleIfscSearch: async () => {},
                // History Tab
                employmentHistory,
                setEmploymentHistory,
                addHistory,
                removeHistory,
              }}>
              <Tabs.Root defaultValue="general" className="flex flex-col lg:flex-row gap-6">
                <Tabs.List className="flex flex-row lg:flex-col gap-1 lg:w-64 shrink-0 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
                  {[
                    { id: 'general', label: 'General Info', icon: <UserCircle size={18} /> },
                    { id: 'employment', label: 'Employment Details', icon: <Building2 size={18} /> },
                    { id: 'wages', label: 'Wages & Weekly Off', icon: <Wallet size={18} /> },
                    { id: 'docs', label: 'Documents & Payment', icon: <FileText size={18} /> },
                    { id: 'history', label: 'Employment History', icon: <History size={18} /> },
                    { id: 'family', label: 'Family Details', icon: <Users size={18} /> },
                    currentMode === 'K' && selectedEmployeeId && employees.some(e => e.parent_employee_id === parseInt(selectedEmployeeId)) && (
                      { id: 'waterfall', label: 'Waterfall View', icon: <Layers size={18} /> }
                    )
                  ].filter(Boolean).map((tab: any) => (
                    <Tabs.Trigger 
                      key={tab.id}
                      value={tab.id} 
                      className={cn(
                        "px-4 py-3 text-sm textile-header flex items-center gap-3 transition-all cursor-pointer text-left whitespace-nowrap rounded-md font-bold",
                        "data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:bg-primary-navy/10",
                        "data-[state=active]:bg-primary-navy data-[state=active]:text-white data-[state=active]:shadow-lg"
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>

                <div className="flex-1 min-w-0">
                  {/* General Info Tab */}
                  <GeneralTab />
                  <EmploymentTab />
                  <WagesTab />
                  <DocsTab />
                  <HistoryTab />
          <Tabs.Content value="salary_old" className="hidden">
            {/* This tab is replaced by Wages & Weekly Off and Documents & Payment */}
          </Tabs.Content>

          {/* Family Details Tab */}
          <Tabs.Content value="family" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-app-border pb-2">
                <h3 className="textile-header font-bold text-primary-navy">Family Members & Nominees</h3>
                <button type="button" onClick={addFamilyMember} className="text-xs flex items-center gap-1 text-primary-navy hover:underline">
                  <Plus size={14} /> Add Member
                </button>
              </div>
              <div className="space-y-4">
                {/* Nominee Share Validation Banner */}
                {!isNomineeShareValid && familyMembers.some(m => m.is_nominee) && (
                  <div className="p-3 bg-primary-red/10 border border-primary-red/20 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                    <ShieldAlert className="text-primary-red" size={20} />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-primary-red">Total Nominee share must be exactly 100% for PF compliance.</p>
                      <p className="text-[10px] text-primary-red/70 font-bold uppercase tracking-wider">Current Total: {nomineeShareTotal}%</p>
                    </div>
                  </div>
                )}

                {familyMembers.map((member, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-8 gap-3 p-4 bg-slate-50 rounded-lg border border-app-border relative group items-end overflow-hidden">
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-[8px] uppercase text-text-muted font-bold">Name</label>
                      <input 
                        value={member.name || ''} 
                        onChange={(e) => {
                          const newMembers = [...familyMembers];
                          newMembers[idx].name = e.target.value;
                          setFamilyMembers(newMembers);
                        }}
                        className="w-full bg-white border border-app-border p-1.5 text-xs rounded focus:outline-none focus:border-primary-navy" 
                      />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                      <SearchableSelect 
                        label="Role"
                        options={[
                          { value: "Father", label: "Father" },
                          { value: "Mother", label: "Mother" },
                          { value: "Spouse", label: "Spouse" },
                          { value: "Son", label: "Son" },
                          { value: "Daughter", label: "Daughter" },
                          { value: "Brother", label: "Brother" },
                          { value: "Sister", label: "Sister" },
                          { value: "Father-in-law", label: "Father-in-law" },
                          { value: "Mother-in-law", label: "Mother-in-law" }
                        ]}
                        value={member.role || ''} 
                        onChange={(val) => {
                          const newMembers = [...familyMembers];
                          newMembers[idx].role = val;
                          setFamilyMembers(newMembers);
                        }}
                        placeholder="Select Role"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-[8px] uppercase text-text-muted font-bold">DOB</label>
                      <input 
                        type="date"
                        value={member.dob || ''} 
                        onChange={(e) => {
                          const newMembers = [...familyMembers];
                          newMembers[idx].dob = e.target.value;
                          setFamilyMembers(newMembers);
                        }}
                        className="w-full bg-white border border-app-border p-1.5 text-xs rounded focus:outline-none focus:border-primary-navy" 
                      />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-[8px] uppercase text-text-muted font-bold">Aadhar Number</label>
                      <input 
                        value={member.aadhar_no || ''} 
                        maxLength={12}
                        onChange={(e) => {
                          const newMembers = [...familyMembers];
                          newMembers[idx].aadhar_no = e.target.value.replace(/\D/g, '');
                          setFamilyMembers(newMembers);
                        }}
                        placeholder="12 digit Aadhar"
                        className="w-full bg-white border border-app-border p-1.5 text-xs rounded focus:outline-none focus:border-primary-navy font-mono" 
                      />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-[8px] uppercase text-text-muted font-bold">Mobile Number</label>
                      <input 
                        value={member.mobile || ''} 
                        maxLength={10}
                        onChange={(e) => {
                          const newMembers = [...familyMembers];
                          newMembers[idx].mobile = e.target.value.replace(/\D/g, '');
                          setFamilyMembers(newMembers);
                        }}
                        placeholder="10 digit Mobile"
                        className="w-full bg-white border border-app-border p-1.5 text-xs rounded focus:outline-none focus:border-primary-navy font-mono" 
                      />
                    </div>
                    <div className="space-y-1 md:col-span-1 flex flex-col items-center justify-center pb-1">
                      <label className="text-[8px] uppercase text-text-muted font-bold mb-1">Nominee</label>
                      <button
                        type="button"
                        onClick={() => {
                          const newMembers = [...familyMembers];
                          newMembers[idx].is_nominee = !newMembers[idx].is_nominee;
                          // Default 100 if first nominee, or 0
                          if (newMembers[idx].is_nominee && !newMembers[idx].nominee_share_percent) {
                             const existingNominees = newMembers.filter((m, i) => i !== idx && m.is_nominee);
                             if (existingNominees.length === 0) newMembers[idx].nominee_share_percent = 100;
                          }
                          setFamilyMembers(newMembers);
                        }}
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                          member.is_nominee ? "bg-primary-navy" : "bg-slate-300"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                            member.is_nominee ? "translate-x-5" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>

                    {member.is_nominee && (
                      <>
                        <div className="space-y-1 md:col-span-1 animate-in zoom-in-95 duration-200">
                          <label className="text-[8px] uppercase text-text-muted font-bold text-primary-navy">% Share (*)</label>
                          <input 
                            type="number"
                            required
                            value={member.nominee_share_percent || ''} 
                            onChange={(e) => {
                              const newMembers = [...familyMembers];
                              newMembers[idx].nominee_share_percent = Number(e.target.value);
                              setFamilyMembers(newMembers);
                            }}
                            className="w-full bg-white border-2 border-primary-navy/20 p-1.5 text-xs rounded focus:outline-none focus:border-primary-navy font-bold text-primary-navy" 
                          />
                        </div>
                        {calculateAge(member.dob) < 18 && (
                          <div className="space-y-1 md:col-span-1 animate-in zoom-in-95 duration-200">
                            <label className="text-[8px] uppercase text-text-muted font-bold text-primary-red">Guardian (*)</label>
                            <input 
                              required
                              value={member.guardian_name || ''} 
                              onChange={(e) => {
                                const newMembers = [...familyMembers];
                                newMembers[idx].guardian_name = e.target.value;
                                setFamilyMembers(newMembers);
                              }}
                              placeholder="Name"
                              className="w-full bg-white border-2 border-primary-red/20 p-1.5 text-xs rounded focus:outline-none focus:border-primary-red font-bold" 
                            />
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex items-end pb-1 justify-center md:col-span-1">
                      <button type="button" onClick={() => removeFamilyMember(idx)} className="p-1.5 text-primary-red hover:bg-primary-red/10 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {familyMembers.length === 0 && (
                  <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-app-border">
                    <Users size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-text-muted italic">No family details recorded.</p>
                  </div>
                )}
              </div>
            </div>
          </Tabs.Content>

          {/* Waterfall Tab */}
                  {currentMode === 'K' && (
                    <Tabs.Content value="waterfall" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      {waterfallData ? (
                        <WaterfallHierarchy 
                          parentEmployee={employees.find(e => e.id === parseInt(selectedEmployeeId!)) as any}
                          children={waterfallData.children}
                          logs={waterfallData.logs}
                          totalPool={waterfallData.totalPool}
                          residual={waterfallData.residual}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                          <Layers className="text-slate-200 animate-pulse" size={64} />
                          <p className="text-text-muted">Calculating Operational Waterfall...</p>
                        </div>
                      )}
                    </Tabs.Content>
                  )}
                </div>
              </Tabs.Root>
              </EmployeeFormProvider>
            </div>
          </div>
        </div>
      )}
      
      {isSyncDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-app-border bg-slate-50">
              <div className="flex items-center gap-3 text-primary-navy">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Upload size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold">Sync to Pakka</h3>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Employee: {syncEmployee?.name}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <SearchableSelect
                  label="Select Salary Slab"
                  required={true}
                  options={salarySlabs.map(s => ({ value: s.id.toString(), label: s.slab_name || s.name }))}
                  value={syncSlabId || ''}
                  onChange={(val) => setSyncSlabId(val)}
                  placeholder="Choose a slab..."
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase">Statutory Rate (*)</label>
                <input 
                  type="number" 
                  value={syncWageAmount || ''}
                  onChange={(e) => setSyncWageAmount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono" 
                  placeholder="0.00"
                />
              </div>

              <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex gap-3">
                <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  Syncing will create a copy of this employee in the Pakka (Statutory) database. 
                  Future updates in Kachha will not automatically reflect in Pakka.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-app-border flex gap-3 justify-end">
              <button
                onClick={() => setIsSyncDialogOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSyncToPakka}
                disabled={isSyncing || !syncSlabId || currentUser?.connection_status === 'DISCONNECTED'}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-200"
              >
                {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Sync Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
