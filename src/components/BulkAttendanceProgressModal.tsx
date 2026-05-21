import React, { useState } from 'react';
import { useAttendanceTaskStore } from '../store/attendanceTaskStore';
import { X, Play, AlertCircle, CheckCircle, RefreshCcw, Hand, XCircle, LayoutTemplate } from 'lucide-react';
import { invokeCommand as invoke, fetchApi } from '../services/apiClient';

export const BulkAttendanceProgressModal: React.FC = () => {
  const { status, progress, summary, error, rowsPerSec, etaSeconds, cancelTask, resetTask } = useAttendanceTaskStore();
  const [minimized, setMinimized] = useState(false);

  // If there's no task running/completed/error and not minimized, don't show
  if (status === 'idle') return null;

  const handleCancel = async () => {
    try {
      await fetchApi('/api/attendance/cancel-bulk', { method: 'POST' });
      cancelTask();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismiss = () => {
    resetTask();
    setMinimized(false);
  };

  if (minimized) {
    return (
      <div 
        className="fixed bottom-4 right-4 bg-white/90 backdrop-blur border border-gray-200 shadow-lg rounded-full px-4 py-2 flex items-center space-x-3 cursor-pointer hover:bg-gray-50 transition-colors z-50 text-sm font-medium"
        onClick={() => setMinimized(false)}
      >
        {status === 'running' && (
          <>
            <RefreshCcw className="w-4 h-4 text-primary animate-spin" />
            <span className="text-gray-700">Generating Attendance... {progress?.percentage}%</span>
          </>
        )}
        {status === 'completed' && (
          <>
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-gray-700">Attendance Generated</span>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-gray-700">Generation Failed</span>
          </>
        )}
        {status === 'cancelled' && (
          <>
            <XCircle className="w-4 h-4 text-gray-500" />
            <span className="text-gray-700">Generation Cancelled</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-gray-500" />
            Bulk Attendance Generation
          </h3>
          <div className="flex items-center gap-2">
            {status === 'running' && (
              <button
                onClick={() => setMinimized(true)}
                className="text-gray-400 hover:text-gray-600 px-2 py-1 text-sm font-medium transition-colors"
              >
                Minimize
              </button>
            )}
            <button
              onClick={status === 'running' ? handleCancel : handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {status === 'running' && (
            <div className="space-y-6">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 font-medium tracking-tight">Processing Records...</span>
                <span className="text-primary font-bold">{progress?.percentage}%</span>
              </div>
              
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
                <div 
                  className="bg-primary h-3 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${progress?.percentage || 0}%` }}
                ></div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium mb-1">Processed</p>
                  <p className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-1 inline-block">
                    {progress?.processed.toLocaleString() || 0} <span className="text-sm font-normal text-gray-400">/ {progress?.total.toLocaleString() || 0}</span>
                  </p>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium mb-1">Estimated Time</p>
                  <p className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-1 inline-block">
                    {etaSeconds !== null && etaSeconds > 0 ? (
                      etaSeconds > 60 
                        ? `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s`
                        : `${etaSeconds}s`
                    ) : 'Calculating...'}
                  </p>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 col-span-2 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">Processing Speed</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {rowsPerSec.toLocaleString()} <span className="text-gray-500 font-normal">records/sec</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                    <RefreshCcw className="w-3 h-3 animate-spin" /> Working
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={handleCancel} 
                  className="px-4 py-2 rounded-md font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 transition-colors bg-white"
                >
                  Cancel Generation
                </button>
              </div>
            </div>
          )}

          {status === 'completed' && summary && (
            <div className="text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4 ring-8 ring-green-50/50">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-semibold text-gray-900 tracking-tight">Generation Complete</h4>
                <p className="text-gray-500 text-sm mt-1">Bulk attendance processing finished successfully.</p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4 text-left border border-gray-100">
                 <div>
                    <p className="text-xs text-gray-500 font-medium">Total Records Inserted</p>
                    <p className="text-xl font-bold text-gray-900">{summary.total_records.toLocaleString()}</p>
                 </div>
                 <div>
                    <p className="text-xs text-gray-500 font-medium">Employees Processed</p>
                    <p className="text-xl font-bold text-gray-900">{summary.processed_employees.toLocaleString()}</p>
                 </div>
              </div>

              {summary.skipped_missing_shift && summary.skipped_missing_shift.length > 0 && (
                <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm text-left border border-amber-100 flex gap-3 pb-4">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Skipped {summary.skipped_missing_shift.length} Employees</p>
                    <p className="text-xs opacity-90 hidden sm:block">
                      These employees do not have a mapped shift in the Employee Master. Attendance could not be calculated.
                    </p>
                  </div>
                </div>
              )}

              <button 
                onClick={handleDismiss} 
                className="w-full py-2.5 bg-primary text-white font-medium rounded-md hover:bg-primary/90 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-5">
              <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 ring-8 ring-red-50/50">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-semibold text-gray-900 tracking-tight">Generation Error</h4>
                <p className="text-gray-500 text-sm mt-1">An error occurred during bulk generation.</p>
              </div>
              <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm text-left border border-red-100">
                <span className="font-mono">{error}</span>
              </div>
              <button 
                onClick={handleDismiss} 
                className="w-full py-2.5 bg-primary text-white font-medium rounded-md hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {status === 'cancelled' && (
            <div className="text-center space-y-5">
              <div className="mx-auto w-16 h-16 bg-gray-50 text-gray-500 rounded-full flex items-center justify-center mb-4 ring-8 ring-gray-50/50">
                <Hand className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-semibold text-gray-900 tracking-tight">Generation Cancelled</h4>
                <p className="text-gray-500 text-sm mt-1">The bulk generation process was stopped by the user.</p>
              </div>
              <button 
                onClick={handleDismiss} 
                className="w-full py-2.5 border-2 border-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
