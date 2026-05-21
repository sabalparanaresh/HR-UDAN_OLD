import React, { useState, useEffect } from 'react';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import * as Tabs from '@radix-ui/react-tabs';
import { 
  Save, Plus, Trash2, AlertCircle, 
  ShieldCheck, Activity, Landmark, 
  Users, Scale, Gift, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useModule } from '../../contexts/ModuleContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SalaryHead {
  id: number;
  name: string;
  type: 'EARNING' | 'DEDUCTION';
}

interface StatutoryConfig {
  id?: number;
  type: string;
  config: any;
  effective_date: string;
}

export default function StatutorySettings() {
  const { currentMode } = useModule();
  const [heads, setHeads] = useState<SalaryHead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PF');
  const [history, setHistory] = useState<StatutoryConfig[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [pfConfig, setPfConfig] = useState({
    ceiling_amount: 15000,
    employee_pct: 12,
    employer_epf_pct: 3.67,
    employer_eps_pct: 8.33,
    edli_pct: 0.5,
    admin_charges_pct: 0.5,
    gross_heads: [] as number[]
  });
  const [pfEffectiveDate, setPfEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  const [esiConfig, setEsiConfig] = useState({
    employee_pct: 0.75,
    employer_pct: 3.25,
    eligibility_limit: 21000,
    gross_heads: [] as number[]
  });
  const [esiEffectiveDate, setEsiEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  const [ptaxConfig, setPtaxConfig] = useState({
    slabs: [] as { from: number; to: number | null; amount: number }[]
  });
  const [ptaxEffectiveDate, setPtaxEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  const [minWageConfig, setMinWageConfig] = useState({
    wages: [] as { zone: string; skill_level: string; rate: number; type: 'Daily' | 'Monthly' }[],
    end_date: ''
  });
  const [minWageEffectiveDate, setMinWageEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  const [lwfConfig, setLwfConfig] = useState({
    employee_amount: 0,
    employer_amount: 0,
    months: [] as string[]
  });
  const [lwfEffectiveDate, setLwfEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  const [bonusConfig, setBonusConfig] = useState({
    bonus_pct: 8.33,
    gross_heads: [] as number[],
    use_min_wage: false,
    salary_cap: 21000,
    min_attendance: 30
  });
  const [bonusEffectiveDate, setBonusEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  useEffect(() => {
    fetchData();
  }, [currentMode]);

  useEffect(() => {
    fetchHistory();
  }, [activeTab, currentMode]);

  const fetchHistory = async () => {
    try {
      const type = activeTab === 'PTAX' ? 'PTAX' : activeTab;
      const data = await fetchApi('/api/system/cmd/listStatutorySettings', { method: 'POST', body: JSON.stringify({
        type,
        moduleType: currentMode
      }) });
      setHistory(data || []);
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headsData = await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'salary_heads',
        operation: 'list',
        moduleType: currentMode
      }) });
      setHeads(Array.isArray(headsData) ? headsData : []);

      const types = ['PF', 'ESI', 'PTAX', 'MIN_WAGE', 'LWF', 'BONUS'];
      for (const type of types) {
        const data = await fetchApi('/api/system/cmd/getStatutorySettings', { method: 'POST', body: JSON.stringify({
          type,
          moduleType: currentMode
        }) });
        if (data && data.config) {
          try {
            const config = typeof data.config === 'string' ? JSON.parse(data.config) : data.config;
            if (type === 'PF') { setPfConfig(prev => ({ ...prev, ...config })); setPfEffectiveDate(data.effective_date); }
            if (type === 'ESI') { setEsiConfig(prev => ({ ...prev, ...config })); setEsiEffectiveDate(data.effective_date); }
            if (type === 'PTAX') { setPtaxConfig(prev => ({ ...prev, ...config })); setPtaxEffectiveDate(data.effective_date); }
            if (type === 'MIN_WAGE') { setMinWageConfig(prev => ({ ...prev, ...config })); setMinWageEffectiveDate(data.effective_date); }
            if (type === 'LWF') { setLwfConfig(prev => ({ ...prev, ...config })); setLwfEffectiveDate(data.effective_date); }
            if (type === 'BONUS') { setBonusConfig(prev => ({ ...prev, ...config })); setBonusEffectiveDate(data.effective_date); }
          } catch (e) {
            console.error(`Failed to parse config for ${type}`, e);
          }
        }
      }
    } catch (error) {
      toast.error('Failed to fetch statutory settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (type: string, config: any, effective_date: string) => {
    try {
      await fetchApi('/api/system/cmd/saveStatutorySettings', { method: 'POST', body: JSON.stringify({
        type,
        config: { config, effective_date },
        moduleType: currentMode,
        id: editingId
      }) });
      toast.success(`${type} settings saved successfully`);
      setEditingId(null);
      fetchHistory();
    } catch (error) {
      toast.error(`Failed to save ${type} settings`);
    }
  };

  const handleDeleteHistory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this historical record?')) return;
    try {
      await fetchApi('/api/system/cmd/deleteStatutorySetting', { method: 'POST', body: JSON.stringify({ id, moduleType: currentMode }) });
      toast.success('Record deleted');
      fetchHistory();
    } catch (e) {
      toast.error('Failed to delete record');
    }
  };

  const handleEditHistory = (record: StatutoryConfig) => {
    setEditingId(record.id || null);
    const config = typeof record.config === 'string' ? JSON.parse(record.config) : record.config;
    if (record.type === 'PF') { setPfConfig(config); setPfEffectiveDate(record.effective_date); }
    if (record.type === 'ESI') { setEsiConfig(config); setEsiEffectiveDate(record.effective_date); }
    if (record.type === 'PTAX') { setPtaxConfig(config); setPtaxEffectiveDate(record.effective_date); }
    if (record.type === 'MIN_WAGE') { setMinWageConfig(config); setMinWageEffectiveDate(record.effective_date); }
    if (record.type === 'LWF') { setLwfConfig(config); setLwfEffectiveDate(record.effective_date); }
    if (record.type === 'BONUS') { setBonusConfig(config); setBonusEffectiveDate(record.effective_date); }
    toast.info('Record loaded into form for editing');
  };

  const HistoryGrid = ({ type }: { type: string }) => {
    return (
      <div className="mt-12 space-y-4">
        <div className="flex items-center justify-between border-b border-app-border pb-2">
          <h4 className="text-sm font-bold text-primary-navy uppercase tracking-wider">Historical Records</h4>
        </div>
        <div className="border border-app-border rounded-xl overflow-hidden bg-slate-50/50">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-app-border text-text-muted font-mono uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3">Effective Date</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-text-muted italic">No historical records found</td>
                </tr>
              ) : (
                history.map((record) => {
                  const config = typeof record.config === 'string' ? JSON.parse(record.config) : record.config;
                  let summary = '';
                  if (type === 'PF') summary = `Ceiling: ${config.ceiling_amount}, Emp%: ${config.employee_pct}`;
                  if (type === 'ESI') summary = `Emp%: ${config.employee_pct}, Limit: ${config.eligibility_limit}`;
                  if (type === 'PTAX') summary = `${(config.slabs || []).length} Slabs defined`;
                  if (type === 'MIN_WAGE') summary = `${(config.wages || []).length} Rates defined`;
                  if (type === 'LWF') summary = `Emp: ₹${config.employee_amount}, Months: ${(config.months || []).length}`;
                  if (type === 'BONUS') summary = `${config.bonus_pct}% Bonus, Cap: ₹${config.salary_cap}`;

                  return (
                    <tr key={record.id} className="hover:bg-white transition-colors group">
                      <td className="px-4 py-3 font-medium text-primary-navy">{record.effective_date}</td>
                      <td className="px-4 py-3 text-text-muted truncate max-w-md">{summary}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEditHistory(record)}
                            className="p-1.5 text-primary-navy hover:bg-slate-200 rounded"
                            title="Edit this record"
                          >
                            <Plus size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteHistory(record.id!)}
                            className="p-1.5 text-primary-red hover:bg-red-50 rounded"
                            title="Delete this record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-navy" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Statutory Settings</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Module P // Compliance Configuration</p>
        </div>
      </div>

      <div className="textile-card bg-white border-app-border overflow-hidden min-h-[600px]">
        <Tabs.Root 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="flex h-full"
          orientation="vertical"
        >
          <Tabs.List className="w-64 bg-slate-50 border-r border-app-border p-2 space-y-1">
            {[
              { id: 'PF', label: 'Provident Fund', icon: ShieldCheck },
              { id: 'ESI', label: 'Employee State Insurance', icon: Activity },
              { id: 'PTAX', label: 'Professional Tax', icon: Landmark },
              { id: 'MIN_WAGE', label: 'Minimum Wages', icon: Scale },
              { id: 'LWF', label: 'Labour Welfare Fund', icon: Users },
              { id: 'BONUS', label: 'Bonus Settings', icon: Gift },
            ].map((tab) => (
              <Tabs.Trigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all",
                  "hover:bg-white hover:shadow-sm",
                  "data-[state=active]:bg-white data-[state=active]:text-primary-navy data-[state=active]:shadow-md data-[state=active]:border-l-4 data-[state=active]:border-primary-navy"
                )}
              >
                <tab.icon size={18} className={activeTab === tab.id ? "text-primary-navy" : "text-text-muted"} />
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <div className="flex-1 p-8 overflow-y-auto">
            <Tabs.Content value="PF" className="space-y-8 outline-none">
              <div className="flex justify-between items-center border-b border-app-border pb-4">
                <h3 className="text-xl font-bold text-primary-navy">PF Configuration</h3>
                <div className="flex items-center gap-4">
                  <input 
                    type="date" 
                    value={pfEffectiveDate || ''}
                    onChange={(e) => setPfEffectiveDate(e.target.value)}
                    className="bg-slate-50 border border-app-border p-2 text-sm rounded-md"
                  />
                  <button 
                    onClick={() => handleSave('PF', pfConfig, pfEffectiveDate)}
                    className="app-btn app-btn-primary flex items-center gap-2"
                  >
                    <Save size={16} /> Save PF Settings
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-app-border">
                    <div className="space-y-1">
                      <p className="font-bold text-primary-navy">PF Ceiling Amount</p>
                      <p className="text-xs text-text-muted">Cap calculations at this amount (Default: ₹15,000)</p>
                    </div>
                    <div className="w-32">
                      <input 
                        type="number" 
                        value={pfConfig.ceiling_amount ?? ''}
                        onChange={(e) => setPfConfig({...pfConfig, ceiling_amount: parseFloat(e.target.value) || 0})}
                        className="w-full bg-white border border-app-border p-2 text-sm rounded-md font-bold text-primary-navy"
                        placeholder="15000"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-text-muted uppercase">Employee Contribution %</label>
                      <input 
                        type="number" 
                        value={pfConfig.employee_pct ?? ''}
                        onChange={(e) => setPfConfig({...pfConfig, employee_pct: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-text-muted uppercase">Employer EPF %</label>
                      <input 
                        type="number" 
                        value={pfConfig.employer_epf_pct ?? ''}
                        onChange={(e) => setPfConfig({...pfConfig, employer_epf_pct: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-text-muted uppercase">Employer EPS %</label>
                      <input 
                        type="number" 
                        value={pfConfig.employer_eps_pct ?? ''}
                        onChange={(e) => setPfConfig({...pfConfig, employer_eps_pct: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-text-muted uppercase">EDLI %</label>
                      <input 
                        type="number" 
                        value={pfConfig.edli_pct ?? ''}
                        onChange={(e) => setPfConfig({...pfConfig, edli_pct: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-text-muted uppercase">Admin Charges %</label>
                      <input 
                        type="number" 
                        value={pfConfig.admin_charges_pct ?? ''}
                        onChange={(e) => setPfConfig({...pfConfig, admin_charges_pct: parseFloat(e.target.value) || 0})}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono text-text-muted uppercase">PF Gross Heads (Earnings)</label>
                    <div className="max-h-96 overflow-y-auto border border-app-border rounded-md p-3 space-y-2 bg-slate-50">
                      {heads.filter(h => h.type === 'EARNING').map(head => (
                        <label key={head.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-1 rounded transition-colors">
                          <input 
                            type="checkbox"
                            checked={pfConfig.gross_heads.includes(head.id)}
                            onChange={(e) => {
                              const newHeads = e.target.checked 
                                ? [...pfConfig.gross_heads, head.id]
                                : pfConfig.gross_heads.filter(id => id !== head.id);
                              setPfConfig({...pfConfig, gross_heads: newHeads});
                            }}
                            className="w-4 h-4 rounded border-app-border text-primary-navy"
                          />
                          <span className="text-sm">{head.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <HistoryGrid type="PF" />
            </Tabs.Content>

            <Tabs.Content value="ESI" className="space-y-8 outline-none">
              <div className="flex justify-between items-center border-b border-app-border pb-4">
                <h3 className="text-xl font-bold text-primary-navy">ESI Configuration</h3>
                <div className="flex items-center gap-4">
                  <input 
                    type="date" 
                    value={esiEffectiveDate || ''}
                    onChange={(e) => setEsiEffectiveDate(e.target.value)}
                    className="bg-slate-50 border border-app-border p-2 text-sm rounded-md"
                  />
                  <button 
                    onClick={() => handleSave('ESI', esiConfig, esiEffectiveDate)}
                    className="app-btn app-btn-primary flex items-center gap-2"
                  >
                    <Save size={16} /> Save ESI Settings
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Employee Contribution %</label>
                    <input 
                      type="number" 
                      value={esiConfig.employee_pct ?? ''}
                      onChange={(e) => setEsiConfig({...esiConfig, employee_pct: parseFloat(e.target.value) || 0})}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Employer Contribution %</label>
                    <input 
                      type="number" 
                      value={esiConfig.employer_pct ?? ''}
                      onChange={(e) => setEsiConfig({...esiConfig, employer_pct: parseFloat(e.target.value) || 0})}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-text-muted uppercase">ESI Eligibility Limit</label>
                    <input 
                      type="number" 
                      value={esiConfig.eligibility_limit ?? ''}
                      onChange={(e) => setEsiConfig({...esiConfig, eligibility_limit: parseFloat(e.target.value) || 0})}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                    />
                  </div>

                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-mono text-text-muted uppercase">ESI Gross Heads (Earnings)</label>
                  <div className="max-h-96 overflow-y-auto border border-app-border rounded-md p-3 space-y-2 bg-slate-50">
                    {heads.filter(h => h.type === 'EARNING').map(head => (
                      <label key={head.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-1 rounded transition-colors">
                        <input 
                          type="checkbox"
                          checked={esiConfig.gross_heads.includes(head.id)}
                          onChange={(e) => {
                            const newHeads = e.target.checked 
                              ? [...esiConfig.gross_heads, head.id]
                              : esiConfig.gross_heads.filter(id => id !== head.id);
                            setEsiConfig({...esiConfig, gross_heads: newHeads});
                          }}
                          className="w-4 h-4 rounded border-app-border text-primary-navy"
                        />
                        <span className="text-sm">{head.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <HistoryGrid type="ESI" />
            </Tabs.Content>

            <Tabs.Content value="PTAX" className="space-y-8 outline-none">
              <div className="flex justify-between items-center border-b border-app-border pb-4">
                <h3 className="text-xl font-bold text-primary-navy">Professional Tax Configuration</h3>
                <div className="flex items-center gap-4">
                  <input 
                    type="date" 
                    value={ptaxEffectiveDate || ''}
                    onChange={(e) => setPtaxEffectiveDate(e.target.value)}
                    className="bg-slate-50 border border-app-border p-2 text-sm rounded-md"
                  />
                  <button 
                    onClick={() => handleSave('PTAX', ptaxConfig, ptaxEffectiveDate)}
                    className="app-btn app-btn-primary flex items-center gap-2"
                  >
                    <Save size={16} /> Save PTAX Settings
                  </button>
                </div>
              </div>

              <div className="space-y-6">


                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-primary-navy uppercase tracking-wider">Tax Slabs</p>
                    <button 
                      onClick={() => setPtaxConfig({...ptaxConfig, slabs: [...ptaxConfig.slabs, { from: 0, to: 0, amount: 0 }]})}
                      className="text-xs flex items-center gap-1 text-primary-navy hover:underline"
                    >
                      <Plus size={14} /> Add Slab
                    </button>
                  </div>
                  <div className="border border-app-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-app-border">
                        <tr>
                          <th className="px-4 py-3 text-left font-mono text-[10px] uppercase text-text-muted">From Amount</th>
                          <th className="px-4 py-3 text-left font-mono text-[10px] uppercase text-text-muted">To Amount</th>
                          <th className="px-4 py-3 text-left font-mono text-[10px] uppercase text-text-muted">Tax Amount</th>
                          <th className="px-4 py-3 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ptaxConfig.slabs.map((slab, idx) => (
                          <tr key={idx} className="border-b border-app-border last:border-0">
                            <td className="px-4 py-2">
                              <input 
                                type="number" 
                                value={Number.isNaN(slab.from) ? '' : (slab.from ?? '')}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  const newSlabs = [...ptaxConfig.slabs];
                                  newSlabs[idx].from = Number.isNaN(val) ? 0 : val;
                                  setPtaxConfig({...ptaxConfig, slabs: newSlabs});
                                }}
                                className="w-full bg-transparent p-1 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="number" 
                                value={Number.isNaN(slab.to) ? '' : (slab.to || '')}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  const newSlabs = [...ptaxConfig.slabs];
                                  newSlabs[idx].to = Number.isNaN(val) ? null : val;
                                  setPtaxConfig({...ptaxConfig, slabs: newSlabs});
                                }}
                                className="w-full bg-transparent p-1 focus:outline-none"
                                placeholder="Infinity"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="number" 
                                value={Number.isNaN(slab.amount) ? '' : (slab.amount ?? '')}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  const newSlabs = [...ptaxConfig.slabs];
                                  newSlabs[idx].amount = Number.isNaN(val) ? 0 : val;
                                  setPtaxConfig({...ptaxConfig, slabs: newSlabs});
                                }}
                                className="w-full bg-transparent p-1 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button 
                                onClick={() => setPtaxConfig({...ptaxConfig, slabs: ptaxConfig.slabs.filter((_, i) => i !== idx)})}
                                className="text-primary-red p-1 hover:bg-primary-red/10 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <HistoryGrid type="PTAX" />
            </Tabs.Content>

            <Tabs.Content value="MIN_WAGE" className="space-y-8 outline-none">
              <div className="flex justify-between items-center border-b border-app-border pb-4">
                <h3 className="text-xl font-bold text-primary-navy">Minimum Wages Configuration</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-text-muted uppercase">From</label>
                    <input 
                      type="date" 
                      value={minWageEffectiveDate || ''}
                      onChange={(e) => setMinWageEffectiveDate(e.target.value)}
                      className="bg-slate-50 border border-app-border p-2 text-sm rounded-md focus:border-primary-navy outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-text-muted uppercase">To</label>
                    <input 
                      type="date" 
                      value={minWageConfig.end_date || ''}
                      onChange={(e) => setMinWageConfig({...minWageConfig, end_date: e.target.value})}
                      className="bg-slate-50 border border-app-border p-2 text-sm rounded-md focus:border-primary-navy outline-none"
                    />
                  </div>
                  <button 
                    onClick={() => handleSave('MIN_WAGE', minWageConfig, minWageEffectiveDate)}
                    className="app-btn app-btn-primary flex items-center gap-2"
                  >
                    <Save size={16} /> Save Min Wages
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-bold text-primary-navy uppercase tracking-wider">Wage Rates</p>
                  <button 
                    onClick={() => setMinWageConfig({...minWageConfig, wages: [...minWageConfig.wages, { zone: 'I', skill_level: 'Unskilled', rate: 0, type: 'Monthly' }]})}
                    className="text-xs flex items-center gap-1 text-primary-navy hover:underline"
                  >
                    <Plus size={14} /> Add Rate
                  </button>
                </div>
                <div className="border border-app-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-app-border">
                      <tr>
                        <th className="px-4 py-3 text-left font-mono text-[10px] uppercase text-text-muted">Zone</th>
                        <th className="px-4 py-3 text-left font-mono text-[10px] uppercase text-text-muted">Skill Level</th>
                        <th className="px-4 py-3 text-left font-mono text-[10px] uppercase text-text-muted">Rate Type</th>
                        <th className="px-4 py-3 text-left font-mono text-[10px] uppercase text-text-muted">Rate Amount</th>
                        <th className="px-4 py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {minWageConfig.wages.map((wage, idx) => (
                        <tr key={idx} className="border-b border-app-border last:border-0">
                          <td className="px-4 py-2">
                            <select 
                              value={wage.zone || ''}
                              onChange={(e) => {
                                const newWages = [...minWageConfig.wages];
                                newWages[idx].zone = e.target.value;
                                setMinWageConfig({...minWageConfig, wages: newWages});
                              }}
                              className="w-full bg-transparent p-1 focus:outline-none"
                            >
                              <option value="I">Zone I</option>
                              <option value="II">Zone II</option>
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <select 
                              value={wage.skill_level || ''}
                              onChange={(e) => {
                                const newWages = [...minWageConfig.wages];
                                newWages[idx].skill_level = e.target.value;
                                setMinWageConfig({...minWageConfig, wages: newWages});
                              }}
                              className="w-full bg-transparent p-1 focus:outline-none"
                            >
                              <option value="Unskilled">Unskilled</option>
                              <option value="Semi-Skilled">Semi-Skilled</option>
                              <option value="Skilled">Skilled</option>
                              <option value="Highly Skilled">Highly Skilled</option>
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <select 
                              value={wage.type || ''}
                              onChange={(e) => {
                                const newWages = [...minWageConfig.wages];
                                newWages[idx].type = e.target.value as 'Daily' | 'Monthly';
                                setMinWageConfig({...minWageConfig, wages: newWages});
                              }}
                              className="w-full bg-transparent p-1 focus:outline-none"
                            >
                              <option value="Daily">Daily</option>
                              <option value="Monthly">Monthly</option>
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input 
                              type="number" 
                              value={Number.isNaN(wage.rate) ? '' : (wage.rate ?? '')}
                              onChange={(e) => {
                                const newWages = [...minWageConfig.wages];
                                newWages[idx].rate = parseFloat(e.target.value) || 0;
                                setMinWageConfig({...minWageConfig, wages: newWages});
                              }}
                              className="w-full bg-transparent p-1 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button 
                              onClick={() => setMinWageConfig({...minWageConfig, wages: minWageConfig.wages.filter((_, i) => i !== idx)})}
                              className="text-primary-red p-1 hover:bg-primary-red/10 rounded"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <HistoryGrid type="MIN_WAGE" />
            </Tabs.Content>

            <Tabs.Content value="LWF" className="space-y-8 outline-none">
              <div className="flex justify-between items-center border-b border-app-border pb-4">
                <h3 className="text-xl font-bold text-primary-navy">Labour Welfare Fund Configuration</h3>
                <div className="flex items-center gap-4">
                  <input 
                    type="date" 
                    value={lwfEffectiveDate || ''}
                    onChange={(e) => setLwfEffectiveDate(e.target.value)}
                    className="bg-slate-50 border border-app-border p-2 text-sm rounded-md"
                  />
                  <button 
                    onClick={() => handleSave('LWF', lwfConfig, lwfEffectiveDate)}
                    className="app-btn app-btn-primary flex items-center gap-2"
                  >
                    <Save size={16} /> Save LWF Settings
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Employee Amount (₹)</label>
                    <input 
                      type="number" 
                      value={lwfConfig.employee_amount ?? ''}
                      onChange={(e) => setLwfConfig({...lwfConfig, employee_amount: parseFloat(e.target.value) || 0})}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Employer Amount (₹)</label>
                    <input 
                      type="number" 
                      value={lwfConfig.employer_amount ?? ''}
                      onChange={(e) => setLwfConfig({...lwfConfig, employer_amount: parseFloat(e.target.value) || 0})}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-mono text-text-muted uppercase">Applicable Months</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ].map(month => (
                      <label key={month} className="flex items-center gap-2 p-2 bg-slate-50 border border-app-border rounded-md cursor-pointer hover:bg-white transition-colors">
                        <input 
                          type="checkbox"
                          checked={lwfConfig.months.includes(month)}
                          onChange={(e) => {
                            const newMonths = e.target.checked 
                              ? [...lwfConfig.months, month]
                              : lwfConfig.months.filter(m => m !== month);
                            setLwfConfig({...lwfConfig, months: newMonths});
                          }}
                          className="w-4 h-4 rounded border-app-border text-primary-navy"
                        />
                        <span className="text-xs">{month}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <HistoryGrid type="LWF" />
            </Tabs.Content>

            <Tabs.Content value="BONUS" className="space-y-8 outline-none">
              <div className="flex justify-between items-center border-b border-app-border pb-4">
                <h3 className="text-xl font-bold text-primary-navy">Bonus Configuration</h3>
                <div className="flex items-center gap-4">
                  <input 
                    type="date" 
                    value={bonusEffectiveDate || ''}
                    onChange={(e) => setBonusEffectiveDate(e.target.value)}
                    className="bg-slate-50 border border-app-border p-2 text-sm rounded-md"
                  />
                  <button 
                    onClick={() => handleSave('BONUS', bonusConfig, bonusEffectiveDate)}
                    className="app-btn app-btn-primary flex items-center gap-2"
                  >
                    <Save size={16} /> Save Bonus Settings
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Bonus Percentage (%)</label>
                    <input 
                      type="number" 
                      value={bonusConfig.bonus_pct ?? ''}
                      onChange={(e) => setBonusConfig({...bonusConfig, bonus_pct: parseFloat(e.target.value) || 0})}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Salary Cap (₹)</label>
                    <input 
                      type="number" 
                      value={bonusConfig.salary_cap ?? ''}
                      onChange={(e) => setBonusConfig({...bonusConfig, salary_cap: parseFloat(e.target.value) || 0})}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-text-muted uppercase">Minimum Attendance (Days)</label>
                    <input 
                      type="number" 
                    value={bonusConfig.min_attendance ?? ''}
                    onChange={(e) => setBonusConfig({...bonusConfig, min_attendance: parseInt(e.target.value) || 0})}
                      className="w-full bg-slate-50 border border-app-border p-3 text-sm rounded-md"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-app-border">
                    <div className="space-y-1">
                      <p className="font-bold text-primary-navy">Use Minimum Wage Rate</p>
                      <p className="text-xs text-text-muted">If toggled, uses min wage instead of actual earnings</p>
                    </div>
                    <button 
                      onClick={() => setBonusConfig({...bonusConfig, use_min_wage: !bonusConfig.use_min_wage})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        bonusConfig.use_min_wage ? "bg-primary-navy" : "bg-slate-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        bonusConfig.use_min_wage ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-mono text-text-muted uppercase">Bonus Gross Heads (Earnings)</label>
                  <div className="max-h-96 overflow-y-auto border border-app-border rounded-md p-3 space-y-2 bg-slate-50">
                    {heads.filter(h => h.type === 'EARNING').map(head => (
                      <label key={head.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-1 rounded transition-colors">
                        <input 
                          type="checkbox"
                          checked={bonusConfig.gross_heads.includes(head.id)}
                          onChange={(e) => {
                            const newHeads = e.target.checked 
                              ? [...bonusConfig.gross_heads, head.id]
                              : bonusConfig.gross_heads.filter(id => id !== head.id);
                            setBonusConfig({...bonusConfig, gross_heads: newHeads});
                          }}
                          className="w-4 h-4 rounded border-app-border text-primary-navy"
                        />
                        <span className="text-sm">{head.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <HistoryGrid type="BONUS" />
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </div>
    </div>
  );
}
