import React from 'react';
import { useReportingStore } from '../../store/reportingStore';
import { Eye, FileText, Download, FileSpreadsheet } from 'lucide-react';

export function ReportExportButtons() {
  const { activeReport } = useReportingStore();

  if (!activeReport) return null;

  return (
    <div className="flex gap-2">
      <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium transition-colors border border-slate-300">
        <Eye size={16} /> View Report
      </button>
      <button className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md text-sm font-medium transition-colors border border-rose-200">
        <FileText size={16} /> Export PDF
      </button>
      <button className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md text-sm font-medium transition-colors border border-emerald-200">
        <FileSpreadsheet size={16} /> Export Excel
      </button>
      <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-sm font-medium transition-colors border border-blue-200">
        <Download size={16} /> Export Word
      </button>
    </div>
  );
}
