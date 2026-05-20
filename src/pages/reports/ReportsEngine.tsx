import { usePermission } from '../../hooks/useRBAC';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  BarChart, 
  Settings, 
  Save, 
  Filter,
  Columns as ColumnsIcon,
  Database,
  History,
  MonitorPlay,
  FileSpreadsheet,
  CalendarClock,
  Trash2,
  Power,
  HardDriveDownload
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { 
  ModuleRegistry, 
  InfiniteRowModelModule, 
  ClientSideRowModelModule,
  ValidationModule,
  PaginationModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule,
  CsvExportModule
} from 'ag-grid-community';
import { useModule } from '../../contexts/ModuleContext';
import { withModuleGuard } from '../../components/layout/ModuleGuard';
import { invokeCommand as invoke } from '../../services/apiClient';
import { toast } from 'sonner';

import { ReportFilterEngine } from '../../components/reports/ReportFilterEngine';
import { formulaEngine } from '../../utils';
import { FilterDTO, serializeToBackendFilters } from '../../types/ReportFilters';
import { useReportStore } from '../../store/useReportStore';
import { DistributionModal } from '../../components/reports/DistributionModal';
import { FormulaBuilderModal } from '../../components/reports/FormulaBuilderModal';
import CachedStatutoryWarningBanner from '../../components/layout/CachedStatutoryWarningBanner';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  InfiniteRowModelModule,
  PaginationModule,
  ValidationModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule,
  CsvExportModule
]);

const TABLES = [
  { id: 'employees', name: 'Employee Master', cols: ['id', 'emp_code', 'name', 'department_id', 'designation_id', 'status', 'created_at'] },
  { id: 'final_payroll', name: 'Final Payroll / Processed Data', cols: ['id', 'emp_code', 'name', 'department', 'designation', 'month_year', 'wage_type', 'k_gross_payable', 'k_net_payable', 'p_gross_statutory_payable', 'net_payable_final', 'k_attendance', 'p_attendance', 'working_days', 'status'] },
  { id: 'salary_transactions', name: 'Salary Transactions', cols: ['id', 'emp_id', 'transaction_type', 'salary_month_year', 'amount', 'created_at'] },
  { id: 'attendance_logs', name: 'Attendance Logs', cols: ['id', 'emp_id', 'date', 'total_time_mins', 'worked_mins'] },
  { id: 'cash_transactions', name: 'Cash Register', cols: ['id', 'emp_id', 'wage_month', 'type', 'total_amount', 'paid_amount', 'balance_amount', 'status'] },
  { id: 'emp_snapshot', name: '[Analytics] Employee Snapshot', cols: ['id', 'emp_code', 'name', 'status', 'wage_type', 'department_name', 'designation_name', 'department_id', 'designation_id', 'location_id', 'category_id', 'division_id', 'group_id', 'class_id', 'employment_type_id', 'shift_id'] },
  { id: 'monthly_trend', name: '[Analytics] Monthly Salary Trends', cols: ['month_year', 'gross_salaryK', 'gross_salaryP', 'net_salary', 'emp_count'] },
  { id: 'salary_pivot', name: '[Analytics] Salary Component Pivot', cols: ['emp_id', 'salary_month_year', 'CREDIT', 'DEBIT', 'LOAN', 'ADVANCE'] },
];

const REPORT_CODE = 'GENERAL_REPORTING';

function ReportsEngine({ currentUser }: { currentUser: any }) {
  const { currentMode, isConnected } = useModule();
  const [templates, setTemplates] = useState<any[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<any | null>(null);
  
  const reportStore = useReportStore();
  const moduleState = currentMode === 'P' ? reportStore.P : reportStore.K;
  const activeState = moduleState.activeState[REPORT_CODE] || {
    baseTable: 'employees',
    selectedCols: ['id', 'emp_code', 'name'],
    calculatedCols: [],
    filters: { status: 'ACTIVE', module_type: currentMode as any },
    pagination: { limit: 25, offset: 0 },
    sorts: []
  };

  const { baseTable, selectedCols, calculatedCols = [], filters: appliedFilters, pagination } = activeState;
  
  const setStoreState = (update: Partial<typeof activeState>) => {
    reportStore.setReportState(currentMode, REPORT_CODE, update);
  };
  
  const [data, setData] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const gridRef = useRef<AgGridReact>(null);

  const [drilldownData, setDrilldownData] = useState<any>(null);

  // Template Save Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDesc, setSaveTemplateDesc] = useState("");
  const [saveTemplateIsSystem, setSaveTemplateIsSystem] = useState(false);
  const [saveTemplateRoles, setSaveTemplateRoles] = useState<string[]>([]);
  
  // Scheduling State
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleCron, setScheduleCron] = useState("0 0 * * *");
  const [scheduleHistory, setScheduleHistory] = useState<any[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [activeScheduleId, setActiveScheduleId] = useState<string|null>(null);

  // Distribution State
  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);

  const hasExportAccess = usePermission('ReportsEngine.export');
  
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
    fetchSchedules();
    
    if (currentMode === 'K' && !isConnected) {
      invoke('master_crud', { operation: 'get_last_sync_time' })
        .then((res: any) => setLastSyncTime(res?.timestamp || 'Unknown'))
        .catch(() => setLastSyncTime('Unknown'));
    }
  }, [currentMode, isConnected]);

  /* .... Effects .... */

  const fetchTemplates = async () => {
    try {
      const resp = await invoke('get_report_templates', { module_type: currentMode }) as any[];
      setTemplates(resp);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSchedules = async () => {
    try {
      const resp = await invoke('get_report_schedules', { module_type: currentMode }) as any[];
      setSchedules(resp);
    } catch (e) {
      console.error(e);
    }
  };

  const submitSchedule = async () => {
    if (!activeTemplate) {
      toast.error("Please load a template first");
      return;
    }
    try {
      await invoke('create_report_schedule', {
        name: `${activeTemplate.name} Schedule`,
        template_id: activeTemplate.id,
        module_type: currentMode,
        schedule_cron: scheduleCron,
        user: currentUser?.username || 'system'
      });
      toast.success("Schedule created successfully");
      setIsScheduleModalOpen(false);
      fetchSchedules();
    } catch (e: any) {
      toast.error(e.message || "Failed to create schedule");
    }
  };

  const toggleSchedule = async (id: string, e: any) => {
    e.stopPropagation();
    try { await invoke('toggle_report_schedule', { id, module_type: currentMode }); fetchSchedules(); } catch(e){}
  };

  const deleteSchedule = async (id: string, e: any) => {
    e.stopPropagation();
    try { await invoke('delete_report_schedule', { id, module_type: currentMode }); fetchSchedules(); } catch(e){}
  };
  
  const openHistory = async (id: string) => {
    try {
      const resp = await invoke('get_report_schedule_history', { schedule_id: id, module_type: currentMode }) as any[];
      setScheduleHistory(resp);
      setActiveScheduleId(id);
      setIsHistoryModalOpen(true);
    } catch(e: any) {
      toast.error("Failed to fetch history");
    }
  };

  const visibleTemplates = useMemo(() => {
    return templates.filter(t => {
      // System defaults are visible to all
      if (t.is_system === 1) return true;
      // Creator can see their own templates
      if (t.created_by === currentUser?.username) return true;
      // Share by role
      if (t.shared_with_roles && currentUser?.role) {
         const roles = t.shared_with_roles.split(',').map((r: string) => r.trim().toUpperCase());
         if (roles.includes(currentUser.role.toUpperCase())) return true;
      }
      return false;
    });
  }, [templates, currentUser]);

  const saveSnapshot = async () => {
    if (!hasExportAccess) {
       toast.error("Access Denied for snapshots");
       return;
    }
    setLoading(true);
    try {
      await invoke('save_report_snapshot', {
        template_id: activeTemplate?.id || `TEMP-${baseTable}`,
        module_type: currentMode,
        base_table: baseTable,
        data: null
      });
      toast.success("Snapshot saved successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save snapshot");
    } finally {
      setLoading(false);
    }
  };

  const executeReport = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.purgeInfiniteCache();
    }
  }, []);

  const onGridReady = useCallback((params: any) => {
    const dataSource = {
      getRows: async (rowParams: any) => {
        try {
          const limit = rowParams.endRow - rowParams.startRow;
          const offset = rowParams.startRow;
          
          const colsObj = selectedCols.map((c: string) => ({ field: c }));
          const filtersArr = serializeToBackendFilters(appliedFilters);
          
          // Map AG Grid Sort Model
          const sorts = rowParams.sortModel ? rowParams.sortModel.map((s: any) => ({
            field: s.colId,
            direction: s.sort.toUpperCase()
          })) : [];

          const req = {
            base_table: baseTable,
            module_type: currentMode,
            columns: colsObj,
            filters: filtersArr.filter(f => f && f.value !== '' && f.value != null),
            pagination: { limit, offset },
            sorts: sorts
          };
          
          let res;
          if (!isConnected && currentMode === 'K') {
             try {
               const snapRes = await invoke('get_report_snapshots', { template_id: 'SYSTEM_P_SYNC', module_type: 'P' }) as any[];
               if (snapRes && snapRes.length > 0) {
                  const snapData = await invoke('get_report_snapshot_data', { snapshot_id: snapRes[0].id, module_type: 'P' }) as any[];
                  res = { data: snapData.slice(offset, offset + limit), total: snapData.length };
               } else {
                 res = await invoke('execute_report_query', req) as any;
               }
             } catch(e) {
                 res = await invoke('execute_report_query', req) as any;
             }
          } else {
            res = await invoke('execute_report_query', req) as any;
          }

          setTotalRows(res?.total || 0);
          rowParams.successCallback(res?.data || [], res?.total || 0);
        } catch (e: any) {
          console.error("Query failed", e);
          toast.error(e.message || "Query failed");
          rowParams.failCallback();
        }
      }
    };
    params.api.setGridOption('datasource', dataSource);
  }, [baseTable, selectedCols, appliedFilters, currentMode, isConnected]);

  useEffect(() => {
    executeReport();
  }, [baseTable, selectedCols, appliedFilters, currentMode, executeReport]);

  const handleSaveTemplate = () => {
    setSaveTemplateName("");
    setSaveTemplateDesc("");
    setSaveTemplateIsSystem(false);
    setSaveTemplateRoles([]);
    setIsSaveModalOpen(true);
  };

  const submitSaveTemplate = async () => {
    if (!saveTemplateName.trim()) {
      toast.error("Template name is required");
      return;
    }

    try {
      const colState = gridRef.current?.api?.getColumnState();
      const filterModel = gridRef.current?.api?.getFilterModel();
      const chartModels = gridRef.current?.api?.getChartModels() || [];
      
      const colsToSave = colState && colState.length > 0 
          ? colState.map((c: any) => ({ ...c, field: c.colId })) 
          : selectedCols.map((c: string) => ({ field: c }));

      const gridConfig = {
        columnState: colState,
        filterModel: filterModel,
        chartModels: chartModels,
        pivotMode: gridRef.current?.api?.isPivotMode()
      };

      await invoke('save_report_template', {
        name: saveTemplateName,
        description: saveTemplateDesc,
        base_table: baseTable,
        columns: colsToSave,
        filters: appliedFilters,
        config: gridConfig,
        is_system: saveTemplateIsSystem,
        shared_with_roles: saveTemplateRoles,
        module_type: currentMode,
        user: currentUser?.username || 'system'
      });
      toast.success("Template saved");
      setIsSaveModalOpen(false);
      fetchTemplates();
    } catch (e: any) {
      toast.error(e.message || "Failed to save template");
    }
  };

  const agColumns = useMemo(() => {
    const standardCols = selectedCols.map((col: string) => {
      const isNumeric = ['amount', 'salary', 'payable', 'deductions', 'rate', 'count', 'mins', 'days', 'balance', 'CREDIT', 'DEBIT', 'LOAN', 'ADVANCE'].some(k => col.toLowerCase().includes(k.toLowerCase()));
      return {
        field: col,
        headerName: col.toUpperCase().replace(/_/g, ' '),
        filter: true,
        sortable: true,
        cellClassRules: isNumeric ? {
          'text-green-600 font-medium': 'x > 0',
          'text-red-600 font-medium': 'x < 0'
        } : undefined
      };
    });

    const calcCols = calculatedCols.map(calc => ({
        field: calc.field,
        headerName: calc.name || calc.field,
        filter: true,
        sortable: true,
        valueGetter: (params: any) => {
            if (!params.data) return null;
            return formulaEngine.evaluate(calc.formula, params.data);
        },
        cellClassRules: {
            'text-green-600 font-medium': 'x > 0',
            'text-red-600 font-medium': 'x < 0',
            'text-purple-600 font-bold': 'true'
        }
    }));

    return [...standardCols, ...calcCols];
  }, [selectedCols, calculatedCols]);

  const handleExportDataExcel = useCallback(async () => {
    if (!hasExportAccess) {
      toast.error("Export Access Denied.");
      return;
    }
    
    const jobId = `exp_${Date.now()}`;
    reportStore.addExportJob(currentMode, {
      id: jobId,
      reportCode: REPORT_CODE,
      status: 'pending',
      format: 'EXCEL',
      timestamp: new Date().toISOString()
    });

    setLoading(true);
    try {
      reportStore.updateExportJob(currentMode, jobId, { status: 'processing' });
      const password = prompt("Enter a password to protect the Excel file (or leave blank for no password):");
      const filtersArr = serializeToBackendFilters(appliedFilters);
      
      const req = {
        reportName: `Report_${baseTable}_${currentMode}`,
        base_table: baseTable,
        module_type: currentMode,
        columns: selectedCols.map((c: string) => ({ field: c })),
        calculatedCols: calculatedCols,
        filters: filtersArr.filter(f => f && f.value !== '' && f.value != null),
        sorts: [],
        password: password || undefined,
        author: currentUser?.username || 'system'
      };
      
      const res = await invoke('generate_enterprise_excel', req) as any;
      
      if (res && res.status === 'success' && res.base64) {
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || `${req.reportName}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        reportStore.updateExportJob(currentMode, jobId, { status: 'completed' });
        toast.success("Enterprise Excel Export Successful");
      } else {
        reportStore.updateExportJob(currentMode, jobId, { status: 'failed', error: 'Invalid response from server' });
      }
    } catch (e: any) {
      console.error(e);
      reportStore.updateExportJob(currentMode, jobId, { status: 'failed', error: e.message || 'Export failed' });
      toast.error(e.message || "Export failed");
    } finally {
      setLoading(false);
    }
  }, [hasExportAccess, currentMode, baseTable, currentUser, appliedFilters, selectedCols, reportStore]);

  const loadTemplate = (t: any) => {
    setActiveTemplate(t);
    let newFilters = t.filters;
    if (Array.isArray(t.filters)) {
      newFilters = { status: 'ACTIVE', module_type: currentMode as any, custom_filters: t.filters };
    }
    setStoreState({
      baseTable: t.base_table,
      selectedCols: t.columns.map((c: any) => c.field || c.colId),
      filters: newFilters,
      pagination: { ...pagination, offset: 0 }
    });
    setTimeout(() => {
        if (gridRef.current?.api) {
            if (t.config?.columnState) {
                gridRef.current.api.applyColumnState({ state: t.config.columnState, applyOrder: true });
            } else if (t.columns && t.columns[0]?.colId) {
                gridRef.current.api.applyColumnState({ state: t.columns, applyOrder: true });
            }
            
            if (t.config?.filterModel) {
                gridRef.current.api.setFilterModel(t.config.filterModel);
            }
            
            if (t.config?.pivotMode !== undefined) {
               (gridRef.current.api as any).setPivotMode?.(t.config.pivotMode);
            }
            
            if (t.config?.chartModels && t.config.chartModels.length > 0) {
               setTimeout(() => {
                 if (gridRef.current?.api) {
                   t.config.chartModels.forEach((model: any) => {
                     gridRef.current!.api!.restoreChart(model);
                   });
                 }
               }, 500); // Wait for data to load
            }
        }
    }, 500);
  };

  const availableCols = useMemo(() => {
     return TABLES.find(t => t.id === baseTable)?.cols || [];
  }, [baseTable]);

  const toggleColumn = (col: string) => {
    if (selectedCols.includes(col)) {
      setStoreState({ selectedCols: selectedCols.filter((c: string) => c !== col) });
    } else {
      setStoreState({ selectedCols: [...selectedCols, col] });
    }
  };

  const onRowClicked = (e: any) => {
    setDrilldownData(e.data);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CachedStatutoryWarningBanner />
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header flex items-center gap-3 text-primary-navy">
            <BarChart size={32} className="text-blue-600" />
            Modular Reporting Engine
          </h2>
          <p className="text-sm font-mono text-text-muted mt-1 uppercase tracking-widest flex items-center gap-2">
            Module Context: {currentMode} 
          </p>
        </div>
        <div className="flex gap-2">
           <button onClick={handleSaveTemplate} className="flex items-center gap-2 bg-white border border-app-border text-primary-navy px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm">
             <Save size={16} /> Save Template
           </button>
           {activeTemplate && hasExportAccess && (
             <button onClick={() => setIsScheduleModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm opacity-90">
               <CalendarClock size={16} /> Schedule Export
             </button>
           )}
           <button onClick={() => {
              if (!hasExportAccess) { toast.error("Distribution Access Denied."); return; }
              setIsDistributionModalOpen(true);
           }} disabled={!hasExportAccess} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors shadow-sm opacity-90 disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500">
             <HardDriveDownload size={16} /> Distribute...
           </button>
           <button onClick={saveSnapshot} disabled={!hasExportAccess} className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors shadow-sm opacity-90 disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500">
             <Database size={16} /> Snapshot
           </button>
           <button onClick={handleExportDataExcel} disabled={!hasExportAccess} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm opacity-90 disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500">
             <FileSpreadsheet size={16} /> Export Excel
           </button>
        </div>
      </div>

      {currentMode === 'K' && !isConnected && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-yellow-800">
                AUDIT MODE ACTIVE - K MODULE DISCONNECTED
              </h3>
              <div className="mt-1 text-sm text-yellow-700">
                <p>
                  Any P (Statutory) related data shown in these reports is using a cached snapshot. Last recorded sync timestamp: <span className="font-bold">{lastSyncTime || 'Unknown'}</span>. Disconnect/Reconnect to update.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar Templates & Builder */}
        <div className="lg:col-span-1 space-y-4">
           {/* Data Source Selector */}
           <div className="textile-card p-4 space-y-3">
             <h3 className="text-xs font-black uppercase tracking-widest text-primary-navy border-b border-app-border pb-2 flex items-center gap-2">
               <Database size={14}/> Data Source
             </h3>
             <select 
               value={baseTable}
               onChange={e => {
                 setStoreState({ baseTable: e.target.value, selectedCols: ['id'], pagination: { ...pagination, offset: 0 } });
               }}
               className="w-full bg-slate-50 border border-app-border rounded-lg text-sm p-2 outline-none focus:border-blue-500 font-mono"
             >
               {TABLES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
             </select>
           </div>

           {/* Column Builder */}
           <div className="textile-card p-4 space-y-3">
             <h3 className="text-xs font-black uppercase tracking-widest text-primary-navy border-b border-app-border pb-2 flex items-center gap-2">
               <ColumnsIcon size={14}/> Columns Config
             </h3>
             <div className="max-h-48 overflow-y-auto space-y-1">
                {availableCols.map(col => (
                  <label key={col} className="flex items-center gap-2 text-xs font-mono px-2 py-1 hover:bg-slate-50 rounded cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={selectedCols.includes(col)}
                      onChange={() => toggleColumn(col)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    {col}
                  </label>
                ))}
             </div>
           </div>

           {/* Calculated Columns */}
           <div className="textile-card p-4 space-y-3">
             <div className="flex items-center justify-between border-b border-app-border pb-2">
                 <h3 className="text-xs font-black uppercase tracking-widest text-primary-navy flex items-center gap-2">
                   Calculated Columns
                 </h3>
                 <button onClick={() => setIsFormulaModalOpen(true)} className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 hover:bg-slate-200 uppercase font-bold tracking-wider">
                   + Add
                 </button>
             </div>
             <div className="space-y-2">
                {calculatedCols.length === 0 ? (
                  <div className="text-xs text-slate-400 italic py-2 text-center">No calculated columns</div>
                ) : (
                  calculatedCols.map(calc => (
                    <div key={calc.field} className="flex items-center justify-between gap-2 text-xs p-2 bg-slate-50 rounded border border-slate-100">
                      <div>
                        <div className="font-bold text-slate-700">{calc.name}</div>
                        <div className="font-mono text-[9px] text-slate-500 truncate max-w-[150px]" title={calc.formula}>{calc.formula}</div>
                      </div>
                      <button 
                         onClick={() => setStoreState({ calculatedCols: calculatedCols.filter(c => c.field !== calc.field) })}
                         className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
             </div>
           </div>

           {/* Saved Templates */}
           <div className="textile-card p-4 space-y-3">
             <h3 className="text-xs font-black uppercase tracking-widest text-primary-navy border-b border-app-border pb-2 flex items-center gap-2">
               <History size={14}/> Saved Templates
             </h3>
             <div className="space-y-2 max-h-48 overflow-y-auto">
               {visibleTemplates.length === 0 && <p className="text-[10px] text-slate-400 italic">No templates found.</p>}
               {visibleTemplates.map(t => (
                 <div key={t.id} onClick={() => loadTemplate(t)} className={`p-2 rounded border cursor-pointer transition-colors relative ${activeTemplate?.id === t.id ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-app-border hover:bg-slate-100'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-bold text-slate-800 break-words pr-2">{t.name}</p>
                      {t.is_system === 1 && <span className="shrink-0 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[8px] font-bold uppercase rounded">System</span>}
                      {t.is_system !== 1 && t.shared_with_roles && <span className="shrink-0 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-bold uppercase rounded">Shared</span>}
                    </div>
                    {t.description && <p className="text-[10px] text-slate-500 mb-1">{t.description}</p>}
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">{t.base_table} • {t.columns?.length} cols</p>
                 </div>
               ))}
             </div>
           </div>

           {/* Active Schedules */}
           {schedules.length > 0 && (
             <div className="textile-card p-4 space-y-3">
               <h3 className="text-xs font-black uppercase tracking-widest text-primary-navy border-b border-app-border pb-2 flex items-center gap-2">
                 <CalendarClock size={14}/> Schedules
               </h3>
               <div className="space-y-2 max-h-48 overflow-y-auto">
                 {schedules.map(sch => (
                   <div key={sch.id} className="p-2 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                     <div className="flex justify-between items-start">
                        <p className="font-bold">{sch.name}</p>
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => toggleSchedule(sch.id, e)} className={`${sch.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'} hover:opacity-80`} title="Toggle Status"><Power size={12}/></button>
                          <button onClick={(e) => deleteSchedule(sch.id, e)} className="text-rose-500 hover:opacity-80" title="Delete"><Trash2 size={12}/></button>
                        </div>
                     </div>
                     <p className="text-[10px] text-slate-500 font-mono">Cron: {sch.schedule_cron}</p>
                     <p className="text-[10px] text-slate-500">Next: {sch.next_run ? new Date(sch.next_run).toLocaleString() : 'N/A'}</p>
                     <button onClick={() => openHistory(sch.id)} className="text-[10px] text-blue-600 font-bold hover:underline">View History</button>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* Export Jobs */}
           {moduleState.exportQueue.length > 0 && (
             <div className="textile-card p-4 space-y-3">
               <h3 className="text-xs font-black uppercase tracking-widest text-primary-navy border-b border-app-border pb-2 flex items-center gap-2">
                 <MonitorPlay size={14}/> Export Jobs
               </h3>
               <div className="space-y-2 max-h-48 overflow-y-auto">
                 {moduleState.exportQueue.slice(0, 5).map(job => (
                   <div key={job.id} className="p-2 rounded border bg-slate-50 border-app-border text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">{job.format} Export</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          job.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                          'bg-blue-100 text-blue-700 animate-pulse'
                        }`}>
                          {job.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">
                        {new Date(job.timestamp).toLocaleTimeString()}
                      </p>
                      {job.error && <p className="text-[10px] text-rose-600 mt-1 truncate">{job.error}</p>}
                   </div>
                 ))}
               </div>
             </div>
           )}

        </div>

        {/* Main Reporting Area */}
        <div className="lg:col-span-3 space-y-4">
           {/* Report Filter Engine (Horizontal layout at top) */}
           <div className="textile-card p-4">
              <h3 className="text-sm font-bold text-primary-navy mb-4 border-b border-app-border pb-2 flex items-center gap-2">
                <Filter size={18} /> Advanced Filter Engine
              </h3>
              <ReportFilterEngine 
                onApplyFilters={(filters) => setStoreState({ filters, pagination: { ...pagination, offset: 0 } })} 
                defaultValues={appliedFilters}
                availableCols={availableCols}
                showDateRange={true}
                showMonthYear={true}
              />
           </div>
                      <div className="textile-card p-0 flex flex-col h-[600px]">
              <div className="bg-slate-900 px-4 py-3 flex justify-between items-center text-white shrink-0">
                <div className="flex items-center gap-3">
                  <MonitorPlay size={18} className="text-blue-400" />
                  <span className="font-mono text-xs uppercase tracking-widest font-black">Runtime Analytics Engine (AG Grid)</span>
                  {loading && <span className="text-[10px] text-blue-300 animate-pulse">Running queries...</span>}
                </div>
                <div className="flex items-center gap-4">
                  <select 
                    value={pagination.limit} 
                    onChange={e => {
                       setStoreState({ pagination: { ...pagination, limit: Number(e.target.value), offset: 0 } });
                    }}
                    className="bg-slate-800 text-xs border border-slate-700 rounded px-2 py-1 outline-none font-mono text-white"
                  >
                    <option value={100}>100 Rows</option>
                    <option value={1000}>1,000 Rows</option>
                    <option value={5000}>5,000 Rows</option>
                    <option value={50000}>50,000 Rows (Full)</option>
                  </select>
                  <div className="text-[10px] font-mono text-slate-400">
                     <span>FETCHED: {data.length} / {totalRows > pagination.limit ? `(${pagination.limit} max)` : totalRows}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 w-full ag-theme-quartz" style={{ height: '100%' }}>
                  <AgGridReact
                    ref={gridRef}
                    theme="legacy"
                    rowModelType="infinite"
                    onGridReady={onGridReady}
                    columnDefs={agColumns}
                    rowSelection="multiple"
                    onRowClicked={onRowClicked}
                    pagination={true}
                    paginationPageSize={100}
                    cacheBlockSize={100}
                    paginationPageSizeSelector={[25, 50, 100, 500, 1000]}
                    domLayout="normal"
                  />
              </div>

           </div>

           {/* Drilldown Area */}
           {drilldownData && (
              <div className="textile-card p-4 space-y-3 bg-blue-50/50">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary-navy border-b border-blue-200 pb-2">
                  Drill-Down Details (Record ID: {drilldownData.id})
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(drilldownData).map(([key, val]) => (
                    <div key={key}>
                      <span className="text-[10px] uppercase font-mono text-slate-500 block">{key}</span>
                      <span className="text-xs font-medium text-slate-800 break-words">{String(val)}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setDrilldownData(null)} className="text-[10px] bg-white border border-slate-300 px-3 py-1 rounded text-slate-600 hover:bg-slate-100">
                  Close Drilldown
                </button>
              </div>
           )}

        </div>
      </div>

      {/* Save Template Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Save Report Template</h3>
              <button onClick={() => setIsSaveModalOpen(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Template Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={saveTemplateName}
                  onChange={e => setSaveTemplateName(e.target.value)}
                  className="w-full text-sm border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  placeholder="e.g., Monthly Overtime Report"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  value={saveTemplateDesc}
                  onChange={e => setSaveTemplateDesc(e.target.value)}
                  className="w-full text-sm border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  placeholder="Brief description of the report's purpose"
                  rows={2}
                />
              </div>

              {false /* usePermission handles this */ && (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isSystemTemplate"
                      checked={saveTemplateIsSystem}
                      onChange={e => setSaveTemplateIsSystem(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="isSystemTemplate" className="text-xs font-medium text-slate-700">
                      Mark as System Default Template
                    </label>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Share with Roles (comma separated)</label>
                    <input
                      type="text"
                      value={saveTemplateRoles.join(', ')}
                      onChange={e => setSaveTemplateRoles(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      className="w-full text-sm border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      placeholder="e.g., HR_MANAGER, AUDITOR"
                      disabled={saveTemplateIsSystem}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Leave empty to keep it private.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitSaveTemplate}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Schedule Report</h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <div className="p-4 space-y-4 flex-1">
              <p className="text-xs text-slate-600 mb-2 font-medium">Template: {activeTemplate?.name}</p>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cron Expression <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={scheduleCron}
                  onChange={e => setScheduleCron(e.target.value)}
                  className="w-full text-sm border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500 shadow-sm font-mono"
                  placeholder="0 0 1 * *"
                />
                <p className="text-[10px] text-slate-500 mt-1">Format: min hour dom month dow (e.g., * * * * * for every minute)</p>
              </div>
            </div>
    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
              <button onClick={() => setIsScheduleModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
              <button onClick={submitSchedule} className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Create Schedule</button>
            </div>
          </div>
        </div>
      )}

      {/* Formula Builder Modal */}
      <FormulaBuilderModal
        isOpen={isFormulaModalOpen}
        onClose={() => setIsFormulaModalOpen(false)}
        availableCols={availableCols}
        onSave={(calc) => setStoreState({ calculatedCols: [...calculatedCols, calc] })}
      />

      {/* Distribution Modal */}
      <DistributionModal
        isOpen={isDistributionModalOpen}
        onClose={() => setIsDistributionModalOpen(false)}
        reportName={activeTemplate?.name || 'Custom_Report'}
        baseTable={baseTable}
        columns={selectedCols.map((c: any) => ({ field: c }))}
        calculatedCols={calculatedCols}
        filters={serializeToBackendFilters(appliedFilters)}
        sorts={activeState.sorts}
        currentUser={currentUser}
      />

      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-2/3">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Schedule Execution History</h3>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                  <tr>
                    <th className="p-3 border-b border-slate-200">Date/Time</th>
                    <th className="p-3 border-b border-slate-200">Status</th>
                    <th className="p-3 border-b border-slate-200">Result</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {scheduleHistory.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-400 italic">No history found</td></tr>}
                  {scheduleHistory.map(h => (
                    <tr key={h.id} className="border-b border-slate-100 bg-white hover:bg-slate-50">
                      <td className="p-3 whitespace-nowrap">{new Date(h.run_timestamp).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${h.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{h.status}</span>
                      </td>
                      <td className="p-3 text-[10px] break-all font-mono text-slate-600">
                        {h.status === 'SUCCESS' ? h.file_path : h.error_message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default withModuleGuard(ReportsEngine, '*');

