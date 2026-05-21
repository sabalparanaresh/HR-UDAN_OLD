import { useQuery } from '@tanstack/react-query';
import { invokeCommand as invoke, fetchApi } from '../services/apiClient';
import { useModule } from '../contexts/ModuleContext';
import { toast } from 'sonner';
import { useEffect } from 'react';

export const useAttendanceMasterData = () => {
  const { currentMode } = useModule();
  
  const { data, error, isError } = useQuery({
    queryKey: ['master-data', currentMode],
    queryFn: () => fetchApi<any>('/api/master-data/get-master-data', { method: 'POST', body: JSON.stringify({ moduleType: currentMode }) }),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (isError && error) {
      console.error("Failed to load master data:", error);
      toast.error("Failed to load master data");
    }
  }, [isError, error]);

  return {
    departments: Array.isArray(data?.departments) ? data.departments : [],
    employees: Array.isArray(data?.employees) ? data.employees : [],
    locations: Array.isArray(data?.locations) ? data.locations : [],
    divisions: Array.isArray(data?.divisions) ? data.divisions : [],
    groups: Array.isArray(data?.groups) ? data.groups : [],
    categories: Array.isArray(data?.categories) ? data.categories : [],
    classes: Array.isArray(data?.classes) ? data.classes : [],
    designations: Array.isArray(data?.designations) ? data.designations : [],
    machines: Array.isArray(data?.machines) ? data.machines : [],
    shifts: Array.isArray(data?.shifts) ? data.shifts : [],
    holidays: Array.isArray(data?.holidays) ? data.holidays : [],
  };
};
