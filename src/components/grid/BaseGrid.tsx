import React, { useMemo, useCallback, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { 
  ColDef, 
  GridApi, 
  GridReadyEvent, 
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
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { User } from '../../types';

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

export interface BaseGridProps {
  rowData: any[];
  columnDefs: ColDef[];
  loading?: boolean;
  totalRows?: number;
  currentUser?: User | null;
  // Server-side callbacks
  onPaginationChange?: (page: number, pageSize: number) => void;
  onSortChange?: (sortModel: any) => void;
  onFilterChange?: (filterModel: any) => void;
  
  // Customization
  title?: string;
  onRefresh?: () => void;
  
  // Actions RBAC
  moduleContext: 'K' | 'P';
  
  // Provide extra props to AgGridReact
  gridOptions?: any;
}

export function BaseGrid({
  rowData,
  columnDefs,
  loading = false,
  totalRows = 0,
  currentUser,
  onPaginationChange,
  onSortChange,
  onFilterChange,
  title,
  onRefresh,
  moduleContext,
  gridOptions
}: BaseGridProps) {
  const gridRef = useRef<AgGridReact>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  const onGridReady = useCallback((params: GridReadyEvent) => {
    // gridRef.current!.api = params.api;
  }, []);

  const handleExportCSV = useCallback(() => {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `${title || 'export'}_${moduleContext}.csv`
      });
    }
  }, [title, moduleContext]);

  const handleExportExcel = useCallback(() => {
    if (gridRef.current && gridRef.current.api) {
      // requires AG Grid Enterprise, we fall back to CSV if not available or just call it 
      try {
        gridRef.current.api.exportDataAsExcel({
          fileName: `${title || 'export'}_${moduleContext}.xlsx`
        });
      } catch (e) {
        console.warn("Excel export requires AG Grid Enterprise. Falling back to CSV");
        handleExportCSV();
      }
    }
  }, [title, moduleContext, handleExportCSV]);

  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  
  // Using an overarching export check or simple logic for now since we don't know the exact page ID
  // In a real app, page name would be matched.
  const hasExportAccess = isSuperAdmin || (([])?.some(p => p.view));

  const defaultColDef = useMemo(() => {
    return {
      flex: 1,
      minWidth: 100,
      filter: true,
      sortable: true,
      resizable: true,
    };
  }, []);

  const handlePaginationChanged = useCallback(() => {
    if (gridRef.current && gridRef.current.api) {
      const api = gridRef.current.api;
      const newPageSize = api.paginationGetPageSize();
      const newPage = api.paginationGetCurrentPage() + 1;
      
      if (newPageSize !== pageSize || newPage !== currentPage) {
        setPageSize(newPageSize);
        setCurrentPage(newPage);
        if (onPaginationChange) {
          onPaginationChange(newPage, newPageSize);
        }
      }
    }
  }, [currentPage, pageSize, onPaginationChange]);

  const handleSortChanged = useCallback(() => {
     if (gridRef.current && gridRef.current.api && onSortChange) {
        // AG Grid v31+ standard way to get sort state
        const sortModel = gridRef.current.api.getColumnState().filter(s => s.sort != null).map(s => ({colId: s.colId, sort: s.sort}));
        onSortChange(sortModel);
     }
  }, [onSortChange]);

  const handleFilterChanged = useCallback(() => {
     if (gridRef.current && gridRef.current.api && onFilterChange) {
        const filterModel = gridRef.current.api.getFilterModel();
        onFilterChange(filterModel);
     }
  }, [onFilterChange]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-lg">
        <h3 className="font-semibold text-slate-800">{title || 'Data Grid'}</h3>
        
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button 
              onClick={onRefresh}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
          
          <button 
            onClick={handleExportCSV}
            className={`p-2 rounded transition-colors flex items-center gap-1 text-sm font-medium ${
              hasExportAccess 
                ? 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50' 
                : 'text-slate-300 cursor-not-allowed'
            }`}
            disabled={!hasExportAccess || loading}
            title={hasExportAccess ? "Export CSV" : "Export Access Denied"}
          >
            <Download size={18} />
            <span>CSV</span>
          </button>
          
          <button 
             onClick={handleExportExcel}
             className={`p-2 rounded transition-colors flex items-center gap-1 text-sm font-medium ${
              hasExportAccess 
                ? 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50' 
                : 'text-slate-300 cursor-not-allowed'
            }`}
            disabled={!hasExportAccess || loading}
            title={hasExportAccess ? "Export Excel" : "Export Access Denied"}
          >
            <FileSpreadsheet size={18} />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 w-full ag-theme-quartz relative" style={{ height: '100%', minHeight: '400px' }}>
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-indigo-600">
              <RefreshCw size={24} className="animate-spin" />
              <span className="font-medium text-sm">Loading data...</span>
            </div>
          </div>
        )}
        
        <AgGridReact
          ref={gridRef}
          theme="legacy"
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          
          // Pagination
          pagination={true}
          paginationPageSize={pageSize}
          paginationPageSizeSelector={[25, 50, 100, 200, 500]}
          onPaginationChanged={handlePaginationChanged}
          
          // Sorting & Filtering Hooks
          onSortChanged={handleSortChanged}
          onFilterChanged={handleFilterChanged}
          
          // Animations
          animateRows={true}
          
          // Additional custom options
          {...gridOptions}
        />
      </div>
      
      {/* Footer Info */}
      <div className="py-2 px-4 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center bg-slate-50 rounded-b-lg">
        <div>
           Module: <span className="font-semibold text-slate-700">{moduleContext}</span>
        </div>
        <div>
           Total Records: <span className="font-semibold text-slate-700">{totalRows || rowData?.length || 0}</span>
        </div>
      </div>
    </div>
  );
}
