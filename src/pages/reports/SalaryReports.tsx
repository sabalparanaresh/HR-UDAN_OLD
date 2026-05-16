import React, { useState } from 'react';
import { FileText, Download, ShieldAlert, MonitorPlay, Lock } from 'lucide-react';
import { useModule } from '../../contexts/ModuleContext';
import { withModuleGuard } from '../../components/layout/ModuleGuard';
import { invoke } from '@tauri-apps/api/tauri';
import { toast } from 'sonner';
import CachedStatutoryWarningBanner from '../../components/layout/CachedStatutoryWarningBanner';

function SalaryReports({ currentUser }: { currentUser: any }) {
  const { currentMode, isConnected } = useModule();
  const [month, setMonth] = useState('2026-03');
  const [loading, setLoading] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');

  // RBAC Access Check
  const hasAccess = true; // Handled by App.tsx ProtectedRoute

  const handleExportSalaryRegister = async () => {
    if (!hasAccess) {
      toast.error('Access Denied. You do not have permissions to export reports.');
      return;
    }

    setLoading(true);
    try {
      const req = {
        month,
        module_type: currentMode,
        author: currentUser?.username || 'system',
        password: usePassword && password ? password : undefined
      };

      const res = await invoke('generate_salary_register_excel', req) as any;

      if (res && res.status === 'success' && res.base64) {
        // Decode base64 and trigger download
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || `Salary_Register_${month}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success('Enterprise Salary Register Downloaded Successfully');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CachedStatutoryWarningBanner />
      <div className="flex justify-between items-end">
         <div>
           <h2 className="text-3xl textile-header flex items-center gap-3 text-primary-navy">
             <FileText size={32} className="text-blue-600" />
             Salary Reports
           </h2>
           <p className="text-sm font-mono text-text-muted mt-1 uppercase tracking-widest flex items-center gap-2">
             Module Context: {currentMode === 'K' ? 'Actuals' : 'Statutory'} 
             {currentMode === 'K' && !isConnected && <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded ml-2">Audit Mode — Disconnected</span>}
           </p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="textile-card p-6 bg-white border-app-border space-y-6">
           <h3 className="text-sm font-black uppercase tracking-widest text-primary-navy border-b border-app-border pb-2 flex items-center gap-2">
             <MonitorPlay size={16}/> Enterprise Salary Register Export
           </h3>
           <p className="text-xs text-slate-500 font-mono">
              Generates a highly-optimized multi-sheet Excel file containing detailed employee payroll grouped by department and a summary sheet. 
              Supports up to 50k+ records natively via the backend Rust XLSX Writer implementation.
           </p>
           
           <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Target Month</label>
                <input 
                  type="month" 
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  className="w-full bg-slate-50 border border-app-border rounded-lg text-sm p-3 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                 <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={usePassword} 
                      onChange={e => setUsePassword(e.target.checked)} 
                      className="rounded text-blue-600"
                    />
                    <Lock size={16} className="text-slate-500"/> Protect Workbook with Password
                 </label>
                 {usePassword && (
                    <input 
                      type="password" 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter password..."
                      className="mt-3 w-full bg-white border border-app-border rounded text-sm p-2 outline-none focus:border-blue-500 font-mono"
                    />
                 )}
              </div>
           </div>

           <button 
             onClick={handleExportSalaryRegister}
             disabled={loading || (usePassword && !password)}
             className="w-full flex justify-center items-center gap-2 bg-primary-navy text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-900 transition-colors shadow-md disabled:opacity-50"
           >
             {loading ? 'GENERATING EXCEL...' : <><Download size={18} /> GENERATE ENTERPRISE EXCEL</>}
           </button>
        </div>

        <div className="textile-card p-6 bg-slate-50 border-app-border space-y-4">
           <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 border-b border-app-border pb-2 flex items-center gap-2">
             <ShieldAlert size={16}/> Engine Details & Security
           </h3>
           <ul className="text-xs text-slate-600 font-mono space-y-3 list-disc pl-4">
              <li><strong>Module Isolation:</strong> Current export covers {currentMode === 'K' ? 'Actual (Operational)' : 'Statutory (Compliance)'} data only. Cross-module data blending is strictly prevented.</li>
              <li><strong>Dynamic Columns:</strong> Salary Heads (Earnings & Deductions) are dynamically pivoted into columns based on current Master tables.</li>
              <li><strong>Conditional Formatting:</strong> Negative Net Payable values are automatically highlighted in <span className="text-rose-600 font-bold">Red</span>.</li>
              <li><strong>Multi-Sheet:</strong> Includes a granular Detail register (Sheet 1) and a Department Summary aggregation (Sheet 2).</li>
              <li><strong>Audit Traceable:</strong> Every download action logs `EXPORT_EXCEL` event mapped to the active user.</li>
           </ul>
        </div>
      </div>
    </div>
  );
}

export default withModuleGuard(SalaryReports, '*');
