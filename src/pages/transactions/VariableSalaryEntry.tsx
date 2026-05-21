import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePermission } from '../../hooks/useRBAC';
import { 
  Plus, Search, Edit2, Trash2, Download, Upload, Save, X, Calendar, UserCheck, 
  ArrowUpRight, ArrowDownRight, History, Zap, CheckCircle2, AlertCircle, Database,
  ArrowRight, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from '../../utils/xlsx';
import { useModule } from '../../contexts/ModuleContext';
import { EmployeeSearchSelect } from '../../components/form/EmployeeSearchSelect';
import { MultiSelect } from '../../components/common/MultiSelect';
import { Pagination } from '../../components/common/Pagination';
import { useGlobalFilter } from '../../store/useGlobalFilter';
import { useEarningsHistory } from '../../hooks/useEarningsHistory';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SalaryHead {
  id: number;
  name: string;
  type: 'EARNING' | 'DEDUCTION';
}

interface Employee {
  id: number;
  emp_code: string;
  name: string;
  department_id?: number;
  department_name?: string;
  designation_id?: number;
  designation_name?: string;
  group_id?: number;
  group_name?: string;
  location_id?: number;
  location_name?: string;
  division_id?: number;
  division_name?: string;
  category_id?: number;
  category_name?: string;
  class_id?: number;
  class_name?: string;
}

interface Transaction {
  id: number;
  transaction_type: 'EARNING' | 'DEDUCTION';
  date: string;
  salary_month_year: string;
  emp_id: number;
  emp_name?: string;
  emp_code?: string;
  head_id: number;
  head_name?: string;
  amount: number;
  reason: string;
  authorised_by: number;
  authorizer_name?: string;
  remark: string;
  is_bulk_entry: number;
}

interface VariableSalaryEntryProps {
  type: 'EARNING' | 'DEDUCTION';
  currentUser?: any;
}

function DateWarningModal({ isOpen, onClose, onProceed }: { isOpen: boolean, onClose: () => void, onProceed: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-orange-100 animate-in fade-in zoom-in duration-200">
        <div className="bg-orange-50 p-4 flex items-center justify-between border-b border-orange-100">
          <div className="flex items-center gap-2 text-orange-600">
            <AlertCircle size={20} />
            <h3 className="font-bold text-lg">Date Mismatch Warning</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-gray-700 leading-relaxed font-medium">
            You entered the transaction in future date or past date, Do you want to continue?
          </p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onProceed();
                onClose();
              }}
              className="flex-1 px-4 py-3 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors shadow-lg shadow-orange-200"
            >
              Proceed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VariableSalaryEntry({ type, currentUser }: VariableSalaryEntryProps) {
  const { currentMode } = useModule();
  const [view, setView] = useState<'SINGLE' | 'BULK' | 'HISTORY'>('SINGLE');
  
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const hasFilterPermission = isSuperAdmin || usePermission('Payroll.view');
  
  // Master Data
  const [heads, setHeads] = useState<SalaryHead[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Global Filter
  const { wageMonth, wageYear, fromDate, toDate, setWageFilter, setDateFilter } = useGlobalFilter();

  const sysMmInitial = String(new Date().getMonth() + 1).padStart(2, '0');
  const sysYyyyInitial = new Date().getFullYear();

  // Form State (Single)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    salary_month_year: `${sysMmInitial}-${sysYyyyInitial}`,
    emp_id: 0,
    head_id: 0,
    amount: 0,
    reason: '',
    authorised_by: 0,
    remark: ''
  });
  const [editId, setEditId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(500);

  const { data: historyResponse = { data: [], total: 0 }, isLoading: isLoadingHistory, refetch: refetchHistory } = useEarningsHistory(type, page, limit, formData.emp_id || null);
  const transactions = historyResponse?.data || [];
  const totalTransactions = historyResponse?.total || 0;

  // Bulk Fast Entry State
  const [bulkHeader, setBulkHeader] = useState({
    date: new Date().toISOString().split('T')[0],
    salary_month_year: `${sysMmInitial}-${sysYyyyInitial}`,
    head_id: 0,
    authorised_by: 0,
    reason: ''
  });
  const [bulkRows, setBulkRows] = useState<{ id: string; emp_id?: number; amount: string }[]>([
    { id: crypto.randomUUID(), amount: '' }
  ]);

  // Search State
  const [empSearch, setEmpSearch] = useState('');
  const [authSearch, setAuthSearch] = useState('');

  // History Filter State
  const [historySearch, setHistorySearch] = useState('');
  
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<number[]>([]);

  const [showDateWarning, setShowDateWarning] = useState(false);
  const [pendingSubmitAction, setPendingSubmitAction] = useState<(() => void) | null>(null);

  const checkDateMismatch = (dateStr: string) => {
    if (!dateStr) return false;
    const systemDate = new Date();
    const sysMm = String(systemDate.getMonth() + 1).padStart(2, '0');
    const sysYyyy = systemDate.getFullYear();
    const sysMonthYear = `${sysMm}-${sysYyyy}`;
    
    // Check against the current global/system month Year
    const mm = dateStr.slice(5, 7);
    const yyyy = dateStr.slice(0, 4);
    const dateMonthYear = `${mm}-${yyyy}`;
    
    return dateMonthYear !== sysMonthYear;
  };

  const handleDateBlur = (dateStr: string, isBulk: boolean) => {
    if (!dateStr) return;
    const mm = dateStr.slice(5, 7);
    const yyyy = dateStr.slice(0, 4);
    const monthYear = `${mm}-${yyyy}`;
    if (isBulk) {
      setBulkHeader(prev => ({ ...prev, salary_month_year: monthYear }));
    } else {
      setFormData(prev => ({ ...prev, salary_month_year: monthYear }));
    }
  };

  const salaryHeadRef = useRef<HTMLSelectElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headData = await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({ 
        tableName: 'salary_heads', 
        operation: 'list', 
        moduleType: currentMode,
        filters: { type: type }
      }) });
      setHeads(headData);
    } catch (err) {
      toast.error("Failed to fetch master data");
    } finally {
      setIsLoading(false);
    }
  };

  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [currentMode, type]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // text search
      if (historySearch) {
        const q = historySearch.toLowerCase();
        if (!t.emp_name?.toLowerCase().includes(q) && !t.emp_code?.toLowerCase().includes(q) && !t.head_name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [transactions, historySearch]);

  const executeSingleSubmit = async () => {
    try {
      const entryData = {
        ...formData,
        transaction_type: type,
        is_bulk_entry: 0
      };

      if (!entryData.amount || isNaN(entryData.amount)) {
        toast.error("Invalid amount");
        return;
      }
      if (!entryData.emp_id || !entryData.head_id) {
        toast.error("Employee and Salary Head are required");
        return;
      }

      if (currentMode === 'K') {
        const payload = { ...entryData, id: editId || undefined };
        await fetchApi('/api/payroll/transaction/save', { method: 'POST', body: JSON.stringify({ payload }) });
      } else {
        await fetchApi('/api/payroll/transaction/crud', { method: 'POST', body: JSON.stringify({
          operation: editId ? 'update' : 'create',
          id: editId || undefined,
          data: {
            transactionType: type,
            date: formData.date,
            salaryMonthYear: formData.salary_month_year,
            empId: formData.emp_id,
            headId: formData.head_id,
            amount: formData.amount,
            reason: formData.reason,
            authorisedBy: formData.authorised_by,
            remark: formData.remark,
            isBulkEntry: false
          },
          moduleType: currentMode
        }) });
      }
      toast.success(`${type} entry ${editId ? 'updated' : 'saved'} successfully`);
      setFormData({
        ...formData,
        emp_id: 0,
        head_id: 0,
        amount: 0,
        reason: '',
        remark: ''
      });
      setEditId(null);
      setEmpSearch('');
      if (editId) refetchHistory();
    } catch (err: any) {
      console.error("Failed to save entry:", err);
      toast.error(err?.message || err?.toString() || "Failed to save entry");
    }
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.emp_id || !formData.head_id || formData.amount <= 0) {
      toast.error("Please fill all required fields");
      return;
    }

    if (checkDateMismatch(formData.date)) {
      setPendingSubmitAction(() => executeSingleSubmit);
      setShowDateWarning(true);
    } else {
      await executeSingleSubmit();
    }
  };

  const handleBulkDeleteHistory = async () => {
    if (selectedHistoryItems.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedHistoryItems.length} transactions?`)) return;

    try {
      await fetchApi('/api/payroll/transaction/crud', { method: 'POST', body: JSON.stringify({ 
         operation: 'bulk_delete', 
         data: selectedHistoryItems,
         moduleType: currentMode 
      }) });
      toast.success(`Deleted ${selectedHistoryItems.length} transactions`);
      setSelectedHistoryItems([]);
      refetchHistory();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete transactions');
    }
  };

  const handleBulkRowChange = (index: number, field: 'emp_id' | 'amount', value: any) => {
    const newRows = [...bulkRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setBulkRows(newRows);
  };

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const executeBulkSave = async () => {
    if (!bulkHeader.head_id) {
        toast.error("Please select a Salary Head");
        return;
    }

    const validRows = bulkRows.filter(row => row.emp_id && row.amount);
    if (validRows.length === 0) {
       toast.error("No valid entry rows to process");
       return;
    }

    try {
      const payloadToInsert = validRows.map(row => {
         return {
             transaction_type: type,
             date: bulkHeader.date,
             salary_month_year: bulkHeader.salary_month_year,
             emp_id: row.emp_id,
             head_id: bulkHeader.head_id,
             amount: Number.isNaN(parseFloat(row.amount)) ? 0 : parseFloat(row.amount),
             reason: bulkHeader.reason,
             authorised_by: bulkHeader.authorised_by,
             is_bulk_entry: 1
         };
      });
      
      const res = await fetchApi<{ status: string, successCount: number, failedCount: number }>('/api/payroll/transaction/bulk-insert', { method: 'POST', body: JSON.stringify({ 
         payload: payloadToInsert,
         moduleType: currentMode
      }) });
      
      toast.success(`${res.successCount} transactions saved successfully` + (res.failedCount ? ` (${res.failedCount} failed)` : ''));
      const sysMm = String(new Date().getMonth() + 1).padStart(2, '0');
      const sysYyyy = new Date().getFullYear();
      setBulkHeader({
        date: new Date().toISOString().split('T')[0],
        salary_month_year: `${sysMm}-${sysYyyy}`,
        head_id: 0,
        reason: '',
        authorised_by: 0
      });
      setBulkRows([{ id: crypto.randomUUID(), amount: '' }]);
    } catch (err: any) {
      console.error("Bulk save failed:", err);
      toast.error(err?.message || "Failed to save bulk entry");
    }
  };

  const handleBulkSave = async () => {
    if (checkDateMismatch(bulkHeader.date)) {
      setPendingSubmitAction(() => executeBulkSave);
      setShowDateWarning(true);
    } else {
      await executeBulkSave();
    }
  };

  const downloadXlsxTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['EmployeeCode', 'SalaryHead', 'Amount', 'Date', 'MonthYear', 'Reason', 'Authorizer', 'Remark'],
      ['EMP001', heads[0]?.name || 'BASIC', '1000', new Date().toISOString().split('T')[0], '04-2024', 'Performance Bonus', 'ADMIN', 'Excellent work']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${type}_Template.xlsx`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = await XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      
      try {
        // Process all records as payload for bulk insertion
        const payloadData = (data as any[]).map(record => ({
             transaction_type: type,
             date: record.Date,
             salary_month_year: record.MonthYear,
             emp_code: record.EmployeeCode,
             head_name: record.SalaryHead,
             amount: record.Amount,
             reason: record.Reason || '',
             remark: record.Remark || '',
             authorised_by_name: record.Authorizer || '',
             is_bulk_entry: 1
        }));
        const res = await fetchApi<{ status: string, successCount: number, failedCount: number }>('/api/payroll/transaction/bulk-insert', { method: 'POST', body: JSON.stringify({ 
           payload: payloadData,
           moduleType: currentMode
        }) });
        toast.success(`Bulk upload complete: ${res.successCount} saved` + (res.failedCount ? `, ${res.failedCount} failed.` : '.'));
        if (view === 'HISTORY') refetchHistory();
      } catch (err: any) {
        console.error("Bulk upload failed:", err);
        toast.error(err?.message || err?.toString() || "Bulk upload failed");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <DateWarningModal 
        isOpen={showDateWarning} 
        onClose={() => {
            setShowDateWarning(false);
            setPendingSubmitAction(null);
        }} 
        onProceed={() => {
            if (pendingSubmitAction) pendingSubmitAction();
        }} 
      />
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-app-border">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            type === 'EARNING' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
          )}>
            {type === 'EARNING' ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-navy textile-header tracking-tight">
              {type === 'EARNING' ? 'Earning Entry' : 'Deduction Entry'}
            </h1>
            <p className="text-text-muted text-sm capitalize">{currentMode === 'P' ? 'Statutory' : 'Operational'} Transaction Management</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-app-border">
          <button 
            onClick={() => setView('SINGLE')}
            className={cn(
              "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2",
              view === 'SINGLE' ? "bg-primary-navy text-white shadow-md" : "text-text-muted hover:text-primary-navy"
            )}
          >
            <Plus size={14} /> Single Entry
          </button>
          <button 
            onClick={() => setView('BULK')}
            className={cn(
              "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2",
              view === 'BULK' ? "bg-primary-navy text-white shadow-md" : "text-text-muted hover:text-primary-navy"
            )}
          >
            <Zap size={14} /> Bulk Fast-Entry
          </button>
          <button 
            onClick={() => setView('HISTORY')}
            className={cn(
              "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2",
              view === 'HISTORY' ? "bg-primary-navy text-white shadow-md" : "text-text-muted hover:text-primary-navy"
            )}
          >
            <History size={14} /> History
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'SINGLE' && (
          <motion.div 
            key="single"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSingleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-app-border space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Transaction Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                      <input 
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        onBlur={(e) => handleDateBlur(e.target.value, false)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-app-border rounded-xl text-sm focus:outline-none focus:border-primary-navy transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Salary Month-Year</label>
                    <input 
                      type="text"
                      placeholder="MM-YYYY"
                      value={formData.salary_month_year}
                      onChange={(e) => setFormData({...formData, salary_month_year: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-app-border rounded-xl text-sm focus:outline-none focus:border-primary-navy transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1 relative">
                    <EmployeeSearchSelect
                      label="Employee"
                      required
                      value={formData.emp_id}
                      onChange={(id) => setFormData({...formData, emp_id: Number(id)})}
                      onSelect={(emp) => setSelectedEmp(emp)}
                      placeholder="Search by name or code..."
                      nextFieldRef={salaryHeadRef}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Salary Head</label>
                    <select
                      ref={salaryHeadRef}
                      value={formData.head_id}
                      onChange={(e) => setFormData({...formData, head_id: parseInt(e.target.value)})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-app-border rounded-xl text-sm focus:outline-none focus:border-primary-navy transition-all"
                    >
                      <option value={0}>Select Salary Head</option>
                      {heads.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Amount (₹)</label>
                    <input 
                      ref={amountRef}
                      type="number"
                      value={Number.isNaN(formData.amount) ? '' : formData.amount}
                      onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-app-border rounded-xl text-sm focus:outline-none focus:border-primary-navy transition-all font-bold text-primary-navy"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1 relative">
                    <EmployeeSearchSelect
                      label="Authorised By"
                      value={formData.authorised_by}
                      onChange={(id) => setFormData({...formData, authorised_by: Number(id)})}
                      placeholder="Search authorizer..."
                      nextFieldRef={reasonRef}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Reason</label>
                    <input 
                      ref={reasonRef}
                      type="text"
                      value={formData.reason}
                      onChange={(e) => setFormData({...formData, reason: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-app-border rounded-xl text-sm focus:outline-none focus:border-primary-navy transition-all"
                      placeholder="e.g. Overtime Payment"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Remarks</label>
                    <input 
                      type="text"
                      value={formData.remark}
                      onChange={(e) => setFormData({...formData, remark: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-app-border rounded-xl text-sm focus:outline-none focus:border-primary-navy transition-all"
                      placeholder="Any additional notes..."
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-primary-navy text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-navy/90 shadow-lg shadow-primary-navy/20 transition-all active:scale-[0.98]"
                  >
                    <Save size={18} /> {editId ? 'Update' : 'Save'} {type === 'EARNING' ? 'Earning' : 'Deduction'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                        const sysMm = String(new Date().getMonth() + 1).padStart(2, '0');
                        const sysYyyy = new Date().getFullYear();
                        setFormData({
                            date: new Date().toISOString().split('T')[0],
                            salary_month_year: `${sysMm}-${sysYyyy}`,
                            emp_id: 0,
                            head_id: 0,
                            amount: 0,
                            reason: '',
                            authorised_by: 0,
                            remark: ''
                        });
                        setEditId(null);
                        setEmpSearch('');
                        setAuthSearch('');
                    }}
                    className="px-6 py-4 border border-app-border rounded-xl font-bold text-text-muted hover:bg-slate-50 transition-all"
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-app-border space-y-6">
                <h3 className="font-bold text-primary-navy border-b border-app-border pb-3 uppercase text-xs tracking-widest">Target Context</h3>
                {selectedEmp ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-app-border space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-text-muted font-mono uppercase">Department</span>
                        <span className="font-bold text-primary-navy bg-white px-2 py-1 rounded border border-app-border">{selectedEmp.department_name}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-text-muted font-mono uppercase">Designation</span>
                        <span className="font-bold text-primary-navy bg-white px-2 py-1 rounded border border-app-border">{selectedEmp.designation_name}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-text-muted font-mono uppercase">Group</span>
                        <span className="font-bold text-primary-navy bg-white px-2 py-1 rounded border border-app-border">{selectedEmp.group_name || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-text-muted italic text-xs space-y-4">
                    <Database size={32} className="mx-auto opacity-20" />
                    <p>Select an employee to view organizational context</p>
                  </div>
                )}
              </div>

              <div className="bg-primary-navy text-white p-6 rounded-2xl shadow-xl space-y-6">
                 <h3 className="font-bold border-b border-white/20 pb-3 uppercase text-xs tracking-widest">Excel Operations</h3>
                 <div className="grid grid-cols-1 gap-4">
                    <button 
                      onClick={downloadXlsxTemplate}
                      className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all"
                    >
                      <Download size={16} /> Download Template
                    </button>
                    <label className="w-full py-3 bg-white text-primary-navy rounded-xl flex items-center justify-center gap-2 text-sm font-bold cursor-pointer hover:bg-slate-100 transition-all shadow-lg active:scale-95">
                      <Upload size={16} /> 
                      Bulk Upload (XLSX)
                      <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} />
                    </label>
                 </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'BULK' && (
          <motion.div 
            key="bulk"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-app-border space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 p-6 bg-slate-50 rounded-2xl border border-app-border">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Date</label>
                  <input type="date" value={bulkHeader.date} onChange={e => setBulkHeader({...bulkHeader, date: e.target.value})} onBlur={(e) => handleDateBlur(e.target.value, true)} className="w-full bg-white border border-app-border p-2 rounded-lg text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Month-Year</label>
                  <input type="text" value={bulkHeader.salary_month_year} onChange={e => setBulkHeader({...bulkHeader, salary_month_year: e.target.value})} className="w-full bg-white border border-app-border p-2 rounded-lg text-sm" placeholder="MM-YYYY" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Salary Head</label>
                    <select
                      value={bulkHeader.head_id}
                      onChange={(e) => setBulkHeader({...bulkHeader, head_id: parseInt(e.target.value)})}
                      className="w-full bg-white border border-app-border p-2 rounded-lg text-sm"
                    >
                      <option value={0}>Select Head</option>
                      {heads.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Reason</label>
                    <input type="text" value={bulkHeader.reason} onChange={e => setBulkHeader({...bulkHeader, reason: e.target.value})} className="w-full bg-white border border-app-border p-2 rounded-lg text-sm" placeholder="Reason..." />
                </div>
                <div className="space-y-1 max-w-[200px]">
                  <EmployeeSearchSelect
                    label="Authorizer"
                    value={bulkHeader.authorised_by}
                    onChange={(id) => setBulkHeader({...bulkHeader, authorised_by: Number(id)})}
                    placeholder="Select Authorizer"
                  />
                </div>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="font-bold text-primary-navy uppercase text-xs tracking-widest flex items-center gap-2">
                        <Zap size={16} className="text-amber-500" /> Fast-Entry Grid
                    </h3>
                    <span className="text-[10px] font-mono text-text-muted italic bg-slate-100 px-2 py-1 rounded">Press ENTER/TAB in Amount to save & add row</span>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 border-t border-app-border pt-6">
                    {bulkRows.map((row, idx) => (
                      <div key={row.id} className="flex items-center gap-4 animate-in slide-in-from-left-4 duration-300">
                        <div className="flex-none w-8 h-8 rounded bg-slate-100 text-text-muted flex items-center justify-center font-mono text-xs border border-app-border">
                          {idx + 1}
                        </div>
                        <div className="flex-1 group relative" id={`row-emp-${idx}`}>
                           <EmployeeSearchSelect
                              value={row.emp_id}
                              onChange={val => handleBulkRowChange(idx, 'emp_id', Number(val))}
                              onSelect={(emp) => {
                                // optional: store codes if needed
                              }}
                              placeholder="Search Employee..."
                              nextFieldRef={{ get current() { return inputRefs.current[idx]; } }}
                           />
                        </div>
                        <div className="flex-1">
                           <input 
                              type="number"
                              placeholder="Amount"
                              value={row.amount}
                              onChange={e => handleBulkRowChange(idx, 'amount', e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === 'Tab') {
                                  if (idx === bulkRows.length - 1 && row.emp_id && row.amount) {
                                    setBulkRows([...bulkRows, { id: crypto.randomUUID(), amount: '' }]);
                                  }
                                }
                              }}
                              className="w-full bg-slate-50 border border-app-border px-3 py-2 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-primary-navy/10 transition-all font-bold text-primary-navy"
                           />
                        </div>
                        <button 
                          onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                 </div>

                 <div className="flex gap-4 border-t border-app-border pt-6">
                   <button 
                      onClick={() => setBulkRows([...bulkRows, { id: crypto.randomUUID(), amount: '' }])}
                      className="flex-1 py-4 border-2 border-dashed border-app-border rounded-2xl text-text-muted hover:border-primary-navy hover:text-primary-navy hover:bg-slate-50 transition-all font-bold text-sm flex items-center justify-center gap-2"
                   >
                      <Plus size={18} /> Add New Entry Line
                   </button>
                   <button
                      onClick={handleBulkSave}
                      className="flex-1 py-4 bg-primary-navy text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary-navy/90 shadow-lg shadow-primary-navy/20 transition-all"
                   >
                      <Save size={18} /> Save All Entries
                   </button>
                 </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'HISTORY' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-app-border">
               <div className="flex items-center justify-between border-b border-app-border pb-6 mb-6">
                  <div className="flex items-center gap-4">
                     <History size={20} className="text-primary-navy" />
                     <h3 className="font-bold text-primary-navy uppercase text-xs tracking-widest">Transaction History</h3>
                     {selectedHistoryItems.length > 0 && (
                       <button
                         onClick={handleBulkDeleteHistory}
                         className="flex items-center gap-2 bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors ml-4"
                       >
                         <Trash2 size={14} />
                         Delete ({selectedHistoryItems.length})
                       </button>
                     )}
                  </div>
                  <div className="flex items-center gap-2">
                     {hasFilterPermission && (
                       <div className="flex items-center gap-6 bg-slate-50 p-2 rounded-xl border border-app-border">
                         {/* Wage Filter */}
                         <div className="flex items-center gap-2">
                           <label className="text-[10px] font-mono text-text-muted uppercase">Wage:</label>
                           <input
                             type="month"
                             value={(wageYear && wageMonth) ? `${wageYear}-${String(wageMonth).padStart(2, '0')}` : ''}
                             onChange={(e) => {
                               const val = e.target.value;
                               if (!val) {
                                 setWageFilter(null, null);
                               } else {
                                 const [y, m] = val.split('-');
                                 setWageFilter(parseInt(m, 10), parseInt(y, 10));
                               }
                             }}
                             disabled={!!(fromDate || toDate)}
                             className="bg-white border border-app-border px-2 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50 min-w-[150px]"
                           />
                         </div>

                         {/* OR Divider */}
                         <div className="h-6 w-px bg-app-border relative">
                           <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-50 px-1 text-[8px] font-bold text-text-muted">OR</span>
                         </div>

                         {/* Date Filter */}
                         <div className="flex items-center gap-2">
                           <label className="text-[10px] font-mono text-text-muted uppercase">Date:</label>
                           <input 
                             type="date"
                             value={fromDate || ''}
                             onChange={e => setDateFilter(e.target.value, toDate)}
                             disabled={!!(wageMonth || wageYear)}
                             className="bg-white border border-app-border px-2 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 min-w-[110px]"
                           />
                           <span className="text-text-muted text-xs">-</span>
                           <input 
                             type="date"
                             value={toDate || ''}
                             onChange={e => setDateFilter(fromDate, e.target.value)}
                             disabled={!!(wageMonth || wageYear)}
                             className="bg-white border border-app-border px-2 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 min-w-[110px]"
                           />
                         </div>
                       </div>
                     )}
                  </div>
               </div>

               <div className="flex flex-col gap-4 mb-6">
                 <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                   <div className="relative w-full md:w-96">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                     <input
                       value={historySearch}
                       onChange={e => setHistorySearch(e.target.value)}
                       placeholder="Search by Code, Name, or Head..."
                       className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-navy/20 focus:border-primary-navy outline-none transition-all text-sm"
                     />
                   </div>
                 </div>

               </div>

               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 text-text-muted font-mono uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-3 font-medium">
                          <input
                            type="checkbox"
                            checked={filteredTransactions.length > 0 && selectedHistoryItems.length === filteredTransactions.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedHistoryItems(filteredTransactions.map(t => t.id));
                              } else {
                                setSelectedHistoryItems([]);
                              }
                            }}
                            className="rounded border-slate-300 text-primary-navy focus:ring-primary-navy/20"
                          />
                        </th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Employee</th>
                        <th className="px-4 py-3 font-medium">Salary Head</th>
                        <th className="px-4 py-3 font-medium text-right">Amount</th>
                        <th className="px-4 py-3 font-medium">Authorizer</th>
                        <th className="px-4 py-3 font-medium text-center">Source</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-app-border">
                      {filteredTransactions.map(t => (
                        <tr key={t.id} className={cn("hover:bg-slate-50/50 transition-colors group", selectedHistoryItems.includes(t.id) && "bg-primary-navy/5")}>
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedHistoryItems.includes(t.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedHistoryItems(prev => [...prev, t.id]);
                                } else {
                                  setSelectedHistoryItems(prev => prev.filter(id => id !== t.id));
                                }
                              }}
                              className="rounded border-slate-300 text-primary-navy focus:ring-primary-navy/20"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-bold text-primary-navy">{t.date}</p>
                            <p className="text-[10px] text-text-muted font-mono">{t.salary_month_year}</p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-primary-navy">
                                {t.emp_name?.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-primary-navy">{t.emp_name}</p>
                                <p className="text-[10px] text-text-muted font-mono">{t.emp_code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-primary-navy/5 text-primary-navy rounded text-[10px] font-bold uppercase">{t.head_name}</span>
                              {t.allocation_type && (
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[9px] font-bold border",
                                  t.allocation_type === 'K_ONLY' ? "border-amber-200 bg-amber-50 text-amber-700" :
                                  t.allocation_type === 'KP' ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                                  "border-slate-200 bg-slate-50 text-slate-700"
                                )}>
                                  {t.allocation_type}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                             <p className={cn(
                               "font-bold font-mono",
                               t.transaction_type === 'EARNING' ? "text-emerald-600" : "text-rose-600"
                             )}>
                               ₹{t.amount.toLocaleString()}
                             </p>
                          </td>
                          <td className="px-4 py-4">
                             <div className="flex items-center gap-1.5 text-xs text-text-muted">
                               <UserCheck size={12} />
                               {t.authorizer_name || 'N/A'}
                             </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                             {t.is_bulk_entry === 1 ? (
                               <span className="text-[8px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-bold uppercase ring-1 ring-amber-200">Bulk</span>
                             ) : (
                               <span className="text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold uppercase ring-1 ring-blue-200">Single</span>
                             )}
                          </td>
                          <td className="px-4 py-4 text-right">
                             <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                               <button 
                                  onClick={() => {
                                    setEditId(t.id);
                                    setFormData({
                                      date: t.date,
                                      salary_month_year: t.salary_month_year,
                                      emp_id: t.emp_id,
                                      head_id: t.head_id,
                                      amount: t.amount,
                                      reason: t.reason || '',
                                      authorised_by: t.authorised_by || 0,
                                      remark: t.remark || ''
                                    });
                                    setView('SINGLE');
                                  }}
                                  className="p-2 text-text-muted hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit"
                               >
                                 <Edit2 size={14} />
                               </button>
                               <button 
                                  onClick={async () => {
                                    if (confirm('Delete this transaction?')) {
                                      try {
                                        await fetchApi('/api/payroll/transaction/crud', { method: 'POST', body: JSON.stringify({ operation: 'delete', id: t.id, moduleType: currentMode }) });
                                        toast.success("Deleted");
                                        refetchHistory();
                                      } catch(e) {
                                        toast.error("Failed to delete");
                                      }
                                    }
                                  }}
                                  className="p-2 text-text-muted hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Delete"
                               >
                                 <Trash2 size={14} />
                               </button>
                             </div>
                          </td>
                        </tr>
                      ))}
                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-text-muted italic text-xs">
                             <Database size={48} className="mx-auto opacity-10 mb-4" />
                             No transactions found for this month 
                          </td>
                        </tr>
                      )}
                   </tbody>
                 </table>
               </div>
               {totalTransactions > 0 && (
                 <Pagination 
                   currentPage={page}
                   totalPages={Math.ceil(totalTransactions / limit)}
                   totalRecords={totalTransactions}
                   pageSize={limit}
                   onPageChange={(newPage) => setPage(newPage)}
                 />
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
