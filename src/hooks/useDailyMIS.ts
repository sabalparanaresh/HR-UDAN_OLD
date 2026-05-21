import { useState, useEffect, useCallback } from 'react';
import { invokeCommand as invoke, fetchApi } from '../services/apiClient';
import { toast } from 'sonner';

export interface DailyMISEntry {
  id?: number;
  date: string;
  emp_id: number;
  emp_code: string;
  name: string;
  master_designation: string;
  current_designation: string;
  standard_rate: number;
  worked_rate: number;
  variance: number;
  attendance_qty?: number;
}

export function useDailyMIS(date: string) {
  const [entries, setEntries] = useState<DailyMISEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const data = await fetchApi<DailyMISEntry[]>('/api/payroll/transaction/crud', { method: 'POST', body: JSON.stringify({
        operation: 'list',
        tableName: 'daily_mis_entries',
        filters: { date }
      }) });
      setEntries(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch MIS entries: ' + error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const saveBatch = async (batch: DailyMISEntry[]) => {
    setLoading(true);
    try {
      await fetchApi('/api/payroll/transaction/save-daily-mis-batch', { method: 'POST', body: JSON.stringify({
        date,
        entries: batch
      }) });
      toast.success('Batch saved successfully');
      await fetchEntries();
    } catch (error: any) {
      toast.error('Failed to save batch: ' + error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { entries, setEntries, loading, fetchEntries, saveBatch };
}
