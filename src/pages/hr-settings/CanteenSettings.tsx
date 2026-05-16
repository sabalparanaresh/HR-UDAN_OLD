import React, { useState, useEffect } from 'react';
import { 
  Coffee, 
  Clock, 
  Users, 
  Settings, 
  Save, 
  Plus, 
  Trash2, 
  ShieldAlert,
  XCircle,
  Search,
  Edit, 
  FileText, 
  Upload,
  UserPlus,
  Calendar,
  AlertCircle,
  Loader2,
  Database,
  Settings2,
  RefreshCw,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/tauri';
import { useModule } from '../../contexts/ModuleContext';
import { User as UserType } from '../../types';
import { cn } from '../../lib/utils';

import { MultiSelect } from '../../components/common/MultiSelect';
import { Pagination } from '../../components/common/Pagination';

interface TimeWindow {
  id?: number;
  name: string;
  start_time: string;
  end_time: string;
}

interface CanteenPermission {
  emp_id: number;
  emp_name: string;
  emp_code: string;
  class_name?: string;
  category_name?: string;
  group_name?: string;
  department_name?: string;
  designation_name?: string;
  benefit_type?: string;
  is_free_food: boolean;
  is_auto_deduction: boolean;
  rate_override: number | null;
}

interface CanteenRule {
  id?: number;
  rule_name: string;
  benefit_type: 'Free' | 'Full Deduction' | 'Discounted';
  discount_rate?: number;
  dish_rate?: number;
  effective_date?: string;
  categories: number[]; 
  classes: number[];
  groups: number[];
  departments: number[];
  designations: number[];
}

interface CanteenConfig {
  id?: number;
  device_ip: string;
  device_port: number;
  status: string;
  connection_type: 'MS Access' | 'SQL Server' | 'Excel/CSV';
  connection_string: string;
  db_name?: string;
  db_user?: string;
  db_password?: string;
  procedure_name?: string;
  device_entry_type: 'Single Row' | 'Multi-Row';
  table_name: string;
  col_emp_code: string;
  col_punch_time: string;
  col_punch_type: string;
  auto_fetch: boolean;
  fetch_interval: number;
}

const CanteenSettings: React.FC<{ currentUser: UserType | null }> = ({ currentUser }) => {
  const { currentMode } = useModule();
  
  const [config, setConfig] = useState<CanteenConfig>({
    device_ip: '',
    device_port: 8000,
    status: 'Disconnected',
    connection_type: 'MS Access',
    connection_string: '',
    db_name: '',
    db_user: '',
    db_password: '',
    procedure_name: '',
    device_entry_type: 'Multi-Row',
    table_name: '',
    col_emp_code: '',
    col_punch_time: '',
    col_punch_type: '',
    auto_fetch: false,
    fetch_interval: 30
  });
  
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [rules, setRules] = useState<CanteenRule[]>([]);
  const [permissions, setPermissions] = useState<CanteenPermission[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Master data for rules
  const [categories, setCategories] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rulesPage, setRulesPage] = useState(1);
  const [overridesPage, setOverridesPage] = useState(1);
  const pageSize = 10;
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CanteenRule | null>(null);
  
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<CanteenPermission | null>(null);
  
  const [ruleForm, setRuleForm] = useState<CanteenRule>({
    rule_name: '',
    benefit_type: 'Full Deduction',
    discount_rate: 0,
    dish_rate: 0,
    effective_date: new Date().toISOString().split('T')[0],
    categories: [],
    classes: [],
    groups: [],
    departments: [],
    designations: []
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data: any = await invoke('get_canteen_master_data', { moduleType: currentMode });
      if (data.config) setConfig(data.config);
      if (data.windows) setWindows(data.windows);
      if (data.rules) setRules(data.rules);
      if (data.permissions) {
        setPermissions(data.permissions);
      }
      if (data.employees) setEmployees(data.employees);
      
      // Master data
      if (data.categories) setCategories(data.categories);
      if (data.classes) setClasses(data.classes);
      if (data.groups) setGroups(data.groups);
      if (data.departments) setDepartments(data.departments);
      if (data.designations) setDesignations(data.designations);
    } catch (error) {
      toast.error('Failed to fetch canteen data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentMode]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await invoke('master_crud', {
        tableName: 'canteen_config',
        operation: config.id ? 'update' : 'create',
        id: config.id,
        data: config,
        moduleType: currentMode
      });
      toast.success('Configuration saved');
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddWindow = () => {
    setWindows([...windows, { name: '', start_time: '00:00', end_time: '00:00' }]);
  };

  const handleRemoveWindow = async (index: number, id?: number) => {
    if (id) {
      try {
        await invoke('master_crud', {
          tableName: 'canteen_time_windows',
          operation: 'delete',
          id,
          moduleType: currentMode
        });
      } catch (error) {
        toast.error('Failed to delete window');
        return;
      }
    }
    const newWindows = [...windows];
    newWindows.splice(index, 1);
    setWindows(newWindows);
  };

  const handleSaveWindows = async () => {
    setIsSaving(true);
    try {
      for (const window of windows) {
        await invoke('master_crud', {
          tableName: 'canteen_time_windows',
          operation: window.id ? 'update' : 'create',
          id: window.id,
          data: window,
          moduleType: currentMode
        });
      }
      toast.success('Time windows saved');
      fetchData();
    } catch (error) {
      toast.error('Failed to save time windows');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRule = async () => {
    setIsSaving(true);
    try {
      await invoke('master_crud', {
        tableName: 'canteen_rules',
        operation: ruleForm.id ? 'update' : 'create',
        id: ruleForm.id,
        data: ruleForm,
        moduleType: currentMode
      });
      toast.success('Rule saved successfully');
      setIsRuleModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save rule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await invoke('master_crud', {
        tableName: 'canteen_rules',
        operation: 'delete',
        id,
        moduleType: currentMode
      });
      toast.success('Rule deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const filteredPermissions = permissions.filter(p => 
    (p.emp_name || "").toLowerCase().includes((searchTerm || "").toLowerCase()) || 
    (p.emp_code || "").toLowerCase().includes((searchTerm || "").toLowerCase())
  );

  const rulesTotalPages = Math.ceil(rules.length / pageSize);
  const currentRules = rules.slice((rulesPage - 1) * pageSize, rulesPage * pageSize);

  const overridesTotalPages = Math.ceil(filteredPermissions.length / pageSize);
  const currentOverrides = filteredPermissions.slice((overridesPage - 1) * pageSize, overridesPage * pageSize);

  useEffect(() => {
    setOverridesPage(1);
  }, [searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary-navy" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-primary-navy textile-header">Canteen Settings</h1>
          <p className="text-text-muted font-mono text-sm uppercase tracking-widest">Configuration // Periods // Permissions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Biometric Config */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3 textile-card p-6 bg-white border-app-border shadow-xl space-y-6"
        >
          <div className="flex items-center justify-between border-b border-app-border pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-navy/10 rounded-lg text-primary-navy">
                <Settings size={20} />
              </div>
              <h2 className="text-xl font-bold text-primary-navy uppercase tracking-tight">Canteen Biometric Device Integration</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-app-border">
                <span className="text-[10px] font-bold text-text-muted uppercase">Status</span>
                <div className={`w-2 h-2 rounded-full ${config.status === 'Connected' ? 'bg-primary-green animate-pulse' : 'bg-primary-red'}`} />
                <span className={`text-xs font-bold ${config.status === 'Connected' ? 'text-primary-green' : 'text-primary-red'}`}>
                  {config.status}
                </span>
              </div>
              <button 
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="px-6 py-2 bg-primary-navy text-white rounded-lg font-bold hover:bg-primary-navy/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-navy/20"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Save Configuration
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Connection Settings */}
            <div className="space-y-4 p-4 border border-app-border rounded-xl bg-slate-50/50">
              <h4 className="text-xs font-bold text-primary-navy uppercase flex items-center gap-2">
                <Database size={14} /> Connection Settings
              </h4>
              
              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Connection Type</label>
                <select 
                  value={config.connection_type}
                  onChange={(e) => setConfig({ ...config, connection_type: e.target.value as any })}
                  className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                >
                  <option value="MS Access">MS Access (.mdb)</option>
                  <option value="SQL Server">SQL Server</option>
                  <option value="Excel/CSV">Excel/CSV</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Connection String / Path</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={config.connection_string}
                    onChange={(e) => setConfig({ ...config, connection_string: e.target.value })}
                    className="flex-1 bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                    placeholder={config.connection_type === 'MS Access' ? 'C:\\Path\\To\\Database.mdb' : 'Server=...;Database=...'}
                  />
                  <button 
                    type="button"
                    className="p-2 bg-slate-200 hover:bg-slate-300 text-text-main rounded-md transition-colors"
                    title="Browse"
                  >
                    <FolderOpen size={18} />
                  </button>
                </div>
              </div>

              {(config.connection_type === 'SQL Server' || config.connection_type === 'MS Access') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Database Name</label>
                      <input 
                        type="text"
                        value={config.db_name || ''}
                        onChange={(e) => setConfig({ ...config, db_name: e.target.value })}
                        className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                        placeholder="e.g. BioStar"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Procedure Name / Query</label>
                      <input 
                        type="text"
                        value={config.procedure_name || ''}
                        onChange={(e) => setConfig({ ...config, procedure_name: e.target.value })}
                        className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md font-mono"
                        placeholder={config.connection_type === 'SQL Server' ? 'EXEC GetPunches' : 'SELECT * FROM Punches'}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Database Login ID</label>
                      <input 
                        type="text"
                        value={config.db_user || ''}
                        onChange={(e) => setConfig({ ...config, db_user: e.target.value })}
                        className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                        placeholder="sa"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Database Password</label>
                      <input 
                        type="password"
                        value={config.db_password || ''}
                        onChange={(e) => setConfig({ ...config, db_password: e.target.value })}
                        className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Device Entry Type</label>
                <select 
                  value={config.device_entry_type}
                  onChange={(e) => setConfig({ ...config, device_entry_type: e.target.value as any })}
                  className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                >
                  <option value="Single Row">Single Row (In/Out in same record)</option>
                  <option value="Multi-Row">Multi-Row (Separate records for In and Out)</option>
                </select>
              </div>
            </div>

            {/* Column Mapping */}
            <div className="space-y-4 p-4 border border-app-border rounded-xl bg-slate-50/50">
              <h4 className="text-xs font-bold text-primary-navy uppercase flex items-center gap-2">
                <Settings2 size={14} /> Column Mapping
              </h4>

              <div className="space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Table Name</label>
                <input 
                  type="text"
                  value={config.table_name}
                  onChange={(e) => setConfig({ ...config, table_name: e.target.value })}
                  className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                  placeholder="e.g. CANTEEN_LOGS"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Employee Code Column</label>
                  <input 
                    type="text"
                    value={config.col_emp_code}
                    onChange={(e) => setConfig({ ...config, col_emp_code: e.target.value })}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Punch Time Col</label>
                    <input 
                      type="text"
                      value={config.col_punch_time}
                      onChange={(e) => setConfig({ ...config, col_punch_time: e.target.value })}
                      className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Punch Type Col</label>
                    <input 
                      type="text"
                      value={config.col_punch_type}
                      onChange={(e) => setConfig({ ...config, col_punch_type: e.target.value })}
                      className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Device Info & Auto Fetch */}
            <div className="space-y-4">
              <div className="p-4 border border-app-border rounded-xl bg-slate-50/50 space-y-4">
                <h4 className="text-xs font-bold text-primary-navy uppercase flex items-center gap-2">
                  <Coffee size={14} /> Device & Rate
                </h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Device IP</label>
                      <input 
                        type="text" 
                        value={config.device_ip || ''}
                        onChange={(e) => setConfig({ ...config, device_ip: e.target.value })}
                        placeholder="192.168.1.100"
                        className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-lg font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Port</label>
                      <input 
                        type="number" 
                        value={config.device_port ?? ''}
                        onChange={(e) => setConfig({ ...config, device_port: parseInt(e.target.value) || 0 })}
                        className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-lg font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border border-app-border rounded-xl bg-primary-navy/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-primary-navy uppercase flex items-center gap-2">
                    <RefreshCw size={14} /> Auto Fetch
                  </h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={config.auto_fetch}
                      onChange={(e) => setConfig({ ...config, auto_fetch: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-green"></div>
                  </label>
                </div>

                {config.auto_fetch && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Interval</label>
                      <span className="text-xs font-bold text-primary-navy bg-white px-2 py-1 rounded border border-app-border">
                        {config.fetch_interval}m
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="15"
                      max="120"
                      step="15"
                      value={config.fetch_interval}
                      onChange={(e) => setConfig({ ...config, fetch_interval: parseInt(e.target.value) })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-navy"
                    />
                    <div className="flex justify-between text-[8px] text-text-muted font-bold uppercase">
                      <span>15m</span>
                      <span>30m</span>
                      <span>45m</span>
                      <span>60m</span>
                      <span>75m</span>
                      <span>90m</span>
                      <span>105m</span>
                      <span>120m</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Time Windows */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 textile-card p-6 bg-white border-app-border shadow-xl space-y-6"
        >
          <div className="flex items-center justify-between border-b border-app-border pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-navy/10 rounded-lg text-primary-navy">
                <Clock size={20} />
              </div>
              <h2 className="text-xl font-bold text-primary-navy uppercase tracking-tight">Canteen Periods</h2>
            </div>
            <button 
              onClick={handleAddWindow}
              className="p-2 text-primary-navy hover:bg-primary-navy/10 rounded-lg transition-all"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {windows.map((window, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-4 bg-slate-50 rounded-2xl border border-app-border space-y-3 relative group"
                >
                  <button 
                    onClick={() => handleRemoveWindow(idx, window.id)}
                    className="absolute top-2 right-2 p-1 text-primary-red opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Period Name</label>
                      <input 
                        type="text" 
                        value={window.name || ''}
                        onChange={(e) => {
                          const newWindows = [...windows];
                          newWindows[idx].name = e.target.value;
                          setWindows(newWindows);
                        }}
                        placeholder="e.g. Lunch"
                        className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-lg font-bold text-primary-navy"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Start Time</label>
                      <input 
                        type="time" 
                        value={window.start_time || ''}
                        onChange={(e) => {
                          const newWindows = [...windows];
                          newWindows[idx].start_time = e.target.value;
                          setWindows(newWindows);
                        }}
                        className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-lg font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">End Time</label>
                      <input 
                        type="time" 
                        value={window.end_time || ''}
                        onChange={(e) => {
                          const newWindows = [...windows];
                          newWindows[idx].end_time = e.target.value;
                          setWindows(newWindows);
                        }}
                        className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-lg font-mono"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {windows.length > 0 && (
            <button 
              onClick={handleSaveWindows}
              disabled={isSaving}
              className="w-full py-3 bg-primary-navy text-white rounded-xl font-bold hover:bg-primary-navy/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-navy/20"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save Periods
            </button>
          )}
        </motion.div>

        {/* Canteen Rules */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-3 textile-card bg-white border-app-border shadow-xl overflow-hidden"
        >
          <div className="p-6 border-b border-app-border flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-navy/10 rounded-lg text-primary-navy">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-navy">Criteria-Based Rule Engine</h2>
                <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Define benefits based on employee categories, departments, etc.</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setEditingRule(null);
                setRuleForm({
                  rule_name: '',
                  benefit_type: 'Full Deduction',
                  discount_rate: 0,
                  dish_rate: 0,
                  effective_date: new Date().toISOString().split('T')[0],
                  categories: [],
                  classes: [],
                  groups: [],
                  departments: [],
                  designations: []
                });
                setIsRuleModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-navy text-white rounded-lg font-bold hover:bg-primary-navy/90 transition-all text-sm shadow-lg shadow-primary-navy/20"
            >
              <Plus size={16} />
              Add New Rule
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
                          <span className="text-xs font-mono text-text-muted">@{rule.discount_rate}%</span>
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
                          <span className="text-[9px] text-text-muted italic">Global (All Employees)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            setEditingRule(rule);
                            setRuleForm({ ...rule });
                            setIsRuleModalOpen(true);
                          }}
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
                    <td colSpan={4} className="px-6 py-12 text-center text-text-muted italic text-sm">
                      No rules defined. All employees will be charged the default dish rate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination 
            currentPage={rulesPage}
            totalPages={rulesTotalPages}
            totalRecords={rules.length}
            pageSize={pageSize}
            onPageChange={setRulesPage}
          />
        </motion.div>

        {/* Manual Overrides / Exceptional Cases */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-3 textile-card bg-white border-app-border shadow-xl overflow-hidden"
        >
          <div className="p-6 border-b border-app-border flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-navy/10 rounded-lg text-primary-navy">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-navy">Exceptional Overrides</h2>
                <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Manual rate overrides for specific employees</p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input 
                type="text" 
                placeholder="Search employees..."
                value={searchTerm || ''}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-app-border rounded-xl text-sm focus:outline-none focus:border-primary-navy w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-app-border">
                  <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Emp Code</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Class-Category</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Group-Dept.</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Designation</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Benefit Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Rate Override</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {currentOverrides.map((perm) => (
                  <tr key={perm.emp_id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4">
                      <span className="font-bold font-mono text-sm">{perm.emp_code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-primary-navy text-sm">{perm.emp_name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs text-text-main">
                        <span className="font-semibold">{perm.class_name || '-'}</span>
                        <span className="text-text-muted">{perm.category_name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs text-text-main">
                        <span className="font-semibold">{perm.group_name || '-'}</span>
                        <span className="text-text-muted">{perm.department_name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-text-main font-medium">{perm.designation_name || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase w-max",
                        perm.benefit_type === 'Free' ? "bg-primary-green/10 text-primary-green" :
                        perm.benefit_type === 'Discounted' ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-text-main"
                      )}>
                        {perm.benefit_type || 'Full Deduction'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold font-mono text-sm">{perm.rate_override === null ? 'Default' : `₹${perm.rate_override}`}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          setEditingOverride(perm);
                          setIsOverrideModalOpen(true);
                        }}
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
          <Pagination 
            currentPage={overridesPage}
            totalPages={overridesTotalPages}
            totalRecords={filteredPermissions.length}
            pageSize={pageSize}
            onPageChange={setOverridesPage}
          />
        </motion.div>

        {/* Rule Modal */}
        <AnimatePresence>
          {isRuleModalOpen && (
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-app-border overflow-hidden"
              >
                <div className="p-6 border-b border-app-border flex items-center justify-between bg-slate-50">
                  <h3 className="text-lg font-bold text-primary-navy uppercase tracking-tight">
                    {editingRule ? 'Edit Canteen Rule' : 'Create New Canteen Rule'}
                  </h3>
                  <button onClick={() => setIsRuleModalOpen(false)} className="text-text-muted hover:text-primary-red transition-colors">
                    <XCircle size={24} />
                  </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Rule Name</label>
                      <input 
                        type="text" 
                        value={ruleForm.rule_name}
                        onChange={(e) => setRuleForm({ ...ruleForm, rule_name: e.target.value })}
                        placeholder="e.g. Spinning Dept Free Food"
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Effective Date</label>
                      <input 
                        type="date"
                        value={ruleForm.effective_date || ''}
                        onChange={(e) => setRuleForm({ ...ruleForm, effective_date: e.target.value })}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm font-bold focus:outline-none focus:border-primary-navy rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Dish Rate (₹)</label>
                      <input 
                        type="number" 
                        value={ruleForm.dish_rate || 0}
                        onChange={(e) => setRuleForm({ ...ruleForm, dish_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm font-mono font-bold focus:outline-none focus:border-primary-navy rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Benefit Type</label>
                      <select 
                        value={ruleForm.benefit_type}
                        onChange={(e) => setRuleForm({ ...ruleForm, benefit_type: e.target.value as any })}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl"
                      >
                        <option value="Free">Free</option>
                        <option value="Full Deduction">Full Deduction</option>
                        <option value="Discounted">Discounted</option>
                      </select>
                    </div>
                    {ruleForm.benefit_type === 'Discounted' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Discount Rate (%)</label>
                        <input 
                          type="number" 
                          value={ruleForm.discount_rate}
                          onChange={(e) => setRuleForm({ ...ruleForm, discount_rate: parseFloat(e.target.value) })}
                          className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl font-mono"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 border-t border-app-border pt-4">
                    <h4 className="text-xs font-bold text-primary-navy uppercase tracking-widest">Applicable Criteria</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <MultiSelect 
                        label="Category" 
                        options={categories.map(c => ({ id: c.id, name: c.name }))}
                        selected={ruleForm.categories}
                        onChange={(ids) => setRuleForm({ ...ruleForm, categories: ids })}
                      />
                      <MultiSelect 
                        label="Class" 
                        options={classes.map(c => ({ id: c.id, name: c.name }))}
                        selected={ruleForm.classes}
                        onChange={(ids) => setRuleForm({ ...ruleForm, classes: ids })}
                      />
                      <MultiSelect 
                        label="Group" 
                        options={groups.map(g => ({ id: g.id, name: g.name }))}
                        selected={ruleForm.groups}
                        onChange={(ids) => setRuleForm({ ...ruleForm, groups: ids })}
                      />
                      <MultiSelect 
                        label="Department" 
                        options={departments.map(d => ({ id: d.id, name: d.name }))}
                        selected={ruleForm.departments}
                        onChange={(ids) => setRuleForm({ ...ruleForm, departments: ids })}
                      />
                      <div className="col-span-2">
                        <MultiSelect 
                          label="Designation" 
                          options={designations.map(d => ({ id: d.id, name: d.name }))}
                          selected={ruleForm.designations}
                          onChange={(ids) => setRuleForm({ ...ruleForm, designations: ids })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-app-border bg-slate-50 flex gap-3">
                  <button 
                    onClick={() => setIsRuleModalOpen(false)}
                    className="flex-1 py-3 border border-app-border text-text-main rounded-xl font-bold hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveRule}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-primary-navy text-white rounded-xl font-bold hover:bg-primary-navy/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-navy/20"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {editingRule ? 'Update Rule' : 'Create Rule'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isOverrideModalOpen && editingOverride && (
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-app-border overflow-hidden"
              >
                <div className="p-6 border-b border-app-border flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="text-lg font-bold text-primary-navy uppercase tracking-tight">Manual Rate Override</h3>
                    <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">{editingOverride.emp_code} - {editingOverride.emp_name}</p>
                  </div>
                  <button onClick={() => setIsOverrideModalOpen(false)} className="text-text-muted hover:text-primary-red transition-colors">
                    <XCircle size={24} />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-text-muted uppercase tracking-wider block font-bold text-[10px] mb-1">Class</span>
                      <span className="font-semibold text-text-main">{editingOverride.class_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-text-muted uppercase tracking-wider block font-bold text-[10px] mb-1">Category</span>
                      <span className="font-semibold text-text-main">{editingOverride.category_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-text-muted uppercase tracking-wider block font-bold text-[10px] mb-1">Group</span>
                      <span className="font-semibold text-text-main">{editingOverride.group_name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-text-muted uppercase tracking-wider block font-bold text-[10px] mb-1">Department</span>
                      <span className="font-semibold text-text-main">{editingOverride.department_name || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-text-muted uppercase tracking-wider block font-bold text-[10px] mb-1">Designation</span>
                      <span className="font-semibold text-text-main">{editingOverride.designation_name || '-'}</span>
                    </div>
                  </div>

                  <hr className="border-app-border" />

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Benefit Type</label>
                      <select 
                        value={editingOverride.benefit_type || 'Full Deduction'}
                        onChange={(e) => setEditingOverride({ ...editingOverride, benefit_type: e.target.value })}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-xl"
                      >
                        <option value="Free">Free</option>
                        <option value="Full Deduction">Full Deduction</option>
                        <option value="Discounted">Discounted</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Rate Override (₹)</label>
                      <input 
                        type="number" 
                        value={editingOverride.rate_override === null || editingOverride.rate_override === undefined ? '' : editingOverride.rate_override}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : parseFloat(e.target.value);
                          setEditingOverride({ ...editingOverride, rate_override: val });
                        }}
                        className="w-full bg-slate-50 border border-app-border p-3 text-sm font-bold font-mono focus:outline-none focus:border-primary-navy rounded-xl"
                        placeholder="Leave blank to use automatic rules"
                      />
                      <p className="text-[10px] text-text-muted pt-1">Leave blank to revert to automatic rules.</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-app-border bg-slate-50 flex gap-3">
                  <button 
                    onClick={() => setIsOverrideModalOpen(false)}
                    className="flex-1 py-3 border border-app-border text-text-main rounded-xl font-bold hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      setIsSaving(true);
                      try {
                        await invoke('update_canteen_override', {
                          empId: editingOverride.emp_id,
                          rateOverride: editingOverride.rate_override,
                          benefitType: editingOverride.benefit_type,
                          moduleType: currentMode
                        });
                        setPermissions(permissions.map(p => p.emp_id === editingOverride.emp_id ? { ...p, rate_override: editingOverride.rate_override, benefit_type: editingOverride.benefit_type } as any : p));
                        toast.success('Override updated successfully');
                        setIsOverrideModalOpen(false);
                      } catch (error) {
                        toast.error('Failed to update override');
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-primary-navy text-white rounded-xl font-bold hover:bg-primary-navy/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-navy/20"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Save Override
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CanteenSettings;
