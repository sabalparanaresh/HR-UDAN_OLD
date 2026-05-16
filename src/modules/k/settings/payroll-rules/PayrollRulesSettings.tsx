import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { invoke } from '@tauri-apps/api/tauri';
import { toast } from 'sonner';
import { Save, Loader2, Info } from 'lucide-react';
import { usePermission } from '../../../../hooks/useRBAC';

const rulesSchema = z.object({
  k_salary_calculation_source: z.enum(['EMPLOYEE_MASTER', 'DAILY_MIS']),
});

type RulesFormData = z.infer<typeof rulesSchema>;

export default function PayrollRulesSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canEdit = usePermission('CompanySettings.edit'); // Assuming CompanySettings edit permission covers this

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RulesFormData>({
    resolver: zodResolver(rulesSchema),
    defaultValues: {
      k_salary_calculation_source: 'EMPLOYEE_MASTER',
    }
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await invoke<any>('get_payroll_rules');
      if (data) {
        reset({
          k_salary_calculation_source: data.k_salary_calculation_source || 'EMPLOYEE_MASTER',
        });
      }
    } catch (e: any) {
      toast.error('Failed to load payroll rules');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: RulesFormData) => {
    try {
      setSaving(true);
      await invoke('update_payroll_rules', { rules: data });
      toast.success('Payroll rules updated successfully');
    } catch (e: any) {
      toast.error('Failed to update payroll rules');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-primary-navy" />
      </div>
    );
  }

  return (
    <div className="bg-white border border-app-border border-b-4 border-b-primary-navy/20 rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 pt-12 transform translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
        <Save size={100} />
      </div>

      <div className="flex justify-between items-start mb-6 border-b border-app-border pb-4">
        <div>
          <h2 className="text-xl font-black text-primary-navy uppercase tracking-tight flex items-center gap-2">
            Payroll Rules
          </h2>
          <p className="text-[10px] uppercase font-bold text-text-muted mt-1 tracking-wider">
            K Module Salary Source Configuration
          </p>
        </div>
        {canEdit && (
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
            className="app-btn px-4 py-2 text-xs flex items-center gap-2 transition-transform active:scale-95"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Rules'}
          </button>
        )}
      </div>

      <form className="space-y-8" onSubmit={handleSubmit(onSubmit)}>
        {/* Card: K Salary Calculation Source */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-primary-navy flex items-center gap-2">
              K Salary Calculation Source
              <div className="group relative flex items-center cursor-help">
                <Info size={14} className="text-text-muted hover:text-primary-navy transition-colors" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg z-10 text-center pointer-events-none">
                  Determines which source of truth is used to calculate operational wages in the K module.
                  <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-800"></div>
                </div>
              </div>
            </h3>
            <p className="text-xs text-text-muted mt-1">Select the primary logic engine for generating final wages.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="relative flex flex-col font-mono cursor-pointer">
              <input
                type="radio"
                value="EMPLOYEE_MASTER"
                disabled={!canEdit}
                {...register('k_salary_calculation_source')}
                className="peer sr-only"
              />
              <div className="h-full bg-white border-2 border-slate-200 rounded-lg p-4 hover:border-slate-300 peer-checked:border-primary-navy peer-checked:bg-slate-50 transition-all flex items-start gap-3">
                <div className="mt-0.5 min-w-[16px]">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 peer-checked:border-primary-navy flex items-center justify-center bg-white transition-colors">
                    <div className="w-2 h-2 rounded-full bg-primary-navy scale-0 peer-[&:not(:checked)] opacity-0 transition-transform sibling-checked"></div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-primary-navy uppercase tracking-wider mb-1">Employee Master Wage</div>
                  <div className="text-[10px] text-slate-500 leading-relaxed normal-case font-sans">
                    Uses employee master wage/rate logic. Standard processing based on designations, classes, and master rates.
                  </div>
                </div>
              </div>
            </label>

            <label className="relative flex flex-col font-mono cursor-pointer">
              <input
                type="radio"
                value="DAILY_MIS"
                disabled={!canEdit}
                {...register('k_salary_calculation_source')}
                className="peer sr-only"
              />
              <div className="h-full bg-white border-2 border-slate-200 rounded-lg p-4 hover:border-slate-300 peer-checked:border-primary-navy peer-checked:bg-slate-50 transition-all flex items-start gap-3">
                <div className="mt-0.5 min-w-[16px]">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 peer-checked:border-primary-navy flex items-center justify-center bg-white transition-colors">
                    <div className="w-2 h-2 rounded-full bg-primary-navy scale-0 sibling-checked transition-transform"></div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-primary-navy uppercase tracking-wider mb-1">Daily MIS Wage</div>
                  <div className="text-[10px] text-slate-500 leading-relaxed normal-case font-sans">
                    Uses Daily MIS attendance combined with dynamic worked rates. Advanced processing path.
                  </div>
                </div>
              </div>
            </label>
          </div>
          {errors.k_salary_calculation_source && (
            <p className="text-primary-red text-xs mt-2">{errors.k_salary_calculation_source.message}</p>
          )}
        </div>
      </form>
      {/* Add custom CSS for radio button custom circles since tailwind forms sibling checked gets hard without proper plugin */}
      <style>{`
        input:checked + div > div > div > div {
          transform: scale(1);
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
