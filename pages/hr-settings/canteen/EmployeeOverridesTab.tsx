import React, { useState, useEffect } from 'react';
import { Users, Search, Edit, XCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { invokeCommand, fetchApi } from '../../../services/apiClient';
import { useModule } from '../../../contexts/ModuleContext';
import { motion, AnimatePresence } from 'motion/react';
import { Pagination } from '../../../components/common/Pagination';
import { cn } from '../../../lib/utils';
import EmployeeSearchSelect from '../../../components/common/EmployeeSearchSelect';

export default function EmployeeOverridesTab() {
  const { currentMode } = useModule();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<any>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data: any = await fetchApi('/api/canteen/master', { headers: { 'x-module-type': currentMode } });
      if (data.permissions) setPermissions(data.permissions);
    } catch (err) {
      toast.error('Failed to load overrides');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [currentMode]);

  const handleSaveOverride = async () => {
    setIsSaving(true);
    try {
      await fetchApi('/api/canteen/override', {
        method: 'PUT',
        headers: { 'x-module-type': currentMode },
        body: JSON.stringify({
          empId: editingOverride.emp_id,
          rateOverride: editingOverride.is_manual_override ? editingOverride.rate_override : null,
          benefitType: editingOverride.benefit_type
        })
      });
      toast.success('Override saved');
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save override');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPermissions = permissions.filter(p => 
    (p.emp_name || "").toLowerCase().includes((searchTerm || "").toLowerCase()) || 
    (p.emp_code || "").toLowerCase().includes((searchTerm || "").toLowerCase())
  ).sort((a,b) => (b.is_manual_override ? 1 : 0) - (a.is_manual_override ? 1 : 0)); // sorting overrides first

  const totalPages = Math.ceil(filteredPermissions.length / pageSize);
  const currentOverrides = filteredPermissions.slice((page - 1) * pageSize, page * pageSize);

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline-block text-primary-navy" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="textile-card bg-white border-app-border shadow-xl overflow-hidden">
      <div className="p-6 border-b border-app-border flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-navy/10 rounded-lg text-primary-navy">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary-navy">Employee Overrides Matrix</h2>
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Manual rate overwrites taking precedence over all rules</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input 
            type="text" 
            placeholder="Search employees..."
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-app-border rounded-xl text-sm focus:outline-none focus:border-primary-navy w-64 shadow-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-app-border">
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Emp Code</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Assigned Benefit</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Fixed Rate Override</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Origin</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {currentOverrides.map((perm) => (
              <tr key={perm.emp_id} className={cn("transition-all", perm.is_manual_override ? "bg-amber-50/30" : "hover:bg-slate-50/50")}>
                <td className="px-6 py-4"><span className="font-bold font-mono text-sm">{perm.emp_code}</span></td>
                <td className="px-6 py-4">
                  <span className="font-bold text-primary-navy text-sm">{perm.emp_name}</span>
                  <div className="text-[10px] text-text-muted">{perm.designation_name || '-'} | {perm.department_name || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap",
                    perm.benefit_type === 'Free' ? "bg-primary-green/10 text-primary-green" :
                    perm.benefit_type === 'Discounted' ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-text-main"
                  )}>
                    {perm.benefit_type || 'Full Deduction'}
                  </span>
                </td>
                <td className="px-6 py-4"><span className="font-bold font-mono text-sm">{perm.rate_override === null ? 'Default calculated' : `₹${perm.rate_override}`}</span></td>
                <td className="px-6 py-4">
                  {perm.is_manual_override ? 
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold uppercase">Manual Override</span> : 
                    <span className="text-[10px] text-text-muted uppercase">Rule Engine</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => { setEditingOverride(perm); setIsModalOpen(true); }}
                    className="p-2 text-primary-navy hover:bg-primary-navy/10 rounded-lg transition-all"
                  >
                    <Edit size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} totalRecords={filteredPermissions.length} pageSize={pageSize} onPageChange={setPage} />

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-app-border overflow-hidden">
              <div className="p-6 border-b border-app-border flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-bold text-primary-navy uppercase tracking-tight">Manual Canteen Override</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-primary-red transition-colors"><XCircle size={24} /></button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h4 className="font-bold text-primary-navy">{editingOverride.emp_name}</h4>
                  <p className="text-xs text-text-muted font-mono">{editingOverride.emp_code}</p>
                </div>

                <label className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
                  <input type="checkbox" checked={!!editingOverride.is_manual_override} onChange={(e) => setEditingOverride({...editingOverride, is_manual_override: e.target.checked})} className="w-4 h-4 accent-amber-600" />
                  <span className="text-sm font-bold text-amber-900">Enable Fixed Manual Override</span>
                </label>

                {editingOverride.is_manual_override && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Benefit Type</label>
                      <select value={editingOverride.benefit_type} onChange={(e) => setEditingOverride({...editingOverride, benefit_type: e.target.value})} className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl">
                        <option value="Free">Free</option>
                        <option value="Full Deduction">Full Deduction</option>
                        <option value="Discounted">Discounted (Override logic applies)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Fixed Deduct Rate (₹)</label>
                      <input type="number" value={editingOverride.rate_override === null ? '' : editingOverride.rate_override} onChange={(e) => setEditingOverride({...editingOverride, rate_override: e.target.value ? Number(e.target.value) : null})} className="w-full bg-white border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl font-mono" placeholder="Leave empty for free" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-app-border bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-text-main font-bold hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                <button onClick={handleSaveOverride} disabled={isSaving} className="px-8 py-2.5 bg-primary-navy text-white rounded-xl font-bold hover:bg-primary-navy/90 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Save Override
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
