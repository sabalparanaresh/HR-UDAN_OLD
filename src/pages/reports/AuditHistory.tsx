import React, { useState, useEffect } from 'react';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import { useModule } from '../../contexts/ModuleContext';
import { ShieldCheck, Calendar, User, FileText, Search, Activity, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  user_id: number;
  action: string;
  entity: string;
  entity_id: string;
  details: string;
  created_at: string;
}

export default function AuditHistory() {
  const { currentMode, isConnected } = useModule();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAuditLogs();
  }, [currentMode, isConnected]);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      // Re-use execute_report_query for audit_logs since we whitelisted it!
      const req = {
        base_table: "audit_logs",
        module_type: currentMode,
        columns: [{ field: "*" }],
        filters: [], // Add potential date filters here
        sorts: [{ field: "created_at", direction: "DESC" }],
        author: "system"
      };
      
      const res: any = await fetchApi('/api/system/cmd/executeReportQuery', { method: 'POST', body: JSON.stringify(req) });
      setLogs(res.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch audit logs");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
      const s = searchTerm.toLowerCase();
      return log.action.toLowerCase().includes(s) || 
             log.entity.toLowerCase().includes(s) || 
             (log.details && log.details.toLowerCase().includes(s)) ||
             log.id.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Audit History</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Reports & Analytics // User Activity Logs</p>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-border-light flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
                type="text"
                placeholder="Search logs by action, entity, details..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
        </div>
        <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium border border-blue-100 flex items-center gap-2">
                <ShieldCheck size={16} />
                Immutable {currentMode} Module Logs
            </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-border-light overflow-hidden">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-text-muted">
            <Activity className="w-12 h-12 mb-4 opacity-20" />
            <p>No audit logs matching your criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/50 text-text-muted font-medium">
                <tr>
                  <th className="px-6 py-4">Audit ID</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Entity / Target</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{log.id}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-md border border-gray-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-primary-navy">
                      {log.entity} / {log.entity_id}
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate overflow-hidden" title={log.details}>
                        {log.details}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                        {log.created_at ? format(new Date(log.created_at), 'dd MMM yyyy, HH:mm:ss') : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
