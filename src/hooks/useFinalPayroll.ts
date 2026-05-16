import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

export const useFinalPayroll = (month: string, enabled: boolean = true) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !month) return;

    let isMounted = true;
    const controller = new AbortController();

    const fetchFinalPayroll = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<any[]>('get_final_payroll', { month });
        
        if (isMounted && !controller.signal.aborted) {
          setData(result);
        }
      } catch (err: any) {
        if (isMounted && !controller.signal.aborted) {
          setError(err.toString());
        }
      } finally {
        if (isMounted && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchFinalPayroll();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [month, enabled]);

  return { data, loading, error };
};
