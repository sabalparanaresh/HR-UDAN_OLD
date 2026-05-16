import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { toast } from 'sonner';

type ModuleMode = 'K' | 'P';

interface ModuleContextType {
  currentMode: ModuleMode;
  isConnected: boolean;
  lastStatutorySync: string | null;
  toggleMode: () => void;
  setMode: (mode: ModuleMode) => void;
  refreshConnectionStatus: () => Promise<void>;
  toggleConnection: () => Promise<void>;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentMode, setCurrentMode] = useState<ModuleMode>(() => {
    const saved = localStorage.getItem('hr_udan_mode');
    return (saved === 'K' || saved === 'P') ? saved : 'K';
  });
  const [isConnected, setIsConnected] = useState<boolean>(true);

  const [lastStatutorySync, setLastStatutorySync] = useState<string | null>(null);

  const refreshConnectionStatus = useCallback(async () => {
    try {
      const status = await invoke<string>('get_connection_status');
      const connected = status === 'CONNECTED';
      setIsConnected(connected);
      
      const syncRes = await invoke<{ timestamp: string }>('get_last_sync_timestamp', { moduleType: 'K' });
      if (syncRes && syncRes.timestamp && syncRes.timestamp !== '1970-01-01T00:00:00Z') {
        setLastStatutorySync(syncRes.timestamp);
      }
      
      if (!connected && currentMode === 'K') {
        // DO NOT force switch. The admin can look at K, but it's offline!
        // setCurrentMode('P');
        // toast.warning('Module K is operating in offline Audit Mode. Statutory data is cached.');
      }
    } catch (error) {
      console.error('Failed to get connection status:', error);
    }
  }, [currentMode]);

  useEffect(() => {
    refreshConnectionStatus();
    
    // Poll for status changes every 30 seconds
    const interval = setInterval(refreshConnectionStatus, 30000);
    return () => clearInterval(interval);
  }, [refreshConnectionStatus]);

  useEffect(() => {
    localStorage.setItem('hr_udan_mode', currentMode);
    
    // Apply global class for visual feedback
    if (currentMode === 'P') {
      document.documentElement.classList.add('mode-pakka');
    } else {
      document.documentElement.classList.remove('mode-pakka');
    }
  }, [currentMode]);

  const toggleMode = () => {
    if (!isConnected && currentMode === 'P') {
      toast.error('Module K is globally disconnected by Administrator.');
      return;
    }
    setCurrentMode(prev => prev === 'K' ? 'P' : 'K');
  };

  const setMode = (mode: ModuleMode) => {
    if (mode === 'K' && !isConnected) {
      toast.error('Module K is globally disconnected.');
      return;
    }
    setCurrentMode(mode);
  };

  const toggleConnection = async () => {
    // Only toggle connection if we are in K mode (since toggle is theoretically managed by K)
    // Actually the prompt says: "K Module (Primary) UI must include a single toggle button..."
    // We will toggle the backend state
    const newStatus = isConnected ? 'DISCONNECTED' : 'CONNECTED';
    try {
      await invoke('update_connection_status', { status: newStatus });
      setIsConnected(!isConnected);
      refreshConnectionStatus();
      toast.success(`Bridge ${newStatus}`);
    } catch(e) {
      toast.error('Failed to change connection status');
    }
  };

  const toggleAuditMode = async () => {
    try {
      if (currentMode === 'K') {
        await invoke('update_connection_status', { status: 'DISCONNECTED' });
        setIsConnected(false);
        setCurrentMode('P');
        toast.success("Audit Mode Engaged: K Module Disconnected");
      } else {
        await invoke('update_connection_status', { status: 'CONNECTED' });
        setIsConnected(true);
        setCurrentMode('K');
        toast.success("Primary Mode Restored: Statutory Sync Active");
      }
      refreshConnectionStatus();
    } catch(e) {
      toast.error('Failed to change audit mode');
    }
  };

  // Global shortcut Alt + Shift + K to toggle audit mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleAuditMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMode, isConnected]); // Added currentMode


  return (
    <ModuleContext.Provider value={{ currentMode, isConnected, lastStatutorySync, toggleMode, setMode, refreshConnectionStatus, toggleConnection }}>
      {children}
    </ModuleContext.Provider>
  );
};

export const useModule = () => {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error('useModule must be used within a ModuleProvider');
  }
  return context;
};
