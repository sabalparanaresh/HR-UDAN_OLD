import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, 
  Calculator, 
  ShieldCheck, 
  Search, 
  RefreshCw,
  Loader2,
  AlertCircle,
  X
} from 'lucide-react';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import { useModule } from '../../contexts/ModuleContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { Pagination } from '../../components/common/Pagination';
import { MultiSelect } from '../../components/common/MultiSelect';
import { EmployeeSearchSelect } from '../../components/form/EmployeeSearchSelect';
import { useAdvanceSimulation } from '../../hooks/useAdvanceSimulation';
import { useAdvanceFiltersStore } from '../../store/advanceFiltersStore';
import { useRenderProfile } from '../../hooks/useAttendancePerformance';

interface AdvanceDraft {
  emp_id: number;
  emp_code: string;
  name: string;
  group_dept: string;
  designation: string;
  wage_rate: number;
  k_attendance: number;
  k_gross_earned: number;
  k_total_deduction: number;
  p_gross: number;
  p_total_deduction: number;
  p_attendance: number;
  net_payable: number;
  advance_input: number;
  remaining: number;
}

export default function AdvanceProcessing({ currentUser }: { currentUser: any }) {
  useRenderProfile('AdvanceProcessing');
  const { currentMode } = useModule();
  
  const filters = useAdvanceFiltersStore(state => state.filters);
  const setFilters = useAdvanceFiltersStore(state => state.setFilters);

  const [percentage, setPercentage] = useState(50);
  const [threshold, setThreshold] = useState(1000);
  const [rounding, setRounding] = useState(100);
  const [authorizerId, setAuthorizerId] = useState<number | ''>('');
  
  const [drafts, setDrafts] = useState<AdvanceDraft[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [masters, setMasters] = useState({
    locations: [] as any[],
    divisions: [] as any[],
    departments: [] as any[],
    groups: [] as any[],
    classes: [] as any[],
    categories: [] as any[],
    designations: [] as any[],
  });

  const { simulationQuery, postAdvancesMutation } = useAdvanceSimulation(
    filters.wageMonth,
    filters.fromDate,
    filters.toDate,
    {
      locationIds: filters.locationFilters,
      divisionIds: filters.divisionFilters,
      departmentIds: filters.departmentFilters,
      groupIds: filters.groupFilters,
      classIds: filters.classFilters,
      categoryIds: filters.categoryFilters,
      designationIds: filters.designationFilters
    }
  );

  useEffect(() => {
    fetchMasters();
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const newWageMonth = `${year}-${month}`;
    
    const firstDay = `${year}-${month}-01`;
    const lastDayOfMonth = new Date(year, now.getMonth() + 1, 0).getDate();
    const midPoint = Math.min(15, lastDayOfMonth);
    const midDay = `${year}-${month}-${String(midPoint).padStart(2, '0')}`;
    
    setFilters({
      wageMonth: newWageMonth,
      fromDate: firstDay,
      toDate: midDay
    });
  }, []);

  const fetchMasters = async () => {
    try {
      const tables = ['locations', 'divisions', 'departments', 'groups', 'classes', 'categories', 'designations'];
      const results: any = {};
      for (const table of tables) {
        results[table] = await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
          tableName: table,
          operation: 'list',
          moduleType: 'K'
        }) });
      }
      setMasters(results);
    } catch (e) {
      console.error("Failed to fetch masters", e);
    }
  };

  const handleRunAnalysis = async () => {
    if (!filters.wageMonth) {
      toast.error("Please provide wage month");
      return;
    }
    const { data } = await simulationQuery.refetch();
    if (data) {
      const mapped = data.map((r: any) => {
        let calc = r.net_payable * (percentage / 100);
        if (calc < threshold) calc = 0;
        
        if (rounding > 1) {
          calc = Math.round(calc / rounding) * rounding;
        } else {
          calc = Math.round(calc);
        }

        if (calc < 0) calc = 0;

        return {
          ...r,
          advance_input: calc,
          remaining: Math.round(r.net_payable - calc)
        };
      });
      setDrafts(mapped);
    }
  };

  const handleUpdateAmount = (index: number, newAmount: number) => {
    const updatedDrafts = [...drafts];
    const draft = updatedDrafts[index];
    draft.advance_input = newAmount;
    draft.remaining = draft.net_payable - newAmount;
    setDrafts(updatedDrafts);
  };

  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState('BANK');
  const [remarks, setRemarks] = useState('');

  const openPostModal = () => {
    const validEntries = drafts.filter(d => d.advance_input > 0);
    if (validEntries.length === 0) {
      toast.error("No valid advance amounts to commit");
      return;
    }
    setIsPostModalOpen(true);
  };

  const handleConfirmPost = async () => {
    const validEntries = drafts.filter(d => d.advance_input > 0);
    if (!authorizerId) {
      toast.error("Please select an authorizer");
      return;
    }

    if (!paymentType) {
      toast.error("Please select a payment type");
      return;
    }

    postAdvancesMutation.mutate({ 
      validEntries, 
      authorizerId: Number(authorizerId),
      paymentType,
      remark: remarks
    }, {
      onSuccess: () => {
        setIsPostModalOpen(false);
        handleRunAnalysis();
      }
    });
  };

  const filteredDrafts = useMemo(() => drafts.filter(d => 
    (d.name || "").toLowerCase().includes((filters.searchTerm || "").toLowerCase()) ||
    (d.emp_code || "").toLowerCase().includes((filters.searchTerm || "").toLowerCase()) ||
    ((d.group_dept || "").toLowerCase().includes((filters.searchTerm || "").toLowerCase()))
  ), [drafts, filters.searchTerm]);

  const totalPages = Math.ceil(filteredDrafts.length / pageSize);
  const paginatedDrafts = filteredDrafts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalAdvance = drafts.filter(d => d.advance_input > 0).reduce((sum, d) => sum + d.advance_input, 0);
  const employeeCount = drafts.filter(d => d.advance_input > 0).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy flex items-center gap-3">
             <Zap className="text-primary-navy" size={32} />
             Advance Processing
          </h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Payroll Simulation // Advance Entry</p>
        </div>
      </div>

      <div className="textile-card p-6 bg-white border-app-border shadow-md space-y-6">
        {/* Row 1: Global Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Wage Month</label>
            <input 
              type="month" 
              value={filters.wageMonth}
              onChange={e => setFilters({ wageMonth: e.target.value })}
              className="w-full bg-slate-50 border border-app-border p-2.5 text-sm font-medium focus:border-primary-navy outline-none rounded-lg"
            />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase">From Date</label>
             <input type="date" value={filters.fromDate} onChange={e => setFilters({ fromDate: e.target.value })} className="w-full bg-slate-50 border border-app-border p-2.5 text-sm font-medium focus:border-primary-navy outline-none rounded-lg" />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase">To Date</label>
             <input type="date" value={filters.toDate} onChange={e => setFilters({ toDate: e.target.value })} className="w-full bg-slate-50 border border-app-border p-2.5 text-sm font-medium focus:border-primary-navy outline-none rounded-lg" />
          </div>
        </div>

        {/* Row 2: Advance Params */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase text-primary-navy">Advance Percentage (%)</label>
            <input 
              type="number" 
              value={Number.isNaN(percentage) ? '' : percentage}
              onChange={e => setPercentage(parseFloat(e.target.value))}
              className="w-full bg-slate-50 border border-app-border p-2 text-sm font-bold text-primary-navy focus:border-primary-navy outline-none rounded"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase text-primary-navy">Min Threshold (₹)</label>
            <input 
              type="number" 
              value={Number.isNaN(threshold) ? '' : threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))}
              className="w-full bg-slate-50 border border-app-border p-2 text-sm font-bold text-primary-navy focus:border-primary-navy outline-none rounded"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase text-primary-navy">Rounding</label>
            <select
              value={rounding}
              onChange={e => setRounding(Number(e.target.value))}
              className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:border-primary-navy outline-none rounded"
            >
              <option value={1}>None (₹1)</option>
              <option value={10}>Nearest ₹10</option>
              <option value={100}>Nearest ₹100</option>
              <option value={500}>Nearest ₹500</option>
              <option value={1000}>Nearest ₹1000</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col xl:flex-row items-start gap-4">
           <div className="flex-shrink-0 pt-2 w-full xl:w-auto">
             <div className="flex items-center gap-2 text-primary-navy font-bold text-xs uppercase tracking-wider">
               <span className="w-1.5 h-1.5 bg-primary-navy rounded-full"></span>
               Filters
             </div>
           </div>
           <div className="flex-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 w-full">
             <MultiSelect label="Location" options={masters.locations} selected={filters.locationFilters} onChange={(v) => setFilters({ locationFilters: v })} />
             <MultiSelect label="Division" options={masters.divisions} selected={filters.divisionFilters} onChange={(v) => setFilters({ divisionFilters: v })} />
             <MultiSelect label="Class" options={masters.classes} selected={filters.classFilters} onChange={(v) => setFilters({ classFilters: v })} />
             <MultiSelect label="Category" options={masters.categories} selected={filters.categoryFilters} onChange={(v) => setFilters({ categoryFilters: v })} />
             <MultiSelect label="Group" options={masters.groups} selected={filters.groupFilters} onChange={(v) => setFilters({ groupFilters: v })} />
             <MultiSelect label="Department" options={masters.departments} selected={filters.departmentFilters} onChange={(v) => setFilters({ departmentFilters: v })} />
             <MultiSelect label="Designation" options={masters.designations} selected={filters.designationFilters} onChange={(v) => setFilters({ designationFilters: v })} />
           </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button 
            onClick={handleRunAnalysis}
            disabled={simulationQuery.isFetching}
            className="app-btn app-btn-primary flex items-center justify-center gap-2 py-3 px-8 text-sm shadow-md"
          >
            {simulationQuery.isFetching ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
            Simulate Payroll
          </button>
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="space-y-4 animate-in fade-in duration-500">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                <input 
                  type="text" 
                  placeholder="Filter by name, code or department..."
                  value={filters.searchTerm}
                  onChange={e => setFilters({ searchTerm: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-app-border rounded-md text-sm focus:ring-2 focus:ring-primary-navy/20 outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto">
                <button 
                  onClick={openPostModal}
                  className="app-btn bg-primary-green hover:bg-green-700 text-white flex items-center gap-2 px-6"
                >
                  <ShieldCheck size={16} />
                  Post All Advances
                </button>
              </div>
           </div>

           <div className="textile-card overflow-hidden bg-white border-app-border shadow-lg">
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse min-w-max">
                 <thead>
                   <tr className="bg-slate-50 border-b border-app-border">
                     <th className="p-4 text-[10px] font-mono text-text-muted uppercase lg:sticky lg:left-0 bg-slate-50 border-r z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] lg:shadow-none">Code & Name</th>
                     <th className="p-4 text-[10px] font-mono text-text-muted uppercase lg:sticky lg:left-[250px] bg-slate-50 border-r z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] lg:shadow-none">Grp-Dept / Desig</th>
                     <th className="p-4 text-[10px] font-mono text-text-muted uppercase text-right border-r">Wage Rate</th>
                     <th className="p-4 text-[10px] font-mono text-text-muted uppercase text-right border-r bg-blue-50/50">K Gross / Deds</th>
                     
                     <th className="p-4 text-[10px] font-mono text-text-muted uppercase text-right border-r bg-emerald-50/50">P Gross / Deds</th>
                     
                     <th className="p-4 text-[10px] font-mono text-primary-navy font-bold uppercase text-right bg-indigo-50/50">Net Payable</th>
                     
                     <th className="p-4 text-[10px] font-mono font-bold text-primary-navy uppercase text-center w-40 bg-indigo-50/50">Advance Input</th>
                     <th className="p-4 text-[10px] font-mono text-text-muted uppercase text-right bg-indigo-50/50">Remaining</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-app-border">
                   {paginatedDrafts.map((draft) => {
                     const realIndex = drafts.indexOf(draft);
                     return (
                       <tr key={`${draft.emp_id}-${realIndex}`} className="hover:bg-slate-50/50 transition-colors group">
                         <td className="p-3 lg:sticky lg:left-0 bg-white group-hover:bg-slate-50/50 border-r z-10 min-w-[250px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] lg:shadow-none transition-colors">
                           <div className="font-bold text-primary-navy whitespace-nowrap">{draft.name}</div>
                           <div className="text-[10px] font-mono text-text-muted uppercase">{draft.emp_code}</div>
                         </td>
                         <td className="p-3 lg:sticky lg:left-[250px] bg-white group-hover:bg-slate-50/50 border-r z-10 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] lg:shadow-none transition-colors">
                            <div className="text-xs font-bold">{draft.group_dept || 'No Dept'}</div>
                            <div className="text-[10px] text-text-muted">{draft.designation || 'No Designation'}</div>
                         </td>
                         <td className="p-3 text-right font-mono text-sm border-r">₹{(Number(draft.wage_rate) || 0).toLocaleString()}</td>
                         
                         <td className="p-3 text-right bg-blue-50/10 border-r min-w-[120px]">
                            <div className="text-[9px] font-mono text-text-muted flex justify-end gap-1 items-center mb-1"><span className="inline-block w-[24px]">ATT:</span> <span className="font-bold text-primary-navy">{draft.k_attendance || 0}</span></div>
                            <div className="text-sm font-mono text-primary-navy font-bold">₹{(Number(draft.k_gross_earned) || 0).toLocaleString()}</div>
                            <div className="text-[10px] font-mono text-red-600">₹{(Number(draft.k_total_deduction) || 0).toLocaleString()}</div>
                         </td>
                         
                         <td className="p-3 text-right bg-emerald-50/30 border-r min-w-[120px] transition-colors relative">
                            <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500/20"></div>
                            <div className="text-[9px] font-mono text-text-muted flex justify-end gap-1 items-center mb-1 relative z-10"><span className="inline-block w-[24px]">ATT:</span> <span className="font-bold text-emerald-700">{draft.p_attendance || 0}</span></div>
                            <div className="text-sm font-mono text-emerald-700 font-black relative z-10">₹{(Number(draft.p_gross) || 0).toLocaleString()}</div>
                            <div className="text-[10px] font-mono text-red-600 relative z-10">₹{(Number(draft.p_total_deduction) || 0).toLocaleString()}</div>
                         </td>
                         
                         <td className="p-3 text-right font-mono text-sm font-black text-indigo-700 bg-indigo-50/20 border-r">₹{(Number(draft.net_payable) || 0).toLocaleString()}</td>
                         
                         <td className="p-3 bg-indigo-50/20">
                           <input 
                             type="number" 
                             value={Number(draft.advance_input) || 0}
                             onChange={e => handleUpdateAmount(realIndex, Number(e.target.value))}
                             className="w-[100px] bg-white border border-indigo-200 p-1.5 text-right font-mono text-sm font-bold text-primary-navy rounded focus:border-indigo-500 outline-none ml-auto block shadow-sm"
                           />
                         </td>
                         <td className="p-3 text-right bg-indigo-50/20">
                           <div className={cn(
                             "font-mono text-sm font-bold",
                             (Number(draft.remaining) || 0) < 0 ? "text-primary-red" : "text-primary-green"
                           )}>
                             ₹{(Number(draft.remaining) || 0).toLocaleString()}
                           </div>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
             {totalPages > 1 && (
               <div className="p-4 border-t border-app-border bg-slate-50">
                 <Pagination 
                   currentPage={currentPage}
                   totalPages={totalPages}
                   totalRecords={filteredDrafts.length}
                   pageSize={pageSize}
                   onPageChange={(page) => setCurrentPage(page)}
                 />
               </div>
             )}
           </div>

           <div className="flex justify-end gap-6 text-sm bg-slate-50 p-4 border border-app-border rounded-lg shadow-sm">
             <div className="flex items-center gap-2">
               <span className="text-text-muted uppercase text-[10px] font-mono">Total Advance Input:</span>
               <span className="font-bold text-primary-navy text-xl">₹{(Number(totalAdvance) || 0).toLocaleString()}</span>
             </div>
             <div className="flex items-center gap-2 border-l border-app-border pl-6">
               <span className="text-text-muted uppercase text-[10px] font-mono">Employee Count:</span>
               <span className="font-bold text-primary-navy text-xl">{employeeCount}</span>
             </div>
           </div>
        </div>
      )}

      {drafts.length === 0 && !simulationQuery.isFetching && (
        <div className="textile-card p-20 bg-white border-app-border flex flex-col items-center justify-center text-center space-y-4">
           <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-300">
              <Calculator size={32} />
           </div>
           <div className="space-y-1">
             <h3 className="text-lg font-bold text-primary-navy">No Simulation Data</h3>
             <p className="text-text-muted text-sm max-w-xs">Configure filters and run simulation to perform a dry-run payroll calculation.</p>
           </div>
        </div>
      )}

      <AnimatePresence>
        {isPostModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-visible flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-app-border bg-slate-50 rounded-t-xl">
                <div className="flex items-center gap-2 text-primary-navy font-bold">
                  <ShieldCheck size={18} className="text-primary-green" />
                  Confirm Advance Posting
                </div>
                <button onClick={() => setIsPostModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-5">
                <div className="space-y-1.5 z-10 w-full" style={{ isolation: 'isolate' }}>
                  <EmployeeSearchSelect 
                    label="Authorised By *"
                    selectedIds={authorizerId ? [Number(authorizerId)] : []}
                    onChange={(ids) => setAuthorizerId(ids[0] || '')}
                    isMulti={false}
                    placeholder="Search Authorizer..."
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Payment Type <span className="text-primary-red">*</span></label>
                  <select 
                    className="w-full bg-white border border-app-border p-2.5 text-sm rounded outline-none focus:border-primary-navy"
                    value={paymentType}
                    onChange={e => setPaymentType(e.target.value)}
                  >
                    <option value="BANK">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Remarks (Optional)</label>
                  <textarea 
                    className="w-full bg-white border border-app-border p-2.5 text-sm rounded outline-none focus:border-primary-navy resize-none"
                    rows={3}
                    placeholder="Enter any remarks or reference number..."
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                  />
                </div>
                
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-3 text-amber-800 text-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p>You are about to post advances for <strong>{drafts.filter(d => d.advance_input > 0).length}</strong> employees. This action will deduct the amounts from their next payroll.</p>
                </div>
              </div>
              
              <div className="p-4 border-t border-app-border bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsPostModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmPost}
                  disabled={postAdvancesMutation.isPending}
                  className="app-btn bg-primary-green hover:bg-green-700 text-white flex items-center gap-2 px-6 shadow-sm"
                >
                  {postAdvancesMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Confirm & Post'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
