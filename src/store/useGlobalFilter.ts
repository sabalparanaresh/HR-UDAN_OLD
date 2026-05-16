import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface GlobalFilterState {
  wageMonth: number | null;
  wageYear: number | null;
  fromDate: string | null;
  toDate: string | null;
  error: string | null;
  setWageFilter: (month: number | null, year: number | null) => void;
  setDateFilter: (from: string | null, to: string | null) => void;
  setError: (err: string | null) => void;
}

export const useGlobalFilter = create<GlobalFilterState>()(
  devtools(
    (set) => ({
      wageMonth: null,
      wageYear: null,
      fromDate: null,
      toDate: null,
      error: null,
      setWageFilter: (month, year) => set({ wageMonth: month, wageYear: year, fromDate: null, toDate: null, error: null }, false, 'setWageFilter'),
      setDateFilter: (from, to) => set({ fromDate: from, toDate: to, wageMonth: null, wageYear: null, error: null }, false, 'setDateFilter'),
      setError: (err) => set({ error: err }, false, 'setError')
    }),
    { name: 'GlobalFilterStore' }
  )
);
