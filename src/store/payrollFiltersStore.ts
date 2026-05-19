import { create } from 'zustand';

interface PayrollFiltersState {
  filters: {
    selectedMonth: string;
    selectedDeptIds: number[];
    selectedLocationIds: number[];
    selectedGroupIds: number[];
    selectedDivisionIds: number[];
    selectedClassIds: number[];
    selectedCategoryIds: number[];
    selectedDesignationIds: number[];
    searchQuery: string;
    kLogicSource: 'EMPLOYEE_MASTER' | 'DESIGNATION_MASTER' | 'DAILY_MIS';
  };
  setFilters: (filters: Partial<PayrollFiltersState['filters']>) => void;
  resetFilters: () => void;
}

const defaultFilters = {
  selectedMonth: new Date().toISOString().slice(0, 7),
  selectedDeptIds: [],
  selectedLocationIds: [],
  selectedGroupIds: [],
  selectedDivisionIds: [],
  selectedClassIds: [],
  selectedCategoryIds: [],
  selectedDesignationIds: [],
  searchQuery: '',
  kLogicSource: 'EMPLOYEE_MASTER' as const,
};

export const usePayrollFiltersStore = create<PayrollFiltersState>((set) => ({
  filters: defaultFilters,
  setFilters: (newFilters) => 
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),
  resetFilters: () => 
    set(() => ({ filters: defaultFilters })),
}));
