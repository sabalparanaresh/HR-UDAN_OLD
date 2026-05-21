import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import { 
  Plus, 
  Trash2, 
  Save, 
  Calculator, 
  User, 
  Users,
  Calendar, 
  Clock, 
  Building2,
  CheckCircle2,
  Loader2,
  IndianRupee,
  FileText,
  MapPin,
  Layers,
  LayoutGrid,
  Search,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parse } from 'date-fns';
import { useModule } from '../../contexts/ModuleContext';
import { withModuleGuard } from '../../components/layout/ModuleGuard';
import { User as UserType, Employee } from '../../types';
import { EmployeeSearchSelect } from '../../components/form/EmployeeSearchSelect';

interface RokdaEntry {
  id: string;
  token_code: string;
  worker_name: string;
  designation: string;
  in_time: string;
  out_time: string;
  amount: number;
}

interface RokdaManagementProps {
  currentUser: UserType | null;
  onRedirect: () => void;
}

import { HistoryTable } from '../../components/table/HistoryTable';
import * as Tabs from '@radix-ui/react-tabs';

function RokdaManagement({ currentUser }: RokdaManagementProps) {
  const { currentMode } = useModule();
  const [masterData, setMasterData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Header State
  const [voucherDate, setVoucherDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedShift, setSelectedShift] = useState('1');
  const [reportingEmpId, setReportingEmpId] = useState('');
  const [authorizerId, setAuthorizerId] = useState('');

  // Auto-fill fields
  const [autoFields, setAutoFields] = useState({
    location: '',
    division: '',
    group: '',
    department: '',
    departmentId: ''
  });

  // Entries State
  const [entries, setEntries] = useState<RokdaEntry[]>([]);
  const lastTokenRef = useRef<number>(0);

  useEffect(() => {
    fetchMasterData();
  }, [currentMode]);

  const fetchMasterData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<any>('/api/master-data/get-master-data', { method: 'POST', body: JSON.stringify({ moduleType: currentMode }) });
      setMasterData(data);
      
      // Initialize first row with token code
      const prefix = format(new Date(), 'MMyy');
      const tokenData = await fetchApi('/api/transactions/rokda/next-token', { method: 'POST', body: JSON.stringify({ prefix, moduleType: currentMode }) });
      const initialToken = tokenData.nextToken;
      lastTokenRef.current = parseInt(initialToken.substring(4));
      
      setEntries([
        { id: crypto.randomUUID(), token_code: initialToken, worker_name: '', designation: '', in_time: '09:00', out_time: '18:00', amount: 0 }
      ]);
    } catch (err) {
      toast.error("Failed to load master data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReportingEmpChange = (empId: string) => {
    setReportingEmpId(empId);
    if (!empId) {
      setAutoFields({ location: '', division: '', group: '', department: '', departmentId: '' });
      return;
    }

    const emp = masterData.employees?.find((e: any) => e.id.toString() === empId);
    if (emp) {
      const loc = masterData.locations?.find((l: any) => l.id === emp.location_id)?.name || 'N/A';
      const div = masterData.divisions?.find((d: any) => d.id === emp.division_id)?.name || 'N/A';
      const grp = masterData.groups?.find((g: any) => g.id === emp.group_id)?.name || 'N/A';
      const dept = masterData.departments?.find((d: any) => d.id === emp.department_id)?.name || 'N/A';
      
      setAutoFields({
        location: loc,
        division: div,
        group: grp,
        department: dept,
        departmentId: emp.department_id?.toString() || ''
      });
    }
  };

  const generateNextToken = () => {
    const prefix = format(new Date(voucherDate), 'MMyy');
    const nextNum = lastTokenRef.current + 1;
    lastTokenRef.current = nextNum;
    return `${prefix}${nextNum.toString().padStart(3, '0')}`;
  };

  const addRow = () => {
    const nextToken = generateNextToken();
    setEntries([...entries, { id: crypto.randomUUID(), token_code: nextToken, worker_name: '', designation: '', in_time: '09:00', out_time: '18:00', amount: 0 }]);
  };

  const removeRow = (id: string) => {
    if (entries.length === 1) return;
    setEntries(entries.filter(e => e.id !== id));
  };

  const updateEntry = (id: string, field: keyof RokdaEntry, value: any) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const totals = useMemo(() => {
    return entries.reduce((acc, curr) => ({
      count: acc.count + (curr.worker_name ? 1 : 0),
      amount: acc.amount + (Number(curr.amount) || 0)
    }), { count: 0, amount: 0 });
  }, [entries]);

  const handleGenerateVoucher = async () => {
    if (!reportingEmpId || !authorizerId) {
      toast.error("Please select Reporting Employee and Authorizer");
      return;
    }

    const activeEntries = entries.filter(e => e.worker_name.trim() !== '');
    if (activeEntries.length === 0) {
      toast.error("Please add at least one worker entry");
      return;
    }

    if (activeEntries.some(e => e.amount <= 0)) {
      toast.error("All worker entries must have an amount greater than 0");
      return;
    }

    setIsSaving(true);
    try {
      await fetchApi('/api/transactions/rokda/voucher', { method: 'POST', body: JSON.stringify({
        voucher: {
          voucher_date: voucherDate,
          department_id: parseInt(autoFields.departmentId),
          shift: parseInt(selectedShift),
          reporting_employee_id: parseInt(reportingEmpId),
          authorizer_id: parseInt(authorizerId),
          total_count: totals.count,
          total_amount: totals.amount
        },
        entries: activeEntries.map(({ id, ...rest }) => rest),
        moduleType: currentMode
      })});
      toast.success("Cash Voucher Generated Successfully");
      
      // Refresh token for next batch
      const prefix = format(new Date(), 'MMyy');
      const tokenData = await fetchApi('/api/transactions/rokda/next-token', { method: 'POST', body: JSON.stringify({ prefix, moduleType: currentMode }) });
      lastTokenRef.current = parseInt(tokenData.nextToken.substring(4));
      
      setEntries([
        { id: crypto.randomUUID(), token_code: tokenData.nextToken, worker_name: '', designation: '', in_time: '09:00', out_time: '18:00', amount: 0 }
      ]);
      setReportingEmpId('');
      setAuthorizerId('');
      setAutoFields({ location: '', division: '', group: '', department: '', departmentId: '' });
    } catch (err) {
      toast.error("Failed to generate voucher");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Cash Worker</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Transactions // Cash Voucher Entry</p>
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

        <Tabs.Content value="entry" className="space-y-6 outline-none">
          <div className="flex justify-end">
            <button
              onClick={handleGenerateVoucher}
              disabled={isSaving || isLoading}
              className="app-btn app-btn-primary flex items-center gap-2 px-8 h-12 shadow-xl shadow-primary-navy/20"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
              Generate Voucher
            </button>
          </div>

      {/* Voucher Header Card */}
      <div className="textile-card bg-white border-app-border overflow-hidden shadow-sm">
        <div className="bg-primary-navy px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck size={18} className="text-amber-400" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em]">Voucher Header Information</h3>
          </div>
          <div className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
            Official Document // HR-UDAN
          </div>
        </div>
        
        <div className="p-8 space-y-8">
          {/* Row 1: Primary Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <Calendar size={12} /> Voucher Date
              </label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="app-input h-11 text-sm font-bold"
              />
            </div>

            <div className="space-y-2">
              <EmployeeSearchSelect 
                label="Reporting Employee"
                employees={masterData.employees || []}
                selectedIds={reportingEmpId ? [parseInt(reportingEmpId)] : []}
                onChange={(ids) => handleReportingEmpChange(ids[0]?.toString() || '')}
                isMulti={false}
                placeholder="Select Reporting Employee"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <Clock size={12} /> Shift Selection
              </label>
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                {['1', '2', '3'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedShift(s)}
                    className={`flex-1 py-2 text-xs font-black rounded-md transition-all ${
                      selectedShift === s 
                        ? 'bg-primary-navy text-white shadow-md' 
                        : 'text-text-muted hover:bg-gray-200'
                    }`}
                  >
                    SHIFT {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Auto-filled Read-only fields */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-app-border/50">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <MapPin size={12} /> Location
              </label>
              <div className="h-10 px-4 bg-gray-50 border border-app-border rounded-md flex items-center text-xs font-bold text-primary-navy/60">
                {autoFields.location || '---'}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <Layers size={12} /> Division
              </label>
              <div className="h-10 px-4 bg-gray-50 border border-app-border rounded-md flex items-center text-xs font-bold text-primary-navy/60">
                {autoFields.division || '---'}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <LayoutGrid size={12} /> Group
              </label>
              <div className="h-10 px-4 bg-gray-50 border border-app-border rounded-md flex items-center text-xs font-bold text-primary-navy/60">
                {autoFields.group || '---'}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <Building2 size={12} /> Department
              </label>
              <div className="h-10 px-4 bg-gray-50 border border-app-border rounded-md flex items-center text-xs font-bold text-primary-navy/60">
                {autoFields.department || '---'}
              </div>
            </div>
          </div>

          {/* Row 3: Authorizer */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-app-border/50">
            <div className="md:col-start-2 space-y-2">
              <EmployeeSearchSelect 
                label="Authorizer"
                employees={masterData.employees || []}
                selectedIds={authorizerId ? [parseInt(authorizerId)] : []}
                onChange={(ids) => setAuthorizerId(ids[0]?.toString() || '')}
                isMulti={false}
                placeholder="Select Authorizer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Worker Grid Card */}
      <div className="textile-card bg-white border-app-border overflow-hidden shadow-sm">
        <div className="px-6 py-3 bg-gray-50 border-b border-app-border flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary-navy" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary-navy">Rokda Workers Entry Grid</h3>
          </div>
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-[10px] font-black bg-primary-navy text-white px-4 py-1.5 rounded hover:bg-primary-navy/90 transition-all shadow-md"
          >
            <Plus size={14} /> ADD WORKER
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-app-border bg-gray-50/50">
                <th className="px-4 py-3 text-[10px] font-mono text-text-muted uppercase tracking-widest w-16 text-center">#</th>
                <th className="px-4 py-3 text-[10px] font-mono text-text-muted uppercase tracking-widest w-32">Token Code</th>
                <th className="px-4 py-3 text-[10px] font-mono text-text-muted uppercase tracking-widest">Worker Name</th>
                <th className="px-4 py-3 text-[10px] font-mono text-text-muted uppercase tracking-widest">Designation</th>
                <th className="px-4 py-3 text-[10px] font-mono text-text-muted uppercase tracking-widest w-32">In Time</th>
                <th className="px-4 py-3 text-[10px] font-mono text-text-muted uppercase tracking-widest w-32">Out Time</th>
                <th className="px-4 py-3 text-[10px] font-mono text-text-muted uppercase tracking-widest w-40 text-right">Amount (₹)</th>
                <th className="px-4 py-3 text-[10px] font-mono text-text-muted uppercase tracking-widest w-16 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {entries.map((entry, index) => (
                <tr key={entry.id} className="hover:bg-primary-navy/[0.02] transition-colors group">
                  <td className="px-4 py-2 text-center text-xs font-mono text-text-muted">{index + 1}</td>
                  <td className="px-4 py-2">
                    <div className="h-9 px-3 bg-gray-50 border border-app-border rounded flex items-center text-xs font-mono font-bold text-primary-navy">
                      {entry.token_code}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={entry.worker_name}
                      onChange={(e) => updateEntry(entry.id, 'worker_name', e.target.value)}
                      className="app-input h-9 text-xs focus:ring-1 focus:ring-primary-navy"
                      placeholder="Enter Name"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={entry.designation}
                      onChange={(e) => updateEntry(entry.id, 'designation', e.target.value)}
                      className="app-input h-9 text-xs focus:ring-1 focus:ring-primary-navy"
                      placeholder="Enter Designation"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="time"
                      value={entry.in_time}
                      onChange={(e) => updateEntry(entry.id, 'in_time', e.target.value)}
                      className="app-input h-9 text-xs font-mono"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="time"
                      value={entry.out_time}
                      onChange={(e) => updateEntry(entry.id, 'out_time', e.target.value)}
                      className="app-input h-9 text-xs font-mono"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="relative">
                      <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" size={12} />
                      <input
                        type="number"
                        value={entry.amount}
                        onChange={(e) => updateEntry(entry.id, 'amount', e.target.value)}
                        className="app-input h-9 text-xs text-right pl-6 font-mono font-bold text-primary-navy"
                        placeholder="0.00"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => removeRow(entry.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
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

      {/* Live Footer */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-40">
        <div className="textile-card bg-primary-navy text-white p-5 shadow-2xl flex justify-between items-center border-none ring-4 ring-white/10">
          <div className="flex gap-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                <Users size={24} />
              </div>
              <div>
                <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.2em]">Total Headcount</p>
                <p className="text-2xl font-black tracking-tighter">{totals.count}</p>
              </div>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                <IndianRupee size={24} />
              </div>
              <div>
                <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.2em]">Total Cash Amount</p>
                <p className="text-2xl font-black tracking-tighter">₹ {totals.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-full border border-white/10">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono font-black uppercase tracking-widest">System Online // Live Calc</span>
          </div>
        </div>
      </div>
      </Tabs.Content>
      <Tabs.Content value="history" className="outline-none">
        <HistoryTable moduleType="ROKDA" />
      </Tabs.Content>
    </Tabs.Root>
    </div>
  );
}

export default withModuleGuard(RokdaManagement, 'K');
