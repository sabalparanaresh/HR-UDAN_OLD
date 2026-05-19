import { create } from 'zustand';

interface AdvanceFiltersState {
  filters: {
    wageMonth: string;
    fromDate: string;
    toDate: string;
    locationFilters: number[];
    divisionFilters: number[];
    departmentFilters: number[];
    groupFilters: number[];
    classFilters: number[];
    categoryFilters: number[];
    designationFilters: number[];
    searchTerm: string;
  };
  setFilters: (filters: Partial<AdvanceFiltersState['filters']>) => void;
  resetFilters: () => void;
}

const defaultFilters = {
  wageMonth: '',
  fromDate: '',
  toDate: '',
  locationFilters: [],
  divisionFilters: [],
  departmentFilters: [],
  groupFilters: [],
  classFilters: [],
  categoryFilters: [],
  designationFilters: [],
  searchTerm: '',
};

export const useAdvanceFiltersStore = create<AdvanceFiltersState>((set) => ({
  filters: defaultFilters,
  setFilters: (newFilters) => 
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),
  resetFilters: () => 
    set(() => ({ filters: defaultFilters })),
}));
