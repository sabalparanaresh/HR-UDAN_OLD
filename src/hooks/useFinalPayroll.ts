import { useState, useEffect } from 'react';
import { fetchApi } from '../services/apiClient';

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
        const result = await fetchApi<any[]>('/api/payroll/get-final-payroll', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month }),
          signal: controller.signal
        });
        
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
