import React, { useState, useEffect, useMemo } from 'react';
import { 
  IndianRupee, 
  Search, 
  Filter, 
  PieChart, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  X,
  Camera,
  History,
  RotateCcw,
  Check,
  Building2,
  MapPin,
  Briefcase
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { format, subMonths } from 'date-fns';
import { invoke } from '@tauri-apps/api/tauri';
import { useModule } from '../../contexts/ModuleContext';
import { withModuleGuard } from '../../components/layout/ModuleGuard';
import { transformChartData } from '../../utils/format/chartEngine';

const MOCK_CHART_DATA = [
  { name: 'Jan', paid: 400000, unpaid: 240000 },
  { name: 'Feb', paid: 300000, unpaid: 139800 },
  { name: 'Mar', paid: 200000, unpaid: 980000 },
  { name: 'Apr', paid: 278000, unpaid: 390800 },
  { name: 'May', paid: 189000, unpaid: 480000 },
  { name: 'Jun', paid: 239000, unpaid: 380000 },
];

function CashManagement() {
  const { currentMode } = useModule();
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [wageMonth, setWageMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [txnTypeFilter, setTxnTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [paymentInput, setPaymentInput] = useState('');

  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  const fetchTransactions = async () => {
    try {
      const data = await invoke('get_cash_transactions', { module_type: currentMode }) as any[];
      setTransactions(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [currentMode]);

  const handleRowClick = async (txn: any) => {
    setSelectedTxn(txn);
    setPaymentInput(txn.balance > 0 ? txn.balance.toString() : '');
    try {
      const history = await invoke('get_cash_payment_history', { transaction_id: txn.id, module_type: currentMode }) as any[];
      setPaymentHistory(history);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredTxns = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.emp_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = txnTypeFilter === 'ALL' || t.type === txnTypeFilter;
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
      const matchMonth = !wageMonth || t.wage_month === wageMonth;
      return matchSearch && matchType && matchStatus && matchMonth;
    });
  }, [transactions, searchTerm, txnTypeFilter, statusFilter, wageMonth]);

  const summary = useMemo(() => {
    return filteredTxns.reduce((acc, curr) => {
      if (curr.status === 'PAID') acc.paid += curr.total_amount;
      else if (curr.status === 'UNPAID') acc.unpaid += curr.total_amount;
      else if (curr.status === 'PARTIAL') {
        acc.paid += curr.paid_amount;
        acc.unpaid += curr.balance;
        acc.partial++;
      }
      return acc;
    }, { paid: 0, unpaid: 0, partial: 0 });
  }, [filteredTxns]);

  const closeModal = () => setSelectedTxn(null);

  const handlePayment = async () => {
    if (!selectedTxn) return;
    const amount = Number(paymentInput);
    if (amount <= 0 || amount > selectedTxn.balance) {
      alert("Invalid payment amount");
      return;
    }

    try {
      await invoke('add_cash_payment', { 
        transaction_id: selectedTxn.id,
        amount,
        action: amount === selectedTxn.balance ? 'Full Payment' : 'Partial Payment',
        module_type: currentMode,
        user: 'Cashier'
      });
      await fetchTransactions();
      closeModal();
    } catch (e) {
      console.error(e);
      alert("Payment failed");
    }
  };

  const handleReversal = async () => {
    if (!selectedTxn || selectedTxn.paid_amount === 0) return;
    if (confirm("Are you sure you want to reverse the last payment?")) {
      try {
        await invoke('reverse_cash_payment', {
          transaction_id: selectedTxn.id,
          module_type: currentMode,
          user: 'Cashier'
        });
        await fetchTransactions();
        closeModal();
      } catch (e) {
        console.error(e);
        alert("Reversal failed");
      }
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header flex items-center gap-3 text-primary-navy">
            <IndianRupee size={32} />
            Cashier Dashboard
          </h2>
          <p className="text-sm font-mono text-text-muted mt-1 uppercase tracking-widest">
            Treasury // Cash Disbursements
          </p>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="textile-card p-5 bg-gradient-to-br from-indigo-50 to-white shadow-sm border-indigo-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
            <IndianRupee size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Disbursed</p>
            <p className="text-2xl font-black text-indigo-950">₹{(summary.paid).toLocaleString('en-IN')}</p>
          </div>
        </div>
        
        <div className="textile-card p-5 bg-gradient-to-br from-rose-50 to-white shadow-sm border-rose-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Pending Dues</p>
            <p className="text-2xl font-black text-rose-950">₹{(summary.unpaid).toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="textile-card p-5 bg-gradient-to-br from-amber-50 to-white shadow-sm border-amber-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Partial Sets</p>
            <p className="text-2xl font-black text-amber-950">{summary.partial}</p>
          </div>
        </div>

        <div className="textile-card p-5 bg-gradient-to-br from-emerald-50 to-white shadow-sm border-emerald-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Records</p>
            <p className="text-2xl font-black text-emerald-950">{filteredTxns.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters */}
          <div className="textile-card p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-app-border pb-3">
              <Filter size={18} className="text-primary-navy" />
              <h3 className="text-xs font-black uppercase tracking-widest text-primary-navy">Cash Filter Panel</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="col-span-1 md:col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">Wage Month</label>
                <input 
                  type="month" 
                  value={wageMonth} 
                  onChange={e => setWageMonth(e.target.value)} 
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded outline-none focus:border-primary-navy"
                />
              </div>
              <div className="col-span-1 md:col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">Status</label>
                <select 
                  value={statusFilter} 
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded outline-none focus:border-primary-navy"
                >
                  <option value="ALL">All Status</option>
                  <option value="UNPAID">Unpaid</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
              <div className="col-span-1 md:col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">Txn Type</label>
                <select 
                  value={txnTypeFilter} 
                  onChange={e => setTxnTypeFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded outline-none focus:border-primary-navy"
                >
                  <option value="ALL">All Types</option>
                  <option value="Salary">Salary</option>
                  <option value="Advance">Advance</option>
                  <option value="Rokda">Rokda</option>
                  <option value="Full & Final">Full & Final</option>
                </select>
              </div>
              <div className="col-span-1 md:col-span-1 relative">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">Search Employee</label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Name or Code"
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-app-border rounded outline-none focus:border-primary-navy text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="textile-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-app-border">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted">Txn ID</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted">Employee</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted">Type</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Amount</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted text-right">Balance</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-text-muted text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {filteredTxns.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted font-mono">No transactions found</td>
                    </tr>
                  )}
                  {filteredTxns.map((txn, i) => (
                    <tr 
                      key={txn.id} 
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                      onClick={() => handleRowClick(txn)}
                    >
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{txn.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={txn.photo} alt={txn.name} className="w-8 h-8 rounded-full border border-slate-200" />
                          <div>
                            <p className="text-xs font-bold text-primary-navy">{txn.name}</p>
                            <p className="text-[10px] font-mono text-slate-500">{txn.emp_code} • {txn.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-1 rounded font-bold uppercase tracking-wider">{txn.type}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold font-mono text-right text-primary-navy">₹{txn.total_amount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs font-bold font-mono text-right text-rose-600">₹{txn.balance.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded ${
                          txn.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                          txn.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {txn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        {/* Charts & Side Panel */}
        <div className="space-y-6">
          <div className="textile-card p-5">
             <h3 className="text-xs font-black uppercase tracking-widest text-primary-navy mb-4 flex items-center gap-2 border-b border-app-border pb-3">
               <PieChart size={16}/> Cash Flow Trend
             </h3>
             <div className="h-64">
               {(() => {
                 const option = transformChartData(MOCK_CHART_DATA, {
                   type: 'line',
                   categoryField: 'name',
                   valueFields: ['paid', 'unpaid']
                 });
                 if (option.series) {
                   option.series[0].itemStyle = { color: '#4f46e5' };
                   option.series[0].areaStyle = { opacity: 0.3, color: '#4f46e5' };
                   if (option.series[1]) {
                     option.series[1].itemStyle = { color: '#e11d48' };
                     option.series[1].areaStyle = { opacity: 0.3, color: '#e11d48' };
                   }
                 }
                 return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
               })()}
             </div>
          </div>
          <div className="textile-card p-5">
             <h3 className="text-xs font-black uppercase tracking-widest text-primary-navy mb-4 flex items-center gap-2 border-b border-app-border pb-3">
               <Building2 size={16}/> Department Dues Outline
             </h3>
             <div className="h-48">
               {(() => {
                 const barChartData = [
                   { name: 'Weav', amount: 4000 },
                   { name: 'Spin', amount: 3000 },
                   { name: 'Dye', amount: 2000 },
                   { name: 'Pack', amount: 2780 },
                   { name: 'Admn', amount: 1890 },
                 ];
                 const option = transformChartData(barChartData, {
                   type: 'bar',
                   categoryField: 'name',
                   valueFields: ['amount']
                 });
                 if (option.series && option.series[0]) {
                   option.series[0].itemStyle = { color: '#3b82f6', borderRadius: [4, 4, 0, 0] };
                 }
                 return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
               })()}
             </div>
          </div>
        </div>      </div>
      </div>

      {/* Row Click Payment Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 grid grid-cols-1 md:grid-cols-3">
            
            {/* Left Panel: Employee Identity */}
            <div className="bg-slate-50 p-6 md:col-span-1 border-r border-app-border relative">
              <button 
                onClick={closeModal}
                className="absolute top-4 right-4 p-1.5 bg-white rounded-full shadow-sm text-text-muted hover:text-rose-600 border border-slate-200 z-10 md:hidden"
              >
                <X size={16} />
              </button>

              <div className="text-center space-y-4 mb-8">
                <div className="relative inline-block">
                  <img src={selectedTxn.photo} alt={selectedTxn.name} className="w-32 h-32 rounded-2xl object-cover shadow-lg border-4 border-white" />
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-primary-navy text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md whitespace-nowrap">
                    {selectedTxn.emp_code}
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-black text-primary-navy">{selectedTxn.name}</h3>
                  <p className="text-sm font-bold text-text-muted">{selectedTxn.designation}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white p-3 rounded-lg border border-app-border flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <Building2 size={14} className="text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-text-muted uppercase">Department</p>
                    <p className="text-xs font-bold text-primary-navy truncate">{selectedTxn.department}</p>
                  </div>
                </div>
                
                <div className="bg-white p-3 rounded-lg border border-app-border flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <Briefcase size={14} className="text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-text-muted uppercase">Txn Type</p>
                    <p className="text-xs font-bold text-primary-navy truncate">{selectedTxn.type}</p>
                  </div>
                </div>
                
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-1">Status</p>
                  <div className="flex gap-1 flex-wrap">
                    <span className="px-2 py-0.5 bg-white rounded text-[10px] font-mono text-amber-700 shadow-sm border border-amber-100">Live Auth</span>
                    <span className="px-2 py-0.5 bg-white rounded text-[10px] font-mono text-amber-700 shadow-sm border border-amber-100">Biometric Match Required</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel: Transaction Entry */}
            <div className="p-6 md:col-span-2 flex flex-col relative">
              <button 
                onClick={closeModal}
                className="absolute top-6 right-6 p-1.5 bg-slate-100 rounded-full text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors hidden md:block"
              >
                <X size={18} />
              </button>

              <h3 className="text-sm font-black uppercase tracking-widest text-primary-navy mb-8 border-b border-app-border pb-3">
                Cash Payment Terminal
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-xl border border-app-border relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-5">
                    <IndianRupee size={48} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gross Total Amount</p>
                  <p className="text-2xl font-mono text-slate-800 mt-1">₹{selectedTxn.total_amount.toLocaleString()}</p>
                </div>
                
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-5 text-rose-900">
                    <AlertCircle size={48} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Currently Pending</p>
                  <p className="text-2xl font-mono text-rose-700 mt-1 font-bold">₹{selectedTxn.balance.toLocaleString()}</p>
                </div>
              </div>

              {selectedTxn.balance > 0 ? (
                <div className="bg-white border-2 border-indigo-100 p-5 rounded-xl mb-8 shadow-sm">
                  <label className="text-[10px] font-black uppercase tracking-widest text-indigo-900 block mb-3">Tender Amount Entry</label>
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={20} />
                      <input 
                        type="number"
                        min="1"
                        max={selectedTxn.balance}
                        value={paymentInput}
                        onChange={e => setPaymentInput(e.target.value)}
                        className="w-full h-14 pl-12 pr-4 bg-indigo-50 border border-indigo-200 rounded-lg text-xl font-mono font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="0.00"
                      />
                    </div>
                    <button 
                      onClick={handlePayment}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 rounded-lg font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Check size={18} /> CONFIRM
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button 
                      onClick={() => setPaymentInput(selectedTxn.balance.toString())}
                      className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-3 py-1 rounded hover:bg-slate-200"
                    >
                      Full Amount
                    </button>
                    <button 
                      onClick={() => setPaymentInput(Math.floor(selectedTxn.balance / 2).toString())}
                      className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-3 py-1 rounded hover:bg-slate-200"
                    >
                      50% Partial
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl mb-8 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                      <CheckCircle size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-emerald-900 uppercase">Payment Cleared</p>
                      <p className="text-[10px] font-mono text-emerald-700 mt-0.5">No outstanding balance.</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleReversal}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all shadow-sm"
                  >
                    <RotateCcw size={14} /> REVERSE
                  </button>
                </div>
              )}

              {/* History Timeline */}
              <div className="mt-auto">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <History size={14} /> Payment Intel History
                </h4>
                <div className="space-y-4">
                  {paymentHistory.map((hist, idx) => (
                    <div key={hist.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-slate-300 mt-1" />
                        {idx !== paymentHistory.length - 1 && <div className="w-px h-full bg-slate-200 my-1" />}
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-700">{hist.action} by {hist.created_by}</p>
                          <p className="font-mono text-[10px] text-slate-500 mt-1">{hist.created_at}</p>
                        </div>
                        <p className={`font-mono font-bold ${hist.amount < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                          {hist.amount < 0 ? '-' : ''}₹{Math.abs(hist.amount).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withModuleGuard(CashManagement, 'K');
