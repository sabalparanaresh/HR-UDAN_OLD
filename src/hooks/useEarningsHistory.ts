import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/tauri';
import { useGlobalFilter } from '../store/useGlobalFilter';
import { useModule } from '../contexts/ModuleContext';
import { useState, useEffect } from 'react';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function useEarningsHistory(type: 'EARNING' | 'DEDUCTION', page: number = 1, limit: number = 100, employeeId: number | null = null) {
  const { currentMode } = useModule();
  const { wageMonth, wageYear, fromDate, toDate } = useGlobalFilter();

  const debouncedFilters = useDebounce({ wageMonth, wageYear, fromDate, toDate, page, limit, employeeId, type, currentMode }, 300);

  return useQuery({
    queryKey: [
      'earnings-history',
      debouncedFilters.type,
      debouncedFilters.currentMode,
      debouncedFilters.page,
      debouncedFilters.employeeId,
      debouncedFilters.wageMonth,
      debouncedFilters.wageYear,
      debouncedFilters.fromDate,
      debouncedFilters.toDate,
    ],
    queryFn: async () => {
      const result = await invoke<{ data: any[], total: number, page: number, limit: number }>('get_earning_history', {
        employeeId: debouncedFilters.employeeId,
        transactionType: debouncedFilters.type,
        wageMonth: debouncedFilters.wageMonth,
        wageYear: debouncedFilters.wageYear,
        fromDate: debouncedFilters.fromDate,
        toDate: debouncedFilters.toDate,
        page: debouncedFilters.page,
        limit: debouncedFilters.limit,
        moduleType: debouncedFilters.currentMode,
      });
      return result;
    },
  });
}
