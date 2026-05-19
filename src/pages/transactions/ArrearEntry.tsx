import React, { useState, useEffect } from 'react';
import { invokeCommand as invoke } from '../../services/apiClient';
import { 
  RotateCcw, ArrowRight, Search, User, Calendar, 
  Calculator, Save, AlertCircle, Loader2, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useModule } from '../../contexts/ModuleContext';
import { User as UserType, Employee } from '../../types';
import EmployeeSearchSelect from '../../components/form/EmployeeSearchSelect';

export default function ArrearEntry({ currentUser }: { currentUser: UserType | null }) {
  const { currentMode } = useModule();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [sourceMonth, setSourceMonth] = useState<string>('');
  const [targetMonth, setTargetMonth] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);
  const [correctedData, setCorrectedData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await invoke<any[]>('master_crud', {
          tableName: 'employees',
          operation: 'list',
          moduleType: currentMode
        });
        setEmployees(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch employees:", err);
      }
    };
    fetchEmployees();
  }, [currentMode]);

  const handleFetchOriginal = async () => {
    if (!selectedEmpId || !sourceMonth) {
      toast.error("Please select employee and source month");
      return;
    }

    setIsLoading(true);
    try {
      const data = await invoke<any>('get_employee_record', {
        empId: selectedEmpId,
        month: sourceMonth,
        moduleType: currentMode
      });
      if (data) {
        setOriginalData(data);
        setCorrectedData({
          statutory_attendance: data.statutory_attendance,
          wage_rate: data.wage_rate || 0,
          fixed_components: data.fixed_components || 0,
          gross_earning: data.gross_earning
        });
      } else {
        toast.error("No record found for the selected month");
        setOriginalData(null);
        setCorrectedData(null);
      }
    } catch (err) {
      toast.error("Failed to fetch original record");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateArrear = () => {
    if (!originalData || !correctedData) return 0;
    
    const correctedGross = (correctedData.statutory_attendance * correctedData.wage_rate) + correctedData.fixed_components;
    return correctedGross - originalData.gross_earning;
  };

  const arrearAmount = calculateArrear();

  const handleSaveArrear = async () => {
    if (!targetMonth) {
      toast.error("Please select target month");
      return;
    }

    setIsSaving(true);
    try {
      await invoke('save_arrear', {
        data: {
          emp_id: selectedEmpId,
          source_month: sourceMonth,
          target_month: targetMonth,
          arrear_amount: arrearAmount,
          remarks: `Arrear from ${sourceMonth} to ${targetMonth}. Attendance: ${correctedData.statutory_attendance}, Rate: ${correctedData.wage_rate}, Fixed: ${correctedData.fixed_components}`
        },
        moduleType: currentMode
      });
      toast.success("Arrear entry saved successfully");
      // Reset or redirect
    } catch (err) {
      toast.error("Failed to save arrear entry");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Arrear Entry</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Transaction // Salary Corrections</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Pane: Search */}
        <div className="lg:col-span-4 space-y-6">
          <div className="textile-card p-6 bg-white border-app-border space-y-6">
            <div className="flex items-center gap-2 text-primary-navy border-b border-app-border pb-2">
              <Search size={18} />
              <h3 className="font-bold uppercase text-xs tracking-widest">Search Parameters</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <EmployeeSearchSelect 
                  label="Employee"
                  employees={employees}
                  selectedIds={selectedEmpId ? [parseInt(selectedEmpId)] : []}
                  onChange={(ids) => setSelectedEmpId(ids[0]?.toString() || '')}
                  placeholder="Select Employee"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-muted uppercase">Source Month (Error Month)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                  <input 
                    type="month" 
                    value={sourceMonth}
                    onChange={(e) => setSourceMonth(e.target.value)}
                    className="w-full bg-slate-50 border border-app-border pl-10 pr-4 py-2 text-sm rounded-md focus:outline-none focus:border-primary-navy"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-muted uppercase">Target Month (Payout Month)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                  <input 
                    type="month" 
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className="w-full bg-slate-50 border border-app-border pl-10 pr-4 py-2 text-sm rounded-md focus:outline-none focus:border-primary-navy"
                  />
                </div>
              </div>

              <button 
                onClick={handleFetchOriginal}
                disabled={isLoading}
                className="w-full app-btn app-btn-primary flex items-center justify-center gap-2 py-3"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                Fetch Original Data
              </button>
            </div>
          </div>

          {originalData && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3">
              <Info size={20} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Arrears are calculated as the difference between corrected and original values. 
                The calculated amount will be added to the target month's payroll.
              </p>
            </div>
          )}
        </div>

        {/* Right Pane: Dynamic Calculation */}
        <div className="lg:col-span-8 space-y-6">
          {!originalData ? (
            <div className="h-full min-h-[400px] textile-card bg-slate-50 border-dashed border-2 border-app-border flex flex-col items-center justify-center text-text-muted gap-4">
              <Calculator size={48} className="opacity-20" />
              <p className="font-mono text-sm uppercase tracking-widest">Select parameters to begin calculation</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="textile-card bg-white border-app-border overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-app-border flex justify-between items-center">
                  <h3 className="font-bold text-primary-navy uppercase text-xs tracking-widest">Calculation Matrix</h3>
                  <button 
                    onClick={() => setCorrectedData({
                      statutory_attendance: originalData.statutory_attendance,
                      wage_rate: originalData.wage_rate || 0,
                      gross_earning: originalData.gross_earning
                    })}
                    className="text-primary-navy hover:bg-white p-1 rounded-md transition-colors"
                    title="Reset to Original"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>

                <div className="p-6 grid grid-cols-2 gap-8">
                  {/* Original Values */}
                  <div className="space-y-6 opacity-60">
                    <h4 className="text-[10px] font-mono text-text-muted uppercase border-b border-app-border pb-1">Original Values (Read-only)</h4>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-text-muted uppercase">Attendance (Days/Units)</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={originalData.statutory_attendance}
                          className="w-full bg-slate-100 border border-app-border p-2 text-sm rounded-md font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-text-muted uppercase">Wage Rate</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={originalData.wage_rate || 0}
                          className="w-full bg-slate-100 border border-app-border p-2 text-sm rounded-md font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-text-muted uppercase">Fixed Components</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={originalData.fixed_components || 0}
                          className="w-full bg-slate-100 border border-app-border p-2 text-sm rounded-md font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-text-muted uppercase">Gross Earning</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={originalData.gross_earning}
                          className="w-full bg-slate-100 border border-app-border p-2 text-sm rounded-md font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Corrected Values */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-mono text-primary-navy uppercase border-b border-primary-navy/20 pb-1">Corrected Values (Editable)</h4>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-text-muted uppercase">Attendance (Days/Units)</label>
                        <input 
                          type="number" 
                          value={correctedData.statutory_attendance}
                          onChange={(e) => setCorrectedData({...correctedData, statutory_attendance: parseFloat(e.target.value) || 0})}
                          className="w-full bg-white border border-primary-navy/30 p-2 text-sm rounded-md font-mono focus:ring-2 focus:ring-primary-navy/10 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-text-muted uppercase">Wage Rate</label>
                        <input 
                          type="number" 
                          value={correctedData.wage_rate}
                          onChange={(e) => setCorrectedData({...correctedData, wage_rate: parseFloat(e.target.value) || 0})}
                          className="w-full bg-white border border-primary-navy/30 p-2 text-sm rounded-md font-mono focus:ring-2 focus:ring-primary-navy/10 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-text-muted uppercase">Fixed Components</label>
                        <input 
                          type="number" 
                          value={correctedData.fixed_components}
                          onChange={(e) => setCorrectedData({...correctedData, fixed_components: parseFloat(e.target.value) || 0})}
                          className="w-full bg-white border border-primary-navy/30 p-2 text-sm rounded-md font-mono focus:ring-2 focus:ring-primary-navy/10 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-text-muted uppercase">Calculated Gross</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={((correctedData.statutory_attendance * correctedData.wage_rate) + correctedData.fixed_components).toFixed(2)}
                          className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-md font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrear Amount Card */}
              <div className="textile-card bg-primary-navy p-6 text-white flex justify-between items-center shadow-xl shadow-primary-navy/20">
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase opacity-60">Total Arrear Amount</p>
                  <p className="text-4xl font-black">₹{arrearAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <button 
                  onClick={handleSaveArrear}
                  disabled={isSaving}
                  className="bg-white text-primary-navy px-8 py-3 rounded-xl font-black uppercase text-sm hover:bg-slate-100 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Arrear Entry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
