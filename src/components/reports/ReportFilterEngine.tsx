import React, { useEffect, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FilterDTO, FilterDTOSchema } from '../../types/ReportFilters';
import { invokeCommand as invoke } from '../../services/apiClient';
import { useModule } from '../../contexts/ModuleContext';
import { Filter, Calendar, Users, Briefcase, Play, Factory } from 'lucide-react';

interface ReportFilterEngineProps {
  onApplyFilters: (filters: FilterDTO) => void;
  defaultValues?: Partial<FilterDTO>;
  showDateRange?: boolean;
  showMonthYear?: boolean;
  availableCols?: string[];
}

export function ReportFilterEngine({ 
  onApplyFilters, 
  defaultValues,
  showDateRange = true,
  showMonthYear = false,
  availableCols = []
}: ReportFilterEngineProps) {
  const { currentMode } = useModule();
  const [masters, setMasters] = useState({
    departments: [] as any[],
    designations: [] as any[],
    divisions: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<FilterDTO>({
    resolver: zodResolver(FilterDTOSchema),
    defaultValues: {
      status: 'ACTIVE',
      module_type: currentMode as any,
      custom_filters: [],
      ...defaultValues
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'custom_filters'
  });

  useEffect(() => {
    // Check if defaultValues changed and reset
    if (defaultValues) {
      reset({ status: 'ACTIVE', module_type: currentMode as any, ...defaultValues });
    }
  }, [defaultValues, reset, currentMode]);

  useEffect(() => {
    const fetchMasters = async () => {
      setLoading(true);
      try {
        const [depts, desigs, divs] = await Promise.all([
          invoke('master_crud', { tableName: 'departments', operation: 'list', moduleType: currentMode }).catch(() => []),
          invoke('master_crud', { tableName: 'designations', operation: 'list', moduleType: currentMode }).catch(() => []),
          invoke('master_crud', { tableName: 'divisions', operation: 'list', moduleType: currentMode }).catch(() => [])
        ]) as [any[], any[], any[]];
        
        setMasters({
          departments: depts,
          designations: desigs,
          divisions: divs
        });
      } catch (e) {
        console.error("Failed to load filter masters", e);
      } finally {
        setLoading(false);
      }
    };
    fetchMasters();
  }, [currentMode]);

  const onSubmit = (data: FilterDTO) => {
    onApplyFilters(data);
  };

  const handleClear = () => {
    reset({
      status: 'ACTIVE',
      wage_type: 'ALL',
      module_type: currentMode as any,
      department_ids: [],
      designation_ids: [],
      division_ids: [],
      custom_filters: []
    });
    // Immediately apply cleared filters
    onApplyFilters({
      status: 'ACTIVE',
      module_type: currentMode as any
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Time Filters */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <Calendar size={14} /> Time Period
          </h4>
          
          {showMonthYear && (
             <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Month/Year</label>
                <input 
                  type="month" 
                  {...register('month_year')}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-sm outline-none focus:border-blue-500 transition-colors"
                />
             </div>
          )}

          {showDateRange && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-mono text-slate-500 mb-1">From Date</label>
                <input 
                  type="date" 
                  {...register('date_range.from')}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-mono text-slate-500 mb-1">To Date</label>
                <input 
                  type="date" 
                  {...register('date_range.to')}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* Organization Filters */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <Factory size={14} /> Organization
          </h4>
          
          <Controller
            name="department_ids"
            control={control}
            render={({ field }) => (
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Department</label>
                <select 
                  multiple 
                  value={field.value?.map(String) || []} 
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, (option: any) => Number(option.value));
                    field.onChange(values);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:border-blue-500 transition-colors h-16"
                >
                  {masters.departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 mt-0.5">Ctrl/Cmd+Click for multiple</p>
              </div>
            )}
          />
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <Briefcase size={14} /> Role
          </h4>

          <Controller
            name="designation_ids"
            control={control}
            render={({ field }) => (
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Designation</label>
                <select 
                  multiple 
                  value={field.value?.map(String) || []} 
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, (option: any) => Number(option.value));
                    field.onChange(values);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:border-blue-500 transition-colors h-16"
                >
                  {masters.designations.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
          />
        </div>

        {/* Employee State Filters */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <Users size={14} /> Status & Rules
          </h4>
          
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-mono text-slate-500 mb-1">Status</label>
              <select 
                {...register('status')}
                className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-sm outline-none focus:border-blue-500 transition-colors"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-mono text-slate-500 mb-1">Wage Type</label>
              <select 
                {...register('wage_type')}
                className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-sm outline-none focus:border-blue-500 transition-colors"
              >
                <option value="ALL">All Types</option>
                <option value="DAILY_WAGE">Daily Wage</option>
                <option value="PIECE_RATE">Piece Rate</option>
              </select>
            </div>
          </div>
        </div>

      </div>

      {availableCols.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <div className="flex justify-between items-end border-b border-app-border pb-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-primary-navy flex items-center gap-2">
              <Filter size={14}/> Custom Column Filters
            </h4>
            <button 
              type="button"
              onClick={() => append({ field: availableCols[0], operator: 'equals', value: '' })}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
            >
              + ADD CONDITION
            </button>
          </div>
          
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-center p-2 bg-slate-50 border border-slate-200 rounded">
                <select 
                  {...register(`custom_filters.${index}.field` as const)}
                  className="w-1/3 bg-white border border-slate-200 rounded p-1.5 text-sm outline-none focus:border-blue-500 transition-colors font-mono"
                >
                  {availableCols.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select 
                  {...register(`custom_filters.${index}.operator` as const)}
                  className="w-1/4 bg-white border border-slate-200 rounded p-1.5 text-sm outline-none focus:border-blue-500 transition-colors font-mono"
                >
                  <option value="equals">Equals</option>
                  <option value="contains">Contains</option>
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                  <option value="gte">&gt;=</option>
                  <option value="lte">&lt;=</option>
                </select>
                <input 
                  type="text" 
                  {...register(`custom_filters.${index}.value` as const)}
                  className="flex-1 bg-white border border-slate-200 rounded p-1.5 text-sm outline-none focus:border-blue-500 transition-colors"
                  placeholder="Value..."
                />
                <button 
                  type="button" 
                  onClick={() => remove(index)} 
                  className="text-rose-500 hover:text-rose-700 text-xs px-2"
                >
                  ✕
                </button>
              </div>
            ))}
            {fields.length === 0 && <p className="text-[10px] text-slate-400 italic font-mono text-center py-2">No custom column filters</p>}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-slate-200 mt-4">
        <button 
          type="button" 
          onClick={handleClear}
          className="text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors"
        >
          Clear Filters
        </button>
        <button 
          type="submit" 
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded font-semibold text-sm hover:bg-blue-700 transition-colors"
        >
          <Play size={16} /> Apply Filters
        </button>
      </div>
    </form>
  );
}
