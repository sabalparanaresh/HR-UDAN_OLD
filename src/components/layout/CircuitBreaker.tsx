import React, { useEffect, useState } from 'react';
import { fetchApi } from '../../services/apiClient';
import { AlertCircle } from 'lucide-react';

export const CircuitBreaker = () => {
  const [status, setStatus] = useState<string>('CONNECTED');
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const currentStatus = await fetchApi<string>('/api/system/connection-status');
        const syncRes = await fetchApi<{ timestamp: string }>('/api/sync/last-sync-timestamp');
        if (isMounted && !controller.signal.aborted) {
          setStatus(currentStatus);
          if (syncRes && syncRes.timestamp) {
            setLastSync(syncRes.timestamp !== '1970-01-01T00:00:00Z' ? syncRes.timestamp : null);
          }
        }
      } catch (err) {
        console.error("Failed to check status:", err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s

    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  if (status !== 'DISCONNECTED') return null;

  const isReports = window.location.pathname.includes('/reports');

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 flex items-start gap-3 rounded-r-md shadow-sm">
      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <h3 className="text-amber-800 font-bold text-sm uppercase tracking-wider">Audit Mode — K Module Disconnected</h3>
        <p className="text-amber-700 text-sm mt-1">
          {isReports 
            ? `WARNING: Viewing reports in disconnected mode. Data is sourced from the last cached statutory snapshot.` 
            : `The system is currently operating in standalone Audit Mode. P Module is operating independently.`
          }
          {lastSync ? ` Last successful sync: ${new Date(lastSync).toLocaleString()}` : ''}
        </p>
      </div>
    </div>
  );
};
