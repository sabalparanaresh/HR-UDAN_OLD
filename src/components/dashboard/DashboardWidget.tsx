import React, { memo, useMemo } from 'react';
import { FileCheck, AlertCircle } from 'lucide-react';
import { DashboardWidgetConfig } from '../../store/useDashboardStore';
import { transformChartData } from '../../utils';

const ReactECharts = React.lazy(() => import('echarts-for-react'));

interface DashboardWidgetProps {
  widget: DashboardWidgetConfig;
  data: any;
  isEditMode: boolean;
  onKpiClick?: (widget: DashboardWidgetConfig) => void;
  onChartClick?: (params: any, widget: DashboardWidgetConfig) => void;
}

const formatCurrency = (val: number | undefined) => {
    if (val === undefined || val === null) return '₹ 0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
};

const DashboardWidget = memo(({ widget, data, isEditMode, onKpiClick, onChartClick }: DashboardWidgetProps) => {

  const clickHandlers = useMemo(() => {
    if (!onChartClick) return undefined;
    return {
      click: (p: any) => onChartClick(p, widget)
    };
  }, [onChartClick, widget]);

  const handleKpiAction = () => {
    if (onKpiClick) {
      onKpiClick(widget);
    }
  };

  const dataSourceRaw = data?.[widget.dataSource as string];

  const option = useMemo(() => {
    if (widget.type === 'KPI') return null;

    let opt: any = {};
    const dataSource = dataSourceRaw || [];

    if (widget.type === 'PIE') {
       if (widget.id === 'chart_heads_pie') {
           opt = transformChartData(dataSource, {
             type: 'pie',
             categoryField: 'head_name',
             valueFields: ['total_amount']
           });
       } else if (widget.id === 'chart_dept_pie') {
           opt = transformChartData(dataSource, {
             type: 'pie',
             categoryField: 'name',
             valueFields: ['value']
           });
       } else if (widget.id === 'chart_shift_pie') {
           opt = transformChartData(dataSource, {
             type: 'pie',
             categoryField: 'shift_name',
             valueFields: ['absences']
           });
       } else {
           opt = transformChartData(dataSource, {
             type: 'pie',
             categoryField: 'wage_type',
             valueFields: ['total_gross']
           });
       }

       if (opt.series && opt.series[0]) {
           opt.series[0].radius = ['40%', '70%'];
           opt.color = ['#ef4444', '#f97316', '#3b82f6', '#8b5cf6', '#10b981', '#14b8a6', '#6366f1'];
       }

    } else if (widget.type === 'LINE') {
       if (widget.id === 'chart_trend' && widget.title.includes('Payroll Trend')) {
           opt = transformChartData(dataSource, {
             type: 'line',
             categoryField: 'month_year',
             valueFields: ['gross']
           });
           if (opt.series && opt.series[0]) {
             opt.series[0].itemStyle = { color: '#0EA5E9' };
             opt.series[0].areaStyle = { opacity: 0.3 };
           }
       } else if (widget.id === 'chart_trend' && widget.title.includes('Gross vs Net')) {
           opt = transformChartData(dataSource, {
             type: 'line',
             categoryField: 'month',
             valueFields: ['gross_salary', 'net_salary']
           });
           if (opt.series && opt.series[0]) {
             opt.series[0].itemStyle = { color: '#3b82f6' }; 
             opt.series[0].areaStyle = { opacity: 0.1 };
             if (opt.series[1]) {
                 opt.series[1].itemStyle = { color: '#10b981' };
                 opt.series[1].areaStyle = { opacity: 0.1 };
             }
           }
       } else if (widget.id === 'chart_trend' && widget.title.includes('Statutory Liabilities')) {
           opt = transformChartData(dataSource, {
             type: 'line',
             categoryField: 'month',
             valueFields: ['pf_amount', 'esi_amount']
           });
           if (opt.series && opt.series[0]) {
             opt.series[0].name = 'PF Liability';
             opt.series[0].itemStyle = { color: '#3b82f6' }; 
             opt.series[0].areaStyle = { opacity: 0.1 };
             if (opt.series[1]) {
                 opt.series[1].name = 'ESI Liability';
                 opt.series[1].itemStyle = { color: '#f59e0b' };
                 opt.series[1].areaStyle = { opacity: 0.1 };
             }
           }
           opt.legend = { show: true, bottom: 0 };
       } else if (widget.id === 'chart_trend' && widget.title.includes('Attendance')) {
           opt = transformChartData(dataSource, {
             type: 'line',
             categoryField: 'date',
             valueFields: ['present', 'absent', 'leave']
           });
           if (opt.series && opt.series[0]) {
             opt.series[0].itemStyle = { color: '#10b981' }; 
             opt.series[0].areaStyle = { opacity: 0.1 };
             if (opt.series[1]) {
                 opt.series[1].itemStyle = { color: '#ef4444' };
                 opt.series[1].areaStyle = { opacity: 0.1 };
             }
             if (opt.series[2]) {
                 opt.series[2].itemStyle = { color: '#f59e0b' };
             }
           }
       }

    } else if (widget.type === 'BAR') {
       if (widget.dataSource === 'heatmapData') {
           const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
           const formattedData = dataSource.map((row: any) => ({
             day: days[row.day_of_week] || 'Unknown',
             absences: row.absent_count
           }));
           opt = transformChartData(formattedData, {
             type: 'bar',
             categoryField: 'day',
             valueFields: ['absences']
           });
           if (opt.series && opt.series[0]) {
             opt.series[0].itemStyle = { color: '#f59e0b', borderRadius: [4, 4, 0, 0] };
           }
       } else if (widget.id === 'chart_dept_bar' && widget.title.includes('Ave Hrs')) {
           opt = transformChartData(dataSource, {
             type: 'bar',
             categoryField: 'department_name',
             valueFields: ['avg_hours']
           });
           if (opt.series && opt.series[0]) {
             opt.series[0].itemStyle = { color: '#3b82f6', borderRadius: [4, 4, 0, 0] };
             opt.series[0].markLine = {
               data: [{ yAxis: 8, name: 'Target (8h)' }],
               lineStyle: { color: '#10b981', type: 'dashed' }
             };
           }
       } else if (widget.dataSource === 'breakdownData') {
           opt = transformChartData(dataSource, {
             type: 'bar',
             categoryField: 'head_name',
             valueFields: ['total_amount']
           });
           if (opt.series && opt.series[0]) {
             opt.series[0].itemStyle = { color: '#ef4444', borderRadius: [4, 4, 0, 0] };
           }
       } else if (widget.id === 'chart_cost_center') {
           opt = transformChartData(dataSource, {
             type: 'bar',
             categoryField: 'department_name',
             valueFields: ['total_gross']
           });
           if (opt.series && opt.series[0]) {
             opt.series[0].itemStyle = { color: '#8b5cf6', borderRadius: [4, 4, 0, 0] };
           }
       } else {
           opt = transformChartData(dataSource, {
             type: 'bar',
             categoryField: 'name',
             valueFields: ['value']
           });
           if (opt.series && opt.series[0]) {
             opt.series[0].itemStyle = { color: '#1E3A8A', borderRadius: [4, 4, 0, 0] };
           }
       }
    } else if (widget.type === 'HEATMAP') {
       opt = transformChartData(dataSource, {
         type: 'heatmap',
         categoryField: 'x',
         groupBy: 'y',
         valueFields: ['value']
       });
    }
    
    return opt;
  }, [widget, dataSourceRaw]);

  if (widget.type === 'KPI') {
     let sourceObj = data?.[widget.dataSource as string] || {};
     const kpiField = widget.kpiField as string;
     let rawV = sourceObj[kpiField] || 0;
     
     let finalV: string | number = rawV;

     if (typeof rawV === 'number') {
        if (kpiField.includes('salary') || kpiField.includes('net') || kpiField.includes('amount') || kpiField === 'min_bonus_liability' || kpiField === 'max_bonus_liability' || kpiField === 'total_gross_latest' || kpiField === 'total_net_latest' || kpiField === 'total_ded_latest' || kpiField === 'predicted_gross' || kpiField === 'predicted_pf') {
             finalV = formatCurrency(rawV);
        } else if (kpiField === 'absenteeism_rate') {
             finalV = rawV.toLocaleString(undefined, { maximumFractionDigits: 1 }) + '%';
        } else if (kpiField === 'total_overtime_hours' || kpiField === 'predicted_overtime') {
             finalV = rawV.toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' h';
        } else {
             finalV = rawV.toLocaleString();
        }
     }

     return (
        <div 
          onClick={handleKpiAction}
          className={`textile-card p-4 bg-white border-app-border flex items-center justify-center flex-col gap-2 h-full w-full ${isEditMode ? 'ring-2 ring-blue-400 cursor-move' : (onKpiClick ? 'cursor-pointer hover:shadow-md transition-shadow' : '')}`}
        >
           <p className="text-[10px] text-text-muted uppercase font-mono tracking-widest text-center">{widget.title}</p>
           <p className={`text-2xl font-black ${widget.id === 'kpi_risk_count' && rawV > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
             {finalV}
           </p>
        </div>
     );
  }

  if (widget.type === 'TABLE' && widget.dataSource === 'riskData') {
      const riskData = data?.[widget.dataSource] || [];
      return (
        <div className={`textile-card p-4 bg-white border-app-border h-full flex flex-col ${isEditMode ? 'ring-2 ring-blue-400 cursor-move' : ''}`}>
        <h3 className="text-[11px] font-black uppercase tracking-widest text-rose-600 border-b border-app-border pb-2 mb-2 flex items-center gap-2">
          <AlertCircle size={14} /> {widget.title}
        </h3>
        <div className="flex-1 overflow-auto">
          {riskData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50">
               <FileCheck size={32} className="mb-2 text-emerald-600" />
               <p className="text-sm font-mono">No known compliance risks identified.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
               <thead>
                 <tr>
                    <th className="text-[10px] uppercase font-bold text-gray-500 pb-2 border-b">Emp Code</th>
                    <th className="text-[10px] uppercase font-bold text-gray-500 pb-2 border-b">Name</th>
                    <th className="text-[10px] uppercase font-bold text-gray-500 pb-2 border-b text-right">Risk Factor</th>
                 </tr>
               </thead>
               <tbody>
                  {riskData.map((r: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                       <td className="py-2 text-xs font-mono">{r.emp_code}</td>
                       <td className="py-2 text-xs">{r.name}</td>
                       <td className="py-2 text-xs text-right text-rose-600 font-bold">{r.risk_type}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
          )}
        </div>
      </div>
      );
  }

  return (
    <div className={`textile-card p-4 bg-white border-app-border h-full flex flex-col ${isEditMode ? 'ring-2 ring-blue-400 cursor-move' : ''}`}>
      <h3 className="text-[11px] font-black uppercase tracking-widest text-primary-navy border-b border-app-border pb-2 mb-2">
        {widget.title}
      </h3>
      <div className={`flex-1 min-h-0 relative ${isEditMode ? 'pointer-events-none' : ''}`}>
        <React.Suspense fallback={<div className="h-full w-full bg-slate-50 animate-pulse rounded-md"></div>}>
          {option && (
            <ReactECharts 
              option={option} 
              style={{ height: '100%', width: '100%', position: 'absolute' }} 
              onEvents={clickHandlers}
              notMerge={true}
              lazyUpdate={true}
            />
          )}
        </React.Suspense>
      </div>
    </div>
  );
});

DashboardWidget.displayName = 'DashboardWidget';
export default DashboardWidget;
