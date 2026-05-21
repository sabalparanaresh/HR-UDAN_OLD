import React, { useState, useMemo } from 'react';
import { useModule } from '../../contexts/ModuleContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { fetchApi } from '../../services/apiClient';
import { usePermission } from '../../hooks/useRBAC';
import { useRoles } from '../../hooks/useRoles';

export default React.memo(function UserList() {
    const { user: currentUser } = useAuthStore();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const { currentMode } = useModule();
    const canCreate = usePermission(currentMode === 'K' ? 'userManagementK.create' : 'userManagementP.create');
    const canEdit = usePermission(currentMode === 'K' ? 'userManagementK.edit' : 'userManagementP.edit');
    const canDelete = usePermission(currentMode === 'K' ? 'userManagementK.delete' : 'userManagementP.delete');    
    const [form, setForm] = useState({ id: 0, name: '', username: '', password: '', role_id: '', status: 'ACTIVE' });

    const { data: usersData, isLoading } = useQuery({
        queryKey: ['usersList', currentMode],
        queryFn: async () => {
            const res = await fetchApi<{ success: boolean; data: any[] }>('/api/users');
            return res;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
    });

    const { data: rolesData } = useRoles(currentMode);

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            if (data.id) {
                await fetchApi(`/api/users/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
                await fetchApi('/api/users', { method: 'POST', body: JSON.stringify(data) });
            }
        },
        onSuccess: () => {
            toast.success('User saved successfully');
            queryClient.invalidateQueries({ queryKey: ['usersList'] });
            setIsModalOpen(false);
        },
        onError: (e: any) => toast.error(e.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await fetchApi(`/api/users/${id}`, { method: 'DELETE' });
        },
        onSuccess: () => {
            toast.success('User deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['usersList'] });
        },
        onError: (e: any) => toast.error(e.message)
    });

    const roles = useMemo(() => {
        return (rolesData?.data || []).filter((r: any) => currentMode === 'P' || r.name !== 'Auditor');
    }, [rolesData?.data, currentMode]);
    
    const users = useMemo(() => {
        return (usersData?.data || []).filter((u: any) => {
            if (currentUser?.role !== 'SUPERADMIN' && u.role_name === 'SUPERADMIN') return false;
            if (currentMode === 'K' && (u.role_name === 'Auditor' || u.role_name === 'AUDITOR')) return false;
            return true;
        });
    }, [usersData?.data, currentUser?.role, currentMode]);

    const handleEdit = React.useCallback((u: any) => {
        setForm({ id: u.id, name: u.name, username: u.username, password: '', role_id: u.role_id, status: u.status });
        setIsModalOpen(true);
    }, []);

    const handleSave = React.useCallback((e: React.FormEvent) => {
        e.preventDefault();
        saveMutation.mutate(form);
    }, [form, saveMutation]);

    if (isLoading) return <div>Loading users...</div>;

    return (
        <div className="bg-white p-6 rounded shadow border border-gray-200 relative">
            <div className="flex justify-between mb-4 items-center">
                <h2 className="text-lg font-bold text-gray-800">User List</h2>
                {canCreate && <button onClick={() => { setForm({ id: 0, name: '', username: '', password: '', role_id: '', status: 'ACTIVE' }); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-indigo-700">
                    <Plus className="w-4 h-4" /> Add User
                </button>}
            </div>
            
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-y text-xs uppercase text-gray-500">
                    <tr>
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u: any) => (
                        <tr key={u.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">{u.username}</td>
                            <td className="px-4 py-3 text-gray-600">{u.name}</td>
                            <td className="px-4 py-3 text-gray-600">{u.role_name}</td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {u.status}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                                {canEdit && <button onClick={() => handleEdit(u)} className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded mr-2"><Edit2 className="w-4 h-4" /></button>}
                                {canDelete && <button onClick={() => { if(confirm('Are you sure?')) deleteMutation.mutate(u.id); }} className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>}
                            </td>
                        </tr>
                    ))}
                    {users.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No users found.</td></tr>
                    )}
                </tbody>
            </table>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded shadow-xl w-[400px] p-6 relative">
                        <h3 className="text-xl font-bold mb-4">{form.id ? 'Edit User' : 'Add User'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
                            <X className="w-5 h-5" />
                        </button>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input type="text" required className="w-full text-sm border-gray-300 rounded p-2 border" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                <input type="text" required className="w-full text-sm border-gray-300 rounded p-2 border" value={form.username} onChange={e => setForm({...form, username: e.target.value})} disabled={!!form.id} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password {form.id && '(Leave blank to keep unchanged)'}</label>
                                <input type="password" required={!form.id} className="w-full text-sm border-gray-300 rounded p-2 border" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                <select required className="w-full text-sm border-gray-300 rounded p-2 border" value={form.role_id} onChange={e => setForm({...form, role_id: e.target.value})}>
                                    <option value="">Select Role</option>
                                    {roles.map((r: any) => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select required className="w-full text-sm border-gray-300 rounded p-2 border" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="INACTIVE">INACTIVE</option>
                                </select>
                            </div>
                            <button disabled={saveMutation.isPending} type="submit" className="w-full bg-indigo-600 text-white font-semibold rounded py-2 hover:bg-indigo-700 mt-4 disabled:opacity-50">
                                Save
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
});
