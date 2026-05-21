import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { RefreshCw, Users, ShieldAlert, MonitorPlay, BarChart2, Edit3, Save, X, LayoutDashboard, ChevronRight } from 'lucide-react';
import { useModule } from '../../contexts/ModuleContext';
import { withModuleGuard } from '../../components/layout/ModuleGuard';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import ReactGridLayout, { Responsive as ResponsiveGridLayout, Layout } from 'react-grid-layout';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useDashboardStore, DashboardWidgetConfig } from '../../store/useDashboardStore';
import { transformChartData } from '../../utils';
import CachedStatutoryWarningBanner from '../../components/layout/CachedStatutoryWarningBanner';
import { DrillDownViewer } from '../../components/dashboard/DrillDownViewer';
import DashboardWidget from '../../components/dashboard/DashboardWidget';

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
  const activeRequest = useRef<boolean>(false);

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

  const fetchDashboard = async (force: boolean = false, isCancelled = { value: false }) => {
    setLoading(true);
    activeRequest.current = true;
    try {
      // Add a timeout using Promise.race
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 10000));
      const fetchPromise = fetchApi('/api/system/cmd/getDashboardData', { method: 'POST', body: JSON.stringify({ moduleType: currentMode, force_refresh: force }) });
      
      const resp = await Promise.race([fetchPromise, timeoutPromise]);
      if (!isCancelled.value) setData(resp);
    } catch (err) {
      if (!isCancelled.value) {
        console.error('Dashboard fetch failed:', err);
        // Fallback gracefully to empty state
        setData({
           kpis: { total_employees: 0, total_salary: 0, total_net: 0, active_departments: 0 },
           departmentDistribution: [],
           trendData: []
        });
      }
    } finally {
      if (!isCancelled.value) setLoading(false);
      activeRequest.current = false;
    }
  };

  useEffect(() => {
    const isCancelled = { value: false };
    if (hasAccess) {
      fetchDashboard(false, isCancelled);
    }
    return () => {
        isCancelled.value = true;
    };
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

  const currentDrilldownStep = drilldownPath[drilldownPath.length - 1];
  
  const handleNextStep = (step: DrilldownStep) => {
     setDrilldownPath([...drilldownPath, step]);
  };

  const widgetData = useMemo(() => ({
    ...data,
    deptDist: data?.departmentDistribution || [],
    kpis: data?.kpis || { total_employees: 0, total_salary: 0, total_net: 0, active_departments: 0 },
    kpi: data?.kpis || { total_employees: 0, total_salary: 0, total_net: 0, active_departments: 0 }
  }), [data]);

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

  const kpis = widgetData.kpis;
  const deptDist = widgetData.deptDist;
  const trendData = data?.trendData || [];

  // Handled by generic widget renderer in JSX

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
                      <DashboardWidget 
                        widget={w} 
                        data={widgetData} 
                        isEditMode={isEditMode}
                        onKpiClick={handleKpiClick}
                        onChartClick={handleChartClick}
                      />
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

