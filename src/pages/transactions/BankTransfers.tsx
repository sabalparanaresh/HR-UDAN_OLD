import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  Loader2, 
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/tauri';
import { useModule } from '../../contexts/ModuleContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { Pagination } from '../../components/common/Pagination';
import { processBankTransaction } from '../../services/bankTransactionProcessor';
import { useBankAccountConfig } from '../../hooks/useBankAccountConfig';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BankColumn {
  id: string;
  headerName: string;
  nature: 'Static' | 'Dynamic' | 'Incremental';
  dataType: 'Text' | 'Amount' | 'Number' | 'Date';
  dataSource?: 'Employee Master' | 'Salary Processed' | 'Loans' | 'Bank A/c Settings';
  field?: string;
  staticValue?: string;
  format?: string;
}

interface BankConfig {
  id: number;
  bankName?: string;
  bank_name?: string;
  columns: BankColumn[];
}

export default function BankTransfers() {
  const { currentMode } = useModule();
  const [configs, setConfigs] = useState<BankConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [salaryMonth, setSalaryMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [salaryData, setSalaryData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  const selectedExportConfig = configs.find(c => String(c.id) === selectedConfigId);
  const { selectedBankConfig } = useBankAccountConfig(selectedExportConfig?.bankName || selectedExportConfig?.bank_name);

  useEffect(() => {
    fetchConfigs();
  }, [currentMode]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  const filteredData = useMemo(() => {
    if (!searchTerm) return salaryData;
    const lower = searchTerm.toLowerCase();
    return salaryData.filter(row => 
      (row.emp_code && row.emp_code.toLowerCase().includes(lower)) ||
      (row.first_name && row.first_name.toLowerCase().includes(lower)) ||
      (row.last_name && row.last_name.toLowerCase().includes(lower)) ||
      (row.bank_name && row.bank_name.toLowerCase().includes(lower)) ||
      (row.department && row.department.toLowerCase().includes(lower))
    );
  }, [salaryData, searchTerm]);

  // If there are selections, only export those, otherwise export filtered
  const exportData = useMemo(() => {
     if (selectedRowIds.size > 0) {
       return filteredData.filter(row => selectedRowIds.has(String(row.emp_id)));
     }
     return filteredData;
  }, [filteredData, selectedRowIds]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const currentItems = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  const toggleAllInPage = () => {
    const pageIds = currentItems.map(item => String(item.emp_id));
    const allSelected = pageIds.every(id => selectedRowIds.has(id));
    const next = new Set(selectedRowIds);
    if (allSelected) {
      pageIds.forEach(id => next.delete(id));
    } else {
      pageIds.forEach(id => next.add(id));
    }
    setSelectedRowIds(next);
  };

  const fetchConfigs = async () => {
    try {
      const data = await invoke('get_bank_excel_configs', { module_type: currentMode }) as BankConfig[];
      setConfigs(data);
    } catch (err) {
      console.error("Failed to fetch configs:", err);
    }
  };

  const handleFetchData = async () => {
    if (!salaryMonth) {
      toast.error("Please select a Salary Month");
      return;
    }
    setIsLoading(true);
    try {
      const data = await invoke('get_processed_salary_for_bank', { 
        month: salaryMonth,
        module_type: currentMode 
      }) as any[];
      setSalaryData(data);
      if (data.length === 0) {
        toast.warning("No processed salary found for the selected month");
      } else {
        toast.success(`Fetched ${data.length} records`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch salary data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedConfigId) {
      toast.error("Please select a Bank Configuration");
      return;
    }
    if (exportData.length === 0) {
      toast.error("No data to export. Please adjust filters or fetch salary data.");
      return;
    }

    const config = configs.find(c => String(c.id) === selectedConfigId);
    if (!config) return;

    setIsGenerating(true);
    try {
      if (!selectedBankConfig) {
        throw new Error("No company bank account configuration found for the selected template. Ensure the bank is configured in Company Settings.");
      }

      const count = await processBankTransaction({
        bankConfig: selectedBankConfig,
        exportData,
        excelConfigColumns: config.columns,
        paymentDate,
        currentMode
      });

      toast.success("Bank Excel generated successfully!", {
        description: `Template: ${config.bankName || config.bank_name} | Records: ${count}`,
        className: 'bg-card-bg border-primary-navy text-text-main'
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate excel");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black flex items-center gap-3 text-primary-navy">
            <FileSpreadsheet size={32} />
            Bank Transfers
          </h2>
          <p className="text-sm font-mono text-primary-navy/70 uppercase tracking-widest">
            Salary Disbursement // Bulk Export
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selection Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="textile-card p-6 space-y-6">
            <h3 className="text-xs textile-header font-bold text-primary-navy uppercase border-b border-app-border pb-2">Export Parameters</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Bank Configuration</label>
                <select 
                  value={selectedConfigId}
                  onChange={(e) => setSelectedConfigId(e.target.value)}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                >
                  <option value="">Select Template</option>
                  {configs.map(c => (
                    <option key={c.id} value={c.id}>{c.bankName || c.bank_name}</option>
                  ))}
                </select>
                {selectedExportConfig && !selectedBankConfig && (
                  <div className="mt-1 flex items-start gap-1 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>Warning: This configuration refers to a bank that has been removed from Company Settings. Automatic variables will fail.</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Salary Month</label>
                <input 
                  type="month"
                  value={salaryMonth}
                  onChange={(e) => setSalaryMonth(e.target.value)}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Payment Date</label>
                <input 
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                />
              </div>

              <div className="pt-4 space-y-3">
                <button 
                  onClick={handleFetchData}
                  disabled={isLoading}
                  className="app-btn app-btn-outline w-full flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                  Fetch Salary Data
                </button>
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating || salaryData.length === 0}
                  className="app-btn app-btn-primary w-full flex items-center justify-center gap-2 shadow-md"
                >
                  {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                  Generate Bank File
                </button>
              </div>
            </div>
          </div>

          {salaryData.length > 0 && (
            <div className="textile-card p-4 bg-primary-navy/5 border-primary-navy/20 flex items-center gap-3">
              <div className="p-2 bg-white rounded-full text-primary-navy shadow-sm">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-primary-navy uppercase">Data Ready</p>
                <p className="text-[10px] text-text-muted">{salaryData.length} records loaded for {salaryMonth}</p>
              </div>
            </div>
          )}
        </div>

        {/* Data Preview */}
        <div className="lg:col-span-2">
          <div className="textile-card p-6 space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center border-b border-app-border pb-2 gap-4">
              <h3 className="text-xs textile-header font-bold text-primary-navy uppercase whitespace-nowrap">Salary Data Preview</h3>
              <div className="flex gap-2">
                {filteredData.length > 0 && (
                  <span className="bg-primary-navy/10 text-primary-navy text-[10px] font-mono px-2 py-0.5 rounded-full border border-primary-navy/20 whitespace-nowrap">
                    {filteredData.length} RECORDS
                  </span>
                )}
                {selectedRowIds.size > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap cursor-pointer hover:bg-amber-200" onClick={() => setSelectedRowIds(new Set())}>
                    {selectedRowIds.size} SELECTED (Clear)
                  </span>
                )}
              </div>
              <div className="flex-1 ml-4 relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input 
                  type="text" 
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-app-border rounded-md outline-none focus:border-primary-navy focus:bg-white transition-colors"
                  placeholder="Search by name, code, dept, bank..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
            
            {salaryData.length > 0 ? (
              <>
                <div className="flex-1 overflow-auto border border-app-border rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-app-border sticky top-0">
                        <th className="p-3 w-10">
                          <input 
                            type="checkbox" 
                            checked={currentItems.length > 0 && currentItems.every(i => selectedRowIds.has(String(i.emp_id)))}
                            onChange={toggleAllInPage}
                            className="rounded border-slate-300 text-primary-navy focus:ring-primary-navy"
                          />
                        </th>
                        <th className="p-3 text-[10px] textile-header text-text-muted uppercase">Emp Code</th>
                        <th className="p-3 text-[10px] textile-header text-text-muted uppercase">Name</th>
                        <th className="p-3 text-[10px] textile-header text-text-muted uppercase">Bank</th>
                        <th className="p-3 text-[10px] textile-header text-text-muted uppercase">Account No</th>
                        <th className="p-3 text-[10px] textile-header text-right text-text-muted uppercase">Net Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((row, idx) => (
                        <tr key={idx} className="border-b border-app-border last:border-b-0 hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <input 
                              type="checkbox" 
                              checked={selectedRowIds.has(String(row.emp_id))}
                              onChange={() => toggleSelection(String(row.emp_id))}
                              className="rounded border-slate-300 text-primary-navy focus:ring-primary-navy"
                            />
                          </td>
                          <td className="p-3 text-xs font-mono">{row.emp_code}</td>
                          <td className="p-3 text-xs font-bold">{row.first_name} {row.last_name}</td>
                          <td className="p-3 text-xs">{row.bank_name || '-'}</td>
                          <td className="p-3 text-xs font-mono">{row.account_no || '-'}</td>
                          <td className="p-3 text-xs font-bold text-right text-primary-navy">₹{Number(row.net_salary).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              <div className="mt-auto pt-4">
                <Pagination 
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalRecords={salaryData.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50/50 border-2 border-dashed border-app-border rounded-xl">
                <div className="p-4 bg-white rounded-full text-slate-200">
                  <FileSpreadsheet size={48} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-text-muted">No Data Loaded</p>
                  <p className="text-xs text-text-muted max-w-xs">Select parameters and click 'Fetch Salary Data' to preview records before generation.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
