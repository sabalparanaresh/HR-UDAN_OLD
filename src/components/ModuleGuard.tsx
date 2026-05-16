import React from 'react';
import { useModule } from '../contexts/ModuleContext';
import { ShieldAlert } from 'lucide-react';
import { usePermission, useModuleAccess } from '../hooks/useRBAC';

interface ModuleGuardProps {
  children: React.ReactNode;
  requiredModule?: 'K' | 'P' | '*';
  requiredPermission?: string;
}

export default function ModuleGuard({ children, requiredModule, requiredPermission }: ModuleGuardProps) {
  const { currentMode } = useModule();
  
  // A wildcard means access is determined dynamically by the current mode.
  const isModuleAllowed = requiredModule && requiredModule !== '*' 
    ? useModuleAccess(requiredModule as 'K' | 'P') 
    : true;
    
  // If requiredModule is specified and doesn't match currentMode (except wildcard), return null
  if (requiredModule && requiredModule !== '*' && requiredModule !== currentMode) {
    return null;
  }
  
  const isPermAllowed = requiredPermission ? usePermission(requiredPermission) : true;

  if (requiredPermission && !isPermAllowed) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
        <p className="text-slate-600 max-w-md">
          You do not have the required permissions to view this component.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export function withModuleGuard<P extends object>(WrappedComponent: React.ComponentType<P>, requiredModule?: 'K' | 'P' | '*') {
  return function WithModuleGuardWrapper(props: P) {
    return (
      <ModuleGuard requiredModule={requiredModule}>
        <WrappedComponent {...props} />
      </ModuleGuard>
    );
  };
}
