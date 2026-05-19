import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { 
  ReportFilter, 
  ReportPagination, 
  ReportSort, 
  ReportGrouping, 
  ReportColumn, 
  ChartDatasetRequest 
} from '../types/ReportContracts';
import { FilterDTO } from '../types/ReportFilters';

export interface ReportGridPreferences {
  columns?: string[]; // Or ReportColumn[] if strictly full objects
  density?: 'compact' | 'standard' | 'comfortable';
}

export interface CalculatedColumn {
  field: string;
  name: string;
  formula: string;
}

export interface ReportState {
  baseTable: string;
  selectedCols: string[];
  calculatedCols?: CalculatedColumn[];
  filters: FilterDTO;
  pagination: ReportPagination;
  sorts: ReportSort[];
  grouping?: ReportGrouping;
  chartState?: ChartDatasetRequest;
  gridPreferences?: ReportGridPreferences;
}

export interface SavedTemplate {
  id: string;
  name: string;
  reportCode: string;
  state: ReportState;
}

export interface ExportJob {
  id: string;
  reportCode: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: string;
  progress?: number;
  downloadUrl?: string; // used if it's stored instead of immediate download
  error?: string;
  timestamp: string;
}

export interface ModuleReportState {
  activeState: Record<string, ReportState>; // Keyed by report code
  templates: SavedTemplate[];
  exportQueue: ExportJob[];
}

const defaultModuleState = (): ModuleReportState => ({
  activeState: {},
  templates: [],
  exportQueue: [],
});

const defaultReportState = (): ReportState => ({
  baseTable: 'employees',
  selectedCols: ['id', 'emp_code', 'name'],
  filters: {},
  pagination: { limit: 25, offset: 0 },
  sorts: [],
});

interface ReportStore {
  K: ModuleReportState;
  P: ModuleReportState;
  error: string | null;
  
  // Actions
  setReportState: (module: 'K' | 'P', reportCode: string, stateUpdate: Partial<ReportState>) => void;
  clearReportState: (module: 'K' | 'P', reportCode: string) => void;
  
  saveTemplate: (module: 'K' | 'P', template: SavedTemplate) => void;
  deleteTemplate: (module: 'K' | 'P', templateId: string) => void;
  applyTemplate: (module: 'K' | 'P', reportCode: string, templateId: string) => void;
  
  addExportJob: (module: 'K' | 'P', job: ExportJob) => void;
  updateExportJob: (module: 'K' | 'P', jobId: string, update: Partial<ExportJob>) => void;
  removeExportJob: (module: 'K' | 'P', jobId: string) => void;
  setError: (err: string | null) => void;
}

export const useReportStore = create<ReportStore>()(
  devtools(
    persist(
      (set, get) => ({
        K: defaultModuleState(),
        P: defaultModuleState(),
        error: null,

        setReportState: (module, reportCode, stateUpdate) => set((state) => {
          const modState = state[module];
          const existingState = modState.activeState[reportCode] || defaultReportState();
          return {
            [module]: {
              ...modState,
              activeState: {
                ...modState.activeState,
                [reportCode]: { ...existingState, ...stateUpdate }
              }
            },
            error: null
          };
        }, false, 'setReportState'),

        clearReportState: (module, reportCode) => set((state) => {
          const modState = state[module];
          const { [reportCode]: _, ...restActiveState } = modState.activeState;
          return {
            [module]: {
              ...modState,
              activeState: restActiveState
            },
            error: null
          };
        }, false, 'clearReportState'),

        saveTemplate: (module, template) => set((state) => {
          const modState = state[module];
          return {
            [module]: {
              ...modState,
              templates: [...modState.templates.filter(t => t.id !== template.id), template]
            },
            error: null
          };
        }, false, 'saveTemplate'),

        deleteTemplate: (module, templateId) => set((state) => {
          const modState = state[module];
          return {
            [module]: {
              ...modState,
              templates: modState.templates.filter(t => t.id !== templateId)
            },
            error: null
          };
        }, false, 'deleteTemplate'),

        applyTemplate: (module, reportCode, templateId) => set((state) => {
          const modState = state[module];
          const template = modState.templates.find(t => t.id === templateId);
          if (!template) return state;

          return {
            [module]: {
              ...modState,
              activeState: {
                ...modState.activeState,
                [reportCode]: template.state
              }
            },
            error: null
          };
        }, false, 'applyTemplate'),

        addExportJob: (module, job) => set((state) => {
          const modState = state[module];
          return {
            [module]: {
              ...modState,
              exportQueue: [job, ...modState.exportQueue]
            },
            error: null
          };
        }, false, 'addExportJob'),

        updateExportJob: (module, jobId, update) => set((state) => {
          const modState = state[module];
          return {
            [module]: {
              ...modState,
              exportQueue: modState.exportQueue.map(job => 
                job.id === jobId ? { ...job, ...update } : job
              )
            },
            error: null
          };
        }, false, 'updateExportJob'),

        removeExportJob: (module, jobId) => set((state) => {
          const modState = state[module];
          return {
            [module]: {
              ...modState,
              exportQueue: modState.exportQueue.filter(job => job.id !== jobId)
            },
            error: null
          };
        }, false, 'removeExportJob'),
        
        setError: (err) => set({ error: err }, false, 'setError')
      }),
      {
        name: 'hr-udan-report-store',
        partialize: (state) => ({
          K: { ...state.K, exportQueue: [] },
          P: { ...state.P, exportQueue: [] },
        }),
      }
    ),
    { name: 'ReportStore' }
  )
);
