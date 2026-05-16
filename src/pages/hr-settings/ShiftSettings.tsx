import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  Clock, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Loader2,
  AlertCircle,
  Settings,
  ChevronRight,
  CheckCircle2,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useModule } from '../../contexts/ModuleContext';
import { Pagination } from '../../components/common/Pagination';
import MasterUsageWarningModal from '../../components/common/MasterUsageWarningModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AttendanceRule {
  id: string;
  fromHours: number;
  fromMinutes: number;
  toHours: number;
  toMinutes: number;
  attendanceValue: number;
}

interface Shift {
  id: number;
  name: string;
  description: string;
  is24HourCycle: boolean;
  start_time: string;
  end_time: string;
  total_working_hours: number;
  grace_period_mins: number;
  allocation_type?: 'K_ONLY' | 'KP' | 'STATUTORY';
  rules: AttendanceRule[];
  status: number;
}

export default function ShiftSettings() {
  const { currentMode } = useModule();

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [warningModalProps, setWarningModalProps] = useState<{isOpen: boolean, message?: string, onProceed?: () => void}>({isOpen: false});

  const [formData, setFormData] = useState<Omit<Shift, 'id'>>({
    name: '',
    description: '',
    is24HourCycle: true,
    start_time: '08:00',
    end_time: '20:00',
    total_working_hours: 12.0,
    grace_period_mins: 15,
    allocation_type: 'KP',
    rules: [
      { id: crypto.randomUUID(), fromHours: 0, fromMinutes: 0, toHours: 7, toMinutes: 15, attendanceValue: 0 },
      { id: crypto.randomUUID(), fromHours: 7, fromMinutes: 15, toHours: 11, toMinutes: 0, attendanceValue: 0.5 },
    ],
    status: 1
  });

  useEffect(() => {
    fetchShifts();
  }, [currentMode]);

  const fetchShifts = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<Shift[]>('master_crud', {
        tableName: 'shifts',
        operation: 'list',
        moduleType: currentMode
      });
      setShifts(Array.isArray(data) ? data.map(item => ({
        ...item,
        is24HourCycle: !!item.is24HourCycle,
        rules: typeof item.rules === 'string' ? JSON.parse(item.rules) : (item.rules || [])
      })) : []);
    } catch (error) {
      toast.error('Failed to fetch shifts');
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(shifts.length / pageSize);
  const currentItems = shifts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleAddRule = () => {
    const lastRule = formData.rules[formData.rules.length - 1];
    setFormData(prev => ({
      ...prev,
      rules: [
        ...prev.rules,
        {
          id: crypto.randomUUID(),
          fromHours: lastRule ? lastRule.toHours : 0,
          fromMinutes: lastRule ? lastRule.toMinutes : 0,
          toHours: lastRule ? lastRule.toHours + 4 : 4,
          toMinutes: 0,
          attendanceValue: lastRule ? lastRule.attendanceValue + 0.5 : 0.5
        }
      ]
    }));
  };

  const handleRemoveRule = (id: string) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.filter(r => r.id !== id)
    }));
  };

  const handleRuleChange = (id: string, field: keyof AttendanceRule, value: number) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.map(r => r.id === id ? { ...r, [field]: value } : r)
    }));
  };

  const processSubmit = async (dataToSave: any) => {
    try {
      await invoke('master_crud', {
        tableName: 'shifts',
        operation: isEditing ? 'update' : 'create',
        id: isEditing,
        data: dataToSave,
        moduleType: currentMode
      });

      toast.success(isEditing ? "Shift updated" : "Shift created");
      setIsFormOpen(false);
      setIsEditing(null);
      fetchShifts();
    } catch (error) {
      toast.error("Failed to save shift");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const dataToSave = {
      ...formData,
      is24HourCycle: formData.is24HourCycle ? 1 : 0,
      allocation_type: formData.allocation_type || 'KP',
      rules: JSON.stringify(formData.rules)
    };

    try {
      if (isEditing) {
        // Only check usage count on edit
        const respData = await invoke<any>('get_master_usage', { table: 'shifts', id: isEditing, moduleType: currentMode });
        
        if (respData && respData.usageCount > 0) {
           setWarningModalProps({
             isOpen: true,
             message: "This shift has existing punches. Changes will only apply to new or re-processed punches. Proceed?",
             onProceed: () => {
               processSubmit(dataToSave);
             }
           });
           setIsLoading(false);
           return;
        }
      }
      
      await processSubmit(dataToSave);
    } catch (err: any) {
       toast.error("Error verifying shift usage");
       setIsLoading(false);
    }
  };

  const handleEdit = (shift: Shift) => {
    setIsEditing(shift.id);
    setFormData({
      name: shift.name || '',
      description: shift.description || '',
      is24HourCycle: !!shift.is24HourCycle,
      start_time: shift.start_time || '08:00',
      end_time: shift.end_time || '20:00',
      total_working_hours: shift.total_working_hours ?? 12.0,
      grace_period_mins: shift.grace_period_mins ?? 15,
      allocation_type: shift.allocation_type || 'KP',
      rules: shift.rules || [],
      status: shift.status
    });
    setIsFormOpen(true);
  };

  const downloadTemplate = () => {
    const headers = [['name', 'description', 'is_24_hour_cycle', 'Shift Start time', 'Shift End time', 'Total Working Hours', 'Grace period (mins)', 'From', 'To', 'Atd. Value', 'From', 'To', 'Atd. Value', 'From', 'To', 'Atd. Value', 'From', 'To', 'Atd. Value', 'allocation_type', 'status']];
    const example = [[
      'WORKER 12 HRS', 
      'General Shift', 
      '1',
      '08:00',
      '20:00',
      '12.0',
      '15',
      '00:00', '07:05', '0',
      '07:05', '11:00', '0.50',
      '11:00', '22:00', '1.00',
      '22:00', '28:00', '2.00',
      'KP',
      'Active'
    ]];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shift Template");
    XLSX.writeFile(wb, "Shift_Settings_Template.xlsx");
    toast.success("Template downloaded successfully");
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      try {
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (rows.length <= 1) {
          toast.error("No data found in the file");
          return;
        }

        const parseTimeValue = (val: any) => {
          if (!val && val !== 0) return null;
          if (typeof val === 'number') {
            const totalMinutes = Math.round(val * 24 * 60);
          return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
          }
          const s = String(val).trim();
          if (!s) return null;
          const [h, m] = s.split(':').map(n => parseInt(n) || 0);
          return { hours: h || 0, minutes: m || 0 };
        };

        const shiftsData = rows.slice(1).map(row => {
          const name = row[0];
          if (!name) return null;
          const description = row[1] || '';
          const is24HourCycle = row[2] == '1' || String(row[2]).toLowerCase() === 'true';

          const formatTimeStr = (val: any, defaultVal: string) => {
            const t = parseTimeValue(val);
            if (!t) return defaultVal;
            return `${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}`;
          };

          const startTime = formatTimeStr(row[3], '08:00');
          const endTime = formatTimeStr(row[4], '20:00');
          const totalWorkingHours = parseFloat(row[5]) || 12.0;
          const gracePeriodMins = parseInt(row[6]) || 15;
          const allocationType = row[19] || 'KP';
          const status = String(row[20] || '').toLowerCase() === 'active' || row[20] == '1' ? 1 : 0;

          const rules: AttendanceRule[] = [];
          for (let i = 0; i < 4; i++) {
            const baseIdx = 7 + (i * 3);
            const from = parseTimeValue(row[baseIdx]);
            const to = parseTimeValue(row[baseIdx + 1]);
            const val = parseFloat(row[baseIdx + 2]);

            if (from && to) {
              rules.push({
                id: crypto.randomUUID(),
                fromHours: from.hours,
                fromMinutes: from.minutes,
                toHours: to.hours,
                toMinutes: to.minutes,
                attendanceValue: isNaN(val) ? 0 : val
              });
            }
          }

          return {
            name,
            description,
            is24_hour_cycle: is24HourCycle ? 1 : 0,
            start_time: startTime,
            end_time: endTime,
            total_working_hours: totalWorkingHours,
            grace_period_mins: gracePeriodMins,
            allocation_type: allocationType,
            rules: JSON.stringify(rules),
            status
          };
        }).filter(Boolean);

        if (shiftsData.length === 0) {
          toast.error("No valid shift data found");
          return;
        }

        const CHUNK_SIZE = 500;
        const total = shiftsData.length;
        
        for (let i = 0; i < total; i += CHUNK_SIZE) {
          const chunk = shiftsData.slice(i, i + CHUNK_SIZE);
          await invoke('master_crud', {
            tableName: 'shifts',
            operation: 'bulk_create',
            data: chunk,
            moduleType: currentMode
          });
        }
        
        toast.success(`Bulk upload successful (${shiftsData.length} records processed)`);
        fetchShifts();
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(err.error || "Bulk upload failed");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy flex items-center gap-3">
            <Clock size={32} />
            {currentMode === 'P' ? 'Statutory Shift Schedule' : 'Shift Settings'}
            <span className="bg-primary-navy/10 text-primary-navy text-[10px] font-mono px-2 py-0.5 rounded-full border border-primary-navy/20">
              {shifts.length} RECORDS
            </span>
            {currentMode === 'P' && (
              <span className="mode-pakka text-[10px] px-2 py-0.5 rounded shadow-sm">
                STATUTORY MODE
              </span>
            )}
          </h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">
            {currentMode === 'P' ? 'Module P // Statutory Compliance Cycle' : 'Module K // Actual Operations Ledger'}
          </p>
        </div>
        {!isFormOpen && (
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border border-app-border rounded-lg shadow-sm p-1">
              <button 
                onClick={downloadTemplate}
                className="p-2 text-text-muted hover:text-primary-navy hover:bg-slate-50 rounded-md transition-all flex items-center gap-2 text-xs font-bold"
                title="Download Template"
              >
                <Download size={16} />
                <span className="hidden sm:inline">TEMPLATE</span>
              </button>
              <div className="w-[1px] h-4 bg-app-border mx-1" />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-text-muted hover:text-primary-navy hover:bg-slate-50 rounded-md transition-all flex items-center gap-2 text-xs font-bold"
                title="Bulk Upload"
              >
                <Upload size={16} />
                <span className="hidden sm:inline">UPLOAD</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls"
                onChange={handleBulkUpload}
              />
            </div>

            <button 
              onClick={() => {
                setIsEditing(null);
                setFormData({
                  name: '',
                  description: '',
                  is24HourCycle: true,
                  start_time: '09:00',
                  end_time: '17:00',
                  total_working_hours: 8,
                  grace_period_mins: 15,
                  rules: [
                    { id: crypto.randomUUID(), fromHours: 0, fromMinutes: 0, toHours: 7, toMinutes: 15, attendanceValue: 0 },
                    { id: crypto.randomUUID(), fromHours: 7, fromMinutes: 15, toHours: 11, toMinutes: 0, attendanceValue: 0.5 },
                  ],
                  status: 1
                });
                setIsFormOpen(true);
              }}
              className="app-btn app-btn-primary flex items-center gap-2 shadow-lg"
            >
              <Plus size={18} />
              Define New Shift
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isFormOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="textile-card bg-white border-app-border shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-app-border bg-slate-50 flex justify-between items-center">
              <h3 className="textile-header font-bold text-primary-navy flex items-center gap-2 uppercase">
                <Settings size={18} />
                {isEditing ? 'Edit Shift Parameters' : 'New Shift Configuration'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-text-muted" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Shift Name (*)</label>
                    <input
                      required
                      value={formData.name || ''}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                      placeholder="e.g. Day Shift, Night Shift"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Shift Start Time</label>
                      <input
                        type="time"
                        value={formData.start_time || ''}
                        onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Shift End Time</label>
                      <input
                        type="time"
                        value={formData.end_time || ''}
                        onChange={e => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Total Working Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        value={formData.total_working_hours ?? 0}
                        onChange={e => setFormData(prev => ({ ...prev, total_working_hours: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Grace Period (Mins)</label>
                      <input
                        type="number"
                        value={formData.grace_period_mins ?? 0}
                        onChange={e => setFormData(prev => ({ ...prev, grace_period_mins: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Description</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-md resize-none"
                      placeholder="Shift details..."
                    />
                  </div>
                  
                  {currentMode === 'K' && (
                    <div className="space-y-1 pt-2">
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Allocation Type (Dual-Module)</label>
                      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                        {(['K_ONLY', 'KP', 'STATUTORY'] as const).map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({...formData, allocation_type: type})}
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

                  <div className="space-y-1 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={formData.status === 1}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.checked ? 1 : 0 }))}
                        className="w-4 h-4 text-primary-navy focus:ring-primary-navy border-app-border rounded cursor-pointer"
                      />
                      <span className="text-xs textile-header font-bold text-text-main">ACTIVE SHIFT</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-app-border pb-2">
                  <h4 className="textile-header font-bold text-primary-navy text-sm uppercase flex items-center gap-2">
                    <AlertCircle size={16} className="text-primary-navy" />
                    Attendance Value Parameters (24h Cycle)
                  </h4>
                  <button 
                    type="button"
                    onClick={handleAddRule}
                    className="text-xs font-bold text-primary-navy hover:underline flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Range
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-left">
                        <th className="p-3 text-[10px] textile-header text-text-muted uppercase tracking-wider border border-app-border">From (HH:MM)</th>
                        <th className="p-3 text-[10px] textile-header text-text-muted uppercase tracking-wider border border-app-border">To (HH:MM)</th>
                        <th className="p-3 text-[10px] textile-header text-text-muted uppercase tracking-wider border border-app-border">Attendance Value</th>
                        <th className="p-3 text-[10px] textile-header text-text-muted uppercase tracking-wider border border-app-border text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border">
                      {formData.rules.map((rule, idx) => (
                        <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 border border-app-border">
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                min="0" max="30"
                                value={rule.fromHours ?? ''}
                                onChange={e => handleRuleChange(rule.id, 'fromHours', parseInt(e.target.value) || 0)}
                                className="w-16 bg-white border border-app-border p-2 text-xs rounded font-mono"
                              />
                              <span className="text-xs font-bold">:</span>
                              <input 
                                type="number" 
                                min="0" max="59"
                                value={rule.fromMinutes ?? ''}
                                onChange={e => handleRuleChange(rule.id, 'fromMinutes', parseInt(e.target.value) || 0)}
                                className="w-16 bg-white border border-app-border p-2 text-xs rounded font-mono"
                              />
                            </div>
                          </td>
                          <td className="p-3 border border-app-border">
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                min="0" max="30"
                                value={rule.toHours ?? ''}
                                onChange={e => handleRuleChange(rule.id, 'toHours', parseInt(e.target.value) || 0)}
                                className="w-16 bg-white border border-app-border p-2 text-xs rounded font-mono"
                              />
                              <span className="text-xs font-bold">:</span>
                              <input 
                                type="number" 
                                min="0" max="59"
                                value={rule.toMinutes ?? ''}
                                onChange={e => handleRuleChange(rule.id, 'toMinutes', parseInt(e.target.value) || 0)}
                                className="w-16 bg-white border border-app-border p-2 text-xs rounded font-mono"
                              />
                            </div>
                          </td>
                          <td className="p-3 border border-app-border">
                            <input 
                              type="number" 
                              step="0.5"
                              min="0" max="10"
                              value={rule.attendanceValue ?? ''}
                              onChange={e => handleRuleChange(rule.id, 'attendanceValue', parseFloat(e.target.value) || 0)}
                              className="w-full bg-white border border-app-border p-2 text-xs rounded font-mono font-bold text-primary-navy"
                            />
                          </td>
                          <td className="p-3 border border-app-border text-center">
                            <button 
                              type="button"
                              onClick={() => handleRemoveRule(rule.id)}
                              className="p-2 text-primary-red hover:bg-red-50 rounded-full transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-app-border">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-6 py-2.5 text-sm font-bold text-text-muted hover:bg-slate-100 rounded-md transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="app-btn app-btn-primary px-8 py-2.5 flex items-center gap-2 shadow-lg"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {isEditing ? 'Update Shift' : 'Save Shift Configuration'}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentItems.map(shift => (
                <motion.div
                key={shift.id}
                layoutId={`shift-${shift.id}`}
                className="textile-card bg-white border-app-border shadow-xl hover:shadow-2xl transition-all group overflow-hidden"
              >
                <div className="p-5 border-b border-app-border bg-slate-50 flex justify-between items-start">
                  <div>
                    <h3 className="textile-header font-bold text-primary-navy uppercase tracking-tight">{shift.name}</h3>
                    <p className="text-[10px] text-text-muted font-mono uppercase">
                      ID: SHFT-{shift.id.toString().padStart(3, '0')} // {currentMode === 'P' ? 'STATUTORY' : 'ACTUAL'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(shift)}
                      className="p-2 text-primary-navy hover:bg-primary-navy/10 rounded-md transition-colors"
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-xs text-text-muted line-clamp-2 h-8">{shift.description || 'No description provided.'}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-text-muted uppercase border-b border-app-border pb-1">
                      <span>Logic Ranges</span>
                      <span>Value</span>
                    </div>
                    {shift.rules.slice(0, 3).map((rule, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-text-muted">
                          {rule.fromHours.toString().padStart(2, '0')}:{rule.fromMinutes.toString().padStart(2, '0')} - {rule.toHours.toString().padStart(2, '0')}:{rule.toMinutes.toString().padStart(2, '0')}
                        </span>
                        <span className="font-bold text-primary-navy">{rule.attendanceValue.toFixed(1)}</span>
                      </div>
                    ))}
                    {shift.rules.length > 3 && (
                      <p className="text-[9px] text-center text-text-muted italic pt-1">+{shift.rules.length - 3} more ranges</p>
                    )}
                  </div>
                </div>
                <div className="px-5 py-3 bg-slate-50 border-t border-app-border flex justify-between items-center">
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await invoke('master_crud', {
                          tableName: 'shifts',
                          operation: 'update',
                          id: shift.id,
                          data: { 
                            ...shift, 
                            status: shift.status === 1 ? 0 : 1, 
                            rules: JSON.stringify(shift.rules),
                            is24HourCycle: shift.is24HourCycle ? 1 : 0
                          },
                          moduleType: currentMode
                        });
                        toast.success(`Shift marked as ${shift.status === 1 ? 'Inactive' : 'Active'}`);
                        fetchShifts();
                      } catch (err) {
                        toast.error("Failed to update status");
                      }
                    }}
                    className={cn(
                      "px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter border flex items-center gap-1 transition-all hover:shadow-md cursor-pointer",
                      shift.status === 1 ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                    )}
                    title={shift.status === 1 ? 'Click to deactivate' : 'Click to activate'}
                  >
                    {shift.status === 1 ? <CheckCircle2 size={12} /> : <X size={12} />}
                    {shift.status === 1 ? 'Active' : 'Inactive'}
                  </button>
                  <button 
                    onClick={() => handleEdit(shift)}
                    className="text-[10px] font-bold text-primary-navy flex items-center gap-1 hover:underline"
                  >
                    View Details
                    <ChevronRight size={12} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-8">
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={shifts.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </>
        )}
      </AnimatePresence>
      <MasterUsageWarningModal 
        isOpen={warningModalProps.isOpen}
        onClose={() => setWarningModalProps({isOpen: false})}
        onProceed={warningModalProps.onProceed || (() => {})}
        message={warningModalProps.message || ""}
      />
    </div>
  );
}
