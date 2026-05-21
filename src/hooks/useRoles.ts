import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../services/apiClient';

export function useRoles(moduleType?: string) {
    return useQuery({
        queryKey: ['rolesList', moduleType],
        queryFn: async () => {
            const res = await fetchApi<{ success: boolean; data: any }>('/api/users/roles');
            return res;
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
    });
}
