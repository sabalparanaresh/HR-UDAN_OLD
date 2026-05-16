import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { RefreshCw, Users, ShieldAlert, MonitorPlay, BarChart2, Edit3, Save, X, LayoutDashboard, ChevronRight } from 'lucide-react';
import { useModule } from '../../contexts/ModuleContext';
import { withModuleGuard } from '../../components/layout/ModuleGuard';
import { invoke } from '@tauri-apps/api/tauri';
import ReactGridLayout, { Responsive as ResponsiveGridLayout, useContainerWidth, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useDashboardStore, DashboardWidgetConfig } from '../../store/useDashboardStore';
import { transformChartData } from '../../utils/format/chartEngine';
import CachedStatutoryWarningBanner from '../../components/layout/CachedStatutoryWarningBanner';
import { DrillDownViewer } from '../../components/dashboard/DrillDownViewer';

export interface DrilldownStep {
  id: string;
  type: 'DASHBOARD' | 'DEPT_LIST' | 'EMPLOYEE_LIST' | 'EMPLOYEE_RECORD' | 'SALARY_DETAILS' | 'AUDIT_TRAIL' | 'AUDIT_AMENDMENTS';
  title: string;
  context?: any;
}


const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'kpi_emp', type: 'KPI', title: 'Active Employees', dataSource: 'kpi', kpiField: 'total_employees' },
  { id: 'kpi_gross', type: 'KPI', title: 'Gross Liability', dataSource: 'kpi', kpiField: 'total_salary' },
  { id: 'kpi_net', type: 'KPI', title: 'Net Payable', dataSource: 'kpi', kpiField: 'total_net' },
  { id: 'kpi_depts', type: 'KPI', title: 'Depts Active', dataSource: 'kpi', kpiField: 'active_departments' },
  { id: 'chart_trend', type: 'LINE', title: 'Payroll Trend (Last 6 Months)', dataSource: 'trendData' },
  { id: 'chart_dept_pie', type: 'PIE', title: 'Dept Allocation', dataSource: 'deptDist' },
  { id: 'chart_dept_bar', type: 'BAR', title: 'Employee Count by Department', dataSource: 'deptDist' },
];

const DEFAULT_LAYOUTS: any = {
  lg: [
    { i: 'kpi_emp', x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_gross', x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_net', x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_depts', x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'chart_trend', x: 0, y: 4, w: 8, h: 12, minW: 4, minH: 8 },
    { i: 'chart_dept_pie', x: 8, y: 4, w: 4, h: 12, minW: 3, minH: 8 },
    { i: 'chart_dept_bar', x: 0, y: 16, w: 12, h: 12, minW: 4, minH: 8 },
  ]
};

function DashboardEngine({ currentUser }: { currentUser: any }) {
  const { currentMode, isConnected } = useModule();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const dashboardStore = useDashboardStore();
  
  const [layouts, setLayouts] = useState<any>(DEFAULT_LAYOUTS);
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(DEFAULT_WIDGETS);
  const [drilldownPath, setDrilldownPath] = useState<DrilldownStep[]>([{ id: 'root', type: 'DASHBOARD', title: 'Dashboard Overview' }]);

  const { width, containerRef, mounted } = useContainerWidth();

  const ResponsiveGridLayoutAny = ResponsiveGridLayout as any;

  // RBAC Access Check
  const hasAccess = true; // Handled by App.tsx ProtectedRoute

  useEffect(() => {
    if (currentUser?.id) {
       const userLayout = dashboardStore.getLayout(currentUser.id, currentMode);
       if (userLayout) {
          setLayouts({ lg: userLayout.layouts });
          setWidgets(userLayout.widgets);
       } else {
          setLayouts(DEFAULT_LAYOUTS);
          setWidgets(DEFAULT_WIDGETS);
       }
    }
  }, [currentUser?.id, currentMode]);

  const fetchDashboard = async (force: boolean = false) => {
    setLoading(true);
    try {
      const resp = await invoke('get_dashboard_data', { moduleType: currentMode, force_refresh: force });
      setData(resp);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      fetchDashboard();
    }
  }, [currentMode, hasAccess]);

  const onLayoutChange = (layout: any, allLayouts: any) => {
    if (isEditMode) {
      setLayouts(allLayouts);
    }
  };

  const saveDashboard = () => {
    if (currentUser?.id) {
       dashboardStore.saveLayout(currentUser.id, currentMode, layouts.lg || [], widgets);
       setIsEditMode(false);
    }
  };

  const handleKpiClick = (widget: DashboardWidgetConfig) => {
    if (isEditMode) return;
    if (widget.kpiField === 'total_employees') {
        setDrilldownPath([...drilldownPath, { id: Date.now().toString(), type: 'EMPLOYEE_LIST', title: 'Active Employees', context: { status: 1 } }]);
    } else if (widget.kpiField === 'total_salary' || widget.kpiField === 'total_net') {
        setDrilldownPath([...drilldownPath, { id: Date.now().toString(), type: 'SALARY_DETAILS', title: 'Salary Breakdowns', context: { } }]);
    }
  };

  const handleChartClick = (params: any, widget: DashboardWidgetConfig) => {
    if (isEditMode) return;
    if (widget.id === 'chart_dept_pie' || widget.id === 'chart_dept_bar') {
        // params.name is department name
        setDrilldownPath([...drilldownPath, { 
            id: Date.now().toString(), 
            type: 'EMPLOYEE_LIST', 
            title: `Dept: ${params.name}`, 
            context: { department_name: params.name }  // DrillDownViewer can filter exactly on this if needed
        }]);
    } else if (widget.id === 'chart_trend') {
        setDrilldownPath([...drilldownPath, { 
            id: Date.now().toString(), 
            type: 'SALARY_DETAILS', 
            title: `Trend: ${params.name}`, 
            context: { month_year: params.name } 
        }]);
    }
  };

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64 border border-rose-200 bg-rose-50 rounded-lg">
        <p className="text-rose-600 font-mono text-sm">Access Denied. You do not have permissions to view Dashboards.</p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-primary-navy" size={32} />
      </div>
    );
  }

  const kpis = data?.kpis || { total_employees: 0, total_salary: 0, total_net: 0, active_departments: 0 };
  const deptDist = data?.departmentDistribution || [];
  const trendData = data?.trendData || [];

  const renderWidget = (widget: DashboardWidgetConfig) => {
    if (widget.type === 'KPI') {
       const v = widget.kpiField ? kpis[widget.kpiField] : 0;
       const label = widget.title;
       return (
          <div 
            onClick={() => handleKpiClick(widget)}
            className={`textile-card p-4 bg-white border-app-border flex items-center justify-center flex-col gap-2 h-full w-full ${isEditMode ? 'ring-2 ring-blue-400 cursor-move' : 'cursor-pointer hover:shadow-md transition-shadow'}`}
          >
             <p className="text-[10px] text-text-muted uppercase font-mono tracking-widest text-center">{label}</p>
             <p className="text-2xl font-black text-slate-800">
               {widget.kpiField?.includes('salary') || widget.kpiField?.includes('net') ? `₹${v.toLocaleString()}` : v.toLocaleString()}
             </p>
          </div>
       );
    }

    let option: any = {};
    if (widget.type === 'PIE') {
       option = transformChartData(deptDist, {
         type: 'pie',
         categoryField: 'name',
         valueFields: ['value']
       });
    } else if (widget.type === 'LINE') {
       option = transformChartData(trendData, {
         type: 'line',
         categoryField: 'month_year',
         valueFields: ['gross']
       });
       // Inject custom color tweaks
       if (option.series && option.series[0]) {
         option.series[0].itemStyle = { color: '#0EA5E9' };
         option.series[0].areaStyle = { opacity: 0.3 };
       }
    } else if (widget.type === 'BAR') {
       option = transformChartData(deptDist, {
         type: 'bar',
         categoryField: 'name',
         valueFields: ['value']
       });
       if (option.series && option.series[0]) {
         option.series[0].itemStyle = { color: '#1E3A8A', borderRadius: [4, 4, 0, 0] };
       }
    } else if (widget.type === 'HEATMAP') {
       option = transformChartData(data?.[widget.dataSource] || [], {
         type: 'heatmap',
         categoryField: 'x', // Need appropriate mappings
         groupBy: 'y',
         valueFields: ['value']
       });
    }

    return (
      <div className={`textile-card p-4 bg-white border-app-border h-full flex flex-col ${isEditMode ? 'ring-2 ring-blue-400 cursor-move' : ''}`}>
        <h3 className="text-[11px] font-black uppercase tracking-widest text-primary-navy border-b border-app-border pb-2 mb-2">
          {widget.title}
        </h3>
        <div className="flex-1 min-h-0 relative">
          <ReactECharts 
            option={option} 
            style={{ height: '100%', width: '100%', position: 'absolute' }} 
            onEvents={{ click: (p) => handleChartClick(p, widget) }}
          />
        </div>
      </div>
    );
  };

  const currentDrilldownStep = drilldownPath[drilldownPath.length - 1];

  const handleNextStep = (step: DrilldownStep) => {
     setDrilldownPath([...drilldownPath, step]);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CachedStatutoryWarningBanner />
      
      {drilldownPath.length > 1 && (
        <div className="flex items-center gap-2 mb-4 textile-header text-sm p-3 bg-white border border-app-border rounded-lg shadow-sm">
           {drilldownPath.map((step, idx) => (
              <React.Fragment key={step.id}>
                 <button 
                   className={`hover:underline text-xs flex items-center gap-1 ${idx === drilldownPath.length - 1 ? 'font-bold text-primary-navy' : 'text-text-muted cursor-pointer'}`}
                   onClick={() => setDrilldownPath(drilldownPath.slice(0, idx + 1))}
                 >
                   {step.title}
                 </button>
                 {idx < drilldownPath.length - 1 && <ChevronRight size={14} className="text-slate-400 mx-1" />}
              </React.Fragment>
           ))}
        </div>
      )}

      {currentDrilldownStep.type === 'DASHBOARD' ? (
        <>
          <div className="flex justify-between items-end">
             <div>
               <h2 className="text-3xl textile-header flex items-center gap-3 text-primary-navy">
                 <LayoutDashboard size={32} className="text-blue-600" />
                 Dashboard Analytics
               </h2>
               <p className="text-sm font-mono text-text-muted mt-1 uppercase tracking-widest flex items-center gap-2">
                 Module Context: {currentMode === 'K' ? 'Actuals (Operational)' : 'Statutory (Compliance)'} 
               </p>
             </div>
             <div className="flex gap-2">
                {isEditMode ? (
                  <>
                     <button onClick={() => setIsEditMode(false)} className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors shadow-sm border border-slate-300">
                       <X size={14} /> Cancel
                     </button>
                     <button onClick={saveDashboard} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">
                       <Save size={14} /> Save Layout
                     </button>
                  </>
                ) : (
                  <>
                     <button onClick={() => setIsEditMode(true)} className="flex items-center gap-2 bg-white border border-app-border text-primary-navy px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm">
                       <Edit3 size={14} /> Customize
                     </button>
                     <button onClick={() => fetchDashboard(true)} className="flex items-center gap-2 bg-white border border-app-border text-primary-navy px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm">
                       <RefreshCw size={14} /> {loading ? 'Loading...' : 'Refresh'}
                     </button>
                  </>
                )}
             </div>
          </div>

          <div ref={containerRef} className="bg-slate-50/50 rounded-xl p-2 min-h-[600px] border border-slate-200/50">
             {mounted && (
               <ResponsiveGridLayoutAny
                 className="layout"
                 width={width}
                 layouts={layouts}
                 breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                 cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                 rowHeight={30}
                 onLayoutChange={onLayoutChange}
                 isDraggable={isEditMode}
                 isResizable={isEditMode}
                 margin={[16, 16]}
               >
                 {widgets.map(w => (
                   <div key={w.id} className="relative group rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white">
                     {renderWidget(w)}
                   </div>
                 ))}
               </ResponsiveGridLayoutAny>
             )}
          </div>
        </>
      ) : (
        <DrillDownViewer step={currentDrilldownStep} onNextStep={handleNextStep} />
      )}
    </div>
  );
}

export default withModuleGuard(DashboardEngine, '*');

