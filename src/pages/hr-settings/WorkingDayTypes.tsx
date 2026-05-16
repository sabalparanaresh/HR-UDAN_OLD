import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Calculator,
  Settings2,
  Info,
  ChevronRight,
  Variable,
  Hash
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useModule } from '../../contexts/ModuleContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WorkingDayType {
  id: number;
  name: string;
  mode: 'FIXED' | 'FORMULA';
  fixed_days: number | null;
  formula: string | null;
  is_statutory_uniform: number;
  allocation_type?: 'K_ONLY' | 'KP' | 'STATUTORY';
  created_at: string;
}

const FORMULA_VARIABLES = [
  { label: 'Month Days', value: '{MONTH_DAYS}', icon: <Calendar size={14} /> },
  { label: 'Week Offs', value: '{WEEK_OFFS}', icon: <Hash size={14} /> },
  { label: 'Holidays', value: '{HOLIDAYS}', icon: <Hash size={14} /> },
  { label: 'Month Index (1-12)', value: '{MONTH_INDEX}', icon: <Hash size={14} /> },
  { label: 'Choose Function', value: 'CHOOSE(', icon: <Calculator size={14} /> },
  { label: 'If Function', value: 'IF(', icon: <Calculator size={14} /> },
];

const FORMULA_OPERATORS = ['+', '-', '*', '/', '(', ')', ',', '='];

export default function WorkingDayTypes() {
  const { currentMode } = useModule();

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  const [types, setTypes] = useState<WorkingDayType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    mode: 'FIXED' as 'FIXED' | 'FORMULA',
    fixed_days: '',
    formula: '',
    is_statutory_uniform: false,
    allocation_type: 'KP' as 'K_ONLY' | 'KP' | 'STATUTORY'
  });

  const [customValue, setCustomValue] = useState('');

  useEffect(() => {
    fetchTypes();
  }, [currentMode]);

  const fetchTypes = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<WorkingDayType[]>('master_crud', {
        tableName: 'working_day_types',
        operation: 'list',
        moduleType: currentMode
      });
      
      const normalizedData = (Array.isArray(data) ? data : []).map(item => ({
        ...item,
        fixed_days: item.fixed_days ?? (item as any).fixedDays,
      }));
      
      setTypes(normalizedData);

      // If in P mode, automatically load the first type for editing
      if (currentMode === 'P' && normalizedData.length > 0) {
        handleEdit(normalizedData[0]);
      } else if (currentMode === 'P') {
        setFormData({
          name: 'Statutory Default',
          mode: 'FIXED',
          fixed_days: '30',
          formula: '',
          is_statutory_uniform: true,
          allocation_type: 'KP'
        });
      }
    } catch (error) {
      toast.error("Failed to fetch working day types");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addToFormula = (val: string) => {
    setFormData(prev => ({
      ...prev,
      formula: prev.formula + (prev.formula && !prev.formula.endsWith(' ') && !val.startsWith(' ') ? ' ' : '') + val
    }));
  };

  const addCustomValue = () => {
    if (customValue.trim()) {
      addToFormula(customValue.trim());
      setCustomValue('');
    }
  };

  const handleFormulaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, formula: e.target.value }));
  };

  const clearFormula = () => {
    setFormData(prev => ({ ...prev, formula: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalName = currentMode === 'P' ? 'Statutory Default' : formData.name;

    if (!finalName) {
      toast.error("Name is required");
      return;
    }

    if (formData.mode === 'FIXED' && !formData.fixed_days) {
      toast.error("Fixed days value is required");
      return;
    }

    if (formData.mode === 'FORMULA' && !formData.formula) {
      toast.error("Formula is required");
      return;
    }

    try {
      await invoke('master_crud', {
        tableName: 'working_day_types',
        operation: isEditing ? 'update' : 'create',
        id: isEditing,
        data: {
          name: finalName,
          mode: formData.mode,
          fixed_days: formData.mode === 'FIXED' ? parseFloat(formData.fixed_days) : null,
          formula: formData.mode === 'FORMULA' ? formData.formula : null,
          is_statutory_uniform: currentMode === 'P' ? 1 : (formData.is_statutory_uniform ? 1 : 0),
          allocation_type: formData.allocation_type || 'KP'
        },
        moduleType: currentMode
      });

      toast.success(isEditing ? "Configuration updated" : "Configuration created");
      if (currentMode === 'K') resetForm();
      fetchTypes();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save");
    }
  };

  const resetForm = () => {
    setFormData({
      name: currentMode === 'P' ? 'Statutory Default' : '',
      mode: 'FIXED',
      fixed_days: '',
      formula: '',
      is_statutory_uniform: currentMode === 'P',
      allocation_type: 'KP'
    });
    setIsEditing(null);
  };

  const handleEdit = (type: WorkingDayType) => {
    setIsEditing(type.id);
    setFormData({
      name: type.name,
      mode: type.mode,
      fixed_days: type.fixed_days?.toString() || '',
      formula: type.formula || '',
      is_statutory_uniform: type.is_statutory_uniform === 1,
      allocation_type: type.allocation_type || 'KP'
    });
    if (currentMode === 'K') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke('master_crud', {
        tableName: 'working_day_types',
        operation: 'delete',
        id,
        moduleType: currentMode
      });
      toast.success("Type deleted");
      setDeleteConfirmId(null);
      fetchTypes();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy flex items-center gap-3">
            <Settings2 className="text-primary-navy" size={32} />
            {currentMode === 'P' ? 'Statutory Default Days' : 'Working Day Types'}
          </h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">
            Payroll Logic // {currentMode === 'P' ? 'Global Configuration' : 'Attendance Calculation'}
          </p>
        </div>
      </div>

      {currentMode === 'P' ? (
        <div className="max-w-2xl mx-auto">
          <div className="textile-card p-6 bg-white border-app-border shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Calculator size={120} />
            </div>
            
            <div className="flex items-center justify-between border-b border-app-border pb-3 mb-8">
              <h3 className="textile-header font-bold text-primary-navy flex items-center gap-2">
                <Variable className="text-primary-navy" size={20} />
                Global Statutory Logic
              </h3>
              <div className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded border border-emerald-200 uppercase">
                P-Module Mode
              </div>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-8">
              <div className="flex gap-3">
                <Info className="text-amber-600 shrink-0" size={20} />
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  The logic defined below will be used as the <strong>uniform statutory default</strong> for ALL employees in the P-Module. 
                  This ensures consistency across the statutory ledger.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[11px] textile-header text-text-muted uppercase font-bold tracking-wider">Calculation Mode</label>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-app-border">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, mode: 'FIXED' }))}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-3 py-3 text-sm font-bold transition-all rounded-lg",
                      formData.mode === 'FIXED' ? "bg-primary-navy text-white shadow-lg" : "text-text-muted hover:text-primary-navy"
                    )}
                  >
                    <Hash size={18} />
                    FIXED DAYS
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, mode: 'FORMULA' }))}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-3 py-3 text-sm font-bold transition-all rounded-lg",
                      formData.mode === 'FORMULA' ? "bg-primary-navy text-white shadow-lg" : "text-text-muted hover:text-primary-navy"
                    )}
                  >
                    <Calculator size={18} />
                    FORMULA
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {formData.mode === 'FIXED' ? (
                  <motion.div
                    key="fixed"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-3"
                  >
                    <label className="text-[11px] textile-header text-text-muted uppercase font-bold tracking-wider">Fixed Monthly Days</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        name="fixed_days"
                        value={formData.fixed_days}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border-2 border-app-border px-4 py-4 text-2xl font-black text-primary-navy focus:outline-none focus:border-primary-navy transition-all rounded-xl placeholder:text-slate-300"
                        placeholder="e.g. 30"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-bold">DAYS</div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="formula"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] textile-header text-text-muted uppercase font-bold tracking-wider">Statutory Formula</label>
                        <button 
                          type="button" 
                          onClick={clearFormula}
                          className="text-[11px] font-bold text-primary-red hover:underline uppercase"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="w-full bg-slate-900 border-2 border-slate-800 rounded-xl shadow-2xl overflow-hidden">
                        <textarea
                          value={formData.formula || ''}
                          onChange={handleFormulaChange}
                          className="w-full bg-transparent text-primary-green font-mono text-lg p-6 min-h-[150px] focus:outline-none resize-none leading-relaxed"
                          placeholder="Define your statutory calculation logic..."
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {FORMULA_VARIABLES.map(v => (
                        <button
                          key={v.value}
                          type="button"
                          onClick={() => addToFormula(v.value)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 border border-app-border rounded-lg text-xs font-bold text-primary-navy hover:bg-white hover:border-primary-navy transition-all"
                        >
                          {v.icon}
                          {v.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {FORMULA_OPERATORS.map(op => (
                        <button
                          key={op}
                          type="button"
                          onClick={() => addToFormula(op)}
                          className="w-10 h-10 flex items-center justify-center bg-slate-100 border border-app-border rounded-lg text-sm font-black text-primary-navy hover:bg-white hover:border-primary-navy transition-all shadow-sm"
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full app-btn app-btn-primary py-4 text-lg textile-header font-black shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 rounded-xl disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={24} />
                    SAVE STATUTORY CONFIGURATION
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Section */}
          <div className="lg:col-span-4 space-y-6">
            <div className="textile-card p-6 bg-white border-app-border shadow-xl">
              <div className="flex items-center justify-between border-b border-app-border pb-3 mb-6">
                <h3 className="textile-header font-bold text-primary-navy flex items-center gap-2">
                  {isEditing ? <Edit2 size={18} /> : <Plus size={18} />}
                  {isEditing ? 'Edit Logic' : 'Define New Logic'}
                </h3>
                {isEditing && (
                  <button onClick={resetForm} className="text-text-muted hover:text-primary-red transition-colors">
                    <X size={18} />
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Type Name (*)</label>
                  <input
                    required
                    name="name"
                    value={formData.name || ''}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md font-bold"
                    placeholder="e.g. Standard 26 Days"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Calculation Mode</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg border border-app-border">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, mode: 'FIXED' }))}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all rounded-md",
                        formData.mode === 'FIXED' ? "bg-primary-navy text-white shadow-md" : "text-text-muted hover:text-primary-navy"
                      )}
                    >
                      <Hash size={14} />
                      FIXED DAYS
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, mode: 'FORMULA' }))}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all rounded-md",
                        formData.mode === 'FORMULA' ? "bg-primary-navy text-white shadow-md" : "text-text-muted hover:text-primary-navy"
                      )}
                    >
                      <Calculator size={14} />
                      FORMULA
                    </button>
                  </div>
                </div>

                {currentMode === 'K' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Allocation Type (Dual-Module)</label>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                      {(['K_ONLY', 'KP', 'STATUTORY'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, allocation_type: type }))}
                          className={cn(
                            "flex-1 py-1.5 text-[10px] font-black uppercase rounded-md transition-all",
                            formData.allocation_type === type ? "bg-white text-primary-navy shadow-sm" : "text-text-muted hover:text-primary-navy"
                          )}
                        >
                          {type.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {formData.mode === 'FIXED' ? (
                    <motion.div
                      key="fixed"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-1"
                    >
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Fixed Days Value (*)</label>
                      <input
                        type="number"
                        step="0.5"
                        name="fixed_days"
                        value={formData.fixed_days ?? ''}
                        onChange={handleInputChange}
                        className="w-full bg-slate-50 border border-app-border p-2.5 text-sm font-black focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                        placeholder="e.g. 26"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="formula"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Formula Builder (*)</label>
                          <button 
                            type="button" 
                            onClick={clearFormula}
                            className="text-[9px] font-bold text-primary-red hover:underline uppercase"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="w-full bg-slate-900 border border-slate-800 rounded-md shadow-inner overflow-hidden">
                          <textarea
                            value={formData.formula || ''}
                            onChange={handleFormulaChange}
                            className="w-full bg-transparent text-primary-green font-mono text-sm p-4 min-h-[100px] focus:outline-none resize-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {FORMULA_VARIABLES.map(v => (
                          <button
                            key={v.value}
                            type="button"
                            onClick={() => addToFormula(v.value)}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-100 border border-app-border rounded text-[9px] font-bold text-primary-navy hover:bg-white hover:border-primary-navy transition-all"
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full app-btn app-btn-primary py-3 textile-header font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {isEditing ? <Save size={18} /> : <Plus size={18} />}
                  {isEditing ? 'Update Logic' : 'Save Logic'}
                </button>
              </form>
            </div>
          </div>

          {/* List Section */}
          <div className="lg:col-span-8 space-y-6">
            <div className="textile-card bg-white border-app-border shadow-xl overflow-hidden flex flex-col h-full">
              <div className="p-4 border-b border-app-border bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="textile-header font-bold text-primary-navy uppercase text-sm">Configured Types</h3>
                  <span className="bg-primary-navy/10 text-primary-navy text-[10px] font-mono px-2 py-0.5 rounded-full border border-primary-navy/20">
                    {types.length} TYPES
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-app-border">
                      <th className="p-4 text-[10px] textile-header text-text-muted uppercase tracking-wider">Type Name</th>
                      <th className="p-4 text-[10px] textile-header text-text-muted uppercase tracking-wider">Mode</th>
                      <th className="p-4 text-[10px] textile-header text-text-muted uppercase tracking-wider">Allocation</th>
                      <th className="p-4 text-[10px] textile-header text-text-muted uppercase tracking-wider">Logic</th>
                      <th className="p-4 text-[10px] textile-header text-text-muted uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/30">
                    {types.map((type) => (
                      <tr key={type.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4">
                          <div className="text-xs font-black text-primary-navy uppercase tracking-tight">{type.name}</div>
                        </td>
                        <td className="p-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border",
                            type.mode === 'FIXED' 
                              ? "bg-blue-50 text-blue-700 border-blue-200" 
                              : "bg-purple-50 text-purple-700 border-purple-200"
                          )}>
                            {type.mode}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded border ${
                            type.allocation_type === 'K_ONLY' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                            type.allocation_type === 'STATUTORY' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                            'bg-green-50 text-green-600 border-green-200'
                          }`}>
                            {type.allocation_type?.replace('_', ' ') || 'KP'}
                          </span>
                        </td>
                        <td className="p-4">
                          {type.mode === 'FIXED' ? (
                            <div className="text-xs font-mono text-text-main">{type.fixed_days} Days</div>
                          ) : (
                            <div className="text-[10px] font-mono text-primary-navy bg-slate-100 px-2 py-1 rounded border border-slate-200 break-all max-w-[200px]">
                              {type.formula}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <AnimatePresence mode="wait">
                              {deleteConfirmId === type.id ? (
                                <motion.div
                                  key="confirm"
                                  initial={{ opacity: 0, x: 10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 10 }}
                                  className="flex items-center gap-2"
                                >
                                  <button
                                    onClick={() => handleDelete(type.id)}
                                    className="px-2 py-1 bg-red-600 text-white text-[9px] font-bold rounded uppercase hover:bg-red-700"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-2 py-1 bg-slate-200 text-slate-600 text-[9px] font-bold rounded uppercase hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </motion.div>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEdit(type)}
                                    className="p-1.5 text-primary-navy hover:bg-primary-navy/10 rounded transition-colors"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(type.id)}
                                    className="p-1.5 text-primary-red hover:bg-primary-red/10 rounded transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </AnimatePresence>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
