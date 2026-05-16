import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  user: User | null;
  permissionMap: Record<string, boolean>;
  moduleScope: 'K' | 'P' | 'BOTH' | 'NONE';
  auditMode: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setAuditMode: (enabled: boolean) => void;
  setError: (err: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      permissionMap: {},
      moduleScope: 'NONE',
      auditMode: false,
      error: null,
      setUser: (user) => set({
        user,
        permissionMap: user?.rbac_cache?.permissions || {},
        moduleScope: user?.rbac_cache?.module_scope || 'NONE',
        error: null
      }, false, 'setUser'),
      setAuditMode: (enabled) => set({ auditMode: enabled }, false, 'setAuditMode'),
      setError: (err) => set({ error: err }, false, 'setError')
    }),
    { name: 'AuthStore' }
  )
);

