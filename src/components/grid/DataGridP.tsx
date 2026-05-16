import React from 'react';
import { BaseGrid, BaseGridProps } from './BaseGrid';
import { useModule } from '../../contexts/ModuleContext';
import { useAuthStore } from '../../store/authStore';

export interface DataGridPProps extends Omit<BaseGridProps, 'moduleContext'> {
  showAuditAmendments?: boolean;
}

export function DataGridP(props: DataGridPProps) {
  const { currentUser } = props;
  const { isConnected } = useModule();
  
  // Isolated state management for P module preferences
  
  // P Module RBAC logic
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const role = currentUser?.role;
  const isAuditor = role === 'Auditor';
  const { permissionMap } = useAuthStore();
  
  // In P mode, if K is connected, direct manual data entry is blocked. 
  // If disconnected (Audit Mode), Audit Amendments are allowed.
  const hasPageEditingAccess = Object.values(permissionMap).some(p => p === true); // simplified check, in reality should use specific page permissions
  const canEdit = isSuperAdmin || (isAuditor && !isConnected) || (hasPageEditingAccess && !isConnected);

  // Inject RBAC logic dynamically into columnDefs
  const enrichedColumnDefs = React.useMemo(() => {
    let cols = props.columnDefs.map((col: any) => {
      if (col.field === 'actions' || col.headerName === 'Actions') {
        return {
          ...col,
          hide: !canEdit, // Hide actions column if no capability to make audit amendments
          pinned: 'right' as const,
        };
      }
      return col;
    });
    
    // Dynamically inject Audit status column if required
    if (props.showAuditAmendments && !isConnected) {
        cols = [
            {
               field: '_audit_amended',
               headerName: 'Audit Status',
               width: 130,
               pinned: 'left' as const,
               cellRenderer: (p: any) => {
                   return p.value ? <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">Amended</span> : null;
               }
            },
            ...cols
        ];
    }
    
    return cols;
  }, [props.columnDefs, canEdit, props.showAuditAmendments, isConnected]);

  return (
    <div className="relative h-full flex flex-col">
       {!isConnected && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between z-10 shrink-0">
             <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span className="text-sm font-semibold text-amber-800">Audit Mode — K Module Disconnected</span>
             </div>
             <span className="text-xs text-amber-600">Local Edits Flagged as Amendments</span>
          </div>
       )}
      <div className="flex-1 min-h-0">
          <BaseGrid 
            {...props} 
            columnDefs={enrichedColumnDefs}
            moduleContext="P"
            // P-module specific defaults
            gridOptions={{
              rowSelection: 'single', // compliance usually inspects one record at a time
              ...props.gridOptions
            }}
          />
      </div>
    </div>
  );
}
