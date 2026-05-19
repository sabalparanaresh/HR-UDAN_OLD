import React from 'react';

export function ReportToolbar() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b">
      <span className="text-sm text-slate-500 font-medium">Tools</span>
      {/* Additional tools like column visibility, density settings would go here */}
    </div>
  );
}
