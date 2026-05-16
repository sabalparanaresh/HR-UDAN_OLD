import { useAuthStore } from '../store/authStore';
import { useModule } from '../contexts/ModuleContext';
import { authorize } from '../lib/rbac';

const PERMISSION_MAPPING: Record<string, string> = {
  'usermanagement': 'userManagementK',
  'attendance': 'attendance',
  'employeemaster': 'employeeMaster',
  'payroll': 'payrollK',
  'companysettings': 'settings',
  'costmis': 'costMIS'
};

const ACTION_MAPPING: Record<string, 'can_view' | 'can_insert' | 'can_edit' | 'can_delete'> = {
  'view': 'can_view',
  'edit': 'can_edit',
  'add': 'can_insert',
  'insert': 'can_insert',
  'create': 'can_insert',
  'delete': 'can_delete',
  'export': 'can_view',
  'approve': 'can_edit'
};

export function usePermission(pageKeyOrPerm: string, parsedAction?: 'can_view' | 'can_insert' | 'can_edit' | 'can_delete') {
  const { user } = useAuthStore();
  const { currentMode } = useModule();
  
  if (!user) return false;
  if (user.role === 'SUPERADMIN') return true;

  let pageKey = pageKeyOrPerm;
  let actionStr = parsedAction ? parsedAction.replace('can_', '') : 'view';

  if (pageKeyOrPerm.includes('.')) {
      const [feat, act] = pageKeyOrPerm.split('.');
      if (PERMISSION_MAPPING[feat.toLowerCase()]) {
          pageKey = PERMISSION_MAPPING[feat.toLowerCase()];
      } else {
          pageKey = feat.toLowerCase();
      }
      if (ACTION_MAPPING[act.toLowerCase()]) {
          actionStr = ACTION_MAPPING[act.toLowerCase()].replace('can_', '');
      } else {
          actionStr = act.toLowerCase();
      }
  }

  if (user.role === 'AUDITOR') {
      if (currentMode === 'K') return false; 
      if (currentMode === 'P' && actionStr === 'view') return true;
      return false;
  }

  // Use the central authorize function
  return authorize(user, `${pageKey}.${actionStr}`, currentMode);
}

export function useModuleAccess(requiredModule: 'K' | 'P') {
  const { user } = useAuthStore();
  const { currentMode } = useModule();
  
  if (!user) return false;
  if (user?.role === 'SUPERADMIN') return true;
  
  if (user.role === 'AUDITOR') {
      // Auditor has access to P only
      return requiredModule === 'P' && currentMode === 'P';
  }
  
  if (requiredModule !== currentMode) return false;
  
  const moduleScope = user.rbac_cache?.module_scope || 'NONE';
  return moduleScope === 'BOTH' || moduleScope === requiredModule;
}

export function useComponentAccess(pageKey: string) {
  // Backwards compatibility stub
  return usePermission(pageKey, 'can_view');
}

