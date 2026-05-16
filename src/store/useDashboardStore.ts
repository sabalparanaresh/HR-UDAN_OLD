import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

export interface DashboardWidgetConfig {
  id: string;
  type: 'PIE' | 'BAR' | 'LINE' | 'HEATMAP' | 'KPI' | 'TABLE';
  title: string;
  dataSource: string; // e.g. 'deptDist', 'trendData', 'kpi'
  kpiField?: string; // e.g. 'total_salary'
}

export interface DashboardLayoutState {
  layouts: {
    [userId: string]: {
      [module: string]: {
        layouts: any[];
        widgets: DashboardWidgetConfig[];
      }
    }
  };
  error: string | null;
  saveLayout: (userId: string, module: string, layouts: any[], widgets: DashboardWidgetConfig[]) => void;
  getLayout: (userId: string, module: string) => { layouts: any[], widgets: DashboardWidgetConfig[] } | null;
  setError: (err: string | null) => void;
}

export const useDashboardStore = create<DashboardLayoutState>()(
  devtools(
    persist(
      (set, get) => ({
        layouts: {},
        error: null,
        saveLayout: (userId, module, layouts, widgets) => set((state) => {
          const userLayouts = state.layouts[userId] || {};
          return {
            layouts: {
              ...state.layouts,
              [userId]: {
                ...userLayouts,
                [module]: { layouts, widgets }
              }
            },
            error: null
          };
        }, false, 'saveLayout'),
        getLayout: (userId, module) => {
          const state = get();
          return state.layouts[userId]?.[module] || null;
        },
        setError: (err) => set({ error: err }, false, 'setError')
      }),
      {
        name: 'hr-udan-dashboard-layouts'
      }
    ),
    { name: 'DashboardStore' }
  )
);
