import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { RefreshCw, Users, ShieldAlert, MonitorPlay, BarChart2, Edit3, Save, X, Activity, Clock, AlertTriangle, LayoutDashboard } from 'lucide-react';
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
import DashboardWidget from '../../components/dashboard/DashboardWidget';

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'kpi_absenteeism', type: 'KPI', title: 'Absenteeism Rate', dataSource: 'kpi', kpiField: 'absenteeism_rate' },
  { id: 'kpi_overtime', type: 'KPI', title: 'Total OT Hrs (30d)', dataSource: 'kpi', kpiField: 'total_overtime_hours' },
  { id: 'kpi_missed', type: 'KPI', title: 'Missed Punches', dataSource: 'kpi', kpiField: 'missed_punches' },
  { id: 'kpi_staff', type: 'KPI', title: 'Total Staff Covered', dataSource: 'kpi', kpiField: 'total_staff' },
  { id: 'chart_trend', type: 'LINE', title: 'Attendance Trend (Last 30 Days)', dataSource: 'trendData' },
  { id: 'chart_dept_bar', type: 'BAR', title: 'Department Ave Hrs', dataSource: 'deptProductivity' },
  { id: 'chart_shift_pie', type: 'PIE', title: 'Absences by Shift', dataSource: 'shiftData' },
  { id: 'chart_heatmap', type: 'BAR', title: 'Absences by Day of Week (Last 90 Days)', dataSource: 'heatmapData' },
  { id: 'kpi_forecast_abs', type: 'KPI', title: 'Predicted Absences (Next Day)', dataSource: 'forecast', kpiField: 'predicted_absences' },
  { id: 'kpi_forecast_ot', type: 'KPI', title: 'Predicted Overtime (Next Day)', dataSource: 'forecast', kpiField: 'predicted_overtime' },
];

const DEFAULT_LAYOUTS: any = {
  lg: [
    { i: 'kpi_absenteeism', x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_overtime', x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_missed', x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_staff', x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'chart_trend', x: 0, y: 4, w: 8, h: 12, minW: 4, minH: 8 },
    { i: 'chart_shift_pie', x: 8, y: 4, w: 4, h: 12, minW: 3, minH: 8 },
    { i: 'chart_dept_bar', x: 0, y: 16, w: 5, h: 10, minW: 4, minH: 8 },
    { i: 'chart_heatmap', x: 5, y: 16, w: 4, h: 10, minW: 4, minH: 8 },
    { i: 'kpi_forecast_abs', x: 9, y: 16, w: 3, h: 5, minW: 2, minH: 3 },
    { i: 'kpi_forecast_ot', x: 9, y: 21, w: 3, h: 5, minW: 2, minH: 3 },
  ]
};

function AttendanceAnalytics({ currentUser }: { currentUser: any }) {
  const { currentMode, isConnected } = useModule();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [layouts, setLayouts] = useState<any>(DEFAULT_LAYOUTS);
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(DEFAULT_WIDGETS);
  const activeRequest = useRef<boolean>(false);
  
  const { width, containerRef, mounted } = useContainerWidth();
  const ResponsiveGridLayoutAny = ResponsiveGridLayout as any;

  // RBAC Access Check
  const hasAccess = true; // Handled by App.tsx ProtectedRoute

  const fetchDashboard = async (force: boolean = false, isCancelled = { value: false }) => {
    setLoading(true);
    activeRequest.current = true;
    try {
      const resp = await fetchApi('/api/system/cmd/getAttendanceAnalytics', { method: 'POST', body: JSON.stringify({ moduleType: currentMode, force_refresh: force }) });
      if (!isCancelled.value) {
          setData(resp);
      }
    } catch (err) {
      if (!isCancelled.value) console.error(err);
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

  const kpis = useMemo(() => data?.kpi || { absenteeism_rate: 0, total_overtime_hours: 0, missed_punches: 0, total_staff: 0 }, [data]);
  const forecast = useMemo(() => data?.forecast || { predicted_absences: 0, predicted_overtime: 0 }, [data]);
  const trendData = data?.trendData || [];
  const deptProductivity = data?.deptProductivity || [];
  const shiftData = data?.shiftData || [];

  const widgetData = useMemo(() => ({ ...data, kpis, kpi: kpis, forecast }), [data, kpis, forecast]);

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64 border border-rose-200 bg-rose-50 rounded-lg">
        <p className="text-rose-600 font-mono text-sm">Access Denied. You do not have permissions to view Dashboards.</p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="animate-spin text-primary-navy" size={32} />
        <p className="text-sm font-mono text-text-muted">Aggregating attendance over DuckDB snapshot...</p>
      </div>
    );
  }

  // Handled by generic widget renderer in JSX

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CachedStatutoryWarningBanner />
      <div className="flex justify-between items-end">
         <div>
           <h2 className="text-3xl textile-header flex items-center gap-3 text-primary-navy">
             <Activity size={32} className="text-emerald-600" />
             Attendance Analytics
           </h2>
           <p className="text-sm font-mono text-text-muted mt-1 uppercase tracking-widest flex items-center gap-2">
             Module Context: {currentMode === 'K' ? 'Actuals (Operational)' : 'Statutory (Compliance)'} 
           </p>
         </div>
         <div className="flex gap-2">
            {isEditMode ? (
              <>
                 <button onClick={() => setIsEditMode(false)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">
                   <Save size={14} /> Done
                 </button>
              </>
            ) : (
              <>
                 <button onClick={() => setIsEditMode(true)} className="flex items-center gap-2 bg-white border border-app-border text-primary-navy px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm">
                   <LayoutDashboard size={14} /> Reorder
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
                 <DashboardWidget widget={w} data={widgetData} isEditMode={isEditMode} />
               </div>
             ))}
           </ResponsiveGridLayoutAny>
         )}
      </div>
    </div>
  );
}

export default withModuleGuard(AttendanceAnalytics, 'K');
