import React, { useState } from 'react';
import { useReportingStore } from '../../store/reportingStore';
import { FileText, Search } from 'lucide-react';
import { getReportsByGroup } from '../../reporting';

export function ReportsListPanel() {
  const { activeReportGroup, activeReport, setActiveReport, setViewingReport } = useReportingStore();
  const [searchTerm, setSearchTerm] = useState('');

  if (!activeReportGroup) {
    return (
      <div className="flex-[1.5] w-full flex items-center justify-center bg-slate-50/50">
        <p className="text-slate-400 text-sm">Select a report group to view available reports</p>
      </div>
    );
  }

  const reports = getReportsByGroup(activeReportGroup).map(r => ({
    id: r.reportKey,
    name: r.name,
    formats: r.supportedExports,
    desc: r.description || ''
  }));

  const filteredReports = reports.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-[1.5] flex flex-col bg-white min-w-[300px]">
      <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="font-bold text-slate-800 whitespace-nowrap">Available Reports</h2>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search reports..."
            className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredReports.map((report) => {
          const isActive = activeReport === report.id;
          return (
            <div
              key={report.id}
              onClick={() => setActiveReport(report.id)}
              className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-indigo-400 flex flex-col gap-3 ${
                isActive ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/5' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className={`p-2 rounded-md shrink-0 ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{report.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{report.desc}</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap justify-end shrink-0">
                  {report.formats.map(fmt => (
                    <span 
                      key={fmt} 
                      className={`text-[10px] font-bold px-2 py-1 rounded bg-slate-100 border border-slate-200 ${
                        fmt === 'PDF' ? 'text-rose-600' : fmt === 'EXCEL' ? 'text-emerald-600' : 'text-blue-600'
                      }`}
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>
              
              {isActive && (
                <div className="pt-3 border-t mt-1 flex justify-end">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setViewingReport(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Configure & View
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
