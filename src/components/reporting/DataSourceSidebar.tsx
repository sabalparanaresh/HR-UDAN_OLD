import React, { useState } from 'react';
import { useReportingStore } from '../../store/reportingStore';
import { Search, Database, Users, Clock, CreditCard, Banknote, FileText, Briefcase, Activity, ShieldCheck, DollarSign } from 'lucide-react';

const DATA_SOURCES = [
  { id: 'MASTERS', name: 'Masters', icon: Database },
  { id: 'EMPLOYEE_MASTER', name: 'Employee Master', icon: Users },
  { id: 'ATTENDANCE', name: 'Attendance', icon: Clock },
  { id: 'SALARY', name: 'Salary', icon: Banknote },
  { id: 'EARNINGS_TRANS', name: 'Earnings Trans.', icon: DollarSign },
  { id: 'DEDUCTION_TRANS', name: 'Deduction Trans.', icon: CreditCard },
  { id: 'ADVANCE_TRANS', name: 'Advance Trans.', icon: CreditCard },
  { id: 'LOAN_TRANS', name: 'Loan Trans.', icon: Banknote },
  { id: 'BONUS_TRANS', name: 'Bonus Trans.', icon: DollarSign },
  { id: 'INCENTIVE_TRANS', name: 'Incentive Trans.', icon: DollarSign },
  { id: 'OT_TRANS', name: 'OT Trans.', icon: Clock },
  { id: 'ARREAR_TRANS', name: 'Arrear Trans.', icon: DollarSign },
  { id: 'PF', name: 'PF', icon: FileText },
  { id: 'ESI', name: 'ESI', icon: FileText },
  { id: 'PT', name: 'PT', icon: FileText },
  { id: 'LWF', name: 'LWF', icon: FileText },
  { id: 'GRATUITY', name: 'Gratuity', icon: Briefcase },
  { id: 'BANKING', name: 'Banking', icon: CreditCard },
  { id: 'MIS', name: 'MIS', icon: Activity },
  { id: 'AUDIT_LOGS', name: 'Audit Logs', icon: ShieldCheck },
];

export function DataSourceSidebar() {
  const { activeDataSource, setActiveDataSource, isSidebarOpen } = useReportingStore();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSources = DATA_SOURCES.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isSidebarOpen) return null;

  return (
    <div className="w-64 border-r bg-slate-50 h-full flex flex-col">
      <div className="p-4 border-b bg-white">
        <h2 className="font-bold text-slate-800 mb-4">Data Sources</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search sources..."
            className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredSources.map((source) => {
          const Icon = source.icon;
          const isActive = activeDataSource === source.id;
          return (
            <button
              key={source.id}
              onClick={() => setActiveDataSource(source.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive 
                  ? 'bg-indigo-100 text-indigo-700 font-medium' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon size={18} />
              <span>{source.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
