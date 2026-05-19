import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { invokeCommand as invoke } from '../services/apiClient';
import { toast } from 'sonner';
import { useWorkspaceStore } from '../store/workspaceStore';

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
  const currentMode = useWorkspaceStore(state => state.activeWorkspace);
  const setModeStore = useWorkspaceStore(state => state.setWorkspace);
  const toggleWorkspaceStore = useWorkspaceStore(state => state.toggleWorkspace);

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
    } catch (error) {
      console.error('Failed to get connection status:', error);
    }
  }, []);

  useEffect(() => {
    refreshConnectionStatus();
    // Poll for status changes every 30 seconds
    const interval = setInterval(refreshConnectionStatus, 30000);
    return () => clearInterval(interval);
  }, [refreshConnectionStatus]);

  useEffect(() => {
    // Apply global class for visual feedback
    if (currentMode === 'P') {
      document.documentElement.classList.add('mode-pakka');
    } else {
      document.documentElement.classList.remove('mode-pakka');
    }
  }, [currentMode]);

  const toggleMode = () => {
    toggleWorkspaceStore();
  };

  const setMode = (mode: ModuleMode) => {
    setModeStore(mode);
  };

  const toggleConnection = async () => {
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
