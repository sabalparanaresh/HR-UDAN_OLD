import React from 'react';
import { BaseGrid, BaseGridProps } from './BaseGrid';
import { ColDef } from 'ag-grid-community';

export interface DataGridKProps extends Omit<BaseGridProps, 'moduleContext'> {
  requireAuditAccess?: boolean;
}

export function DataGridK(props: DataGridKProps) {
  const { currentUser } = props;
  
  // Isolated state management for K module preferences
  // We can load K-specific column states, filters from local storage, etc.
  
  // K Module automatically supports Action Columns for primary transactions
  // RBAC check specific to K Module
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const canEdit = isSuperAdmin || (([])?.some(p => p.addUpdate));
  
  // Inject RBAC logic dynamically into columnDefs if they have 'action' type columns
  const enrichedColumnDefs = React.useMemo(() => {
    return props.columnDefs.map((col: any) => {
      if (col.field === 'actions' || col.headerName === 'Actions') {
        return {
          ...col,
          hide: !canEdit, // Hide actions column if no edit access
          pinned: 'right' as const,
        };
      }
      return col;
    });
  }, [props.columnDefs, canEdit]);

  return (
    <BaseGrid 
      {...props} 
      columnDefs={enrichedColumnDefs}
      moduleContext="K" 
      // K-module specific defaults
      gridOptions={{
        rowSelection: 'multiple',
        suppressRowClickSelection: true,
        ...props.gridOptions
      }}
    />
  );
}
