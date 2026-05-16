import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Settings2, 
  Plus, 
  Trash2, 
  Save, 
  ArrowUp, 
  ArrowDown,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useModule } from '../../contexts/ModuleContext';

interface LeaveConfig {
  id?: number;
  leave_name: string;
  credit_type: 'Fixed' | 'Attendance Based';
  leave_value?: number;
  multiplier?: number;
  min_attendance_threshold?: number;
  min_service_requirement_value?: number;
  min_service_requirement_unit?: 'Days' | 'Months';
  credit_trigger: 'Calendar Year Start' | 'Prorated' | 'Month Start' | 'Month End';
  adjustment_priority: number;
  status: boolean;
}

export default function LeaveSettings() {
  const { currentMode } = useModule();
  const [configs, setConfigs] = useState<LeaveConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LeaveConfig | null>(null);

  const [formData, setFormData] = useState<LeaveConfig>({
    leave_name: '',
    credit_type: 'Fixed',
    leave_value: 0,
    multiplier: 0,
    min_attendance_threshold: 0,
    min_service_requirement_value: 0,
    min_service_requirement_unit: 'Months',
    credit_trigger: 'Calendar Year Start',
    adjustment_priority: 0,
    status: true
  });

  useEffect(() => {
    fetchConfigs();
  }, [currentMode]);

  const fetchConfigs = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<LeaveConfig[]>('master_crud', {
        tableName: 'leave_configurations',
        operation: 'list',
        moduleType: currentMode,
        filters: null
      });
      // Sort by priority
      const sortedData = [...data].sort((a, b) => a.adjustment_priority - b.adjustment_priority);
      setConfigs(sortedData);
    } catch (err) {
      toast.error("Failed to fetch leave configurations");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await invoke('master_crud', {
        tableName: 'leave_configurations',
        operation: editingConfig ? 'update' : 'create',
        id: editingConfig?.id,
        data: {
          ...formData,
          status: formData.status ? 1 : 0
        },
        moduleType: currentMode,
        filters: null
      });

      toast.success(`Leave configuration ${editingConfig ? 'updated' : 'created'} successfully`);
      setIsModalOpen(false);
      setEditingConfig(null);
      resetForm();
      fetchConfigs();
    } catch (err) {
      toast.error(typeof err === 'string' ? err : "Failed to save configuration");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return;
    try {
      await invoke('master_crud', {
        tableName: 'leave_configurations',
        operation: 'delete',
        id,
        moduleType: currentMode,
        filters: null
      });
      toast.success("Configuration deleted");
      fetchConfigs();
    } catch (err) {
      toast.error("Failed to delete configuration");
    }
  };

  const resetForm = () => {
    setFormData({
      leave_name: '',
      credit_type: 'Fixed',
      leave_value: 0,
      multiplier: 0,
      min_attendance_threshold: 0,
      min_service_requirement_value: 0,
      min_service_requirement_unit: 'Months',
      credit_trigger: 'Calendar Year Start',
      adjustment_priority: configs.length + 1,
      status: true
    });
  };

  const movePriority = async (index: number, direction: 'up' | 'down') => {
    const newConfigs = [...configs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newConfigs.length) return;

    // Swap priorities
    const temp = newConfigs[index].adjustment_priority;
    newConfigs[index].adjustment_priority = newConfigs[targetIndex].adjustment_priority;
    newConfigs[targetIndex].adjustment_priority = temp;

    try {
      // Update both in DB
      await Promise.all([
        invoke('master_crud', {
          tableName: 'leave_configurations',
          operation: 'update',
          id: newConfigs[index].id,
          data: { adjustment_priority: newConfigs[index].adjustment_priority },
          moduleType: currentMode,
          filters: null
        }),
        invoke('master_crud', {
          tableName: 'leave_configurations',
          operation: 'update',
          id: newConfigs[targetIndex].id,
          data: { adjustment_priority: newConfigs[targetIndex].adjustment_priority },
          moduleType: currentMode,
          filters: null
        })
      ]);
      fetchConfigs();
    } catch (err) {
      toast.error("Failed to update priority");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Leave Configurations</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Module // HR Settings</p>
        </div>
        <button 
          onClick={() => { resetForm(); setEditingConfig(null); setIsModalOpen(true); }}
          className="app-btn app-btn-primary flex items-center gap-2 px-6 py-2.5 shadow-lg hover:shadow-xl transition-all"
        >
          <Plus size={18} />
          <span className="textile-header font-bold">New Configuration</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="textile-card p-4 bg-white border-app-border">
            <div className="flex items-center gap-2 mb-4 border-b border-app-border pb-2">
              <Settings2 size={16} className="text-primary-navy" />
              <h3 className="textile-header font-bold text-primary-navy uppercase text-xs tracking-widest">Adjustment Priority</h3>
            </div>
            <p className="text-[10px] text-text-muted font-mono mb-4 uppercase">Defines the order in which the payroll engine debits leaves.</p>
            
            <div className="space-y-2">
              {configs.map((config, index) => (
                <div 
                  key={config.id}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-app-border rounded-md group hover:border-primary-navy/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-primary-navy text-white text-[10px] font-bold rounded-full">
                      {config.adjustment_priority}
                    </span>
                    <span className="text-sm font-bold text-primary-navy">{config.leave_name}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => movePriority(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-app-border disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button 
                      onClick={() => movePriority(index, 'down')}
                      disabled={index === configs.length - 1}
                      className="p-1 hover:bg-white rounded border border-transparent hover:border-app-border disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {configs.length === 0 && (
                <div className="text-center py-8 text-text-muted font-mono text-xs italic">
                  No configurations defined
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="textile-card bg-white border-app-border overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-app-border">
                  <th className="p-4 textile-header text-[10px] text-text-muted uppercase font-bold tracking-widest">Leave Name</th>
                  <th className="p-4 textile-header text-[10px] text-text-muted uppercase font-bold tracking-widest">Credit Type</th>
                  <th className="p-4 textile-header text-[10px] text-text-muted uppercase font-bold tracking-widest">Trigger</th>
                  <th className="p-4 textile-header text-[10px] text-text-muted uppercase font-bold tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-primary-navy border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-mono text-text-muted uppercase">Loading Configs...</span>
                      </div>
                    </td>
                  </tr>
                ) : configs.map((config) => (
                  <tr key={config.id} className="border-b border-app-border hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-primary-navy">{config.leave_name}</span>
                        <span className="text-[10px] font-mono text-text-muted uppercase">Priority: {config.adjustment_priority}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        config.credit_type === 'Fixed' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {config.credit_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-text-main font-medium">{config.credit_trigger}</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setEditingConfig(config); setFormData(config); setIsModalOpen(true); }}
                          className="p-2 text-primary-navy hover:bg-primary-navy/5 rounded-md transition-colors"
                        >
                          <Settings2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(config.id!)}
                          className="p-2 text-primary-red hover:bg-primary-red/5 rounded-md transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-navy/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-xl shadow-2xl border border-app-border w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-app-border bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-navy rounded-lg flex items-center justify-center text-white shadow-lg">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl textile-header font-black text-primary-navy">
                      {editingConfig ? 'Edit Configuration' : 'New Leave Configuration'}
                    </h3>
                    <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Define Credit Logic & Rules</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-primary-navy transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-widest">Leave Name</label>
                    <input 
                      required
                      type="text"
                      value={formData.leave_name}
                      onChange={(e) => setFormData({ ...formData, leave_name: e.target.value })}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                      placeholder="e.g. SL, CL, PL"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-widest">Credit Trigger</label>
                    <select 
                      value={formData.credit_trigger}
                      onChange={(e) => setFormData({ ...formData, credit_trigger: e.target.value as any })}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                    >
                      <option value="Calendar Year Start">Calendar Year Start</option>
                      <option value="Prorated">Prorated</option>
                      <option value="Month Start">Month Start</option>
                      <option value="Month End">Month End</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 p-4 bg-slate-50 border border-app-border rounded-lg">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-widest">Credit Type</label>
                    <div className="flex bg-white border border-app-border rounded-md p-1">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, credit_type: 'Fixed' })}
                        className={`px-4 py-1.5 text-[10px] font-bold rounded transition-all ${
                          formData.credit_type === 'Fixed' 
                            ? 'bg-primary-navy text-white shadow-md' 
                            : 'text-text-muted hover:text-primary-navy'
                        }`}
                      >
                        FIXED
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, credit_type: 'Attendance Based' })}
                        className={`px-4 py-1.5 text-[10px] font-bold rounded transition-all ${
                          formData.credit_type === 'Attendance Based' 
                            ? 'bg-primary-navy text-white shadow-md' 
                            : 'text-text-muted hover:text-primary-navy'
                        }`}
                      >
                        ATTENDANCE BASED
                      </button>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {formData.credit_type === 'Fixed' ? (
                      <motion.div 
                        key="fixed"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="space-y-2"
                      >
                        <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-widest">Leave Value (Days)</label>
                        <input 
                          type="number"
                          step="0.5"
                          value={formData.leave_value ?? 0}
                          onChange={(e) => setFormData({ ...formData, leave_value: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                        />
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="attendance"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="grid grid-cols-2 gap-4"
                      >
                        <div className="space-y-2">
                          <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-widest">Multiplier (e.g. 0.05)</label>
                          <input 
                            type="number"
                            step="0.001"
                            value={formData.multiplier ?? 0}
                            onChange={(e) => setFormData({ ...formData, multiplier: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-white border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-widest">Min Attendance Threshold</label>
                          <input 
                            type="number"
                            value={formData.min_attendance_threshold ?? 0}
                            onChange={(e) => setFormData({ ...formData, min_attendance_threshold: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                            placeholder="e.g. 240"
                          />
                        </div>
                        <div className="col-span-2 grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-widest">Min Service Value</label>
                            <input 
                              type="number"
                              value={formData.min_service_requirement_value ?? 0}
                              onChange={(e) => setFormData({ ...formData, min_service_requirement_value: parseInt(e.target.value) || 0 })}
                              className="w-full bg-white border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-widest">Service Unit</label>
                            <select 
                              value={formData.min_service_requirement_unit}
                              onChange={(e) => setFormData({ ...formData, min_service_requirement_unit: e.target.value as any })}
                              className="w-full bg-white border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                            >
                              <option value="Days">Days</option>
                              <option value="Months">Months</option>
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-widest">Adjustment Priority</label>
                    <input 
                      type="number"
                      value={formData.adjustment_priority}
                      onChange={(e) => setFormData({ ...formData, adjustment_priority: parseInt(e.target.value) })}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <input 
                      type="checkbox"
                      id="status"
                      checked={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
                      className="w-4 h-4 text-primary-navy border-app-border rounded focus:ring-primary-navy"
                    />
                    <label htmlFor="status" className="text-xs font-bold text-primary-navy uppercase tracking-widest">Active Status</label>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex gap-3">
                  <Info className="text-blue-500 shrink-0" size={18} />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Configuration Note</p>
                    <p className="text-xs text-blue-600/80 leading-relaxed">
                      {formData.credit_type === 'Fixed' 
                        ? `This leave will be credited as a flat ${formData.leave_value} days based on the ${formData.credit_trigger} trigger.`
                        : `This leave will be calculated based on attendance (Multiplier: ${formData.multiplier}) once the threshold of ${formData.min_attendance_threshold} days is met.`}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-app-border text-text-muted textile-header font-bold rounded-md hover:bg-slate-50 transition-colors uppercase text-xs tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-primary-navy text-white textile-header font-bold rounded-md shadow-lg hover:shadow-xl transition-all uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                  >
                    <Save size={16} />
                    Save Configuration
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
