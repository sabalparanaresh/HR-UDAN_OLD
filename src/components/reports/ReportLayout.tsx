import React, { ReactNode } from 'react';
import { 
  BarChart, 
  Download, 
  FileSpreadsheet, 
  Save, 
  ChevronRight, 
  AlertTriangle,
  Filter,
  PieChart
} from 'lucide-react';
import { useModule } from '../../contexts/ModuleContext';
import { User } from '../../types';

export interface Breadcrumb {
  id: string;
  label: string;
}

export interface ReportLayoutProps {
  title: string;
  moduleContext: 'K' | 'P';
  icon?: ReactNode;
  currentUser?: User | null;
  
  // Actions
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  onSaveTemplate?: () => void;
  
  // View Toggles
  showChart?: boolean;
  onToggleChart?: (show: boolean) => void;
  
  // Drill-down
  drilldownPath?: Breadcrumb[];
  onBreadcrumbClick?: (id: string, index: number) => void;
  
  // Slots
  filtersNode?: ReactNode;
  paginationNode?: ReactNode;
  children: ReactNode;
  
  // Optional flag to show Audit Status
  showAuditWarning?: boolean;
}

export function ReportLayout({
  title,
  moduleContext,
  icon = <BarChart size={24} />,
  currentUser,
  onExportExcel,
  onExportCSV,
  onSaveTemplate,
  showChart,
  onToggleChart,
  drilldownPath = [],
  onBreadcrumbClick,
  filtersNode,
  paginationNode,
  children,
  showAuditWarning = true
}: ReportLayoutProps) {
  const { isConnected } = useModule();

  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const hasExportAccess = isSuperAdmin || (([])?.some(p => p.view)); // simplified check

  const isAuditMode = moduleContext === 'P' && !isConnected;
  const isUsingCachedPData = moduleContext === 'K' && !isConnected;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
            <span className={moduleContext === 'P' ? 'text-amber-600' : 'text-indigo-600'}>
              {icon}
            </span>
            {title}
          </h2>
          
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-mono font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              Module Context: {moduleContext}
            </span>
            
            {showAuditWarning && isUsingCachedPData && (
              <span className="text-xs font-medium bg-rose-100 text-rose-700 px-2 py-0.5 rounded flex items-center gap-1 border border-rose-200">
                <AlertTriangle size={12} />
                Using Cached Data
              </span>
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {onToggleChart && (
            <button 
              onClick={() => onToggleChart(!showChart)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                showChart 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <PieChart size={16} />
              {showChart ? 'Show Grid' : 'Show Chart'}
            </button>
          )}

          {onSaveTemplate && (
            <button 
              onClick={onSaveTemplate}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Save size={16} /> 
              Save Template
            </button>
          )}

          {hasExportAccess && (onExportCSV || onExportExcel) && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
              {onExportCSV && (
                <button 
                  onClick={onExportCSV} 
                  className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors shadow-sm"
                  title="Export to CSV"
                >
                  <Download size={16} /> 
                  <span className="hidden sm:inline">CSV</span>
                </button>
              )}
              {onExportExcel && (
                <button 
                  onClick={onExportExcel} 
                  className="flex items-center gap-1 bg-emerald-600 border border-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                  title="Export to Excel"
                >
                  <FileSpreadsheet size={16} /> 
                  <span className="hidden sm:inline">Excel</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Audit Warning Banner */}
      {showAuditWarning && isAuditMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start sm:items-center gap-3 shadow-sm">
          <div className="bg-amber-100 p-1.5 rounded-full shrink-0">
            <AlertTriangle className="text-amber-600" size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-800">Audit Mode Active — K Module Disconnected</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              P Module is operating independently. Any local modifications will be recorded as Audit Amendments.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        
        {/* Filter Panel (Left Sidebar) */}
        {filtersNode && (
          <div className="lg:w-64 shrink-0 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col">
            <div className="p-3 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
               <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                 <Filter size={16} className="text-slate-500" />
                 Filters & Configuration
               </h3>
            </div>
            <div className="p-3 overflow-y-auto flex-1">
              {filtersNode}
            </div>
          </div>
        )}

        {/* Content Container (Grid / Chart) */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-slate-200 rounded-lg shadow-sm">
           
           {/* Drill-down Breadcrumbs */}
           {drilldownPath.length > 0 && (
              <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center overflow-x-auto">
                 <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Path:</span>
                 {drilldownPath.map((crumb, idx) => (
                    <React.Fragment key={crumb.id}>
                       {idx > 0 && <ChevronRight size={14} className="text-slate-400 mx-1 shrink-0" />}
                       <button 
                         onClick={() => onBreadcrumbClick?.(crumb.id, idx)}
                         className={`text-sm truncate max-w-[150px] ${
                            idx === drilldownPath.length - 1 
                              ? 'font-bold text-slate-800' 
                              : 'font-medium text-indigo-600 hover:text-indigo-800 hover:underline'
                         }`}
                       >
                         {crumb.label}
                       </button>
                    </React.Fragment>
                 ))}
              </div>
           )}

           {/* Injected Content (BaseGrid/DataGridK/DataGridP or Chart) */}
           <div className="flex-1 relative min-h-[400px]">
             {/* If children has height 100%, absolute layout ensures it fills this container */}
             <div className="absolute inset-0">
               {children}
             </div>
           </div>

           {/* Custom Pagination Footer (if not using AG Grid's native footer) */}
           {paginationNode && (
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg flex items-center justify-between">
                 {paginationNode}
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
