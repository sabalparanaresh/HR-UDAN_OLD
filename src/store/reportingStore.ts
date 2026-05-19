import { create } from 'zustand';

export interface ReportingFilters {
  month: string;
  year: string;
  department: string;
  employee: string;
  category: string;
  division: string;
  contractor: string;
  shift: string;
  status: string;
}

interface ReportingState {
  activeDataSource: string | null;
  activeReportGroup: string | null;
  activeReport: string | null;
  filters: ReportingFilters;
  viewingReport: boolean;
  isSidebarOpen: boolean;
  
  setActiveDataSource: (source: string | null) => void;
  setActiveReportGroup: (group: string | null) => void;
  setActiveReport: (report: string | null) => void;
  setFilter: (key: keyof ReportingFilters, value: string) => void;
  setViewingReport: (viewing: boolean) => void;
  toggleSidebar: () => void;
  resetSelections: () => void;
}

export const useReportingStore = create<ReportingState>((set) => ({
  activeDataSource: null,
  activeReportGroup: null,
  activeReport: null,
  filters: {
    month: '',
    year: '',
    department: '',
    employee: '',
    category: '',
    division: '',
    contractor: '',
    shift: '',
    status: '',
  },
  viewingReport: false,
  isSidebarOpen: true,

  setActiveDataSource: (source) => set({ activeDataSource: source, activeReportGroup: null, activeReport: null, viewingReport: false }),
  setActiveReportGroup: (group) => set({ activeReportGroup: group, activeReport: null, viewingReport: false }),
  setActiveReport: (report) => set({ activeReport: report }),
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  setViewingReport: (viewing) => set({ viewingReport: viewing }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  resetSelections: () => set({ activeDataSource: null, activeReportGroup: null, activeReport: null, viewingReport: false }),
}));
