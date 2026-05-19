import React, { useState, useEffect } from 'react';
import { Calendar, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { invokeCommand } from '../../../services/apiClient';
import { useModule } from '../../../contexts/ModuleContext';
import { motion } from 'motion/react';
import { Pagination } from '../../../components/common/Pagination';
import EmployeeSearchSelect from '../../../components/common/EmployeeSearchSelect';

export default function RulePreviewTab() {
  const { currentMode } = useModule();
  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

  useEffect(() => {
    async function loadData() {
      try {
        const data: any = await invokeCommand('get_canteen_master_data', { moduleType: currentMode });
        if (data.employees) setEmployees(data.employees);
      } catch (err) {
        toast.error('Failed to load employees for simulator');
      }
    }
    loadData();
  }, [currentMode]);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const data: any = await invokeCommand('calculate_canteen_deductions', {
        month: selectedMonth,
        moduleType: currentMode
      });
      // Map results to include names
      const enriched = data.results.map((r: any) => ({
         ...r,
         emp_name: employees.find(e => e.id === r.emp_id)?.name || 'Unknown',
         emp_code: employees.find(e => e.id === r.emp_id)?.emp_code || '---'
      }));
      setResults(enriched);
      toast.success('Simulation complete');
    } catch (error) {
      toast.error('Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="textile-card bg-white border-app-border shadow-xl overflow-hidden space-y-6">
      <div className="p-6 border-b border-app-border bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-navy/10 rounded-lg text-primary-navy">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary-navy">Benefit Simulation & Validation</h2>
              <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Test rules on current punch data before payroll lock</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-lg font-mono font-bold"
            />
            <button 
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="px-6 py-2 bg-primary-green text-white rounded-lg font-bold hover:bg-primary-green/90 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {isSimulating ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
              Run Engine
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
         {results.length === 0 && !isSimulating ? (
            <div className="text-center py-12 text-sm text-text-muted italic border-2 border-dashed border-app-border rounded-xl">
              No results to display. Click "Run Engine" to validate logic.
            </div>
         ) : isSimulating ? (
            <div className="text-center py-12 text-sm font-bold text-primary-navy flex flex-col items-center">
               <Loader2 className="animate-spin mb-4" size={32} />
               Processing Punches & Rules...
            </div>
         ) : (
            <div className="overflow-x-auto rounded-xl border border-app-border">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-app-border">
                    <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Emp Code</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Punches Matched to Periods</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Total Calculated Deduction (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {results.map((r) => (
                    <tr key={r.emp_id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-4 font-mono text-sm font-bold">{r.emp_code}</td>
                      <td className="px-6 py-4 text-sm font-bold text-primary-navy">{r.emp_name}</td>
                      <td className="px-6 py-4 text-sm font-mono">{r.punch_count} valid consumption(s)</td>
                      <td className="px-6 py-4 text-right font-mono text-sm font-bold text-primary-red">₹ {r.total_deduction.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
         )}
      </div>
    </motion.div>
  );
}
