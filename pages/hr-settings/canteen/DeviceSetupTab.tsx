import React, { useState, useEffect } from 'react';
import { Settings, Database, FolderOpen, Settings2, Coffee, RefreshCw, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { invokeCommand, fetchApi } from '../../../services/apiClient';
import { useModule } from '../../../contexts/ModuleContext';
import { motion } from 'motion/react';

export default function DeviceSetupTab() {
  const { currentMode } = useModule();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [config, setConfig] = useState<any>({
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

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data: any = await fetchApi('/api/canteen/master', { headers: { 'x-module-type': currentMode } });
        if (data.config) setConfig(data.config);
      } catch (err) {
        toast.error('Failed to load device config');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [currentMode]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'canteen_config',
        operation: config.id ? 'update' : 'create',
        id: config.id,
        data: config,
        moduleType: currentMode
      }) });
      toast.success('Configuration saved');
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline-block text-primary-navy" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="textile-card p-6 bg-white border-app-border shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-app-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-navy/10 rounded-lg text-primary-navy">
            <Settings size={20} />
          </div>
          <h2 className="text-xl font-bold text-primary-navy uppercase tracking-tight">Biometric Integration Setup</h2>
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
            Save Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Same UI fields extracted from existing CanteenSettings.tsx */}
        <div className="space-y-4 p-4 border border-app-border rounded-xl bg-slate-50/50">
          <h4 className="text-xs font-bold text-primary-navy uppercase flex items-center gap-2">
            <Database size={14} /> DB Connection
          </h4>
          <div className="space-y-2">
            <label className="text-[10px] text-text-muted uppercase font-bold">Connection Type</label>
            <select 
              value={config.connection_type}
              onChange={(e) => setConfig({ ...config, connection_type: e.target.value })}
              className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
            >
              <option value="MS Access">MS Access (.mdb)</option>
              <option value="SQL Server">SQL Server</option>
              <option value="Excel/CSV">Excel/CSV</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-text-muted uppercase font-bold">Connection String / Path</label>
            <div className="flex gap-2">
              <input 
                type="text"
                value={config.connection_string}
                onChange={(e) => setConfig({ ...config, connection_string: e.target.value })}
                className="flex-1 bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy font-mono rounded-md"
                placeholder={config.connection_type === 'MS Access' ? 'C:\\Path\\To\\Database.mdb' : 'Server=...;Database=...'}
              />
            </div>
          </div>
          {(config.connection_type === 'SQL Server' || config.connection_type === 'MS Access') && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-text-muted uppercase font-bold">DB Name</label>
                  <input type="text" value={config.db_name || ''} onChange={(e) => setConfig({ ...config, db_name: e.target.value })} className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none rounded-md" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-text-muted uppercase font-bold">Procedure Name</label>
                  <input type="text" value={config.procedure_name || ''} onChange={(e) => setConfig({ ...config, procedure_name: e.target.value })} className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none font-mono rounded-md" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-4 p-4 border border-app-border rounded-xl bg-slate-50/50">
          <h4 className="text-xs font-bold text-primary-navy uppercase flex items-center gap-2">
            <Settings2 size={14} /> Mapping
          </h4>
          <div className="space-y-2">
            <label className="text-[10px] text-text-muted uppercase font-bold">Table Name</label>
            <input type="text" value={config.table_name} onChange={(e) => setConfig({ ...config, table_name: e.target.value })} className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none font-mono rounded-md" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-text-muted uppercase font-bold">Employee Code Column</label>
            <input type="text" value={config.col_emp_code} onChange={(e) => setConfig({ ...config, col_emp_code: e.target.value })} className="w-full bg-white border border-app-border p-2 text-sm font-mono rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] text-text-muted uppercase font-bold">Time Col</label>
              <input type="text" value={config.col_punch_time} onChange={(e) => setConfig({ ...config, col_punch_time: e.target.value })} className="w-full bg-white border border-app-border p-2 text-sm font-mono rounded-md" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 border border-app-border rounded-xl bg-slate-50/50 space-y-4">
            <h4 className="text-xs font-bold text-primary-navy uppercase flex items-center gap-2">
              <Coffee size={14} /> IP Link
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Device IP</label>
                <input type="text" value={config.device_ip || ''} onChange={(e) => setConfig({ ...config, device_ip: e.target.value })} className="w-full bg-white border border-app-border p-2 text-sm font-mono rounded-lg" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Port</label>
                <input type="number" value={config.device_port ?? ''} onChange={(e) => setConfig({ ...config, device_port: parseInt(e.target.value) || 0 })} className="w-full bg-white border border-app-border p-2 text-sm font-mono rounded-lg" />
              </div>
            </div>
          </div>

          <div className="p-4 border border-app-border rounded-xl bg-primary-navy/5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-primary-navy uppercase flex items-center gap-2">
                <RefreshCw size={14} /> Auto Fetch
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={config.auto_fetch} onChange={(e) => setConfig({ ...config, auto_fetch: e.target.checked })} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-green"></div>
              </label>
            </div>
            {config.auto_fetch && (
              <div className="space-y-4 pt-2 border-t border-app-border/40">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-text-muted uppercase font-bold">Interval (mins)</label>
                  <span className="text-xs font-bold text-primary-navy bg-white px-2 py-1 rounded border border-app-border">{config.fetch_interval}m</span>
                </div>
                <input type="range" min="15" max="120" step="15" value={config.fetch_interval} onChange={(e) => setConfig({ ...config, fetch_interval: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-navy" />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
