import { create } from 'zustand';

interface AttendanceEntryState {
  filters: {
    fromDate: string;
    toDate: string;
    selectedEmpIds: number[];
    deptId: string[];
    locationId: string[];
    divisionId: string[];
    groupId: string[];
    categoryId: string[];
    classId: string[];
    designationId: string[];
    machineName: string[];
    punchesFilter: 'ALL' | 'MISSED';
  };
  setFilters: (filters: Partial<AttendanceEntryState['filters']>) => void;
  resetFilters: () => void;
}

const defaultFilters = {
  fromDate: new Date().toISOString().split('T')[0],
  toDate: new Date().toISOString().split('T')[0],
  selectedEmpIds: [],
  deptId: [],
  locationId: [],
  divisionId: [],
  groupId: [],
  categoryId: [],
  classId: [],
  designationId: [],
  machineName: [],
  punchesFilter: 'ALL' as const,
};

export const useAttendanceEntryStore = create<AttendanceEntryState>((set) => ({
  filters: defaultFilters,
  setFilters: (newFilters) => 
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),
  resetFilters: () => 
    set(() => ({ filters: defaultFilters })),
}));

