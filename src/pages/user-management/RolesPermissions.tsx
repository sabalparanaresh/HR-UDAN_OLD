import React, { useState, useMemo } from 'react';
import { useModule } from '../../contexts/ModuleContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { invokeCommand as invoke } from '../../services/apiClient';
import { useRoles } from '../../hooks/useRoles';

export const SYSTEM_PAGES = {
  primary: [
    { menu: 'Masters & Settings', page: 'General Settings', key: 'settings' },
    { menu: 'Masters & Settings', page: 'Department Master', key: 'departmentMaster' },
    { menu: 'Employee Master', page: 'Employee Master', key: 'employeeMaster' },
    { menu: 'Transactions', page: 'Attendance', key: 'attendance' },
    { menu: 'Transactions', page: 'Payroll', key: 'payrollK' },
    { menu: 'Reports & Analytics', page: 'Cost MIS', key: 'costMIS' },
    { menu: 'User Management', page: 'User Access', key: 'userManagementK' }
  ],
  statutory: [
    { menu: 'Masters & Settings', page: 'Statutory Settings', key: 'statutorySettings' },
    { menu: 'Employee Master', page: 'Statutory Employee Master', key: 'statutoryEmployee' },
    { menu: 'Transactions', page: 'Salary Process', key: 'salaryProcessP' },
    { menu: 'Transactions', page: 'Audit Adjustments', key: 'auditAdjustments' },
    { menu: 'Reports & Analytics', page: 'Compliance Reports', key: 'complianceReports' },
    { menu: 'User Management', page: 'Auditor Access', key: 'userManagementP' }
  ]
};

export default React.memo(function RolesPermissions() {
    const queryClient = useQueryClient();
    const { currentMode } = useModule();
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [activeModuleTab, setActiveModuleTab] = useState<'K' | 'P'>('K');
    const [permissionsState, setPermissionsState] = useState<any[]>([]);
    
    const { data: rolesData, isLoading: rolesLoading } = useRoles(currentMode);

    const { data: permsData, isLoading: permsLoading } = useQuery({
        queryKey: ['rolePermissions', selectedRoleId, currentMode],
        queryFn: async () => {
            if (!selectedRoleId) return { data: [] };
            const res = await invoke<any>('user_crud', { operation: 'get_role_permissions', id: selectedRoleId, moduleType: currentMode });
            return { success: true, data: res };
        },
        enabled: !!selectedRoleId,
        staleTime: 1000 * 60 * 5, // 5 mins
        gcTime: 1000 * 60 * 30, // 30 mins
    });

    React.useEffect(() => {
        if (permsData?.data) {
            setPermissionsState(permsData.data);
        }
    }, [permsData]);

    const updatePermsMutation = useMutation({
        mutationFn: async (perms: any[]) => {
            await invoke('user_crud', { 
                operation: 'update_role_permissions', 
                id: selectedRoleId, 
                data: { permissions: perms },
                moduleType: currentMode
            });
        },
        onSuccess: () => {
            toast.success('Permissions updated successfully!');
            queryClient.invalidateQueries({ queryKey: ['rolePermissions', selectedRoleId, currentMode] });
        },
        onError: (e: Error) => {
            toast.error(e.message);
        }
    });

    const roles = useMemo(() => {
        return (rolesData?.data || []).filter((r: any) => currentMode === 'P' || r.name !== 'Auditor');
    }, [rolesData?.data, currentMode]);
    
    const selectedRole = useMemo(() => {
        return roles.find((r: any) => r.id === selectedRoleId);
    }, [roles, selectedRoleId]);

    const togglePermission = React.useCallback((pageKey: string, moduleCode: string, menuGroup: string, field: 'can_view'|'can_insert'|'can_edit'|'can_delete') => {
        if (selectedRole?.name === 'SUPERADMIN' || selectedRole?.name === 'AUDITOR') return; // Read-only UI for auditor editing

        setPermissionsState(prev => {
            const existingIdx = prev.findIndex(p => p.page_key === pageKey && p.module === moduleCode);
            if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx] = { ...next[existingIdx], [field]: next[existingIdx][field] === 1 ? 0 : 1 };
                // Also auto-check "View" if giving insert/edit/delete
                if (field !== 'can_view' && next[existingIdx][field] === 1) {
                    next[existingIdx].can_view = 1;
                }
                return next;
            } else {
                return [...prev, {
                    role_id: selectedRoleId,
                    module: moduleCode,
                    menu_group: menuGroup,
                    page_key: pageKey,
                    can_view: field === 'can_view' ? 1 : 1, // imply view=1 if other actions toggled
                    can_insert: field === 'can_insert' ? 1 : 0,
                    can_edit: field === 'can_edit' ? 1 : 0,
                    can_delete: field === 'can_delete' ? 1 : 0
                }];
            }
        });
    }, [selectedRole]);

    const getPerm = (pageKey: string, moduleCode: string, field: 'can_view'|'can_insert'|'can_edit'|'can_delete') => {
        if (selectedRole?.name === 'SUPERADMIN') return true;
        if (selectedRole?.name === 'AUDITOR' && field === 'can_view') return true; // Auditor has readonly always
        if (selectedRole?.name === 'AUDITOR') return false; // Other perms false

        return permissionsState.find(p => p.page_key === pageKey && p.module === moduleCode)?.[field] === 1;
    };

    const handleSave = () => {
        updatePermsMutation.mutate(permissionsState);
    };

    return (
        <div className="flex bg-white rounded shadow border border-gray-200 h-[700px]">
            {/* Roles Sidebar */}
            <div className="w-1/4 border-r border-gray-200 flex flex-col bg-gray-50">
                <div className="p-4 border-b font-semibold text-gray-700 bg-gray-100">System Roles</div>
                <div className="flex-1 overflow-y-auto">
                    {rolesLoading ? (
                        <div className="p-4 text-gray-500">Loading roles...</div>
                    ) : (
                        <ul className="space-y-1 p-2">
                            {roles.map((r: any) => (
                                <li key={r.id}>
                                    <button 
                                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                                            selectedRoleId === r.id 
                                            ? 'bg-indigo-600 text-white font-medium' 
                                            : 'text-gray-700 hover:bg-gray-200'
                                        }`}
                                        onClick={() => setSelectedRoleId(r.id)}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span>{r.name}</span>
                                            {r.module_scope === 'P' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">P-Only</span>}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Matrix View */}
            <div className="w-3/4 flex flex-col">
                {!selectedRoleId ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        Select a role to configure permissions
                    </div>
                ) : (
                    <>
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-lg">{selectedRole?.name} Permissions</h3>
                            <div className="flex gap-2">
                                <button className="px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 rounded flex items-center gap-2" onClick={() => queryClient.invalidateQueries({ queryKey: ['rolePermissions', selectedRoleId, currentMode] })}>
                                    <RefreshCw className="w-4 h-4" /> Reset
                                </button>
                                <button 
                                    className="px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded flex items-center gap-2 disabled:opacity-50"
                                    onClick={handleSave}
                                    disabled={selectedRole?.name === 'SUPERADMIN' || updatePermsMutation.isPending}
                                >
                                    <Save className="w-4 h-4" /> Save Adjustments
                                </button>
                            </div>
                        </div>

                        {selectedRole?.name === 'SUPERADMIN' && (
                            <div className="p-4 bg-yellow-50 text-yellow-800 border-b border-yellow-200 text-sm">
                                SUPERADMIN implicitly bypasses all permission checks. Configuration is not required.
                            </div>
                        )}
                        {selectedRole?.name === 'AUDITOR' && (
                            <div className="p-4 bg-blue-50 text-blue-800 border-b border-blue-200 text-sm">
                                AUDITOR implicitly has read-only access to all features in P Module. Modification is restricted.
                            </div>
                        )}

                        <div className="flex border-b">
                            <button 
                                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeModuleTab === 'K' ? 'border-primary-navy text-primary-navy' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                                onClick={() => setActiveModuleTab('K')}
                            >
                                K Module (Primary)
                            </button>
                            <button 
                                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeModuleTab === 'P' ? 'border-primary-navy text-primary-navy' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                                onClick={() => setActiveModuleTab('P')}
                            >
                                P Module (Statutory)
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {permsLoading ? (
                                <div className="text-gray-500 text-center mt-10">Loading permissions...</div>
                            ) : (
                                <table className="w-full border-collapse">
                                    <thead className="bg-gray-50 sticky top-0 border-b shadow-sm z-10">
                                        <tr className="text-left text-xs uppercase text-gray-600 tracking-wider">
                                            <th className="px-4 py-3 border-r" style={{ width: '40%' }}>Feature / Page</th>
                                            <th className="px-4 py-3 text-center border-r">View</th>
                                            <th className="px-4 py-3 text-center border-r">Insert</th>
                                            <th className="px-4 py-3 text-center border-r">Edit</th>
                                            <th className="px-4 py-3 text-center border-r">Delete</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(
                                            (activeModuleTab === 'K' ? SYSTEM_PAGES.primary : SYSTEM_PAGES.statutory)
                                            .reduce((acc, curr) => {
                                                if (!acc[curr.menu]) acc[curr.menu] = [];
                                                acc[curr.menu].push(curr);
                                                return acc;
                                            }, {} as any)
                                        ).map(([group, pages]: any) => (
                                            <React.Fragment key={group}>
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-2 bg-gray-100 font-semibold text-gray-800 text-sm border-b">
                                                        {group}
                                                    </td>
                                                </tr>
                                                {pages.map((p: any) => {
                                                    const mCode = activeModuleTab;
                                                    const disabled = selectedRole?.name === 'SUPERADMIN' || selectedRole?.name === 'AUDITOR' || (mCode === 'K' && selectedRole?.scope === 'P');

                                                    return (
                                                        <tr key={p.key} className="border-b hover:bg-gray-50 transition-colors">
                                                            <td className="px-4 py-3 text-sm text-gray-700 pl-8 border-r">{p.page}</td>
                                                            <td className="px-4 py-3 text-center border-r">
                                                                <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50" 
                                                                       checked={getPerm(p.key, mCode, 'can_view')} onChange={() => togglePermission(p.key, mCode, p.menu, 'can_view')} disabled={disabled}/>
                                                            </td>
                                                            <td className="px-4 py-3 text-center border-r">
                                                                <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50" 
                                                                       checked={getPerm(p.key, mCode, 'can_insert')} onChange={() => togglePermission(p.key, mCode, p.menu, 'can_insert')} disabled={disabled}/>
                                                            </td>
                                                            <td className="px-4 py-3 text-center border-r">
                                                                <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50" 
                                                                       checked={getPerm(p.key, mCode, 'can_edit')} onChange={() => togglePermission(p.key, mCode, p.menu, 'can_edit')} disabled={disabled}/>
                                                            </td>
                                                            <td className="px-4 py-3 text-center border-r">
                                                                <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50" 
                                                                       checked={getPerm(p.key, mCode, 'can_delete')} onChange={() => togglePermission(p.key, mCode, p.menu, 'can_delete')} disabled={disabled}/>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
});
