import React from 'react';
import { Cloud, Database } from 'lucide-react';

export default function CloudSyncMonitor() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy flex items-center gap-3">
            <Cloud size={32} />
            Cloud Sync Monitor
          </h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Module SYS-03 // Real-time Data Synchronisation</p>
        </div>
      </div>
      
      <div className="textile-card p-12 bg-white border-app-border flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-primary-navy/20">
          <Database size={40} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-primary-navy">Cloud Sync Module</h3>
          <p className="text-text-muted max-w-md mx-auto">This section is currently being structured. Real-time synchronisation monitoring will be integrated soon.</p>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1 bg-primary-navy/5 text-primary-navy text-[10px] font-mono rounded-full border border-primary-navy/10">
            STATUS: DRAFT
          </div>
          <div className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-mono rounded-full border border-slate-200">
            VERSION: 0.1.0
          </div>
        </div>
      </div>
    </div>
  );
}
