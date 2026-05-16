import React from 'react';
import { useModule } from '../../contexts/ModuleContext';
import { DatabaseZap } from 'lucide-react';

export default function CachedStatutoryWarningBanner() {
  const { currentMode, isConnected, lastStatutorySync } = useModule();

  if (currentMode !== 'K' || isConnected) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center justify-between mb-4 shadow-sm animate-in fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-100 rounded-full">
          <DatabaseZap className="text-amber-600" size={20} />
        </div>
        <div>
          <h4 className="text-amber-800 font-bold text-sm uppercase tracking-wider">Cached Statutory Data</h4>
          <p className="text-amber-700 text-xs mt-0.5">
            Audit Mode is active. This report relies on P Module data which is currently disconnected.
            Showing the last successfully cached snapshot.
          </p>
        </div>
      </div>
      {lastStatutorySync && (
        <div className="text-right flex flex-col justify-center">
          <span className="text-[10px] text-amber-600/80 font-bold uppercase tracking-wider">Snapshot Timestamp</span>
          <span className="text-xs font-mono font-bold text-amber-800">
            {new Date(lastStatutorySync).toLocaleString('en-IN')}
          </span>
        </div>
      )}
    </div>
  );
}
