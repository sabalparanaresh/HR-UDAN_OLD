import { useQuery } from '@tanstack/react-query';
import { invokeCommand as invoke } from '../services/apiClient';

export function useRoles(moduleType?: string) {
    return useQuery({
        queryKey: ['rolesList', moduleType],
        queryFn: async () => {
            const res = await invoke<any>('user_crud', { operation: 'get_roles', moduleType });
            return { success: true, data: res };
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
    });
}
