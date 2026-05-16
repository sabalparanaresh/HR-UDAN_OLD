import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceState {
  activeWorkspace: 'K' | 'P';
  lastRoutes: {
    K: string;
    P: string;
  };
  setWorkspace: (workspace: 'K' | 'P') => void;
  toggleWorkspace: () => void;
  setLastRoute: (workspace: 'K' | 'P', route: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      activeWorkspace: 'K',
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
    }),
    {
      name: 'workspace-storage',
    }
  )
);
