import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
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
}

export function useDailyMIS(date: string) {
  const [entries, setEntries] = useState<DailyMISEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const data = await invoke<DailyMISEntry[]>('transaction_crud', {
        operation: 'list',
        tableName: 'daily_mis_entries',
        filters: { date }
      });
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
      await invoke('save_daily_mis_batch', {
        date,
        entries: batch
      });
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
