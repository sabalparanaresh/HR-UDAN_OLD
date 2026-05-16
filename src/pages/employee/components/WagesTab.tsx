import React, { useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { FormProvider } from 'react-hook-form';
import { Wallet, Calculator, Info, History, Plus, ShieldAlert, ShieldCheck, ShieldX, BookOpen } from 'lucide-react';
import { useEmployeeForm } from '../EmployeeFormContext';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import PSalaryDetailsGrid from '../../../modules/k/employee-master/components/salary/PSalaryDetailsGrid';

export default function WagesTab() {
  const { 
    form, currentMode, isSuperAdmin, 
    weeklyOffSource, selectedEmployeeId, 
    salarySlabs,
    fetchRevisionHistory, setIsRevisionHistoryOpen,
    isBifurcationExceeded, isShowingHistoricalRate,
    revisionData, setRevisionData, setIsRevisionRecordOpen,
    workingDayTypes, bifurcationData, isBifurcationValid,
    gratuityLedger, gratuityEligibility, isFteContractValue, employees, isRoot
  } = useEmployeeForm();
  
  const { register, formState: { errors }, watch, setValue } = form;

  const wageTypeValue = watch('wage_type');
  const selectedSlabId = watch('slab_id');

  return (
    <FormProvider {...form}>
                <Tabs.Content value="wages" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-app-border pb-2">
                        <h3 className="textile-header font-bold text-primary-navy">
                          {currentMode === 'P' ? 'Statutory Wages' : 'Wages Type'}
                        </h3>
                        {selectedEmployeeId && (
                          <button
                            type="button"
                            onClick={() => {
                              fetchRevisionHistory(parseInt(selectedEmployeeId));
                              setIsRevisionHistoryOpen(true);
                            }}
                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-primary-navy hover:text-primary-red transition-colors"
                          >
                            <History size={14} />
                            Revision History
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <SearchableSelect
                            label="Wage Type"
                            required={true}
                            options={currentMode === 'P' ? ["Monthly", "Daily"] : ["Daily", "Hourly", "Monthly", "Piece rate", "Fix"]}
                            value={watch('wage_type') || ''}
                            onChange={(val) => setValue('wage_type', val)}
                            placeholder="Select Wage Type"
                          />
                        </div>
      
                        {currentMode === 'P' && (
                          <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                            <SearchableSelect
                              label="Salary Slab"
                              required={true}
                              options={salarySlabs.map(s => ({ value: s.id.toString(), label: s.slab_name || s.name }))}
                              value={watch('slab_id') || ''}
                              onChange={(val) => setValue('slab_id', val)}
                              placeholder="Select Slab"
                            />
                          </div>
                        )}
      
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1 relative">
                            <label className={cn(
                              "text-[10px] textile-header text-text-muted uppercase transition-colors flex items-center gap-2",
                              isBifurcationExceeded && "text-primary-red font-bold"
                            )}>
                              {currentMode === 'P' ? 'Statutory CTC (*)' : 'Wage Amount (*)'}
                              {isShowingHistoricalRate && (
                                <span className="bg-primary-navy/10 text-primary-navy px-1.5 py-0.5 rounded text-[8px] font-bold animate-pulse">
                                  Showing latest revision
                                </span>
                              )}
                            </label>
                            <div className="flex gap-2">
                              <input 
                                type="number" 
                                {...register('wage_amount', { valueAsNumber: true })} 
                                readOnly={!!selectedEmployeeId}
                                className={cn(
                                  "w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono transition-all",
                                  selectedEmployeeId && "bg-slate-100 cursor-not-allowed",
                                  isBifurcationExceeded && "border-primary-red bg-primary-red/5 ring-1 ring-primary-red"
                                )} 
                              />
                              {selectedEmployeeId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRevisionData({
                                      ...revisionData,
                                      newRate: watch('wage_amount') || 0,
                                      effectiveDate: watch('wage_effective_from') || new Date().toISOString().split('T')[0]
                                    });
                                    setIsRevisionRecordOpen(true);
                                  }}
                                  className="bg-primary-navy text-white px-3 rounded-md hover:bg-opacity-90 transition-all flex items-center justify-center shrink-0"
                                  title="Revise Salary"
                                >
                                  <Plus size={16} />
                                </button>
                              )}
                            </div>
                            {isBifurcationExceeded && (
                              <p className="text-primary-red text-[10px] mt-1 flex items-center gap-1 font-bold">
                                <ShieldAlert size={10} /> Bifurcation exceeds total CTC
                              </p>
                            )}
                            {selectedEmployeeId && (
                              <p className="text-[9px] text-text-muted italic mt-1 font-bold uppercase tracking-tighter">
                                * Use '+' button to record a formal salary revision
                              </p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] textile-header text-text-muted uppercase">Effective From (*)</label>
                            <input 
                              type="date" 
                              {...register('wage_effective_from')} 
                              readOnly={!!selectedEmployeeId}
                              className={cn(
                                "w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md",
                                selectedEmployeeId && "bg-slate-100 cursor-not-allowed"
                              )} 
                            />
                          </div>
                        </div>
      
                        {watch('wage_type') === 'Monthly' && !isRoot && currentMode !== 'P' && (
                          <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                            <SearchableSelect
                              label="Working Day Type"
                              options={workingDayTypes.map(w => ({ value: w.id.toString(), label: w.name }))}
                              value={watch('working_day_type_id') || ''}
                              onChange={(val) => setValue('working_day_type_id', val)}
                              placeholder="Select Working Day Type"
                            />
                          </div>
                        )}
      
                        {currentMode === 'P' && (
                          <div className="pt-4 border-t border-app-border grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                                {watch('is_pf_covered') ? <ShieldCheck size={12} className="text-indigo-600" /> : <ShieldX size={12} className="text-slate-400" />}
                                PF Contribution Active
                              </label>
                              <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600/20">
                                <input 
                                  type="checkbox"
                                  {...register('is_pf_covered')}
                                  className="peer h-6 w-11 cursor-pointer appearance-none rounded-full border border-slate-300 bg-slate-200 checked:bg-indigo-600 transition-all"
                                />
                                <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                                {watch('is_esi_covered') ? <ShieldCheck size={12} className="text-purple-600" /> : <ShieldX size={12} className="text-slate-400" />}
                                ESI Contribution Active
                              </label>
                              <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600/20">
                                <input 
                                  type="checkbox"
                                  {...register('is_esi_covered')}
                                  className="peer h-6 w-11 cursor-pointer appearance-none rounded-full border border-slate-300 bg-slate-200 checked:bg-purple-600 transition-all"
                                />
                                <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
      
                    {currentMode === 'P' && bifurcationData.length > 0 && (
                      <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4 animate-in slide-in-from-right-4 duration-500">
                        <div className="flex items-center justify-between border-b border-app-border pb-2">
                          <h3 className="textile-header font-bold text-primary-navy flex items-center gap-2">
                            <Calculator size={18} className="text-primary-navy" />
                            Statutory Bifurcation
                          </h3>
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold",
                            isBifurcationValid ? "bg-primary-green/10 text-primary-green" : "bg-primary-red/10 text-primary-red"
                          )}>
                            {isBifurcationValid ? 'BALANCED' : 'UNBALANCED'}
                          </span>
                        </div>
                        <div className="overflow-hidden rounded-md border border-app-border">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-[10px] font-mono uppercase text-text-muted">
                                <th className="p-2 border-b border-app-border">Salary Head</th>
                                <th className="p-2 border-b border-app-border text-right">Computed Amount</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs font-mono">
                              {bifurcationData.map((item, idx) => (
                                <tr key={idx} className="border-b border-app-border last:border-0 hover:bg-slate-50 transition-colors">
                                  <td className="p-2 font-bold text-primary-navy">{item.headName}</td>
                                  <td className="p-2 text-right">₹{item.amount.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-primary-navy/5 font-bold">
                                <td className="p-2 text-[10px]">TOTAL BIFURCATED</td>
                                <td className="p-2 text-right">₹{bifurcationData.reduce((sum, i) => sum + i.amount, 0).toLocaleString()}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
      
                    {currentMode === 'P' && selectedEmployeeId && (
                      <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden">
                        <div className="flex items-center gap-2 text-primary-navy border-b border-app-border pb-2">
                          <BookOpen size={18} />
                          <h3 className="text-sm font-bold uppercase tracking-tight">Gratuity Provision Ledger</h3>
                        </div>
                        
                        <div className="bg-slate-50 border border-app-border rounded-xl overflow-hidden shadow-inner font-mono">
                          <div className="p-4 bg-primary-navy/5 border-b border-app-border flex justify-between items-center">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-text-muted uppercase block">Total Accrued Fund</span>
                              <span className="text-xl font-black text-primary-navy">
                                ₹{gratuityLedger.reduce((acc, curr) => acc + (curr.accrued_amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="text-right space-y-1">
                              <span className="text-[10px] font-bold text-text-muted uppercase block">Vesting Plan</span>
                              <span className={cn(
                                "text-[10px] font-black px-2 py-1 rounded-full",
                                isFteContractValue ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                              )}>
                                {isFteContractValue ? '1-YR PRO RATA (FTE)' : '5-YR STANDARD'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="overflow-x-auto max-h-[300px]">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-white border-b border-app-border sticky top-0 z-10">
                                <tr>
                                  <th className="p-3 text-text-muted uppercase font-bold">Month</th>
                                  <th className="p-3 text-text-muted uppercase font-bold text-right">Base Salary</th>
                                  <th className="p-3 text-text-muted uppercase font-bold text-right">Provision</th>
                                  <th className="p-3 text-text-muted uppercase font-bold text-right">Balance</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-app-border/30">
                                {gratuityLedger.length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="p-8 text-center text-text-muted italic bg-white">
                                      <div className="flex flex-col items-center gap-2">
                                        <ShieldCheck size={32} className="opacity-20" />
                                        <p>No provisions recorded for this employee.</p>
                                      </div>
                                    </td>
                                  </tr>
                                ) : (
                                  gratuityLedger.map((row, i) => (
                                    <tr key={i} className="hover:bg-white transition-colors group">
                                      <td className="p-3 font-black text-primary-navy">{row.month_year}</td>
                                      <td className="p-3 text-right">₹{(row.base_salary_snapshot || 0).toLocaleString()}</td>
                                      <td className="p-3 text-right">
                                        <span className="text-primary-green font-bold">+₹{(row.accrued_amount || 0).toFixed(2)}</span>
                                      </td>
                                      <td className="p-3 text-right font-black">₹{(row.cumulative_provision || 0).toFixed(2)}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                          <div className="p-2.5 bg-white border-t border-app-border flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <ShieldCheck className="text-primary-navy" size={14} />
                               <span className="text-[9px] text-text-muted font-bold uppercase tracking-tight">Verified for Statutory Audit - SS Code 2020</span>
                             </div>
                             {gratuityEligibility.status === 'eligible' && (
                               <span className="text-[8px] font-black bg-primary-green/20 text-primary-green px-2 py-0.5 rounded-full animate-pulse">VESTED</span>
                             )}
                          </div>
                        </div>
                      </div>
                    )}
      
                    {weeklyOffSource === 'Employee' && (
                      <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4 h-fit">
                        <h3 className="textile-header font-bold text-primary-navy border-b border-app-border pb-2">Weekly Off</h3>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-1">
                            <SearchableSelect
                              label="Weekly Off"
                              required={false}
                              options={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(d => ({ value: d, label: d }))}
                              value={watch('weekly_off') || ''}
                              onChange={(val) => setValue('weekly_off', val)}
                              placeholder="Select Day"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] textile-header text-text-muted uppercase">Effective Date</label>
                            <input type="date" {...register('weekly_off_effective_date')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                          </div>
                        </div>
                      </div>
                    )}
      
                    {currentMode !== 'P' && (
                      <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4 md:col-span-2">
                        <h3 className="textile-header font-bold text-primary-navy border-b border-app-border pb-2">Parent Employee Mapping</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <SearchableSelect
                              label="Parent Employee"
                              options={employees.map(e => ({ value: e.id.toString(), label: `${e.emp_code} - ${e.name}` }))}
                              value={watch('parent_employee_id') || ''}
                              onChange={(val) => setValue('parent_employee_id', val)}
                              placeholder="Search Parent Employee"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] textile-header text-text-muted uppercase">Salary Process Sequence</label>
                            <input 
                              type="number" 
                              {...register('salary_process_sequence', { valueAsNumber: true })} 
                              disabled={isRoot}
                              className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono disabled:opacity-50" 
                            />
                          </div>
                          <div className="flex items-end pb-1">
                            <p className="text-[10px] text-text-muted italic">
                              * This employee will be linked to the selected parent for reporting and hierarchy purposes.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {currentMode !== 'P' && selectedEmployeeId && (
                     <PSalaryDetailsGrid employeeId={parseInt(selectedEmployeeId)} />
                  )}
                </Tabs.Content>
      
                {/* Documents & Payment Tab */}
    </FormProvider>
  );
}
