import React, { useState, useEffect, useRef } from 'react';
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
import { invokeCommand as invoke } from '../../services/apiClient';
import { useModule } from '../../contexts/ModuleContext';
import { DrilldownStep } from '../../pages/reports/DashboardEngine';

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

export function DrillDownViewer({ step, onNextStep }: { step: DrilldownStep, onNextStep: (nextStep: DrilldownStep) => void }) {
  const { currentMode } = useModule();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [step, currentMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (step.type === 'EMPLOYEE_LIST') {
        const filters = [];
        
        if (step.context?.department_name) {
          filters.push({ field: 'department_name', operator: 'equals', value: step.context.department_name });
        } else if (step.context?.departmentId) {
           // Provide fallback if only ID is provided
           const depts = await invoke<any>('master_crud', { tableName: 'departments', operation: 'list', moduleType: currentMode }).catch(() => []);
           const found = Array.isArray(depts) ? depts.find(d => d.id === step.context.departmentId) : null;
           if (found) {
              filters.push({ field: 'department_name', operator: 'equals', value: found.name });
           }
        }
        if (step.context?.status) {
          filters.push({ field: 'status', operator: 'equals', value: step.context.status });
        }
        
        const req = {
          base_table: 'emp_snapshot',
          module_type: currentMode,
          columns: [{field: 'id'}, {field: 'emp_code'}, {field: 'name'}, {field: 'department_name'}, {field: 'designation_name'}, {field: 'status'}],
          filters,
          pagination: { limit: 1000, offset: 0 },
          sorts: []
        };
        const res = await invoke<any>('execute_report_query', req);
        setData(res.data || []);
      } else if (step.type === 'SALARY_DETAILS') {
         const filters = [];
         if (step.context?.empId) {
            filters.push({ field: 'emp_id', operator: 'equals', value: step.context.empId });
         }
         if (step.context?.month_year) {
            filters.push({ field: 'salary_month_year', operator: 'equals', value: step.context.month_year });
         }
         
         const req = {
          base_table: 'salary_transactions',
          module_type: currentMode,
          columns: [{field: 'id'}, {field: 'emp_id'}, {field: 'salary_month_year'}, {field: 'transaction_type'}, {field: 'amount'}, {field: 'head_id'}, {field: 'authorised_by'}],
          filters,
          pagination: { limit: 1000, offset: 0 },
          sorts: []
        };
        const res = await invoke<any>('execute_report_query', req);
        setData(res.data || []);
      } else if (step.type === 'AUDIT_TRAIL') {
         const filters = [];
         if (step.context?.entityType) {
            filters.push({ field: 'entity', operator: 'equals', value: step.context.entityType });
         }
         if (step.context?.entityId) {
            filters.push({ field: 'entity_id', operator: 'equals', value: step.context.entityId });
         }
         if (step.context?.userId) {
            filters.push({ field: 'user_id', operator: 'equals', value: step.context.userId });
         }
         if (step.context?.transactionId) {
             // For a specific transaction
            filters.push({ field: 'entity_id', operator: 'equals', value: step.context.transactionId });
            filters.push({ field: 'entity', operator: 'equals', value: 'salary_transactions' });
         }
         if (step.context?.action) {
            filters.push({ field: 'action', operator: 'equals', value: step.context.action });
         }
         
         const req = {
          base_table: 'audit_logs',
          module_type: currentMode,
          columns: [{field: 'id'}, {field: 'entity'}, {field: 'entity_id'}, {field: 'action'}, {field: 'details'}, {field: 'created_at'}, {field: 'user_id'}],
          filters,
          pagination: { limit: 1000, offset: 0 },
          sorts: []
        };
        const res = await invoke<any>('execute_report_query', req);
        setData(res.data || []);
      } else if (step.type === 'AUDIT_AMENDMENTS') {
         const filters = [];
         if (step.context?.auditLogId) {
            filters.push({ field: 'reference_id', operator: 'equals', value: step.context.auditLogId });
         }
         if (step.context?.entityId) {
             filters.push({ field: 'entity_id', operator: 'equals', value: step.context.entityId });
         }
         const req = {
          base_table: 'audit_amendment_log',
          module_type: currentMode,
          columns: [{field: 'id'}, {field: 'entity'}, {field: 'entity_id'}, {field: 'reference_id'}, {field: 'timestamp'}, {field: 'user_id'}, {field: 'amendment_reason'}, {field: 'previous_value'}, {field: 'new_value'}],
          filters,
          pagination: { limit: 1000, offset: 0 },
          sorts: []
        };
        const res = await invoke<any>('execute_report_query', req);
        setData(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onRowClicked = (e: any) => {
    if (step.type === 'EMPLOYEE_LIST') {
      onNextStep({
        id: `emp_${e.data.id}`,
        type: 'EMPLOYEE_RECORD',
        title: `EMP: ${e.data.name}`,
        context: { empId: e.data.id, empCode: e.data.emp_code }
      });
    } else if (step.type === 'SALARY_DETAILS') {
      onNextStep({
        id: `sal_${e.data.id}`,
        type: 'AUDIT_TRAIL',
        title: `Audit: ${e.data.transaction_type || 'Transaction'}`,
        context: { transactionId: e.data.id, entityId: e.data.id, entityType: 'salary_transactions' }
      });
    } else if (step.type === 'AUDIT_TRAIL') {
      if (currentMode === 'P') {
        onNextStep({
          id: `amen_${e.data.id}`,
          type: 'AUDIT_AMENDMENTS',
          title: `Amendments: ${e.data.action}`,
          context: { auditLogId: e.data.id, entityId: e.data.entity_id }
        });
      }
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-mono text-sm">Loading drill-down data...</div>;
  }

  if (step.type === 'EMPLOYEE_RECORD') {
      return (
          <div className="bg-white p-6 rounded-lg border border-app-border animate-in fade-in zoom-in-95 duration-300">
              <h3 className="text-lg font-bold text-primary-navy">Employee Record Deep-Dive</h3>
              <p className="text-sm font-mono text-text-muted mt-2">ID: {step.context?.empId} | Code: {step.context?.empCode}</p>
              
              <div className="grid grid-cols-2 gap-4 mt-6">
                 <button className="p-4 bg-slate-50 border border-app-border rounded hover:bg-slate-100 text-left transition-colors"
                   onClick={() => onNextStep({
                       id: `sal_hist_${step.context?.empId}`,
                       type: 'SALARY_DETAILS',
                       title: 'Salary History',
                       context: { empId: step.context?.empId }
                   })}
                 >
                     <div className="font-bold text-primary-navy">Salary History</div>
                     <div className="text-xs text-text-muted mt-1 font-mono">View past transactions</div>
                 </button>
                 <button className="p-4 bg-slate-50 border border-app-border rounded hover:bg-slate-100 text-left transition-colors"
                    onClick={() => onNextStep({
                        id: `audit_${step.context?.empId}`,
                        type: 'AUDIT_TRAIL',
                        title: 'Audit Trail',
                        context: { entityType: 'employee', entityId: step.context?.empId }
                    })}
                 >
                     <div className="font-bold text-primary-navy">Audit Trail</div>
                     <div className="text-xs text-text-muted mt-1 font-mono">View record modifications</div>
                 </button>
              </div>
          </div>
      );
  }

  // default table view
  const colDefs = data.length > 0 ? Object.keys(data[0]).map(k => ({
    field: k, sortable: true, filter: true
  })) : [];

  return (
    <div className="ag-theme-quartz bg-white border border-app-border rounded-lg overflow-hidden h-[600px] w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-4 bg-slate-50 border-b border-app-border flex justify-between items-center text-sm font-mono text-text-muted">
         <span>{data.length} records found</span>
         <span>Drilldown Level: {step.type}</span>
      </div>
      <AgGridReact
        theme="legacy"
        rowData={data}
        columnDefs={colDefs}
        onRowClicked={onRowClicked}
        pagination={true}
        paginationPageSize={20}
        defaultColDef={{ resizable: true, flex: 1 }}
      />
    </div>
  );
}
