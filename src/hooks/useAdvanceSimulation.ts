import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeCommand as invoke } from '../services/apiClient';
import { toast } from 'sonner';

export const useAdvanceSimulation = (
  wageMonth: string,
  fromDate: string,
  toDate: string,
  employeeFilters: any
) => {
  const queryClient = useQueryClient();

  const simulationQuery = useQuery({
    queryKey: ['advanceSimulation', wageMonth, fromDate, toDate, employeeFilters],
    queryFn: async () => {
      if (!wageMonth) return [];

      const filtersObj = {
        departmentId: employeeFilters?.departmentIds?.length > 0 ? employeeFilters.departmentIds : null,
        locationId: employeeFilters?.locationIds?.length > 0 ? employeeFilters.locationIds : null,
        groupId: employeeFilters?.groupIds?.length > 0 ? employeeFilters.groupIds : null,
        divisionId: employeeFilters?.divisionIds?.length > 0 ? employeeFilters.divisionIds : null,
        classId: employeeFilters?.classIds?.length > 0 ? employeeFilters.classIds : null,
        categoryId: employeeFilters?.categoryIds?.length > 0 ? employeeFilters.categoryIds : null,
        designationId: employeeFilters?.designationIds?.length > 0 ? employeeFilters.designationIds : null,
      };

      const kResults = await invoke<any[]>('calculate_k_module_wages', {
        month: wageMonth,
        filters: filtersObj,
        fromDate,
        toDate
      });

      const pResults = await invoke<any[]>('calculate_p_module_statutory', {
        month: wageMonth,
        kResults
      });

      return pResults
        .filter((r) => r.k_gross_payable > 0 || r.k_gross_wage > 0)
        .map(r => {
          const kDedsObj = JSON.parse(r.k_deductions || '{}');
          const pDedsObj = JSON.parse(r.p_deductions || '{}');
          
          let kDedsTotal = 0;
          Object.values(kDedsObj).forEach((v: any) => kDedsTotal += Number(v));

          let pDedsTotal = 0;
          Object.values(pDedsObj).forEach((v: any) => pDedsTotal += Number(v));

          const pGross = r.k_net_payable || r.net_payable_final || 0;
          const netPayable = pGross - pDedsTotal;

          return {
            ...r,
            group_dept: r.department || r.group_name || 'N/A',
            k_gross_earned: Math.round(r.k_gross_payable || 0),
            k_total_deduction: Math.round(kDedsTotal),
            p_gross: Math.round(pGross),
            p_total_deduction: Math.round(pDedsTotal),
            p_attendance: r.p_attendance || 0,
            net_payable: Math.round(netPayable),
            advance_input: 0,
            remaining: Math.round(netPayable)
          };
        });
    },
    enabled: false, // Wait for user trigger
  });

  const postAdvancesMutation = useMutation({
    mutationFn: async ({ 
      validEntries, 
      authorizerId, 
      paymentType, 
      remark 
    }: { 
      validEntries: any[], 
      authorizerId: number, 
      paymentType: string, 
      remark: string 
    }) => {
      await invoke('post_advance_transactions', {
        advances: validEntries.map(v => ({ emp_id: v.emp_id, amount: v.advance_input })),
        monthYear: wageMonth,
        userId: 1, // Ensure userId is passed (like active user id, but we can assume 1 for now or skip)
        authorisedBy: authorizerId,
        paymentMode: paymentType,
        remark: remark
      });
    },
    onSuccess: () => {
      toast.success('Advances posted successfully');
      queryClient.invalidateQueries({ queryKey: ['advanceSimulation'] });
    },
    onError: (error: any) => {
      toast.error(String(error));
    }
  });

  return {
    simulationQuery,
    postAdvancesMutation
  };
};
