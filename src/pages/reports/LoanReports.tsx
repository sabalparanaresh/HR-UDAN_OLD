import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  Search, 
  FileText,
  Download,
  PieChart,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  Calculator,
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

import { useModule } from '../../contexts/ModuleContext';
import CachedStatutoryWarningBanner from '../../components/layout/CachedStatutoryWarningBanner';

interface LoanReport {
  id: number;
  employee_id: number;
  employee_name: string;
  emp_code: string;
  loan_type_id: number;
  loan_type_name: string;
  amount: number;
  tenure_months: number;
  reason: string;
  status: string;
  grace_period_months: number;
  repayment_start_date: string;
  created_at: string;
  paid_amount: number;
  pending_amount: number;
}

export default function LoanReports() {
  const { currentMode } = useModule();

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  const [reports, setReports] = useState<LoanReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, [currentMode]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<LoanReport[]>('get_loan_reports', { moduleType: currentMode });
      setReports(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to fetch reports');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredReports = reports.filter(r => 
    (r.employee_name || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
    (r.emp_code || "").toLowerCase().includes((searchTerm || "").toLowerCase())
  );

  const totalDisbursed = reports.reduce((acc, r) => acc + r.amount, 0);
  const totalRecovered = reports.reduce((acc, r) => acc + (r.paid_amount || 0), 0);
  const totalPending = reports.reduce((acc, r) => acc + (r.pending_amount || 0), 0);
  const activeLoans = reports.filter(r => r.status === 'PROCESSED_BY_HR').length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CachedStatutoryWarningBanner />
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Loan Reports</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Reports & Analytics // Loan Portfolio</p>
        </div>
        <button 
          onClick={() => toast.info('Exporting to PDF...')}
          className="app-btn app-btn-primary flex items-center gap-2"
        >
          <Download size={18} />
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="textile-card p-6 bg-white border-app-border flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Total Disbursed</p>
            <p className="text-xl font-black text-primary-navy">₹{totalDisbursed.toLocaleString()}</p>
          </div>
        </div>
        <div className="textile-card p-6 bg-white border-app-border flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-lg text-green-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Total Recovered</p>
            <p className="text-xl font-black text-primary-navy">₹{totalRecovered.toLocaleString()}</p>
          </div>
        </div>
        <div className="textile-card p-6 bg-white border-app-border flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-lg text-red-600">
            <TrendingDown size={24} />
          </div>
          <div>
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Total Pending</p>
            <p className="text-xl font-black text-primary-navy">₹{totalPending.toLocaleString()}</p>
          </div>
        </div>
        <div className="textile-card p-6 bg-white border-app-border flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Active Loans</p>
            <p className="text-xl font-black text-primary-navy">{activeLoans}</p>
          </div>
        </div>
      </div>

      <div className="textile-card p-4 bg-white border-app-border flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input 
            type="text" 
            placeholder="Search by employee name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-app-border rounded-md text-sm focus:outline-none focus:border-primary-navy transition-colors"
          />
        </div>
      </div>

      <div className="textile-card bg-white border-app-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-app-border">
              <th className="p-4 text-[10px] font-mono text-text-muted uppercase tracking-widest">Employee</th>
              <th className="p-4 text-[10px] font-mono text-text-muted uppercase tracking-widest">Loan Info</th>
              <th className="p-4 text-[10px] font-mono text-text-muted uppercase tracking-widest">Recovery Status</th>
              <th className="p-4 text-[10px] font-mono text-text-muted uppercase tracking-widest">Balance</th>
              <th className="p-4 text-[10px] font-mono text-text-muted uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-text-muted font-mono uppercase text-xs">
                  <div className="w-6 h-6 border-2 border-primary-navy border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading Portfolio Data...
                </td>
              </tr>
            ) : filteredReports.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-text-muted font-mono uppercase text-xs">
                  No Loan Records Found
                </td>
              </tr>
            ) : filteredReports.map((report) => {
              const progress = report.amount > 0 ? ((report.paid_amount || 0) / report.amount) * 100 : 0;
              return (
                <tr key={report.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-navy/5 rounded-full flex items-center justify-center text-primary-navy">
                        <User size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary-navy">{report.employee_name}</p>
                        <p className="text-[10px] font-mono text-text-muted uppercase">{report.emp_code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-primary-navy">₹{report.amount.toLocaleString()}</p>
                      <p className="text-[10px] font-mono text-text-muted uppercase">{report.loan_type_name}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-2 w-48">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-text-muted uppercase">Progress</span>
                        <span className="text-primary-navy font-bold">{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary-green transition-all duration-500" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[9px] font-mono text-text-muted uppercase">Paid: ₹{(report.paid_amount || 0).toLocaleString()}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-bold text-primary-red">₹{(report.pending_amount || 0).toLocaleString()}</p>
                    <p className="text-[10px] font-mono text-text-muted uppercase">Outstanding</p>
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      report.status === 'PROCESSED_BY_HR' 
                        ? 'bg-green-50 text-green-600 border-green-100' 
                        : report.status === 'REJECTED'
                        ? 'bg-red-50 text-red-600 border-red-100'
                        : 'bg-slate-50 text-slate-600 border-slate-100'
                    }`}>
                      {report.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
