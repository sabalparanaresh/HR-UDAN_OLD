import React, { useState, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { 
  Building2, 
  CreditCard, 
  Fingerprint, 
  PenTool, 
  Settings2, 
  Save, 
  Loader2,
  Database,
  Zap,
  Trash2,
  FolderOpen,
  Clock,
  RefreshCw,
  X,
  FileSpreadsheet,
  FileText,
  Info,
  Plus,
  Calculator
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User, Employee } from '../../types';
import PincodeSearch from '../../components/form/PincodeSearch';
import BankExcelConfigurator from './BankExcelConfigurator';
import { EmployeeSearchSelect } from '../../components/form/EmployeeSearchSelect';

import { usePermission } from '../../hooks/useRBAC';
import { useModule } from '../../contexts/ModuleContext';
import { invokeCommand as invoke } from '../../services/apiClient';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Validation Schema
const companySettingsSchema = z.object({
  // Company Information
  company_name: z.string().min(1, "Company name is required"),
  alias: z.string().optional(),
  phone: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal('')),
  date_of_incorporation: z.string().optional(),
  companyLogo: z.any().optional(),
  cin: z.string().optional(),
  lin: z.string().optional(),
  pf_reg_no: z.string().optional(),
  esi_reg_no: z.string().optional(),
  lwf_account_no: z.string().optional(),
  factory_license_no: z.string().optional(),
  factory_registration_no: z.string().optional(),
  udyog_aadhaar_reg_no: z.string().optional(),
  gst_no: z.string().optional(),
  tan: z.string().optional(),
  pan: z.string().optional(),
  activity: z.string().optional(),

  // Bank Accounts (List)
  bank_accounts: z.array(z.object({
    bank: z.string().optional(),
    account_no: z.string().optional(),
    ifsc_code: z.string().optional(),
    cms_client_code: z.string().optional(),
    cms_product_code: z.string().optional(),
    reference_start_no: z.string().optional(),
    payment_type_identifier_same_bank: z.string().optional(),
    payment_type_identifier_other_bank: z.string().optional(),
  })),
  
  // Coding Configuration
  emp_id_prefix: z.string().optional(),
  emp_id_suffix: z.string().optional(),
  emp_id_manual_entry: z.boolean(),
  emp_id_auto_increment: z.boolean(),
  emp_id_padding: z.number().min(0).max(10),
  emp_id_start_number: z.number().min(1),
  
  // Biometric Device
  biometric_ip: z.string().optional(),
  biometric_port: z.number().optional(),
  comm_key: z.string().optional(),
  connection_type: z.enum(['MS Access', 'SQL Server', 'Excel/CSV']),
  connection_string: z.string().optional(),
  db_name: z.string().optional(),
  db_user: z.string().optional(),
  db_password: z.string().optional(),
  procedure_name: z.string().optional(),
  device_entry_type: z.enum(['Single Row', 'Multi-Row']),
  table_name: z.string().optional(),
  col_employee_code: z.string().optional(),
  col_punch_time: z.string().optional(),
  col_punch_type: z.string().optional(),
  auto_fetch: z.boolean(),
  fetch_interval: z.number().min(15).max(120),
  
  // Signatory Configuration
  signatory_name: z.string().optional(),
  designation: z.string().optional(),
  signatories: z.array(z.object({
    emp_id: z.number().optional().nullable(),
    signatory_name: z.string().optional(),
    designation: z.string().optional(),
    signature: z.any().optional(),
  })).optional(),

  
  // Payroll Rules
  payroll_adjustment_head: z.string().optional(),
  weekly_off_source: z.enum(['Global', 'Employee']),
  k_salary_calculation_source: z.enum(['EMPLOYEE_MASTER', 'DAILY_MIS']).optional(),
});

type CompanySettingsData = z.infer<typeof companySettingsSchema>;

interface CompanySettingsProps {
  currentUser: User | null;
}

export default function CompanySettings({ currentUser }: CompanySettingsProps) {
  const { currentMode } = useModule();
  const canEdit = usePermission('CompanySettings.edit');
  const [isLoading, setIsLoading] = useState(false);

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  // Bank Entry Form State
  const [bankEntry, setBankEntry] = useState({
    bank: '',
    account_no: '',
    ifsc_code: '',
    cms_client_code: '',
    cms_product_code: '',
    reference_start_no: '',
    payment_type_identifier_same_bank: '',
    payment_type_identifier_other_bank: '',
  });

  const [masterBanks, setMasterBanks] = useState<any[]>([]);
  const [salaryHeads, setSalaryHeads] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isPincodeVerified, setIsPincodeVerified] = useState(false);
  const [selectedBankForConfig, setSelectedBankForConfig] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const banksData = await invoke('master_crud', {
          table_name: 'banks',
          operation: 'list',
          module_type: currentMode
        }) as any[];
        setMasterBanks(banksData);

        const empsData = await invoke('master_crud', {
          table_name: 'employees',
          operation: 'list',
          module_type: currentMode
        }) as any[];
        setEmployees(empsData);

        if (currentMode === 'K') {
          const headsData = await invoke('master_crud', {
            table_name: 'salary_heads',
            operation: 'list',
            module_type: currentMode
          }) as any[];
          setSalaryHeads(headsData);
        }
      } catch (err) {
        console.error("Failed to fetch master data:", err);
      }
    };
    fetchData();
  }, [currentMode]);

  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm<CompanySettingsData>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      company_name: "HR-UDAN TEXTILE MILLS",
      alias: "UDAN",
      phone: "022-12345678",
      address1: "123 Textile Estate",
      address2: "Mumbai Central",
      state: "Maharashtra",
      city: "Mumbai",
      pincode: "400001",
      email: "info@hr-udan.com",
      date_of_incorporation: "1995-05-15",
      cin: "L17110MH1995PLC012345",
      lin: "1234567890",
      pf_reg_no: "MH/MUM/12345",
      esi_reg_no: "31000123450001001",
      lwf_account_no: "LWF-98765",
      factory_license_no: "FAC-123",
      factory_registration_no: "REG-456",
      udyog_aadhaar_reg_no: "MH19A0012345",
      gst_no: "27ABCDE1234F1Z5",
      tan: "MUMW12345G",
      pan: "ABCDE1234F",
      activity: "Manufacturing of high-quality cotton textiles and garments.",
      bank_accounts: [
        {
          bank: "HDFC Bank",
          account_no: "123456789012",
          ifsc_code: "HDFC0001234",
          cms_client_code: "CMS123",
          cms_product_code: "PROD456",
          reference_start_no: "1000",
          payment_type_identifier_same_bank: "IFT",
          payment_type_identifier_other_bank: "NEFT"
        }
      ],
      emp_id_prefix: "UDAN-",
      emp_id_suffix: "-HR",
      emp_id_manual_entry: false,
      emp_id_auto_increment: true,
      emp_id_padding: 4,
      emp_id_start_number: 1,
      biometric_ip: "192.168.1.100",
      biometric_port: 4370,
      comm_key: "0",
      connection_type: "MS Access",
      connection_string: "C:\\Attendance\\DeviceLogs.mdb",
      device_entry_type: "Multi-Row",
      table_name: "CHECKINOUT",
      col_employee_code: "USERID",
      col_punch_time: "CHECKTIME",
      col_punch_type: "CHECKTYPE",
      auto_fetch: false,
      fetch_interval: 30,
      signatory_name: "Rajesh Kumar",
      designation: "General Manager",
      signatories: [],
      weekly_off_source: 'Global',
      k_salary_calculation_source: 'EMPLOYEE_MASTER',
    }
  });

  const { fields: signatoryFields, append: appendSignatory, remove: removeSignatory } = useFieldArray({
    control,
    name: 'signatories'
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await invoke('get_company_config', { module_type: currentMode }) as any;
        if (data) {
          Object.keys(data).forEach(key => {
            const val = data[key];
            // Handle specific types to avoid validation issues
            if (val === null || val === undefined) {
              // Don't overwrite if we have a default and the DB is null
              return;
            }

            // Convert 0/1 to boolean for fields that expect boolean in Zod
            const booleanFields = ['emp_id_manual_entry', 'emp_id_auto_increment', 'auto_fetch'];
            const numericFields = ['emp_id_padding', 'emp_id_start_number', 'biometric_port', 'fetch_interval'];
            
            if (booleanFields.includes(key)) {
              setValue(key as any, !!val);
            } else if (numericFields.includes(key)) {
              const numVal = Number(val);
              setValue(key as any, isNaN(numVal) ? 0 : numVal);
            } else {
              setValue(key as any, val ?? '');
            }
          });
        }

        if (currentMode === 'K') {
          const payrollRules = await invoke<any>('get_payroll_rules');
          if (payrollRules && payrollRules.k_salary_calculation_source) {
            setValue('k_salary_calculation_source', payrollRules.k_salary_calculation_source);
          }
        }
      } catch (err) {
        console.error("Failed to fetch company config:", err);
      }
    };
    fetchConfig();
  }, [currentMode, setValue]);

  const bank_accounts = watch('bank_accounts');

  const onSave = async (data: CompanySettingsData) => {
    setIsLoading(true);
    try {
      console.log("Saving Company Config:", data);
      
      await invoke('save_company_config', {
        config: data,
        module_type: currentMode
      });

      if (currentMode === 'K' && data.k_salary_calculation_source) {
        await invoke('update_payroll_rules', { rules: { k_salary_calculation_source: data.k_salary_calculation_source } });
      }

      toast.success(`Configuration saved successfully!`, {
        description: `All settings for ${data.company_name} have been updated.`,
        className: 'bg-card-bg border-primary-navy text-text-main'
      });
    } catch (err: any) {
      console.error("Save Error:", err);
      const errorMessage = typeof err === 'string' ? err : (err.message || "Failed to save configuration. System error.");
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddBank = () => {
    const currentAccounts = watch('bank_accounts') || [];
    // Basic validation
    if (currentAccounts.some(acc => acc.bank === bankEntry.bank && acc.account_no === bankEntry.account_no)) {
      toast.error("Account already exists");
      return;
    }
    if (!bankEntry.payment_type_identifier_same_bank || !bankEntry.payment_type_identifier_other_bank) {
      toast.error("Payment ID fields are mandatory");
      return;
    }
    if (bankEntry.ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankEntry.ifsc_code)) {
      toast.error("Invalid IFSC format. Must be 4 letters, a zero, and 6 alphanumeric characters.");
      return;
    }

    setValue('bank_accounts', [...currentAccounts, { ...bankEntry }]);
    setBankEntry({
      bank: '',
      account_no: '',
      ifsc_code: '',
      cms_client_code: '',
      cms_product_code: '',
      reference_start_no: '',
      payment_type_identifier_same_bank: '',
      payment_type_identifier_other_bank: '',
    });
    toast.success("Bank account added to list");
  };

  const handleClearBank = () => {
    setBankEntry({
      bank: '',
      account_no: '',
      ifsc_code: '',
      cms_client_code: '',
      cms_product_code: '',
      reference_start_no: '',
      payment_type_identifier_same_bank: '',
      payment_type_identifier_other_bank: '',
    });
  };

  const removeBank = (index: number) => {
    const currentAccounts = watch('bank_accounts') || [];
    setValue('bank_accounts', currentAccounts.filter((_, i) => i !== index));
  };

  const themeColors = {
    accent: 'text-primary-navy',
    border: 'border-primary-navy/30',
    bg: 'bg-primary-navy/10',
    button: 'app-btn-primary',
    tabActive: 'bg-primary-navy text-white',
    tabHover: 'hover:bg-primary-navy/10',
    icon: <Database className="text-primary-navy" size={20} />
  };

  return (
    <div className="space-y-6">
      
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black flex items-center gap-3">
            {themeColors.icon}
            Company Settings
          </h2>
          <p className={cn("text-sm font-mono", themeColors.accent)}>
            SYSTEM CONFIGURATION // GLOBAL PARAMETERS
          </p>
        </div>
        <button 
          onClick={handleSubmit(onSave, (errors) => {
            console.error("Validation Errors:", errors);
            const firstError = Object.values(errors)[0];
            toast.error("Validation Error", {
              description: firstError?.message?.toString() || "Please check the form for errors.",
              className: 'bg-primary-red/10 border-primary-red text-primary-red'
            });
          })}
          disabled={isLoading}
          className={cn(
            "app-btn flex items-center gap-2 cursor-pointer shadow-md transition-all",
            themeColors.button,
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {isLoading ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <Tabs.Root defaultValue="info" className="flex flex-col lg:flex-row gap-6">
        <Tabs.List className="flex flex-row lg:flex-col gap-1 lg:w-64 shrink-0 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
          <Tabs.Trigger 
            value="info" 
            className={cn(
              "px-4 py-3 text-sm textile-header flex items-center gap-3 transition-all cursor-pointer text-left whitespace-nowrap",
              "data-[state=active]:" + themeColors.tabActive,
              "data-[state=inactive]:" + themeColors.tabHover,
              "data-[state=inactive]:text-gray-400"
            )}
          >
            <Building2 size={18} />
            Company Info
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="bank" 
            className={cn(
              "px-4 py-3 text-sm textile-header flex items-center gap-3 transition-all cursor-pointer text-left whitespace-nowrap",
              "data-[state=active]:" + themeColors.tabActive,
              "data-[state=inactive]:" + themeColors.tabHover,
              "data-[state=inactive]:text-gray-400"
            )}
          >
            <CreditCard size={18} />
            Bank Account
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="coding" 
            className={cn(
              "px-4 py-3 text-sm textile-header flex items-center gap-3 transition-all cursor-pointer text-left whitespace-nowrap",
              "data-[state=active]:" + themeColors.tabActive,
              "data-[state=inactive]:" + themeColors.tabHover,
              "data-[state=inactive]:text-gray-400"
            )}
          >
            <Settings2 size={18} />
            Coding Config
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="biometric" 
            className={cn(
              "px-4 py-3 text-sm textile-header flex items-center gap-3 transition-all cursor-pointer text-left whitespace-nowrap",
              "data-[state=active]:" + themeColors.tabActive,
              "data-[state=inactive]:" + themeColors.tabHover,
              "data-[state=inactive]:text-gray-400"
            )}
          >
            <Fingerprint size={18} />
            Biometric Device
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="signatory" 
            className={cn(
              "px-4 py-3 text-sm textile-header flex items-center gap-3 transition-all cursor-pointer text-left whitespace-nowrap",
              "data-[state=active]:" + themeColors.tabActive,
              "data-[state=inactive]:" + themeColors.tabHover,
              "data-[state=inactive]:text-gray-400"
            )}
          >
            <PenTool size={18} />
            Signatory
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="payroll" 
            className={cn(
              "px-4 py-3 text-sm textile-header flex items-center gap-3 transition-all cursor-pointer text-left whitespace-nowrap",
              "data-[state=active]:" + themeColors.tabActive,
              "data-[state=inactive]:" + themeColors.tabHover,
              "data-[state=inactive]:text-gray-400"
            )}
          >
            <FileText size={18} />
            Payroll Rules
          </Tabs.Trigger>
        </Tabs.List>

        <div className="flex-1">
          <Tabs.Content value="info" className="textile-card p-6 space-y-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="textile-header text-lg font-bold border-b border-app-border pb-2 text-primary-navy">Company Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">Company Name (*)</label>
                <input 
                  {...register('company_name')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                />
                {errors.company_name && <p className="text-primary-red text-[10px]">{errors.company_name.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">Alias</label>
                <input 
                  {...register('alias')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">Phone</label>
                <input 
                  {...register('phone')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">Email</label>
                <input 
                  {...register('email')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                />
                {errors.email && <p className="text-primary-red text-[10px]">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">Date of Incorporation</label>
                <input 
                  type="date"
                  {...register('date_of_incorporation')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">Address 1</label>
                <input 
                  {...register('address1')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                />
                {errors.address1 && <p className="text-primary-red text-[10px]">{errors.address1.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">Address 2</label>
                <input 
                  {...register('address2')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">City</label>
                <input 
                  {...register('city')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase flex items-center justify-between">
                  <span>State</span>
                  {isPincodeVerified && (
                    <span className="text-[8px] text-primary-green italic normal-case" title="Verified via OGD Platform India">
                      Verified via OGD Platform India
                    </span>
                  )}
                </label>
                <input 
                  {...register('state')}
                  disabled={isPincodeVerified}
                  className={cn(
                    "w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md",
                    isPincodeVerified && "bg-slate-100 cursor-not-allowed opacity-70"
                  )}
                />
              </div>
              <div className="space-y-2">
                <PincodeSearch 
                  defaultValue={watch('pincode')}
                  onResult={(results) => {
                    if (results.length > 0) {
                      const data = results[0];
                      setValue('pincode', data.pincode);
                      setValue('state', data.statename);
                      setValue('city', data.districtname); // OGD district often maps to city in these forms
                      setIsPincodeVerified(true);
                    }
                  }}
                  onNotFound={() => {
                    setIsPincodeVerified(false);
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">CIN</label>
                <input 
                  {...register('cin')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">LIN</label>
                <input 
                  {...register('lin')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">PF Registration No</label>
                <input 
                  {...register('pf_reg_no')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">ESI Registration No</label>
                <input 
                  {...register('esi_reg_no')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">LWF Account No</label>
                <input 
                  {...register('lwf_account_no')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">Factory License No</label>
                <input 
                  {...register('factory_license_no')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">Factory Registration No</label>
                <input 
                  {...register('factory_registration_no')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">Udhoyg Aadhaar RegNo</label>
                <input 
                  {...register('udyog_aadhaar_reg_no')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">GSTNO</label>
                <input 
                  {...register('gst_no')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">TAN</label>
                <input 
                  {...register('tan')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">PAN</label>
                <input 
                  {...register('pan')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase">Company Logo</label>
                <input 
                  type="file"
                  className="w-full text-xs text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-primary-navy/10 file:text-primary-navy hover:file:bg-primary-navy/20 cursor-pointer"
                />
              </div>

              <div className="space-y-2 md:col-span-3">
                <label className="text-[10px] textile-header text-text-muted uppercase">Activity (Business Description)</label>
                <textarea 
                  {...register('activity')}
                  rows={3}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                  placeholder="Describe the nature of business..."
                />
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="bank" className="textile-card p-6 space-y-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="textile-header text-lg font-bold border-b border-app-border pb-2 text-primary-navy">Bank Account Configuration</h3>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-app-border space-y-4">
              <h4 className="text-xs textile-header font-bold text-primary-navy uppercase">Bank Entry Form</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase">Bank</label>
                  <input 
                    type="text"
                    value={bankEntry.bank || ''}
                    onChange={(e) => setBankEntry({...bankEntry, bank: e.target.value})}
                    placeholder="Enter Bank Name"
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase">Account No</label>
                  <input 
                    type="text"
                    value={bankEntry.account_no || ''}
                    onChange={(e) => setBankEntry({...bankEntry, account_no: e.target.value})}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase">IFSC Code</label>
                  <input 
                    type="text"
                    value={bankEntry.ifsc_code || ''}
                    onChange={(e) => setBankEntry({...bankEntry, ifsc_code: e.target.value})}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase">CMS Client Code</label>
                  <input 
                    type="text"
                    value={bankEntry.cms_client_code || ''}
                    onChange={(e) => setBankEntry({...bankEntry, cms_client_code: e.target.value})}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase">CMS Product Code</label>
                  <input 
                    type="text"
                    value={bankEntry.cms_product_code || ''}
                    onChange={(e) => setBankEntry({...bankEntry, cms_product_code: e.target.value})}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase">Reference Start No</label>
                  <input 
                    type="text"
                    value={bankEntry.reference_start_no || ''}
                    onChange={(e) => setBankEntry({...bankEntry, reference_start_no: e.target.value})}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase">Payment ID (Same Bank)</label>
                  <input 
                    type="text"
                    value={bankEntry.payment_type_identifier_same_bank || ''}
                    onChange={(e) => setBankEntry({...bankEntry, payment_type_identifier_same_bank: e.target.value})}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                    placeholder="e.g. IFT"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase">Payment ID (Other Bank)</label>
                  <input 
                    type="text"
                    value={bankEntry.payment_type_identifier_other_bank || ''}
                    onChange={(e) => setBankEntry({...bankEntry, payment_type_identifier_other_bank: e.target.value})}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                    placeholder="e.g. NEFT"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  type="button"
                  onClick={handleAddBank}
                  className="app-btn app-btn-primary text-xs px-6"
                >
                  Add
                </button>
                <button 
                  type="button"
                  onClick={handleClearBank}
                  className="app-btn app-btn-outline text-xs px-6"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs textile-header font-bold text-primary-navy uppercase">Configured Bank Accounts</h4>
              <div className="textile-card overflow-hidden border-app-border/50">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-app-border">
                      <th className="p-2 text-[10px] textile-header text-text-muted">Bank</th>
                      <th className="p-2 text-[10px] textile-header text-text-muted">Account No</th>
                      <th className="p-2 text-[10px] textile-header text-text-muted">IFSC</th>
                      <th className="p-2 text-[10px] textile-header text-text-muted">CMS Client</th>
                      <th className="p-2 text-[10px] textile-header text-text-muted">CMS Product</th>
                      <th className="p-2 text-[10px] textile-header text-text-muted">P.ID(Same)</th>
                      <th className="p-2 text-[10px] textile-header text-text-muted">P.ID(Other)</th>
                      <th className="p-2 text-[10px] textile-header text-right text-text-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bank_accounts.length > 0 ? bank_accounts.map((acc, idx) => (
                      <tr key={idx} className="border-b border-app-border/30 hover:bg-slate-50">
                        <td className="p-2 text-xs font-bold text-text-main">{acc.bank}</td>
                        <td className="p-2 text-xs font-mono">{acc.account_no}</td>
                        <td className="p-2 text-xs font-mono">{acc.ifsc_code}</td>
                        <td className="p-2 text-xs font-mono">{acc.cms_client_code || '-'}</td>
                        <td className="p-2 text-xs font-mono">{acc.cms_product_code || '-'}</td>
                        <td className="p-2 text-xs font-mono">{acc.payment_type_identifier_same_bank || '-'}</td>
                        <td className="p-2 text-xs font-mono">{acc.payment_type_identifier_other_bank || '-'}</td>
                        <td className="p-2 text-right flex justify-end gap-1">
                          <button 
                            type="button"
                            onClick={() => setSelectedBankForConfig(acc.bank)}
                            className="text-primary-navy hover:bg-primary-navy/10 p-1 rounded transition-colors"
                            title="Configure Excel Export"
                          >
                            <FileSpreadsheet size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => removeBank(idx)}
                            className="text-primary-red hover:bg-primary-red/10 p-1 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-xs text-text-muted italic">
                          No bank accounts configured yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="coding" className="textile-card p-6 space-y-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="textile-header text-lg font-bold border-b border-app-border pb-2 text-primary-navy">System Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Employee ID Prefix</label>
                <input 
                  {...register('emp_id_prefix')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                  placeholder="e.g. EMP-"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Employee ID Suffix</label>
                <input 
                  {...register('emp_id_suffix')}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                  placeholder="e.g. -HR"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Padding Digits</label>
                <input 
                  type="number"
                  {...register('emp_id_padding', { valueAsNumber: true })}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
                <p className="text-[9px] text-text-muted italic">Number of zeros to pad the sequence (e.g. 4 &rarr; 0001)</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Start Number</label>
                <input 
                  type="number"
                  {...register('emp_id_start_number', { valueAsNumber: true })}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                />
                <p className="text-[9px] text-text-muted italic">The sequence will start from this number for new companies.</p>
              </div>

              <div className="flex flex-col gap-4 md:col-span-2 bg-slate-50 p-4 rounded-md border border-app-border">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox"
                      {...register('emp_id_manual_entry')}
                      className="w-4 h-4 rounded border-app-border text-primary-navy focus:ring-primary-navy"
                    />
                    <span className="text-xs font-bold text-primary-navy uppercase tracking-wider group-hover:text-primary-green transition-colors">Manual Entry Allowed?</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox"
                      {...register('emp_id_auto_increment')}
                      className="w-4 h-4 rounded border-app-border text-primary-navy focus:ring-primary-navy"
                    />
                    <span className="text-xs font-bold text-primary-navy uppercase tracking-wider group-hover:text-primary-green transition-colors">Auto Increment?</span>
                  </label>
                </div>
              </div>

              <div className="md:col-span-2 bg-primary-navy/5 border border-primary-navy/20 p-4 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] textile-header font-bold text-primary-navy uppercase tracking-widest">ID Format Preview</h4>
                  <Zap size={14} className="text-primary-green animate-pulse" />
                </div>
                <div className="bg-white border border-primary-navy/10 p-3 rounded font-mono text-xl text-center text-primary-navy font-black tracking-tighter shadow-inner">
                  {String(watch('emp_id_prefix') || '')}
                  {String(watch('emp_id_start_number') || 1).padStart(Number(watch('emp_id_padding') || 0), '0')}
                  {String(watch('emp_id_suffix') || '')}
                </div>
                <p className="text-[9px] text-text-muted mt-2 text-center italic">This is how the first generated Employee ID will appear.</p>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="biometric" className="textile-card p-6 space-y-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="textile-header text-lg font-bold border-b border-app-border pb-2 text-primary-navy">Biometric Device Integration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Connection Settings */}
              <div className="space-y-4 p-4 border border-app-border rounded-lg bg-slate-50/50">
                <h4 className="text-xs font-bold text-primary-navy uppercase flex items-center gap-2">
                  <Database size={14} /> Connection Settings
                </h4>
                
                <div className="space-y-2">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Connection Type</label>
                  <select 
                    {...register('connection_type')}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                  >
                    <option value="MS Access">MS Access (.mdb)</option>
                    <option value="SQL Server">SQL Server</option>
                    <option value="Excel/CSV">Excel/CSV</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Connection String / Path</label>
                  <div className="flex gap-2">
                    <input 
                      {...register('connection_string')}
                      className="flex-1 bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                      placeholder={watch('connection_type') === 'MS Access' ? 'C:\\Path\\To\\Database.mdb' : 'Server=...;Database=...'}
                    />
                    <button 
                      type="button"
                      className="p-2 bg-slate-200 hover:bg-slate-300 text-text-main rounded-md transition-colors"
                      title="Browse"
                    >
                      <FolderOpen size={18} />
                    </button>
                  </div>
                  {errors.connection_string && <p className="text-primary-red text-[10px]">{errors.connection_string.message}</p>}
                </div>

                {(watch('connection_type') === 'SQL Server' || watch('connection_type') === 'MS Access') && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Database Name</label>
                        <input 
                          {...register('db_name')}
                          className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                          placeholder="e.g. BioStar"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Procedure Name / Query</label>
                        <input 
                          {...register('procedure_name')}
                          className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md font-mono"
                          placeholder={watch('connection_type') === 'SQL Server' ? 'EXEC GetPunches' : 'SELECT * FROM Punches'}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Database Login ID</label>
                        <input 
                          {...register('db_user')}
                          className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                          placeholder="sa"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Database Password</label>
                        <input 
                          type="password"
                          {...register('db_password')}
                          className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Device Entry Type</label>
                  <select 
                    {...register('device_entry_type')}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                  >
                    <option value="Single Row">Single Row (In/Out in same record)</option>
                    <option value="Multi-Row">Multi-Row (Separate records for In and Out)</option>
                  </select>
                </div>
              </div>

              {/* Column Mapping */}
              <div className="space-y-4 p-4 border border-app-border rounded-lg bg-slate-50/50">
                <h4 className="text-xs font-bold text-primary-navy uppercase flex items-center gap-2">
                  <Settings2 size={14} /> Column Mapping
                </h4>

                <div className="space-y-2">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Table Name</label>
                  <input 
                    {...register('table_name')}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                    placeholder="e.g. CHECKINOUT"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Employee Code</label>
                    <input 
                      {...register('col_employee_code')}
                      className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Punch Time</label>
                    <input 
                      {...register('col_punch_time')}
                      className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Punch Type</label>
                    <input 
                      {...register('col_punch_type')}
                      className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* Auto Fetch Settings */}
              <div className="md:col-span-2 space-y-4 p-4 border border-app-border rounded-lg bg-primary-navy/5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-primary-navy uppercase flex items-center gap-2">
                    <RefreshCw size={14} /> Auto Fetch Configuration
                  </h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      {...register('auto_fetch')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-green"></div>
                    <span className="ml-3 text-xs font-bold text-primary-navy uppercase">Enable Auto Fetch</span>
                  </label>
                </div>

                {watch('auto_fetch') && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Fetch Interval (Minutes)</label>
                      <span className="text-xs font-bold text-primary-navy bg-white px-2 py-1 rounded border border-app-border">
                        {watch('fetch_interval')} Minutes
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="15"
                      max="120"
                      step="15"
                      {...register('fetch_interval', { valueAsNumber: true })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-navy"
                    />
                    <div className="flex justify-between text-[8px] text-text-muted font-bold uppercase">
                      <span>15m</span>
                      <span>30m</span>
                      <span>45m</span>
                      <span>60m</span>
                      <span>75m</span>
                      <span>90m</span>
                      <span>105m</span>
                      <span>120m</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="signatory" className="textile-card p-6 space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="flex justify-between items-center border-b border-app-border pb-2">
              <h3 className="textile-header text-lg font-bold text-primary-navy">Authorized Signatories</h3>
              <button 
                type="button" 
                onClick={() => appendSignatory({ emp_id: null, signatory_name: '', designation: '' })}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-2 rounded bg-primary-navy text-white hover:bg-primary-navy/90 border border-primary-navy/20"
              >
                <Plus size={14} /> Add Signatory
              </button>
            </div>
            
            <div className="space-y-6">
              {signatoryFields.length === 0 ? (
                <div className="text-center py-8 text-text-muted">
                  <p>No signatories added yet.</p>
                </div>
              ) : (
                signatoryFields.map((field, index) => (
                  <div key={field.id} className="relative grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 border border-app-border rounded-lg p-6">
                    <button 
                      type="button"
                      onClick={() => removeSignatory(index)}
                      className="absolute top-2 right-2 text-text-muted hover:text-primary-red transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                    
                    <div className="space-y-2">
                      <EmployeeSearchSelect 
                        label="Employee"
                        employees={employees}
                        value={watch(`signatories.${index}.emp_id`)}
                        onChange={(val) => {
                          setValue(`signatories.${index}.emp_id`, Number(val));
                          const emp = employees.find(e => e.id === Number(val));
                          if (emp) {
                            setValue(`signatories.${index}.signatory_name`, emp.name);
                            setValue(`signatories.${index}.designation`, emp.designation_name || emp.designation);
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] textile-header text-text-muted uppercase">Signatory Name</label>
                      <input 
                        {...register(`signatories.${index}.signatory_name`)}
                        className="w-full bg-white border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                        placeholder="Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] textile-header text-text-muted uppercase">Designation</label>
                      <input 
                        {...register(`signatories.${index}.designation`)}
                        className="w-full bg-white border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                        placeholder="Designation"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] textile-header text-text-muted uppercase">Digital Signature (.png/.jpg)</label>
                      <input 
                        type="file"
                        accept="image/png, image/jpeg"
                        className="hidden"
                        id={`signature-upload-${index}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setValue(`signatories.${index}.signature`, reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label 
                        htmlFor={`signature-upload-${index}`}
                        className="block border-2 border-dashed border-app-border rounded-md p-4 text-center hover:border-primary-navy transition-colors cursor-pointer bg-white overflow-hidden relative"
                      >
                        {watch(`signatories.${index}.signature`) ? (
                          <div className="flex flex-col items-center justify-center">
                            <img 
                              src={watch(`signatories.${index}.signature`)} 
                              alt="Signature" 
                              className="max-h-12 object-contain"
                            />
                            <span className="text-[10px] sm:absolute sm:top-1 sm:right-1 bg-slate-100 px-2 py-0.5 rounded text-text-muted mt-2 sm:mt-0">Change</span>
                          </div>
                        ) : (
                          <>
                            <PenTool className="mx-auto text-text-muted mb-2 z-10" size={24} />
                            <p className="text-xs text-text-muted z-10">Select signature image</p>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Tabs.Content>

          <Tabs.Content value="payroll" className="textile-card p-6 space-y-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="textile-header text-lg font-bold border-b border-app-border pb-2 text-primary-navy font-bold">Payroll & Attendance Rules</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {currentMode === 'K' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <h4 className="text-xs textile-header font-bold text-primary-navy uppercase tracking-wider flex items-center gap-2">
                    <Settings2 size={14} /> Adjustment Configuration
                  </h4>
                  <div className="bg-slate-50 p-6 rounded-lg border border-app-border space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-tight">Payroll Adjustment Head</label>
                      <select 
                        {...register('payroll_adjustment_head')}
                        className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md font-medium"
                      >
                        <option value="">No Adjustment Head Linked</option>
                        {salaryHeads
                          .filter(head => head.type === 'EARNING')
                          .map(head => (
                            <option key={head.id} value={head.name}>{head.name}</option>
                          ))}
                      </select>
                      <p className="text-[9px] text-text-muted leading-relaxed italic">
                        Select the salary head where any manual payroll adjustments or round-offs will be applied by default.
                      </p>
                    </div>
                  </div>

                  <h4 className="text-xs textile-header font-bold text-primary-navy uppercase tracking-wider flex items-center gap-2 mt-8">
                    <Calculator size={14} /> K Salary Engine Source
                  </h4>
                  <div className="bg-slate-50 p-6 rounded-lg border border-app-border space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-tight">Salary Calculation Source</label>
                      <div className="flex bg-white p-1 rounded-lg border border-app-border w-fit">
                        <button
                          type="button"
                          onClick={() => setValue('k_salary_calculation_source', 'EMPLOYEE_MASTER')}
                          className={cn(
                            "px-4 py-2 text-xs font-bold rounded-md transition-all uppercase tracking-widest",
                            watch('k_salary_calculation_source') === 'EMPLOYEE_MASTER' 
                              ? "bg-primary-navy text-white shadow-md scale-105" 
                              : "text-text-muted hover:bg-slate-100"
                          )}
                        >
                          Employee Master
                        </button>
                        <button
                          type="button"
                          onClick={() => setValue('k_salary_calculation_source', 'DAILY_MIS')}
                          className={cn(
                            "px-4 py-2 text-xs font-bold rounded-md transition-all uppercase tracking-widest",
                            watch('k_salary_calculation_source') === 'DAILY_MIS' 
                              ? "bg-primary-navy text-white shadow-md scale-105" 
                              : "text-text-muted hover:bg-slate-100"
                          )}
                        >
                          Daily MIS
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-primary-navy/5 p-3 rounded border border-primary-navy/10 flex gap-3">
                      <Info className="text-primary-navy shrink-0" size={16} />
                      <p className="text-[10px] text-primary-navy/80 leading-relaxed font-medium">
                        {watch('k_salary_calculation_source') === 'EMPLOYEE_MASTER' 
                          ? "EMPLOYEE MASTER: System will use standard processing based on designations, classes, and master rates."
                          : "DAILY MIS: System will use Daily MIS attendance combined with dynamic worked rates."
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-xs textile-header font-bold text-primary-navy uppercase tracking-wider flex items-center gap-2">
                  <Clock size={14} /> Weekly Off Rules
                </h4>
                <div className="bg-slate-50 p-6 rounded-lg border border-app-border space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-tight">Weekly Off Application</label>
                    <div className="flex bg-white p-1 rounded-lg border border-app-border w-fit">
                      <button
                        type="button"
                        onClick={() => setValue('weekly_off_source', 'Global')}
                        className={cn(
                          "px-6 py-2 text-xs font-bold rounded-md transition-all uppercase tracking-widest",
                          watch('weekly_off_source') === 'Global' 
                            ? "bg-primary-navy text-white shadow-md scale-105" 
                            : "text-text-muted hover:bg-slate-100"
                        )}
                      >
                        Global
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue('weekly_off_source', 'Employee')}
                        className={cn(
                          "px-6 py-2 text-xs font-bold rounded-md transition-all uppercase tracking-widest",
                          watch('weekly_off_source') === 'Employee' 
                            ? "bg-primary-navy text-white shadow-md scale-105" 
                            : "text-text-muted hover:bg-slate-100"
                        )}
                      >
                        Employee
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-primary-navy/5 p-3 rounded border border-primary-navy/10 flex gap-3">
                    <Info className="text-primary-navy shrink-0" size={16} />
                    <p className="text-[10px] text-primary-navy/80 leading-relaxed font-medium">
                      {watch('weekly_off_source') === 'Global' 
                        ? "GLOBAL MODE: System will strictly use the Weekly Off defined in the Weekly Off Master for all calculations."
                        : "EMPLOYEE MODE: System will look at individual Weekly Off settings defined in each Employee's Master record."
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.Content>

          {/* Bank Excel Config Modal-like Overlay */}
          {selectedBankForConfig && (
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col border border-app-border animate-in zoom-in-95 duration-300">
                <div className="p-4 border-b border-app-border flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-navy text-white rounded-lg">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm textile-header font-bold text-primary-navy uppercase">Excel Export Configuration</h3>
                      <p className="text-[10px] font-mono text-text-muted uppercase">Bank: {selectedBankForConfig}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedBankForConfig(null)}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors text-text-muted"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                  <BankExcelConfigurator 
                    standalone={false} 
                    initialBankName={selectedBankForConfig} 
                    onClose={() => setSelectedBankForConfig(null)} 
                  />
                </div>
                <div className="p-4 border-t border-app-border bg-slate-50 flex justify-end">
                  <button 
                    onClick={() => setSelectedBankForConfig(null)}
                    className="app-btn app-btn-outline px-6"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Tabs.Root>
    </div>
  );
}
