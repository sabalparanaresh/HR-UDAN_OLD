import { useState, useEffect, useMemo } from 'react';
import { invokeCommand as invoke } from '../services/apiClient';
import { ColDef, ColGroupDef } from 'ag-grid-community';

export interface SalaryHead {
  id: number;
  name: string;
  type: string;
  allocation_type: string;
  system_head?: string;
  is_part_of_ctc?: number | boolean;
  status?: number | boolean;
}

export interface ColumnEngineOptions {
  moduleContext: 'K' | 'P' | 'ALL' | '*';
  enableConditionalFormatting?: boolean;
}

export function useSalaryColumnEngine(options: ColumnEngineOptions) {
  const [heads, setHeads] = useState<SalaryHead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHeads = async () => {
      setLoading(true);
      try {
        // Fetch all active heads. P module generally has all heads synced from K.
        const data = await invoke<SalaryHead[]>('master_crud', {
          tableName: 'salary_heads',
          operation: 'list',
          moduleType: 'P', 
        });
        setHeads(data.filter(h => h.status)); // Only ACTIVE heads
      } catch (e) {
        console.error("Failed to fetch salary heads for column engine", e);
      } finally {
        setLoading(false);
      }
    };
    fetchHeads();
  }, []);

  const columns = useMemo(() => {
    const baseCols: (ColDef | ColGroupDef)[] = [
      {
        headerName: 'Employee Info',
        children: [
          { field: 'emp_code', headerName: 'Emp Code', pinned: 'left', minWidth: 120, filter: true },
          { field: 'name', headerName: 'Name', pinned: 'left', minWidth: 200, filter: true },
          { field: 'department', headerName: 'Department', filter: true },
          { field: 'designation', headerName: 'Designation', filter: true },
        ]
      },
      {
        headerName: 'Attendance & Rates',
        children: [
          { field: 'working_days', headerName: 'Total Days', width: 100, aggFunc: 'sum' },
          { field: 'k_attendance', headerName: 'Att. (K)', width: 100, aggFunc: 'sum' },
          { field: 'p_attendance', headerName: 'Att. (P)', width: 100, aggFunc: 'sum' },
          { field: 'wage_rate', headerName: 'Rate (K)', width: 120 },
          { field: 'statutory_rate', headerName: 'Rate (P)', width: 120 },
        ]
      }
    ];

    const formatCurrency = (params: any) => {
      if (params.value == null) return '-';
      return `₹${Number(params.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const conditionalStyle = options.enableConditionalFormatting
      ? (params: any) => {
          if (params.value < 0) return { color: '#dc2626', fontWeight: 'bold' };
          return null;
        }
      : undefined;

    // Filter heads dynamically
    const kEarning = heads.filter(h => h.type === 'EARNING' && (h.allocation_type === 'K' || h.allocation_type === 'K_ONLY'));
    const kDeduction = heads.filter(h => h.type === 'DEDUCTION' && (h.allocation_type === 'K' || h.allocation_type === 'K_ONLY'));
    
    const kpEarning = heads.filter(h => h.type === 'EARNING' && h.allocation_type === 'KP');
    const kpDeduction = heads.filter(h => h.type === 'DEDUCTION' && h.allocation_type === 'KP');

    if (options.moduleContext === 'K' || options.moduleContext === 'ALL' || options.moduleContext === '*') {
      baseCols.push({
        headerName: 'Earnings (K)',
        children: [
          { field: 'k_gross_wage', headerName: 'Gross Wage (K)', width: 140, aggFunc: 'sum', valueFormatter: formatCurrency, cellStyle: conditionalStyle } as ColDef,
          ...kEarning.map(h => ({
            field: `k_earning_${h.id}`,
            headerName: h.name,
            width: 130,
            aggFunc: 'sum',
            valueFormatter: formatCurrency,
            cellStyle: conditionalStyle
          } as ColDef))
        ]
      });

      baseCols.push({
        headerName: 'Deductions (K)',
        children: [
          ...kDeduction.map(h => ({
            field: `k_deduction_${h.id}`,
            headerName: h.name,
            width: 130,
            aggFunc: 'sum',
            valueFormatter: formatCurrency,
            cellStyle: conditionalStyle
          } as ColDef))
        ]
      });

      baseCols.push({
        headerName: 'Net (K)',
        children: [
          { field: 'k_net_payable', headerName: 'Net Payable (K)', width: 150, aggFunc: 'sum', valueFormatter: formatCurrency, cellStyle: conditionalStyle, pinned: 'right' } as ColDef
        ]
      });
    }

    if (options.moduleContext === 'P' || options.moduleContext === 'ALL' || options.moduleContext === '*') {
      baseCols.push({
        headerName: 'Earnings (P Statutory)',
        children: [
          { field: 'p_gross_wage', headerName: 'Gross Wage (P)', width: 140, aggFunc: 'sum', valueFormatter: formatCurrency, cellStyle: conditionalStyle } as ColDef,
          ...kpEarning.map(h => ({
            field: `p_earning_${h.id}`,
            headerName: h.name,
            width: 130,
            aggFunc: 'sum',
            valueFormatter: formatCurrency,
            cellStyle: conditionalStyle
          } as ColDef))
        ]
      });

      baseCols.push({
        headerName: 'Deductions (P Statutory)',
        children: [
          ...kpDeduction.map(h => ({
            field: `p_deduction_${h.id}`,
            headerName: h.name,
            width: 130,
            aggFunc: 'sum',
            valueFormatter: formatCurrency,
            cellStyle: conditionalStyle
          } as ColDef))
        ]
      });

      baseCols.push({
        headerName: 'Final (P)',
        children: [
          { field: 'p_gross_statutory_payable', headerName: 'Gross Stat. Pay (P)', width: 150, aggFunc: 'sum', valueFormatter: formatCurrency, cellStyle: conditionalStyle } as ColDef,
          { field: 'net_payable_final', headerName: 'Final Net Payable', width: 160, aggFunc: 'sum', valueFormatter: formatCurrency, cellStyle: conditionalStyle, pinned: 'right', cellClass: 'font-bold bg-emerald-50 text-emerald-700' } as ColDef
        ]
      });
    }

    return baseCols;
  }, [heads, options.moduleContext, options.enableConditionalFormatting]);

  return { columns, loading, heads };
}
