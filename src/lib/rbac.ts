import { User } from '../types';

/**
 * Enterprise RBAC Engine - Frontend Resolver
 * 
 * Centralized authorization based on the user's `rbac_cache` loaded during login.
 * Validates against pre-calculated module scopes and exact permission strings.
 */

export function authorize(user: User | null | undefined, permissionStr: string, currentModuleContext?: 'K' | 'P'): boolean {
  if (!user) return false;

  // SuperAdmin override - Immutable highest privilege
  if (user?.role === 'SUPERADMIN') {
    return true;
  }

  // Ensure user has a valid cache
  if (!user.rbac_cache) {
    return false;
  }

  // Module Scope Isolation
  if (currentModuleContext) {
    const scope = user.rbac_cache.module_scope;
    if (scope !== 'BOTH' && scope !== currentModuleContext) {
      return false; // User's scope is restricted from this module entirely
    }
  }

  // Exact permission match
  return !!user.rbac_cache.permissions[permissionStr];
}

// Higher order wrapper for React components
export function useRbac(user: User | null | undefined, currentModuleContext?: 'K' | 'P') {
  return {
    can: (permissionStr: string) => authorize(user, permissionStr, currentModuleContext),
    isSuperAdmin: user?.role === 'SUPERADMIN',
    isAuditor: user?.role === 'Auditor',
  };
}
