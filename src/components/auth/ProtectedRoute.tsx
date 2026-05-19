import React from 'react';
import { authorize } from '../../lib/rbac';
import { useAuthStore } from '../../store/authStore';
import { ErrorBoundary } from '../';
import { AccessDeniedFallback } from './AccessDeniedFallback';

export function ProtectedRoute({ 
  moduleCode = 'K', 
  pageKey, 
  children 
}: { 
  moduleCode?: string, 
  pageKey?: string, 
  children: React.ReactNode 
}) {
  const currentUser = useAuthStore(state => state.user);
  
  if (!pageKey) return <ErrorBoundary>{children}</ErrorBoundary>;
  
  // NOTE: the legacy RBAC logic checks for 'SUPERADMIN'. 
  // It's possible the type is 'Super Admin', we handle both just in case.
  if (currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'Super Admin') {
      return <ErrorBoundary>{children}</ErrorBoundary>;
  }

  if (currentUser?.role === 'AUDITOR' && moduleCode === 'K') {
      return <AccessDeniedFallback message="Auditors cannot access Primary (K) Module." />;
  }

  if (currentUser?.role === 'AUDITOR' && (moduleCode === 'P' || moduleCode === '*')) {
      return <ErrorBoundary>{children}</ErrorBoundary>;
  }

  const hasPerm = authorize(currentUser, `${pageKey}.view`, moduleCode === '*' ? undefined : moduleCode as 'K'|'P');

  if (!hasPerm) {
      return <AccessDeniedFallback />;
  }
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
