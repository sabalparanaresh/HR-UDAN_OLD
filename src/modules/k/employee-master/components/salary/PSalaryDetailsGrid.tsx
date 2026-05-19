import React, { useEffect, useState } from 'react';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { invokeCommand as invoke } from '../../../../../services/apiClient';
import { toast } from 'sonner';
import { Loader2, Plus, Save, History, Edit2 } from 'lucide-react';
import { PSalaryDetailsDTO } from '../../../../../types/pSalaryDetails';
import { pSalaryFieldAdapter } from '../../../bridges/pSalaryFieldAdapter';
import { usePermission } from '../../../../../hooks/useRBAC';

export default function PSalaryDetailsGrid({ employeeId }: { employeeId: number }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<PSalaryDetailsDTO[]>([]);
  const [salaryHeads, setSalaryHeads] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const canEdit = usePermission('EmployeeMaster.edit');

  const methods = useForm({
    defaultValues: pSalaryFieldAdapter.toFormData(null)
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { isDirty } } = methods;

  useEffect(() => {
    checkConnection();
    if (employeeId) {
      loadData();
    }
  }, [employeeId]);

  const checkConnection = async () => {
     try {
         const bridgeState = await invoke<any>('get_connection_status');
         setIsConnected(bridgeState.status === 'CONNECTED');
     } catch(e) {}
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await invoke<any>('get_p_salary_details_for_k', { employeeId });
      setRecords(res.records || []);
      setSalaryHeads(res.salaryHeads || []);
      
      if (res.records && res.records.length > 0) {
        reset(pSalaryFieldAdapter.toFormData(res.records[0]));
      } else {
        reset(pSalaryFieldAdapter.toFormData(null));
      }
    } catch (e: any) {
      toast.error('Failed to load P format salary details: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: any) => {
    if (!isConnected) {
        toast.error('Cannot edit P module details while System is Disconnected (Audit Mode).');
        return;
    }
    try {
      setSaving(true);
      const dto = pSalaryFieldAdapter.toDTO(employeeId, data);
      await invoke('save_p_salary_details_for_k', { employeeId, data: dto });
      toast.success('P Salary Details saved to Statutory Bridge');
      setIsEditing(false);
      loadData();
    } catch (e: any) {
      toast.error('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (isDirty) {
       if (!window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
          return;
       }
    }
    setIsEditing(false);
    if (records.length > 0) {
      reset(pSalaryFieldAdapter.toFormData(records[0]));
    } else {
      reset(pSalaryFieldAdapter.toFormData(null));
    }
  };

  const addNewRevision = () => {
    setIsEditing(true);
    reset({
      ...watch(),
      id: undefined,
      effective_from: new Date().toISOString().split('T')[0]
    });
  };

  if (loading) {
    return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-primary-navy" /></div>;
  }

  const earnings = salaryHeads.filter(h => h.type === 'EARNING');
  const deductions = salaryHeads.filter(h => h.type === 'DEDUCTION');

  return (
    <div className="mt-8 border-t-2 border-dashed border-app-border pt-8 animate-in slide-in-from-bottom-4 relative">
      {!isConnected && (
         <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <span className="bg-amber-100 text-amber-800 px-4 py-2 rounded font-bold shadow-lg border border-amber-300">
               P Module Disconnected. Read-Only Mode.
            </span>
         </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-black text-primary-navy uppercase tracking-tight">P Module Salary Setup (Bridge)</h2>
          <p className="text-[10px] uppercase font-bold text-text-muted mt-1 tracking-wider">Statutory Master Blueprint</p>
        </div>
        <div className="flex gap-2">
          {!isEditing && isConnected && canEdit && (
            <>
               <button onClick={() => setIsEditing(true)} className="app-btn-outline px-4 py-2 text-xs flex items-center gap-2">
                 <Edit2 size={14} /> Edit Current
               </button>
               <button onClick={addNewRevision} className="app-btn px-4 py-2 text-xs flex items-center gap-2">
                 <Plus size={14} /> New Revision
               </button>
            </>
          )}
          {isEditing && (
            <>
               <button type="button" onClick={cancelEdit} className="app-btn-outline px-4 py-2 text-xs text-primary-red border-primary-red hover:bg-primary-red hover:text-white">Cancel</button>
               <button type="button" onClick={handleSubmit(onSubmit)} disabled={saving} className="app-btn px-4 py-2 text-xs bg-primary-green hover:bg-green-700 flex items-center gap-2">
                 {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save to Statutory Bridge
               </button>
            </>
          )}
        </div>
      </div>

      <FormProvider {...methods}>
        <form className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-inner space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Effective From</label>
              <input type="date" {...register('effective_from')} disabled={!isEditing} className="w-full bg-white border border-slate-300 p-2.5 text-xs rounded-md shadow-sm font-mono focus:border-primary-navy disabled:bg-slate-100" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Wage Type</label>
              <select {...register('statutory_wage_type')} disabled={!isEditing} className="w-full bg-white border border-slate-300 p-2.5 text-xs rounded-md shadow-sm focus:border-primary-navy disabled:bg-slate-100">
                <option value="">Select Wage Type</option>
                <option value="Daily">Daily</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
             <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Working Day Type</label>
              <select {...register('statutory_working_day_type')} disabled={!isEditing} className="w-full bg-white border border-slate-300 p-2.5 text-xs rounded-md shadow-sm focus:border-primary-navy disabled:bg-slate-100">
                <option value="">Select Setting...</option>
                <option value="26 Days Fix">26 Days Fix</option>
                <option value="30 Days Fix">30 Days Fix</option>
                <option value="Actual Calendar Days">Actual Calendar Days</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Base Rate (₹)</label>
              <input type="number" step="0.01" {...register('statutory_base_rate')} disabled={!isEditing} className="w-full bg-white border border-slate-300 p-2.5 text-xs rounded-md shadow-sm font-mono focus:border-primary-navy disabled:bg-slate-100" />
            </div>
          </div>

          {(earnings.length > 0 || deductions.length > 0) && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-200">
                <div className="space-y-4">
                   <h4 className="text-sm font-bold text-primary-navy border-b border-slate-200 pb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary-green"></span>Earnings</h4>
                   {earnings.map(h => (
                     <div key={h.id} className="flex justify-between items-center gap-4">
                        <label className="text-xs font-bold text-slate-700">{h.name}</label>
                        <input type="number" step="0.01" {...register(`heads.${h.id}`)} disabled={!isEditing} className="w-32 bg-white border border-slate-300 p-1.5 text-right text-xs rounded-md font-mono disabled:bg-slate-100" placeholder="0.00" />
                     </div>
                   ))}
                </div>
                <div className="space-y-4">
                   <h4 className="text-sm font-bold text-primary-navy border-b border-slate-200 pb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary-red"></span>Deductions</h4>
                   {deductions.map(h => (
                     <div key={h.id} className="flex justify-between items-center gap-4">
                        <label className="text-xs font-bold text-slate-700">{h.name}</label>
                        <input type="number" step="0.01" {...register(`heads.${h.id}`)} disabled={!isEditing} className="w-32 bg-white border border-slate-300 p-1.5 text-right text-xs rounded-md font-mono disabled:bg-slate-100" placeholder="0.00" />
                     </div>
                   ))}
                </div>
             </div>
          )}
        </form>
      </FormProvider>

      {records.length > 1 && (
        <div className="mt-8">
           <h3 className="text-xs font-bold text-text-muted uppercase flex items-center gap-2 mb-4"><History size={14}/> Revision History</h3>
           <div className="overflow-hidden rounded-lg border border-slate-200">
             <table className="w-full text-left text-xs bg-white">
               <thead className="bg-slate-50 border-b border-slate-200">
                 <tr>
                    <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Effective From</th>
                    <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Wage Type</th>
                    <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-right">Base Rate</th>
                    <th className="p-3 font-bold text-slate-500 uppercase tracking-wider">Last Modified</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {records.map(r => (
                    <tr key={r.id}>
                        <td className="p-3 font-mono">{r.effective_from}</td>
                        <td className="p-3 font-bold">{r.statutory_wage_type}</td>
                        <td className="p-3 text-right font-mono">₹{r.statutory_base_rate}</td>
                        <td className="p-3 text-slate-500">{new Date(r.modified_at || '').toLocaleString()}</td>
                    </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}
    </div>
  );
}
