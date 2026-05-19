import React, { useState, useEffect, useMemo } from 'react';
const ReactECharts = React.lazy(() => import('echarts-for-react'));
import { ShieldCheck, ShieldAlert, FileText, Users, TrendingUp, RefreshCw } from 'lucide-react';
import { useModule } from '../../contexts/ModuleContext';
import { invokeCommand as invoke } from '../../services/apiClient';
import { transformChartData } from '../../utils';

export default function StatutoryDashboard() {
  const { currentMode } = useModule();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async (force: boolean = false) => {
    setIsLoading(true);
    try {
      const data = await invoke('get_dashboard_data', { 
        moduleType: currentMode,
        force_refresh: force 
      });
      setDashboardData(data);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentMode]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-primary-navy" size={32} />
      </div>
    );
  }

  const stats = dashboardData?.stats || { total_employees: 0, total_pf: 0, total_esi: 0, total_gross: 0, compliance_variance: 0 };
  const recentFilings = dashboardData?.recentFilings || [];

  const option = useMemo(() => {
    const chartData = [
      { name: 'PF', value: stats.total_pf || 0, color: '#1E3A8A' },
      { name: 'ESI', value: stats.total_esi || 0, color: '#DC2626' },
    ];

    const opt = transformChartData(chartData, {
      type: 'bar',
      categoryField: 'name',
      valueFields: ['value']
    });

    if (opt.series && opt.series[0]) {
      opt.series[0].itemStyle = {
        color: function (params: any) {
          const colorList = ['#1E3A8A', '#DC2626'];
          return colorList[params.dataIndex];
        },
        borderRadius: [4, 4, 0, 0]
      };
    }
    return opt;
  }, [stats.total_pf, stats.total_esi]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Statutory Overview</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Compliance Dashboard // Unified System</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchData(true)} className="flex items-center gap-2 bg-white border border-app-border text-primary-navy px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm">
            <RefreshCw size={14} /> Refresh Data
          </button>
          {stats.compliance_variance > 0 && (
            <div className="bg-primary-red/10 border border-primary-red/20 px-3 py-1 rounded-md flex items-center gap-2">
              <ShieldAlert className="text-primary-red" size={14} />
              <span className="text-[10px] font-mono text-primary-red font-bold uppercase">{stats.compliance_variance} Compliance Variances</span>
            </div>
          )}
          <div className="bg-primary-green/10 border border-primary-green/20 px-3 py-1 rounded-md flex items-center gap-2">
            <ShieldCheck className="text-primary-green" size={14} />
            <span className="text-[10px] font-mono text-primary-green font-bold uppercase">Compliance Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: (stats.total_employees || 0).toLocaleString(), icon: <Users size={20} />, color: 'text-primary-navy' },
          { label: 'Monthly PF', value: `₹${(stats.total_pf || 0).toLocaleString()}`, icon: <FileText size={20} />, color: 'text-primary-navy' },
          { label: 'Compliance Variance', value: (stats.compliance_variance || 0).toLocaleString(), icon: <ShieldAlert size={20} />, color: stats.compliance_variance > 0 ? 'text-primary-red' : 'text-primary-green' },
          { label: 'Total Gross', value: `₹${(stats.total_gross || 0).toLocaleString()}`, icon: <TrendingUp size={20} />, color: 'text-primary-green' },
        ].map((stat, i) => (
          <div key={i} className="textile-card p-4 bg-white border-app-border flex items-center gap-4">
            <div className={`p-3 rounded-md bg-slate-50 ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase font-mono">{stat.label}</p>
              <p className="text-xl font-black text-primary-navy">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 textile-card p-6 bg-white border-app-border">
          <h3 className="textile-header text-lg font-bold mb-6 text-primary-navy border-b border-app-border pb-2">Contribution Analysis</h3>
          <div className="h-[300px] w-full relative">
            <React.Suspense fallback={<div className="h-full w-full bg-slate-50 animate-pulse rounded-md"></div>}>
              <ReactECharts option={option} style={{ height: '100%', width: '100%', position: 'absolute' }} notMerge={true} lazyUpdate={true} />
            </React.Suspense>
          </div>
        </div>

        <div className="textile-card p-6 bg-white border-app-border">
          <h3 className="textile-header text-lg font-bold mb-6 text-primary-navy border-b border-app-border pb-2">Recent Filings</h3>
          <div className="space-y-4">
            {recentFilings.map((filing: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-app-border group hover:border-primary-navy transition-colors">
                <div>
                  <p className="text-xs font-bold text-primary-navy">{filing.type}</p>
                  <p className="text-[10px] text-text-muted font-mono">{filing.month}</p>
                </div>
                <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-md border ${
                  filing.status === 'Filed' ? 'bg-primary-green/10 text-primary-green border-primary-green/20' : 'bg-amber-100 text-amber-700 border-amber-200'
                }`}>
                  {filing.status}
                </span>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-2 text-xs font-bold textile-header text-primary-navy border border-primary-navy rounded-md hover:bg-primary-navy hover:text-white transition-all uppercase tracking-widest">
            View All Filings
          </button>
        </div>
      </div>
    </div>
  );
}
