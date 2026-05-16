export interface PagePermission {
  page: string;
  view: boolean;
  addUpdate: boolean;
  delete: boolean;
  can_process_blacklist?: boolean;
}

export type UserRole = 
  | 'Super Admin' 
  | 'Admin' 
  | 'Payroll Manager' 
  | 'HR Executive' 
  | 'MIS Executive' 
  | 'Accountant' 
  | 'Time-Keeper' 
  | 'Auditor'
  | 'Viewer';

export interface RbacCache {
  permissions: Record<string, boolean>;
  module_scope: 'K' | 'P' | 'BOTH';
}
