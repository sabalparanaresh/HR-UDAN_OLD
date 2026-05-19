import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Edit, Trash2, XCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { invokeCommand } from '../../../services/apiClient';
import { useModule } from '../../../contexts/ModuleContext';
import { motion, AnimatePresence } from 'motion/react';
import { Pagination } from '../../../components/common/Pagination';
import { cn } from '../../../lib/utils';
import { MultiSelect } from '../../../components/common/MultiSelect';

export default function RuleConfigurationTab() {
  const { currentMode } = useModule();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [rules, setRules] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  const [rulesPage, setRulesPage] = useState(1);
  const pageSize = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  
  const [ruleForm, setRuleForm] = useState<any>({
    rule_name: '',
    benefit_type: 'Full Deduction',
    discount_rate: 0,
    dish_rate: 0,
    effective_date: new Date().toISOString().split('T')[0],
    categories: [], classes: [], groups: [], departments: [], designations: []
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data: any = await invokeCommand('get_canteen_master_data', { moduleType: currentMode });
      if (data.rules) setRules(data.rules);
      if (data.categories) setCategories(data.categories);
      if (data.classes) setClasses(data.classes);
      if (data.groups) setGroups(data.groups);
      if (data.departments) setDepartments(data.departments);
      if (data.designations) setDesignations(data.designations);
    } catch (err) {
      toast.error('Failed to load rules');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [currentMode]);

  const handleSaveRule = async () => {
    setIsSaving(true);
    try {
      await invokeCommand('master_crud', {
        tableName: 'canteen_rules',
        operation: ruleForm.id ? 'update' : 'create',
        id: ruleForm.id,
        data: ruleForm,
        moduleType: currentMode
      });
      toast.success('Rule saved successfully');
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save rule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await invokeCommand('master_crud', {
        tableName: 'canteen_rules',
        operation: 'delete',
        id,
        moduleType: currentMode
      });
      toast.success('Rule deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const totalPages = Math.ceil(rules.length / pageSize);
  const currentRules = rules.slice((rulesPage - 1) * pageSize, rulesPage * pageSize);

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline-block text-primary-navy" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="textile-card bg-white border-app-border shadow-xl overflow-hidden">
      <div className="p-6 border-b border-app-border flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-navy/10 rounded-lg text-primary-navy">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary-navy">Criteria-Based Priority Engine</h2>
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Higher specificity (e.g. Designation vs Group) naturally takes priority.</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setEditingRule(null);
            setRuleForm({
              rule_name: '', benefit_type: 'Full Deduction', discount_rate: 0, dish_rate: 0,
              effective_date: new Date().toISOString().split('T')[0],
              categories: [], classes: [], groups: [], departments: [], designations: []
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-navy text-white rounded-lg font-bold hover:bg-primary-navy/90 transition-all text-sm shadow-lg shadow-primary-navy/20"
        >
          <Plus size={16} />
          Add New Priority Rule
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-app-border">
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Rule Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Effective From</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Dish Rate (₹)</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Benefit Type</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Criteria Summary</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {currentRules.map((rule) => (
              <tr key={rule.id} className="hover:bg-slate-50/50 transition-all">
                <td className="px-6 py-4">
                  <span className="font-bold text-primary-navy text-sm">{rule.rule_name}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="font-bold font-mono text-sm">{rule.effective_date ? new Date(rule.effective_date).toLocaleDateString('en-IN') : 'Immediately'}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="font-bold font-mono text-sm">{rule.dish_rate ? `₹${rule.dish_rate}` : '₹0'}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                      rule.benefit_type === 'Free' ? "bg-primary-green/10 text-primary-green" :
                      rule.benefit_type === 'Discounted' ? "bg-amber-100 text-amber-700" :
                      "bg-primary-navy/10 text-primary-navy"
                    )}>
                      {rule.benefit_type}
                    </span>
                    {rule.benefit_type === 'Discounted' && (
                      <span className="text-xs font-mono text-text-muted">₹{rule.discount_rate} OFF</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {rule.categories.length > 0 && <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-app-border">Cat: {rule.categories.length}</span>}
                    {rule.departments.length > 0 && <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-app-border">Dept: {rule.departments.length}</span>}
                    {rule.designations.length > 0 && <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-app-border">Desig: {rule.designations.length}</span>}
                    {rule.groups.length > 0 && <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-app-border">Grp: {rule.groups.length}</span>}
                    {rule.categories.length === 0 && rule.departments.length === 0 && rule.designations.length === 0 && rule.groups.length === 0 && (
                      <span className="text-[9px] text-text-muted italic">Global (All Employees Default)</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => { setEditingRule(rule); setRuleForm({ ...rule }); setIsModalOpen(true); }}
                      className="p-2 text-primary-navy hover:bg-primary-navy/10 rounded-lg transition-all"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => rule.id && handleDeleteRule(rule.id)}
                      className="p-2 text-primary-red hover:bg-primary-red/10 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-text-muted italic text-sm">
                  No rules defined. All employees will be charged the default dish rate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={rulesPage} totalPages={totalPages} totalRecords={rules.length} pageSize={pageSize} onPageChange={setRulesPage} />

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-app-border overflow-hidden">
              <div className="p-6 border-b border-app-border flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-bold text-primary-navy uppercase tracking-tight">
                  {editingRule ? 'Edit Canteen Rule' : 'Create New Canteen Rule'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-primary-red transition-colors"><XCircle size={24} /></button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Rule Name</label>
                    <input type="text" value={ruleForm.rule_name} onChange={(e) => setRuleForm({ ...ruleForm, rule_name: e.target.value })} className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Benefit Type</label>
                    <select value={ruleForm.benefit_type} onChange={(e) => setRuleForm({ ...ruleForm, benefit_type: e.target.value as any })} className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl">
                      <option value="Free">Free (No Deduction)</option>
                      <option value="Full Deduction">Full Deduction</option>
                      <option value="Discounted">Discounted Rate</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Effective From</label>
                    <input type="date" value={ruleForm.effective_date?.split('T')[0] || ''} onChange={(e) => setRuleForm({ ...ruleForm, effective_date: e.target.value })} className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Dish Rate Base (₹)</label>
                    <input type="number" value={ruleForm.dish_rate || ''} onChange={(e) => setRuleForm({ ...ruleForm, dish_rate: Number(e.target.value) })} className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl font-mono" />
                  </div>
                  {ruleForm.benefit_type === 'Discounted' && (
                    <div className="space-y-1 animate-in fade-in">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Discount Rate (₹)</label>
                      <input type="number" value={ruleForm.discount_rate || ''} onChange={(e) => setRuleForm({ ...ruleForm, discount_rate: Number(e.target.value) })} className="w-full bg-amber-50 border border-amber-200 p-3 text-sm focus:outline-none focus:border-amber-400 rounded-xl font-mono" />
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-app-border space-y-4">
                  <h4 className="text-xs font-bold text-primary-navy uppercase tracking-wider">Applicability Criteria (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MultiSelect label="Categories" options={categories} selected={ruleForm.categories || []} onChange={(newVal) => setRuleForm({ ...ruleForm, categories: newVal })} />
                    <MultiSelect label="Classes" options={classes} selected={ruleForm.classes || []} onChange={(newVal) => setRuleForm({ ...ruleForm, classes: newVal })} />
                    <MultiSelect label="Groups" options={groups} selected={ruleForm.groups || []} onChange={(newVal) => setRuleForm({ ...ruleForm, groups: newVal })} />
                    <MultiSelect label="Departments" options={departments} selected={ruleForm.departments || []} onChange={(newVal) => setRuleForm({ ...ruleForm, departments: newVal })} />
                    <MultiSelect label="Designations" options={designations} selected={ruleForm.designations || []} onChange={(newVal) => setRuleForm({ ...ruleForm, designations: newVal })} />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-app-border bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-text-main font-bold hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                <button onClick={handleSaveRule} disabled={isSaving || !ruleForm.rule_name} className="px-8 py-2.5 bg-primary-navy text-white rounded-xl font-bold hover:bg-primary-navy/90 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Save Priority Rule
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
