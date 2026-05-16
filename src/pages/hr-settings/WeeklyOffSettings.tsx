import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Clock, Calendar, Plus, Trash2, Edit2, Save, X, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

import { useModule } from '../../contexts/ModuleContext';

const weeklyOffSchema = z.object({
  day: z.string().min(1, "Please select a day"),
  effectiveFrom: z.string().min(1, "Please select effective date"),
  allocation_type: z.enum(['K_ONLY', 'KP', 'STATUTORY']).optional().default('KP')
});

type WeeklyOffFormValues = z.infer<typeof weeklyOffSchema>;

interface WeeklyOffSetting {
  id: number;
  day: string;
  effective_from: string;
  allocation_type?: 'K_ONLY' | 'KP' | 'STATUTORY';
  created_at: string;
}

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export default function WeeklyOffSettings() {
  const { currentMode } = useModule();

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  const [settings, setSettings] = useState<WeeklyOffSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<WeeklyOffFormValues>({
    resolver: zodResolver(weeklyOffSchema),
    defaultValues: {
      day: '',
      effectiveFrom: new Date().toISOString().slice(0, 7), // YYYY-MM
      allocation_type: 'KP'
    }
  });

  useEffect(() => {
    fetchSettings();
  }, [currentMode]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const data = await invoke<WeeklyOffSetting[]>('master_crud', {
        tableName: 'weekly_off',
        operation: 'list',
        moduleType: currentMode
      });
      setSettings(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Could not load weekly off history');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: WeeklyOffFormValues) => {
    try {
      await invoke('master_crud', {
        tableName: 'weekly_off',
        operation: editingId ? 'update' : 'create',
        id: editingId,
        data: {
          day: data.day,
          effective_from: data.effectiveFrom,
          allocation_type: data.allocation_type || 'KP'
        },
        moduleType: currentMode
      });

      toast.success(editingId ? 'Setting updated successfully' : 'Weekly off added successfully');
      reset();
      setEditingId(null);
      fetchSettings();
    } catch (error) {
      toast.error('Error saving weekly off setting');
    }
  };

  const handleEdit = (setting: WeeklyOffSetting) => {
    setEditingId(setting.id);
    setValue('day', setting.day);
    setValue('effectiveFrom', setting.effective_from);
    setValue('allocation_type', setting.allocation_type || 'KP');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke('master_crud', {
        tableName: 'weekly_off',
        operation: 'delete',
        id,
        moduleType: currentMode
      });
      toast.success('Setting deleted');
      setDeleteConfirmId(null);
      fetchSettings();
    } catch (error) {
      toast.error('Error deleting setting');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
  };

  // Helper to format YYYY-MM to MMM-YYYY
  const formatMonthYear = (val: string) => {
    if (!val) return '';
    const [year, month] = val.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Weekly Off Settings</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">HR Settings // Master Configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="textile-card p-6 bg-white border-app-border sticky top-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-primary-navy/5 rounded-lg text-primary-navy">
                <Clock size={20} />
              </div>
              <h3 className="text-lg font-bold text-primary-navy">
                {editingId ? 'Edit Weekly Off' : 'Set Weekly Off'}
              </h3>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-primary-navy uppercase tracking-tight">Select Day</label>
                <select
                  {...register('day')}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-primary-navy/20 focus:border-primary-navy outline-none transition-all text-sm"
                >
                  <option value="">-- Choose Day --</option>
                  {DAYS_OF_WEEK.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
                {errors.day && <p className="text-[10px] text-red-500 font-bold uppercase">{errors.day.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-primary-navy uppercase tracking-tight">Effective From</label>
                <div className="relative">
                  <input
                    type="month"
                    {...register('effectiveFrom')}
                    className="w-full h-10 px-3 pl-10 bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-primary-navy/20 focus:border-primary-navy outline-none transition-all text-sm"
                  />
                  <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
                </div>
                {errors.effectiveFrom && <p className="text-[10px] text-red-500 font-bold uppercase">{errors.effectiveFrom.message}</p>}
              </div>

              {currentMode === 'K' && (
                <div className="space-y-1 pt-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Allocation Type (Dual-Module)</label>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                    {(['K_ONLY', 'KP', 'STATUTORY'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setValue('allocation_type', type)}
                        className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${
                          watch('allocation_type') === type ? "bg-white text-primary-navy shadow-sm" : "text-text-muted hover:text-primary-navy"
                        }`}
                      >
                        {type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-10 bg-primary-navy text-white rounded font-bold text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    'Saving...'
                  ) : editingId ? (
                    <><Save size={16} /> Update Setting</>
                  ) : (
                    <><Plus size={16} /> Add Setting</>
                  )}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="w-10 h-10 border border-slate-200 rounded flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-all"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* History Table Section */}
        <div className="lg:col-span-2">
          <div className="textile-card bg-white border-app-border overflow-hidden">
            <div className="p-6 border-b border-app-border flex justify-between items-center">
              <h3 className="text-lg font-bold text-primary-navy">Configuration History</h3>
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-tighter">
                Total Records: {settings.length}
              </div>
            </div>

            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-4 border-primary-navy/20 border-t-primary-navy rounded-full animate-spin" />
                  <p className="text-xs font-mono text-text-muted animate-pulse">FETCHING HISTORY...</p>
                </div>
              ) : settings.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                    <Clock size={40} />
                  </div>
                  <div>
                    <h4 className="font-bold text-primary-navy">No History Found</h4>
                    <p className="text-sm text-text-muted">Start by adding a weekly off configuration.</p>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-app-border">
                      <th className="px-6 py-4 text-[10px] font-black text-primary-navy uppercase tracking-widest">Weekly Off Day</th>
                      <th className="px-6 py-4 text-[10px] font-black text-primary-navy uppercase tracking-widest">Effective From</th>
                      <th className="px-6 py-4 text-[10px] font-black text-primary-navy uppercase tracking-widest">Allocation</th>
                      <th className="px-6 py-4 text-[10px] font-black text-primary-navy uppercase tracking-widest">Created On</th>
                      <th className="px-6 py-4 text-[10px] font-black text-primary-navy uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout">
                      {settings.map((setting) => (
                        <motion.tr
                          key={setting.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-b border-app-border hover:bg-slate-50/50 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-primary-navy/5 flex items-center justify-center text-primary-navy font-bold text-xs">
                                {setting.day.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm font-bold text-primary-navy">{setting.day}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                              {formatMonthYear(setting.effective_from)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] uppercase font-black px-2 py-1 rounded border ${
                              setting.allocation_type === 'K_ONLY' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                              setting.allocation_type === 'STATUTORY' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                              'bg-green-50 text-green-600 border-green-200'
                            }`}>
                              {setting.allocation_type?.replace('_', ' ') || 'KP'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-text-muted">
                              {new Date(setting.created_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <AnimatePresence mode="wait">
                                {deleteConfirmId === setting.id ? (
                                  <motion.div
                                    key="confirm"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className="flex items-center gap-2"
                                  >
                                    <button
                                      onClick={() => handleDelete(setting.id)}
                                      className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded uppercase tracking-tighter hover:bg-red-700 transition-colors"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded uppercase tracking-tighter hover:bg-slate-300 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="actions"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <button
                                      onClick={() => handleEdit(setting)}
                                      className="p-2 text-slate-400 hover:text-primary-navy hover:bg-primary-navy/5 rounded transition-all"
                                      title="Edit"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmId(setting.id)}
                                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                      title="Delete"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-app-border flex items-center gap-2 text-amber-600">
              <AlertCircle size={14} />
              <p className="text-[10px] font-bold uppercase tracking-tight">
                Note: Only the latest effective setting will be applied for payroll calculations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
