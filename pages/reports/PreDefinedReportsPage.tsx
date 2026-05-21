import React from 'react';
import { useReportingStore } from '../../store/reportingStore';
import { DataSourceSidebar } from '../../components/reporting/DataSourceSidebar';
import { ReportGroupsPanel } from '../../components/reporting/ReportGroupsPanel';
import { ReportsListPanel } from '../../components/reporting/ReportsListPanel';
import { DynamicFiltersBar } from '../../components/reporting/DynamicFiltersBar';
import { ReportToolbar } from '../../components/reporting/ReportToolbar';
import { ReportViewerGrid } from '../../components/reporting/ReportViewerGrid';
import { ReportExportButtons } from '../../components/reporting/ReportExportButtons';
import { ArrowLeft } from 'lucide-react';

export default function PreDefinedReportsPage() {
  const { viewingReport, setViewingReport } = useReportingStore();

  return (
    <div className="flex bg-slate-100 overflow-hidden font-sans" style={{height: "calc(100vh - 60px)"}}>
      {!viewingReport ? (
        // Selection Mode Layout
        <div className="flex w-full h-full">
          <DataSourceSidebar />
          <div className="flex-1 flex overflow-hidden">
            <ReportGroupsPanel />
            <ReportsListPanel />
          </div>
        </div>
      ) : (
        // Viewing Mode Layout
        <div className="flex flex-col w-full h-full">
          {/* Top Navbar */}
          <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm z-10 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setViewingReport(false)}
                className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                title="Back to Reports"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-black text-slate-800">PreDefined Reports Viewer</h1>
                <p className="text-sm text-slate-500 -mt-1 font-mono uppercase tracking-widest text-[10px]">Data Grid & Export</p>
              </div>
            </div>
            <ReportExportButtons />
          </div>
          
          <DynamicFiltersBar />
          <ReportToolbar />
          
          {/* Main Content Area */}
          <ReportViewerGrid />
        </div>
      )}
    </div>
  );
}
