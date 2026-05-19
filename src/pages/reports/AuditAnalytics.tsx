import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { RefreshCw, Save, LayoutDashboard, ShieldCheck, PieChart, Activity, AlertCircle, X } from 'lucide-react';
import { useModule } from '../../contexts/ModuleContext';
import { invokeCommand as invoke } from '../../services/apiClient';
import { Responsive as ResponsiveGridLayout } from 'react-grid-layout';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { DashboardWidgetConfig } from '../../store/useDashboardStore';
import { transformChartData } from '../../utils';
import { DrillDownViewer } from '../../components/dashboard/DrillDownViewer';

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'kpi_total', type: 'KPI', title: 'Total Activities', dataSource: 'kpis', kpiField: 'total_activities' },
  { id: 'kpi_exports', type: 'KPI', title: 'Total Exports', dataSource: 'kpis', kpiField: 'total_exports' },
  { id: 'kpi_failed_logins', type: 'KPI', title: 'Failed Logins', dataSource: 'kpis', kpiField: 'failed_logins' },
  { id: 'kpi_views', type: 'KPI', title: 'Report Views', dataSource: 'kpis', kpiField: 'total_views' },
  { id: 'chart_trend', type: 'LINE', title: 'Activity Trend (30 Days)', dataSource: 'trendData' },
  { id: 'chart_action_pie', type: 'PIE', title: 'Action Distribution', dataSource: 'actionDist' },
  { id: 'table_users', type: 'TABLE', title: 'Top Active Users', dataSource: 'userActivity' },
  { id: 'table_sync', type: 'TABLE', title: 'Sync Failures & Status', dataSource: 'syncFailures' },
  { id: 'table_amendments', type: 'TABLE', title: 'Recent Audit Amendments', dataSource: 'amendments' },
];

const DEFAULT_LAYOUTS: any = {
  lg: [
    { i: 'kpi_total', x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_exports', x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_failed_logins', x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'kpi_views', x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'chart_trend', x: 0, y: 4, w: 8, h: 10, minW: 4, minH: 8 },
    { i: 'chart_action_pie', x: 8, y: 4, w: 4, h: 10, minW: 3, minH: 8 },
    { i: 'table_users', x: 0, y: 14, w: 4, h: 10, minW: 3, minH: 6 },
    { i: 'table_sync', x: 4, y: 14, w: 4, h: 10, minW: 3, minH: 6 },
    { i: 'table_amendments', x: 8, y: 14, w: 4, h: 10, minW: 3, minH: 6 },
  ]
};

export default function AuditAnalytics({ currentUser, onRedirect }: { currentUser: any; onRedirect?: () => void }) {
  const { currentMode, isConnected } = useModule();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Drill Down State
  const [drillStep, setDrillStep] = useState<any | null>(null);

  const [layouts, setLayouts] = useState<any>(DEFAULT_LAYOUTS);
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(DEFAULT_WIDGETS);

  const { width, containerRef, mounted } = useContainerWidth();
  const ResponsiveGridLayoutAny = ResponsiveGridLayout as any;

  // RBAC Access Check (Auditor-only drill-down access support via permissions/role checks)
  const hasAccess = true; // Handled by App.tsx ProtectedRoute

  const fetchDashboard = async (force: boolean = false) => {
    setLoading(true);
    try {
      const resp = await invoke('get_audit_analytics', { moduleType: currentMode, force_refresh: force });
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
        <p className="text-sm font-mono text-text-muted">Aggregating audit trails...</p>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const trendData = data?.trendData || [];
  const actionDist = data?.actionDist || [];
  const userActivity = data?.userActivity || [];
  const amendments = data?.amendments || [];

  const renderWidget = (widget: DashboardWidgetConfig) => {
    if (widget.type === 'KPI') {
       const rawV = widget.kpiField ? kpis[widget.kpiField] || 0 : 0;
       return (
          <div className={`textile-card p-4 bg-white border-app-border flex items-center justify-center flex-col gap-2 h-full w-full ${isEditMode ? 'ring-2 ring-blue-400 cursor-move' : ''}`}>
             <p className="text-[10px] text-text-muted uppercase font-mono tracking-widest text-center">{widget.title}</p>
             <p className={`text-2xl font-black ${widget.id === 'kpi_failed_logins' && rawV > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
               {rawV}
             </p>
          </div>
       );
    }
    
    if (widget.type === 'TABLE' && widget.dataSource === 'table_users') {
      return (
        <div className={`textile-card p-4 bg-white border-app-border h-full flex flex-col ${isEditMode ? 'ring-2 ring-blue-400 cursor-move' : ''}`}>
        <h3 className="text-[11px] font-black uppercase tracking-widest text-primary-navy border-b border-app-border pb-2 mb-2">
          {widget.title}
        </h3>
        <div className="flex-1 overflow-auto">
          {userActivity.length === 0 ? (
             <p className="text-sm font-mono opacity-50 p-4 text-center">No activity found.</p>
          ) : (
            <table className="w-full text-left border-collapse">
               <thead>
                 <tr>
                    <th className="text-[10px] uppercase font-bold text-gray-500 pb-2 border-b">User ID</th>
                    <th className="text-[10px] uppercase font-bold text-gray-500 pb-2 border-b text-right">Activities</th>
                 </tr>
               </thead>
               <tbody>
                  {userActivity.map((r: any, idx: number) => (
                    <tr key={idx} 
                      className={`border-b border-slate-50 ${currentMode === 'P' && (currentUser?.role === 'Auditor' || false /* usePermission handles this */) ? 'hover:bg-indigo-50 cursor-pointer' : 'hover:bg-slate-50'}`}
                      onClick={() => {
                        if (currentMode === 'P' && (currentUser?.role === 'Auditor' || false /* usePermission handles this */)) {
                            setDrillStep({
                                type: 'AUDIT_TRAIL',
                                title: `Audit Trail: User ${r.user_id}`,
                                context: { userId: r.user_id }
                            });
                        }
                      }}
                    >
                       <td className="py-2 text-xs font-mono text-indigo-600">{r.user_id}</td>
                       <td className="py-2 text-xs text-right font-bold">{r.count}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
          )}
        </div>
      </div>
      );
    }
    
    if (widget.type === 'TABLE' && widget.dataSource === 'syncFailures') {
        const syncFailures = data?.syncFailures || [];
        return (
          <div className={`textile-card p-4 bg-white border-app-border h-full flex flex-col ${isEditMode ? 'ring-2 ring-blue-400 cursor-move' : ''}`}>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-primary-navy border-b border-app-border pb-2 mb-2 flex items-center justify-between">
            <span>{widget.title}</span>
          </h3>
          <div className="flex-1 overflow-auto">
            {syncFailures.length === 0 ? (
               <p className="text-sm font-mono opacity-50 p-4 text-center text-emerald-600">No sync failures or pending items.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                 <thead>
                   <tr>
                      <th className="text-[10px] uppercase font-bold text-gray-500 pb-2 border-b">Status</th>
                      <th className="text-[10px] uppercase font-bold text-gray-500 pb-2 border-b text-right">Count</th>
                   </tr>
                 </thead>
                 <tbody>
                    {syncFailures.map((r: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                         <td className="py-2 text-xs font-mono text-rose-600">{r.status}</td>
                         <td className="py-2 text-xs text-right font-bold">{r.count}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
            )}
          </div>
        </div>
        );
    }

    if (widget.type === 'TABLE' && widget.dataSource === 'amendments') {
        const isModuleP = currentMode === 'P';
        return (
          <div className={`textile-card p-4 bg-white border-app-border h-full flex flex-col ${isEditMode ? 'ring-2 ring-blue-400 cursor-move' : ''}`}>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-primary-navy border-b border-app-border pb-2 mb-2 flex items-center justify-between">
            <span>{widget.title}</span>
            {isModuleP && <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded">P-Module Only</span>}
          </h3>
          <div className="flex-1 overflow-auto">
            {!isModuleP ? (
              <div className="flex flex-col items-center justify-center p-4 opacity-50 h-full text-center">
                  <AlertCircle size={20} className="mb-2" />
                  <span className="text-xs font-mono">Audit Amendments are only visible in the Statutory (P) Module.</span>
              </div>
            ) : amendments.length === 0 ? (
               <p className="text-sm font-mono opacity-50 p-4 text-center">No amendments recorded.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                 <thead>
                   <tr>
                      <th className="text-[10px] uppercase font-bold text-gray-500 pb-2 border-b">Date</th>
                      <th className="text-[10px] uppercase font-bold text-gray-500 pb-2 border-b">Amendment</th>
                      <th className="text-[10px] uppercase font-bold text-gray-500 pb-2 border-b text-right">User ID</th>
                   </tr>
                 </thead>
                 <tbody>
                    {amendments.map((r: any, idx: number) => (
                      <tr key={idx} 
                         className={`border-b border-slate-50 ${isModuleP ? 'hover:bg-indigo-50 cursor-pointer' : 'hover:bg-slate-50'}`}
                         onClick={() => {
                             if (isModuleP) {
                                 setDrillStep({
                                     type: 'AUDIT_AMENDMENTS',
                                     title: `Amendment Details`,
                                     context: { auditLogId: r.reference_id, entityId: r.entity_id }
                                 });
                             }
                         }}
                      >
                         <td className="py-2 text-xs whitespace-nowrap">{new Date(r.timestamp).toLocaleDateString()}</td>
                         <td className="py-2 text-[10px] truncate max-w-[150px]" title={r.amendment_reason || r.amendment_text}>{r.amendment_reason || r.amendment_text}</td>
                         <td className="py-2 text-xs text-right font-mono text-slate-500">{r.user_id}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
            )}
          </div>
        </div>
        );
    }

    let option: any = {};
    if (widget.type === 'LINE') {
       option = transformChartData(trendData, {
         type: 'line',
         categoryField: 'date',
         valueFields: ['total_actions', 'export_actions']
       });
       if (option.series && option.series[0]) {
         option.series[0].name = 'All Actions';
         option.series[0].itemStyle = { color: '#6366f1' }; 
         if (option.series[1]) {
             option.series[1].name = 'Exports';
             option.series[1].itemStyle = { color: '#10b981' };
         }
       }
       option.legend = { show: true, bottom: 0 };
    } else if (widget.type === 'PIE') {
       const pieData = actionDist.map((item: any) => ({ name: item.action, value: item.count }));
       option = {
         tooltip: { trigger: 'item' },
         series: [{
           type: 'pie',
           radius: ['40%', '70%'],
           avoidLabelOverlap: false,
           itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
           label: { show: false, position: 'center' },
           labelLine: { show: false },
           data: pieData
         }]
       };
    }

    return (
      <div className={`textile-card p-4 bg-white border-app-border h-full flex flex-col ${isEditMode ? 'ring-2 ring-blue-400 cursor-move' : ''}`}>
        <h3 className="text-[11px] font-black uppercase tracking-widest text-primary-navy border-b border-app-border pb-2 mb-2">
          {widget.title}
        </h3>
        <div className="flex-1 min-h-0 relative pb-4">
          <ReactECharts 
            option={option} 
            style={{ height: '100%', width: '100%', position: 'absolute' }} 
            onEvents={{
               click: (p: any) => {
                  if (widget.id === 'chart_action_pie') {
                     setDrillStep({
                        type: 'AUDIT_TRAIL',
                        title: `Action: ${p.name}`,
                        context: { action: p.name }
                     });
                  }
               }
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
         <div>
           <h2 className="text-3xl textile-header flex items-center gap-3 text-primary-navy">
             <ShieldCheck size={32} className="text-indigo-600" />
             Audit Trail Analytics
           </h2>
           <p className="text-sm font-mono text-text-muted mt-1 uppercase tracking-widest flex items-center gap-2">
             Module Context: {currentMode} Mode
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
                 {renderWidget(w)}
               </div>
             ))}
           </ResponsiveGridLayoutAny>
         )}
      </div>

      {drillStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[80vh]">
            <div className="px-6 py-4 border-b border-app-border bg-slate-50 flex items-center justify-between">
              <h3 className="text-lg font-black text-primary-navy uppercase tracking-wider">{drillStep.title}</h3>
              <button onClick={() => setDrillStep(null)} className="text-slate-400 hover:text-slate-600 transition-colors bg-white hover:bg-slate-100 rounded p-1 border border-transparent hover:border-slate-200">
                 <X size={20} />
              </button>
            </div>
            <div className="flex-1 p-6 relative bg-slate-50/50 overflow-hidden">
               <DrillDownViewer step={drillStep} onNextStep={(next) => setDrillStep(next)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
