import React from 'react';
import { FileBarChart } from 'lucide-react';

export function ReportEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-slate-200 text-slate-400">
        <FileBarChart size={40} />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">No Report Selected</h2>
      <p className="text-slate-500 max-w-md">
        Select a data source, choose a report group, and pick a specific report to view or export data.
      </p>
    </div>
  );
}
