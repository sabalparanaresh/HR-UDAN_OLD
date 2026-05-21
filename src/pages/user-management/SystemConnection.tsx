import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  ZapOff, 
  ShieldCheck, 
  Loader2,
  Database,
  RefreshCw,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fetchApi } from '../../services/apiClient';
import { User } from '../../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SystemConnectionProps {
  currentUser: User | null;
}

export default function SystemConnection({ currentUser }: SystemConnectionProps) {
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'DISCONNECTED'>('CONNECTED');
  const [isToggling, setIsToggling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [reconcileData, setReconcileData] = useState<any>(null);
  const [resolution, setResolution] = useState<'KEEP_K' | 'KEEP_P' | 'DUAL_LEDGER'>('DUAL_LEDGER');

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  const fetchConnectionStatus = async () => {
    setIsLoading(true);
    try {
      const status = await fetchApi<'CONNECTED' | 'DISCONNECTED'>('/api/system/connection-status');
      setConnectionStatus(status);
      const logs = await fetchApi<any[]>('/api/system/reconnect-audit-logs');
      setAuditLogs(logs || []);
    } catch (err) {
      console.error("Failed to fetch connection status", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsToggling(true);
    try {
      await fetchApi('/api/system/connection-status', { method: 'POST', body: JSON.stringify({ status: 'DISCONNECTED' }) });
      setConnectionStatus('DISCONNECTED');
      const logs = await fetchApi<any[]>('/api/system/reconnect-audit-logs');
      setAuditLogs(logs || []);
      toast.success(`System ISOLATED`, {
        description: 'Module P is now acting via Isolation Circuit Breaker.',
        className: 'bg-amber-100 border-amber-500 text-amber-800'
      });
    } catch (e: any) {
      toast.error('Disconnect failed', { description: e.message });
    } finally {
      setIsToggling(false);
    }
  };

  const initiateReconnect = async () => {
    setIsToggling(true);
    try {
      const report = await fetchApi<any>('/api/system/reconcile-kp');
      setReconcileData(report);
      setReconcileModalOpen(true);
    } catch (e: any) {
      toast.error('Reconciliation failed', { description: e.message });
    } finally {
      setIsToggling(false);
    }
  };

  const finalizeReconnect = async () => {
    setIsToggling(true);
    try {
      await fetchApi('/api/system/resolve-reconnect', { method: 'POST', body: JSON.stringify({ resolution }) });
      setConnectionStatus('CONNECTED');
      const logs = await fetchApi<any[]>('/api/system/reconnect-audit-logs');
      setAuditLogs(logs || []);
      toast.success('Sync Engine Reconnected', {
        className: 'bg-green-100 border-green-500 text-green-800'
      });
      setReconcileModalOpen(false);
    } catch(e: any) {
       toast.error('Reconnect failed', { description: e.message });
    } finally {
      setIsToggling(false);
    }
  };

  const toggleConnection = async () => {
    if (connectionStatus === 'CONNECTED') {
       await handleDisconnect();
    } else {
       await initiateReconnect();
    }
  };

  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';

  if (!isSuperAdmin && !([] as any[]).find(p => p.page === 'Payroll')?.can_process_blacklist) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <ShieldCheck className="text-primary-red w-16 h-16 opacity-20" />
        <h2 className="text-2xl textile-header font-black text-primary-navy">Access Denied</h2>
        <p className="text-text-muted max-w-md">You do not have sufficient privileges to access system connection controls. Please contact an authorized administrator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black flex items-center gap-3">
            <ShieldCheck className="text-primary-navy" size={32} />
            System Connection Control
          </h2>
          <p className="text-sm font-mono text-primary-navy uppercase tracking-widest">
            GLOBAL ACCESS CONTROL // ISOLATION CIRCUIT BREAKER
          </p>
        </div>
        <button 
          onClick={fetchConnectionStatus}
          disabled={isLoading}
          className="app-btn app-btn-outline flex items-center gap-2"
        >
          <RefreshCw className={cn(isLoading && "animate-spin")} size={16} />
          Refresh Status
        </button>
      </div>

      <div className="textile-card p-8 border-2 border-dashed border-app-border bg-white flex flex-col items-center text-center space-y-8 shadow-xl">
        <div className={cn(
          "w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 transform hover:scale-105",
          connectionStatus === 'CONNECTED' ? "bg-primary-green text-white" : "bg-amber-600 text-white"
        )}>
          {connectionStatus === 'CONNECTED' ? <Zap size={64} /> : <ZapOff size={64} />}
        </div>
        
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Current Status</span>
            <h4 className={cn(
              "text-4xl font-black textile-header uppercase tracking-tighter",
              connectionStatus === 'CONNECTED' ? "text-primary-green" : "text-amber-600"
            )}>
              {connectionStatus === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED / AUDIT MODE'}
            </h4>
          </div>
          
          <p className="text-sm text-text-muted max-w-lg mx-auto leading-relaxed">
            {connectionStatus === 'CONNECTED' 
              ? "The system is connected. Data synchronisation between Primary and Statutory modules is active."
              : "ISOLATION ACTIVE: K Sync API blocked. Statutory module is operating independently with standalone inputs enabled."}
          </p>
        </div>

        <div className="w-full max-w-md space-y-4">
          <button
            onClick={toggleConnection}
            disabled={isToggling}
            className={cn(
              "w-full app-btn px-8 py-4 textile-header text-lg font-bold shadow-xl transition-all flex items-center justify-center gap-3",
              connectionStatus === 'CONNECTED' ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-primary-green hover:bg-green-700 text-white",
              isToggling && "opacity-50 cursor-not-allowed"
            )}
          >
            {isToggling ? <Loader2 className="animate-spin" size={24} /> : (connectionStatus === 'CONNECTED' ? <ZapOff size={24} /> : <Zap size={24} />)}
            {connectionStatus === 'CONNECTED' ? 'DISCONNECT & ISOLATE (AUDIT)' : 'RECONNECT SYNC ENGINE'}
          </button>
        </div>
      </div>

      <div className="textile-card mt-6">
        <div className="p-4 border-b border-app-border flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-primary-navy textile-header uppercase text-sm flex items-center gap-2">
            <Activity size={18} /> Reconnect Audit Logs
          </h3>
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase font-mono text-text-muted bg-slate-50 sticky top-0">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Performed By</th>
                <th className="px-6 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log: any) => (
                <tr key={log.id} className="border-b last:border-0 border-app-border hover:bg-slate-50/50">
                  <td className="px-6 py-3 font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      "px-2 py-1 rounded inline-block text-[10px] font-bold uppercase",
                      log.action === 'CONNECTED' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-3">{log.performed_by_user || 'System'}</td>
                  <td className="px-6 py-3 text-text-muted">{log.reason || '-'}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-text-muted">No audit logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reconcileModalOpen && reconcileData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-app-border w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-6 bg-slate-50 border-b border-app-border">
              <h2 className="text-xl font-black text-primary-navy textile-header uppercase">Sync Reconciliation</h2>
              <p className="text-sm text-text-muted mt-1">Review disconnected operations since {new Date(reconcileData.audit_start_time).toLocaleString()}</p>
            </div>
            
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="flex gap-4 items-center justify-between bg-primary-navy/5 p-4 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-black text-primary-blue">{reconcileData.k_records}</div>
                  <div className="text-[10px] tracking-wider uppercase font-bold text-text-muted">K Module Records</div>
                </div>
                <div className="text-primary-navy font-bold text-lg">VS</div>
                <div className="text-center">
                  <div className="text-2xl font-black text-primary-red">{reconcileData.p_records}</div>
                  <div className="text-[10px] tracking-wider uppercase font-bold text-text-muted">P Module Records</div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-primary-navy">Select Resolution Policy</label>
                <select 
                  className="w-full text-sm p-3 border border-app-border rounded focus:border-primary-blue focus:ring-1 focus:ring-primary-blue bg-white"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                >
                  <option value="DUAL_LEDGER">DUAL_LEDGER - Maintain independent history (Recommended)</option>
                  <option value="KEEP_K">KEEP_K - Overwrite P's audit period with K data</option>
                  <option value="KEEP_P">KEEP_P - Merge P's standalone transactions back into K</option>
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-app-border bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setReconcileModalOpen(false)}
                className="px-6 py-2 border border-app-border rounded text-sm font-bold text-text-main hover:bg-slate-100 transition-colors"
                disabled={isToggling}
              >
                Cancel
              </button>
              <button 
                onClick={finalizeReconnect}
                disabled={isToggling}
                className="px-6 py-2 bg-primary-green hover:bg-green-700 text-white rounded text-sm font-bold shadow transition-colors flex items-center gap-2"
              >
                {isToggling && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Reconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
