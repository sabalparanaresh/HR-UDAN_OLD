import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invokeCommand as invoke } from '../../services/apiClient';
import { AgGridReact } from 'ag-grid-react';
import { 
  ModuleRegistry, 
  ClientSideRowModelModule,
  PaginationModule,
  ValidationModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule,
  CsvExportModule
} from 'ag-grid-community';
import { useSalaryColumnEngine } from '../../hooks/useSalaryColumnEngine';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';
import { useModule } from '../../contexts/ModuleContext';
import { toast } from 'sonner';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  PaginationModule,
  ValidationModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule,
  CsvExportModule
]);

export default function FinalPayrollView() {
  const { currentMode } = useModule();
  const [monthYear, setMonthYear] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const gridRef = useRef<AgGridReact>(null);

  const { columns: dynamicColumns, loading: columnsLoading } = useSalaryColumnEngine({
    moduleContext: currentMode === 'K' ? '*' : 'P', // In K, show everything, in P only statutory unless needed
    enableConditionalFormatting: true
  });

  useEffect(() => {
    const today = new Date();
    setMonthYear(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  const fetchData = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const records = await invoke<any[]>('export_final_payroll', { monthYear });
      setData(records);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `Final_Payroll_${monthYear}.csv`,
    });
  };

  useEffect(() => {
    if (monthYear) fetchData();
  }, [monthYear]);

  const handleConsolidate = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      await invoke('process_payroll', { month: monthYear });
      setSuccess('Consolidation Successful');
      fetchData();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      await invoke('lock_final_payroll', { monthYear });
      setSuccess('Payroll Locked Successfully');
      fetchData();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const isLocked = data.length > 0 && data[0].status === 'LOCKED';

  return (
    <div className="p-6 bg-white shadow-sm rounded-lg flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary-navy">Final Payroll Export</h1>
          <p className="text-sm text-text-muted">Dynamic reporting column engine. Auto-synced with Master Settings.</p>
        </div>
        <div className="flex gap-4 items-center">
          <input 
            type="month" 
            className="border p-2 rounded text-sm outline-none focus:border-blue-500"
            value={monthYear} 
            onChange={e => setMonthYear(e.target.value)} 
          />
          <button 
            onClick={fetchData} 
            disabled={loading || columnsLoading}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading || columnsLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          {!isLocked && (
            <button 
              onClick={handleConsolidate} 
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold text-sm"
            >
              Run Consolidation
            </button>
          )}
          {!isLocked && data.length > 0 && (
            <button 
              onClick={handleLock} 
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold shadow-sm flex items-center gap-2 text-sm"
            >
              🔒 Lock Month
            </button>
          )}
          {isLocked && (
            <span className="px-4 py-2 bg-red-100 text-red-800 rounded font-semibold border border-red-300 flex items-center gap-2 text-sm">
              🔒 LOCKED
            </span>
          )}
          <button 
            onClick={handleExport}
            disabled={loading || columnsLoading || data.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-semibold shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            <FileSpreadsheet size={16} /> Export CSV
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded border border-red-200 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-3 rounded border border-green-200 text-sm">{success}</div>}

      <div className="flex-1 w-full ag-theme-quartz min-h-[500px]">
        <AgGridReact
          ref={gridRef}
          theme="legacy"
          rowData={data}
          columnDefs={dynamicColumns}
          pagination={true}
          paginationPageSize={50}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            minWidth: 100,
          }}
          groupDefaultExpanded={-1}
          domLayout="normal"
        />
      </div>
    </div>
  );
}
