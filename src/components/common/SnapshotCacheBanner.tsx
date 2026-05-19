import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

export function SnapshotCacheBanner() {
  const { isModulePConnected, lastSnapshotTimestamp } = useWorkspaceStore();

  if (isModulePConnected) {
    return null;
  }

  const timestampDisplay = lastSnapshotTimestamp ? lastSnapshotTimestamp : 'Unknown';

  return (
    <div className="bg-amber-50 rounded-md p-4 mb-4 flex items-center border border-amber-200 shadow-sm">
      <div className="flex-shrink-0">
        <AlertCircle className="h-5 w-5 text-amber-800" aria-hidden="true" />
      </div>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-amber-800">
          Audit Mode — K Module Disconnected. Displaying cached snapshots from {timestampDisplay}
        </h3>
      </div>
    </div>
  );
}
