import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { authorize } from '../../lib/rbac';
import { User } from '../../types';

interface RoleGateProps {
  pageKey: string;
  moduleCode?: 'K' | 'P' | '*';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ pageKey, moduleCode = '*', children, fallback = null }: RoleGateProps) {
  const currentUser = useAuthStore((state) => state.user) as User | null;

  if (!currentUser) return <>{fallback}</>;

  if (currentUser.role === 'SUPERADMIN' || currentUser.role === 'Super Admin') {
    return <>{children}</>;
  }

  const hasPerm = authorize(currentUser, `${pageKey}.view`, moduleCode === '*' ? undefined : moduleCode);

  if (!hasPerm) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
