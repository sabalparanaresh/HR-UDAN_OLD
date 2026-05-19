import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceState {
  activeWorkspace: 'K' | 'P';
  lastRoutes: {
    K: string;
    P: string;
  };
  isModulePConnected: boolean;
  lastSnapshotTimestamp: string | null;
  setWorkspace: (workspace: 'K' | 'P') => void;
  toggleWorkspace: () => void;
  setLastRoute: (workspace: 'K' | 'P', route: string) => void;
  setModulePConnection: (connected: boolean, timestamp?: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      activeWorkspace: 'K',
      isModulePConnected: true,
      lastSnapshotTimestamp: null,
      lastRoutes: {
        K: '/reports/dashboard',
        P: '/reports/dashboard',
      },
      setWorkspace: (workspace) => set({ activeWorkspace: workspace }),
      toggleWorkspace: () => {
        const nextWorkspace = get().activeWorkspace === 'K' ? 'P' : 'K';
        set({ activeWorkspace: nextWorkspace });
      },
      setLastRoute: (workspace, route) => set((state) => ({
        lastRoutes: {
          ...state.lastRoutes,
          [workspace]: route,
        }
      })),
      setModulePConnection: (connected, timestamp) => set((state) => ({
        isModulePConnected: connected,
        lastSnapshotTimestamp: timestamp || state.lastSnapshotTimestamp,
      })),
    }),
    {
      name: 'workspace-storage',
    }
  )
);
