import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { RefreshCw, Users, ShieldAlert, MonitorPlay, BarChart2, Edit3, Save, X, Activity, Clock, AlertTriangle, LayoutDashboard, Database, TrendingUp, DollarSign } from 'lucide-react';
import { useModule } from '../../contexts/ModuleContext';
import { withModuleGuard } from '../../components/layout/ModuleGuard';
import { invokeCommand as invoke } from '../../services/apiClient';
import ReactGridLayout, { Responsive as ResponsiveGridLayout, Layout } from 'react-grid-layout';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useDashboardStore, DashboardWidgetConfig } from '../../store/useDashboardStore';
import { transformChartData } from '../../utils';
import CachedStatutoryWarningBanner from '../../components/layout/CachedStatutoryWarningBanner';
import DashboardWidget from '../../components/dashboard/DashboardWidget';

const formatCurrency = (val: number | undefined) => {
    if (val === undefined || val === null) return '₹ 0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
};

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'kpi_gross', type: 'KPI', title: 'Total Gross (Latest)', dataSource: 'kpi', kpiField: 'total_gross_latest' },
  { id: 'kpi_net', type: 'KPI', title: 'Total Net (Latest)', dataSource: 'kpi', kpiField: 'total_net_latest' },
  { id: 'kpi_ded', type: 'KPI', title: 'Total Deductions (Latest)', dataSource: 'kpi', kpiField: 'total_ded_latest' },
  { id: 'kpi_emps', type: 'KPI', title: 'Employees Paid (Latest)', dataSource: 'kpi', kpiField: 'total_employees_paid' },
  { id: 'chart_trend', type: 'LINE', title: 'Gross vs Net Trend', dataSource: 'trendData' },
  { id: 'chart_cost_center', type: 'BAR', title: 'Payroll by Cost Center', dataSource: 'costCenterData' },
  { id: 'chart_wage_pie', type: 'PIE', title: 'Gross by Wage Type', dataSource: 'wageTypeData' },
  { id: 'kpi_forecast_gross', type: 'KPI', title: 'Predicted Next Gross', dataSource: 'forecast', kpiField: 'predicted_gross' },
  { id: 'kpi_forecast_pf', type: 'KPI', title: 'Predicted PF Liability', dataSource: 'forecast', kpiField: 'predicted_pf' },
  { id: 'chart_heads_pie', type: 'PIE', title: 'Salary Heads Contribution', dataSource: 'headData' },
];

const DEFAULT_LAYOUTS: any = {
  lg: [
    { i: 'kpi_gross', x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_net', x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_ded', x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_emps', x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'chart_trend', x: 0, y: 4, w: 8, h: 12, minW: 4, minH: 8 },
    { i: 'chart_wage_pie', x: 8, y: 4, w: 4, h: 12, minW: 3, minH: 8 },
    { i: 'kpi_forecast_gross', x: 0, y: 16, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_forecast_pf', x: 3, y: 16, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'chart_heads_pie', x: 6, y: 16, w: 3, h: 10, minW: 3, minH: 8 },
    { i: 'chart_cost_center', x: 9, y: 16, w: 3, h: 10, minW: 3, minH: 8 },
  ]
};

function PayrollAnalytics({ currentUser }: { currentUser: any }) {
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
      const resp = await invoke('get_payroll_analytics', { moduleType: currentMode, force_refresh: force });
      if (!isCancelled.value) setData(resp);
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

  const kpis = useMemo(() => data?.kpi || { total_gross_latest: 0, total_net_latest: 0, total_ded_latest: 0, total_employees_paid: 0 }, [data]);
  const forecast = useMemo(() => data?.forecast || { predicted_gross: 0, predicted_net: 0 }, [data]);
  const trendData = data?.trendData || [];
  const costCenterData = data?.costCenterData || [];
  const wageTypeData = data?.wageTypeData || [];
  const headData = data?.headData || [];

  const widgetData = useMemo(() => ({ ...data, kpis, kpi: kpis, forecast, heads: headData }), [data, kpis, forecast, headData]);

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
        <p className="text-sm font-mono text-text-muted">Aggregating payroll data over DuckDB snapshot...</p>
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
             <DollarSign size={32} className="text-emerald-600" />
             Payroll Analytics
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

export default withModuleGuard(PayrollAnalytics, 'K');
