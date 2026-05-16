import React from 'react';
import { useModule } from '../contexts/ModuleContext';
import { usePermission, useModuleAccess } from '../hooks/useRBAC';
import { useAuthStore } from '../store/authStore';

interface PermissionGateProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const isAllowed = usePermission(permission);
  if (!isAllowed) return <>{fallback}</>;
  return <>{children}</>;
}

interface ModuleAccessProps {
  moduleScope: 'K' | 'P';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ModuleAccess({ moduleScope, children, fallback = null }: ModuleAccessProps) {
  const isAllowed = useModuleAccess(moduleScope);
  if (!isAllowed) return <>{fallback}</>;
  return <>{children}</>;
}

interface RBACGuardProps {
  permission?: string;
  moduleScope?: 'K' | 'P';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RBACGuard({ permission, moduleScope, children, fallback = null }: RBACGuardProps) {
  const isModuleAllowed = moduleScope ? useModuleAccess(moduleScope) : true;
  const isPermissionAllowed = permission ? usePermission(permission) : true;

  if (!isModuleAllowed || !isPermissionAllowed) return <>{fallback}</>;

  return <>{children}</>;
}

export function CanView({ permission, children, fallback = null }: { permission: string, children: React.ReactNode, fallback?: React.ReactNode }) {
    return <PermissionGate permission={permission} fallback={fallback}>{children}</PermissionGate>;
}

export function CanEdit({ permission, children, fallback = null }: { permission: string, children: React.ReactNode, fallback?: React.ReactNode }) {
    return <PermissionGate permission={permission} fallback={fallback}>{children}</PermissionGate>;
}

export function CanDelete({ permission, children, fallback = null }: { permission: string, children: React.ReactNode, fallback?: React.ReactNode }) {
    return <PermissionGate permission={permission} fallback={fallback}>{children}</PermissionGate>;
}

export function CanApprove({ permission, children, fallback = null }: { permission: string, children: React.ReactNode, fallback?: React.ReactNode }) {
    return <PermissionGate permission={permission} fallback={fallback}>{children}</PermissionGate>;
}
