import React, { useState, useEffect } from 'react';
import { invokeCommand as invoke } from '../../services/apiClient';
import { format } from 'date-fns';
import { AlertTriangle, Info, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function PayrollExceptions() {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchMonth, setSearchMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchExceptions();
  }, [searchMonth]);

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return { date: 'N/A', time: 'N/A' };
    let isoStr = dateStr;
    if (!isoStr.includes('T')) {
      isoStr = isoStr.replace(' ', 'T');
    }
    if (isoStr.includes('T') && !isoStr.endsWith('Z') && !isoStr.includes('+') && !isoStr.includes('-')) {
      isoStr += 'Z';
    }
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) {
      return { date: dateStr, time: '' };
    }
    try {
      return {
        date: format(d, 'dd MMM yyyy'),
        time: format(d, 'HH:mm:ss')
      };
    } catch (err) {
      return { date: dateStr, time: '' };
    }
  };

  const fetchExceptions = async () => {
    setLoading(true);
    try {
      const data = await invoke<any[]>('get_payroll_exceptions', { month: searchMonth });
      setExceptions(data || []);
    } catch (e: any) {
      toast.error('Failed to fetch exceptions: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-app-border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-primary-navy tracking-tight flex items-center gap-2">
            <AlertTriangle className="text-rose-500" />
            Payroll Exceptions
          </h1>
          <p className="text-sm font-medium text-text-muted mt-1">Review employees excluded from Daily MIS payroll due to data anomalies.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-app-border">
            <Calendar size={16} className="text-text-muted" />
            <input 
              type="month" 
              value={searchMonth} 
              onChange={(e) => setSearchMonth(e.target.value)}
              className="bg-transparent text-sm font-bold text-primary-navy outline-none"
            />
          </div>
          <button 
            onClick={fetchExceptions}
            className="px-4 py-2 bg-primary-navy text-white text-sm font-bold rounded-lg hover:bg-opacity-90 shadow-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-app-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-app-border">
                <th className="p-4 text-xs font-black text-text-muted uppercase tracking-widest">Date & Time</th>
                <th className="p-4 text-xs font-black text-text-muted uppercase tracking-widest">Employee</th>
                <th className="p-4 text-xs font-black text-text-muted uppercase tracking-widest">Exception Type</th>
                <th className="p-4 text-xs font-black text-text-muted uppercase tracking-widest">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-text-muted animate-pulse font-medium">Loading exceptions...</td>
                </tr>
              ) : exceptions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8">
                    <div className="flex flex-col items-center justify-center text-text-muted">
                      <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                        <Info className="text-emerald-500" size={24} />
                      </div>
                      <p className="font-bold text-primary-navy">No Exceptions Found</p>
                      <p className="text-sm">Great! All actuals calculated successfully without anomalies.</p>
                    </div>
                  </td>
                </tr>
              ) : exceptions.map(ex => {
                const dt = formatDateTime(ex.created_at);
                return (
                  <tr key={ex.id} className="border-b border-app-border hover:bg-slate-50 transition-colors">
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex flex-col text-sm">
                        <span className="font-bold text-primary-navy">{dt.date}</span>
                        {dt.time && (
                          <span className="text-xs text-text-muted font-mono mt-0.5">{dt.time}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-primary-navy">{ex.employee_name}</span>
                        <span className="text-xs font-mono text-text-muted mt-0.5">{ex.emp_code}</span>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-1 bg-rose-50 text-rose-700 text-xs font-black tracking-widest uppercase rounded">
                        {(ex.exception_type || '').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-medium text-text-muted max-w-md">
                      {ex.message}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
