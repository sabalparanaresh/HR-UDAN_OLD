import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  ZapOff, 
  ShieldCheck, 
  Loader2,
  Database,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { invoke } from '@tauri-apps/api/tauri';
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

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  const fetchConnectionStatus = async () => {
    setIsLoading(true);
    try {
      const status = await invoke<'CONNECTED' | 'DISCONNECTED'>('get_connection_status');
      setConnectionStatus(status);
    } catch (err) {
      console.error("Failed to fetch connection status", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleConnection = async () => {
    const newStatus = connectionStatus === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED';
    setIsToggling(true);
    try {
      await invoke('update_connection_status', { status: newStatus });
      setConnectionStatus(newStatus);
      toast.success(`System ${newStatus}`, {
        description: newStatus === 'DISCONNECTED' ? 'Primary data module is now hidden.' : 'All modules are now accessible.',
        className: 'bg-card-bg border-primary-navy text-text-main'
      });
    } catch (err) {
      toast.error("Failed to update connection status");
    } finally {
      setIsToggling(false);
    }
  };

  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';

  if (!isSuperAdmin && !([]).find(p => p.page === 'Payroll')?.can_process_blacklist) {
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
            GLOBAL ACCESS CONTROL // DATABASE_LINK_STATUS
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
          connectionStatus === 'CONNECTED' ? "bg-primary-green text-white" : "bg-primary-red text-white"
        )}>
          {connectionStatus === 'CONNECTED' ? <Zap size={64} /> : <ZapOff size={64} />}
        </div>
        
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Current Status</span>
            <h4 className={cn(
              "text-4xl font-black textile-header uppercase tracking-tighter",
              connectionStatus === 'CONNECTED' ? "text-primary-green" : "text-primary-red"
            )}>
              {connectionStatus}
            </h4>
          </div>
          
          <p className="text-sm text-text-muted max-w-lg mx-auto leading-relaxed">
            {connectionStatus === 'CONNECTED' 
              ? "The system is currently connected to the primary database. All modules and sensitive data are accessible to authorized personnel."
              : "The system is currently disconnected. Primary data is hidden, and only statutory modules are accessible."}
          </p>
        </div>

        <div className="w-full max-w-md space-y-4">
          <button
            onClick={toggleConnection}
            disabled={isToggling}
            className={cn(
              "w-full app-btn px-8 py-4 textile-header text-lg font-bold shadow-xl transition-all flex items-center justify-center gap-3",
              connectionStatus === 'CONNECTED' ? "bg-primary-red hover:bg-red-700 text-white" : "bg-primary-green hover:bg-green-700 text-white",
              isToggling && "opacity-50 cursor-not-allowed"
            )}
          >
            {isToggling ? <Loader2 className="animate-spin" size={24} /> : (connectionStatus === 'CONNECTED' ? <ZapOff size={24} /> : <Zap size={24} />)}
            {connectionStatus === 'CONNECTED' ? 'DISCONNECT PRIMARY DATA' : 'CONNECT PRIMARY DATA'}
          </button>

          <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-primary-red uppercase bg-primary-red/5 px-4 py-3 border border-primary-red/20 rounded-md">
            <ShieldCheck size={14} />
            Critical Action: This will affect system-wide module availability
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="textile-card p-6 bg-slate-50 border-app-border space-y-3">
          <Database className="text-primary-navy" size={24} />
          <h5 className="font-bold text-primary-navy textile-header uppercase text-xs">Data Integrity</h5>
          <p className="text-[11px] text-text-muted">Ensures that all transactions are synchronized with the central mill server.</p>
        </div>
        <div className="textile-card p-6 bg-slate-50 border-app-border space-y-3">
          <ShieldCheck className="text-primary-navy" size={24} />
          <h5 className="font-bold text-primary-navy textile-header uppercase text-xs">Access Control</h5>
          <p className="text-[11px] text-text-muted">Only users with Blacklist Processing permission can toggle this connection to prevent unauthorized data exposure.</p>
        </div>
        <div className="textile-card p-6 bg-slate-50 border-app-border space-y-3">
          <RefreshCw className="text-primary-navy" size={24} />
          <h5 className="font-bold text-primary-navy textile-header uppercase text-xs">Real-Time Sync</h5>
          <p className="text-[11px] text-text-muted">Connection status is monitored in real-time across all active user sessions.</p>
        </div>
      </div>
    </div>
  );
}
