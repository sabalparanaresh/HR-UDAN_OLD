import React, { useState, useEffect, useRef } from 'react';
import { 
  Coffee, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Calendar, 
  UserPlus, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { invokeCommand as invoke } from '../../services/apiClient';
import { useModule } from '../../contexts/ModuleContext';
import { User as UserType, Employee } from '../../types';
import EmployeeSearchSelect from '../../components/form/EmployeeSearchSelect';

interface CanteenTransaction {
  id: number;
  emp_id: number;
  emp_name: string;
  emp_code: string;
  punch_time: string;
  source: string;
  window_name: string;
  is_valid: number;
}

import { HistoryTable } from '../../components/table/HistoryTable';
import * as Tabs from '@radix-ui/react-tabs';

const CanteenEntry: React.FC<{ currentUser: UserType | null }> = ({ currentUser }) => {
  const { currentMode } = useModule();
  
  const [transactions, setTransactions] = useState<CanteenTransaction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [windows, setWindows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [filters, setFilters] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    emp_ids: [] as number[],
    window_id: ''
  });

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualType, setManualType] = useState<'single' | 'bulk'>('single');
  const [manualPunch, setManualPunch] = useState({
    emp_id: '',
    date: new Date().toISOString().split('T')[0],
    time: '12:00'
  });
  const [bulkPunch, setBulkPunch] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    time: '12:00',
    emp_ids: [] as number[]
  });

  const canteenDateRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [masterData, transData]: [any, any] = await Promise.all([
        invoke('get_canteen_master_data', { moduleType: currentMode }),
        invoke('get_canteen_transactions', { 
          ...filters, 
          emp_id: filters.emp_ids.length > 0 ? filters.emp_ids.join(',') : '', 
          moduleType: currentMode 
        })
      ]);

      if (masterData.employees) setEmployees(masterData.employees);
      if (masterData.windows) setWindows(masterData.windows);
      if (Array.isArray(transData)) setTransactions(transData);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentMode, filters.start_date, filters.end_date, JSON.stringify(filters.emp_ids), filters.window_id]);

  const handleSyncPunches = async () => {
    setIsSaving(true);
    try {
      const data: any = await invoke('sync_canteen_punches', { moduleType: currentMode });
      toast.success(`Synced ${data.syncedCount} punches from biometric device`);
      fetchData();
    } catch (error) {
      toast.error('Failed to sync punches');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualPunchSubmit = async () => {
    setIsSaving(true);
    try {
      const punches = [];
      if (manualType === 'single') {
        if (!manualPunch.emp_id) throw new Error('Please select an employee');
        punches.push({
          emp_id: parseInt(manualPunch.emp_id),
          punch_time: `${manualPunch.date} ${manualPunch.time}:00`,
          source: 'Manual'
        });
      } else {
        if (bulkPunch.emp_ids.length === 0) throw new Error('Please select at least one employee');
        const start = new Date(bulkPunch.start_date);
        const end = new Date(bulkPunch.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          for (const empId of bulkPunch.emp_ids) {
            punches.push({
              emp_id: empId,
              punch_time: `${dateStr} ${bulkPunch.time}:00`,
              source: 'Manual'
            });
          }
        }
      }

      const chunkSize = 200;
      for (let i = 0; i < punches.length; i += chunkSize) {
        const chunk = punches.slice(i, i + chunkSize);
        await invoke('bulk_save_canteen_punches', { punches: chunk, moduleType: currentMode });
      }

      toast.success('Manual punches saved');
      setIsManualModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save manual punches');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-primary-navy textile-header">Canteen Entry</h1>
          <p className="text-text-muted font-mono text-sm uppercase tracking-widest">Transactions // Manual Entry // Biometric Sync</p>
        </div>
      </div>

      <Tabs.Root defaultValue="entry" className="w-full">
        <Tabs.List className="flex border-b border-app-border mb-6">
          <Tabs.Trigger value="entry" className="px-6 py-3 font-bold text-sm uppercase text-text-muted data-[state=active]:text-primary-navy data-[state=active]:border-b-2 data-[state=active]:border-primary-navy hover:text-primary-navy transition-colors">
            Entry Form
          </Tabs.Trigger>
          <Tabs.Trigger value="history" className="px-6 py-3 font-bold text-sm uppercase text-text-muted data-[state=active]:text-primary-navy data-[state=active]:border-b-2 data-[state=active]:border-primary-navy hover:text-primary-navy transition-colors">
            History
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="entry" className="space-y-8 outline-none">
          <div className="flex justify-end gap-3">
            <button 
              onClick={handleSyncPunches}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-primary-navy/20 text-primary-navy rounded-lg hover:bg-primary-navy/5 transition-all font-bold text-sm"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Fetch Biometric Punches
            </button>
            <button 
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-navy text-white rounded-lg hover:bg-primary-navy/90 transition-all font-bold text-sm shadow-lg shadow-primary-navy/20"
            >
              <Plus size={18} /> Add Entry
            </button>
          </div>

          {/* Filters */}
      <div className="textile-card p-6 bg-white border-app-border shadow-xl grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Start Date</label>
          <input 
            type="date" 
            value={filters.start_date}
            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
            className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-lg focus:outline-none focus:border-primary-navy"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">End Date</label>
          <input 
            type="date" 
            value={filters.end_date}
            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
            className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-lg focus:outline-none focus:border-primary-navy"
          />
        </div>
        <div className="space-y-1">
          <EmployeeSearchSelect 
            label="Employee"
            employees={employees}
            selectedIds={filters.emp_ids}
            onChange={(ids) => setFilters({ ...filters, emp_ids: ids })}
            placeholder="All Employees"
            isMulti
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Period</label>
          <select 
            value={filters.window_id}
            onChange={(e) => setFilters({ ...filters, window_id: e.target.value })}
            className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-lg focus:outline-none focus:border-primary-navy"
          >
            <option value="">All Periods</option>
            {windows.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="textile-card bg-white border-app-border shadow-xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-app-border">
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Punch Time</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Period</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Source</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-primary-navy" size={32} />
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted font-mono text-sm">
                    No transactions found for the selected filters.
                  </td>
                </tr>
              ) : (
                transactions.map((trans) => (
                  <tr key={trans.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-primary-navy text-sm">{trans.emp_name}</span>
                        <span className="text-[10px] font-mono text-text-muted">{trans.emp_code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm font-mono text-primary-navy">
                        <Calendar size={14} className="text-text-muted" />
                        {new Date(trans.punch_time).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-primary-navy/5 text-primary-navy rounded text-[10px] font-bold uppercase">
                        {trans.window_name || 'Outside Window'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold uppercase ${trans.source === 'Manual' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {trans.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {trans.is_valid === 1 ? (
                        <div className="flex items-center gap-1 text-primary-green text-[10px] font-bold uppercase">
                          <CheckCircle2 size={14} /> Valid
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-primary-red text-[10px] font-bold uppercase">
                          <AlertCircle size={14} /> Invalid
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Manual Entry Modal */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManualModalOpen(false)}
              className="absolute inset-0 bg-primary-navy/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-primary-navy text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Coffee size={24} />
                  <h2 className="text-xl font-bold">Manual Canteen Entry</h2>
                </div>
                <button onClick={() => setIsManualModalOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-all">
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex p-1 bg-slate-100 rounded-2xl">
                  <button 
                    onClick={() => setManualType('single')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${manualType === 'single' ? 'bg-white text-primary-navy shadow-sm' : 'text-text-muted hover:text-primary-navy'}`}
                  >
                    Single Employee
                  </button>
                  <button 
                    onClick={() => setManualType('bulk')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${manualType === 'bulk' ? 'bg-white text-primary-navy shadow-sm' : 'text-text-muted hover:text-primary-navy'}`}
                  >
                    Bulk Date-wise
                  </button>
                </div>

                {manualType === 'single' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1 md:col-span-2">
                      <EmployeeSearchSelect 
                        label="Select Employee"
                        employees={employees}
                        selectedIds={manualPunch.emp_id ? [parseInt(manualPunch.emp_id)] : []}
                        onChange={(ids) => setManualPunch({ ...manualPunch, emp_id: ids[0]?.toString() || '' })}
                        placeholder="Choose Employee..."
                        nextFieldRef={canteenDateRef}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Punch Date</label>
                      <input 
                        ref={canteenDateRef}
                        type="date" 
                        value={manualPunch.date}
                        onChange={(e) => setManualPunch({ ...manualPunch, date: e.target.value })}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Punch Time</label>
                      <input 
                        type="time" 
                        value={manualPunch.time}
                        onChange={(e) => setManualPunch({ ...manualPunch, time: e.target.value })}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Start Date</label>
                        <input 
                          type="date" 
                          value={bulkPunch.start_date}
                          onChange={(e) => setBulkPunch({ ...bulkPunch, start_date: e.target.value })}
                          className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">End Date</label>
                        <input 
                          type="date" 
                          value={bulkPunch.end_date}
                          onChange={(e) => setBulkPunch({ ...bulkPunch, end_date: e.target.value })}
                          className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Punch Time</label>
                      <input 
                        type="time" 
                        value={bulkPunch.time}
                        onChange={(e) => setBulkPunch({ ...bulkPunch, time: e.target.value })}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <EmployeeSearchSelect 
                        label="Select Employees"
                        employees={employees}
                        selectedIds={bulkPunch.emp_ids}
                        onChange={(ids) => setBulkPunch({ ...bulkPunch, emp_ids: ids })}
                        placeholder="Choose Employees..."
                        isMulti
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setIsManualModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-text-muted rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleManualPunchSubmit}
                    disabled={isSaving}
                    className="flex-1 py-4 bg-primary-navy text-white rounded-2xl font-bold hover:bg-primary-navy/90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary-navy/20"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                    Save Entries
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </Tabs.Content>
        <Tabs.Content value="history" className="outline-none">
          <HistoryTable moduleType="CANTEEN" />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
};

export default CanteenEntry;
