import React from 'react';
import { Loader2 } from 'lucide-react';

export function ReportLoadingState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
      <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
      <h2 className="text-xl font-bold text-slate-800 mb-2">Generating Report</h2>
      <p className="text-slate-500 max-w-md">
        Please wait while we crunch the numbers and assemble your report data.
      </p>
    </div>
  );
}
