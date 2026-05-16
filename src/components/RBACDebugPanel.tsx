import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Shield, X, Maximize2, Minimize2, Key } from 'lucide-react';
import { useModule } from '../contexts/ModuleContext';

export default function RBACDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { user, permissionMap, moduleScope, auditMode } = useAuthStore();
  const { currentMode, isConnected } = useModule();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+D to toggle debug panel
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <div className={`fixed bottom-4 right-4 bg-slate-900 text-slate-300 shadow-2xl rounded-lg border border-slate-700 z-[9999] overflow-hidden transition-all ${isExpanded ? 'w-96 h-[32rem]' : 'w-80 h-auto'}`}>
      <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
          <Shield size={16} /> RBAC Debug Panel
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsExpanded(!isExpanded)} className="hover:text-white transition-colors">
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="hover:text-red-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>
      
      <div className={`p-4 overflow-y-auto ${isExpanded ? 'h-[calc(100%-44px)]' : 'max-h-96'}`}>
        <div className="space-y-4 text-xs font-mono">
          <div>
            <h4 className="text-slate-400 uppercase tracking-wider mb-1 text-[10px]">Current User</h4>
            <div className="bg-slate-800 p-2 rounded border border-slate-700">
              <div>Name: <span className="text-white">{user?.name || 'None'}</span></div>
              <div>Role: <span className="text-white">{user?.role || 'None'}</span></div>
              <div>Module Scope: <span className="text-white">{moduleScope}</span></div>
            </div>
          </div>
          
          <div>
            <h4 className="text-slate-400 uppercase tracking-wider mb-1 text-[10px]">Environment Context</h4>
            <div className="bg-slate-800 p-2 rounded border border-slate-700">
              <div>Current Mode: <span className={currentMode === 'K' ? 'text-indigo-400' : 'text-emerald-400'}>{currentMode} Module</span></div>
              <div>Sync Status: <span className={isConnected ? 'text-emerald-400' : 'text-red-400'}>{isConnected ? 'Connected' : 'Audit Mode (Disconnected)'}</span></div>
              <div>Audit Mode Flag: <span className={auditMode ? 'text-red-400' : 'text-emerald-400'}>{auditMode ? 'Active' : 'Inactive'}</span></div>
            </div>
          </div>

          <div>
            <h4 className="text-slate-400 uppercase tracking-wider mb-1 text-[10px] flex items-center gap-1"><Key size={12}/> Evaluated Permission Map</h4>
            <div className="bg-slate-800 p-2 rounded border border-slate-700 max-h-48 overflow-y-auto">
              {Object.keys(permissionMap).length === 0 ? (
                <span className="text-slate-500 italic">No specific permissions loaded. (SuperAdmin bypass may be active)</span>
              ) : (
                <ul className="space-y-1">
                  {Object.entries(permissionMap).map(([key, val]) => (
                    <li key={key} className="flex justify-between">
                      <span className="truncate pr-2">{key}</span>
                      <span className={val ? 'text-emerald-400' : 'text-red-400'}>{val ? 'true' : 'false'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="text-slate-500 italic text-[10px]">Press Ctrl+Shift+D to hide</div>
        </div>
      </div>
    </div>
  );
}
