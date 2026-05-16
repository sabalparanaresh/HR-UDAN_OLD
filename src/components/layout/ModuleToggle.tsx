import React from 'react';
import { useModule } from '../../contexts/ModuleContext';
import { Shield, Activity, RefreshCw, Lock } from 'lucide-react';
import { clsx } from 'clsx';

export const ModuleToggle: React.FC = () => {
  const { currentMode, toggleMode, isConnected } = useModule();

  return (
    <div className="px-4 py-3 border-t border-primary-navy/10 mt-auto">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className={clsx(
              "text-[10px] font-bold tracking-widest uppercase",
              currentMode === 'K' ? "text-primary-navy/60" : "text-amber-600"
            )}>
              {currentMode === 'K' ? 'Module K (Actual)' : 'Module P (Statutory)'}
            </span>
            {!isConnected && (
              <span className="text-[8px] text-red-500 font-medium flex items-center gap-1">
                <Lock className="w-2 h-2" /> DISCONNECTED
              </span>
            )}
          </div>
          <button 
            onClick={toggleMode}
            disabled={!isConnected && currentMode === 'P'}
            className={clsx(
              "p-1.5 rounded-md transition-all duration-300",
              currentMode === 'K' 
                ? "bg-primary-navy/5 text-primary-navy hover:bg-primary-navy/10" 
                : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20",
              !isConnected && currentMode === 'P' && "opacity-50 cursor-not-allowed"
            )}
            title={isConnected ? "Switch Module" : "Module K is globally disconnected"}
          >
            {isConnected ? (
              <RefreshCw className={clsx("w-3.5 h-3.5", currentMode === 'P' && "rotate-180")} />
            ) : (
              <Lock className="w-3.5 h-3.5 text-red-500" />
            )}
          </button>
        </div>
        
        <div className="relative h-10 bg-primary-navy/5 rounded-lg p-1 flex items-center">
          <div 
            className={clsx(
              "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-md transition-all duration-500 ease-out shadow-sm",
              currentMode === 'K' 
                ? "left-1 bg-primary-navy" 
                : "left-[calc(50%+2px)] bg-amber-500"
            )}
          />
          
          <button 
            onClick={() => isConnected && currentMode !== 'K' && toggleMode()}
            disabled={!isConnected}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 z-10 text-[11px] font-bold transition-all duration-300",
              currentMode === 'K' ? "text-white" : "text-primary-navy/40",
              !isConnected && "opacity-50 cursor-not-allowed"
            )}
            title={!isConnected ? "Module K is globally disconnected by Administrator." : ""}
          >
            {isConnected ? <Activity className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            KACHHA
          </button>
          
          <button 
            onClick={() => currentMode !== 'P' && toggleMode()}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 z-10 text-[11px] font-bold transition-colors duration-300",
              currentMode === 'P' ? "text-white" : "text-primary-navy/40"
            )}
          >
            <Shield className="w-3 h-3" />
            PAKKA
          </button>
        </div>
      </div>
    </div>
  );
};
