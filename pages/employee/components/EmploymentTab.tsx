import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { FormProvider } from 'react-hook-form';
import { Briefcase, Building2, MapPin, Search, ShieldCheck, CheckCircle2, ShieldAlert, Lock } from 'lucide-react';
import { useEmployeeForm } from '../EmployeeFormContext';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import { EmployeeSearchSelect } from '../../../components/form/EmployeeSearchSelect';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function EmploymentTab() {
  const { 
    form, currentMode, isSuperAdmin,
    employeeStatuses, employmentTypes, groups, departments,
    designations, locations, divisions, categories, classes,
    shifts, employees, selectedGroupId, selectedLocationId,
    isRoot, gratuityEligibility, estimatedGratuity, isFteContractValue
  } = useEmployeeForm();
  const { register, formState: { errors }, watch, setValue } = form;

  return (
    <FormProvider {...form}>
                <Tabs.Content value="employment" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4">
                      <h3 className="textile-header font-bold text-primary-navy border-b border-app-border pb-2">Employment Status</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] textile-header text-text-muted uppercase">Employee Status</label>
                              {gratuityEligibility.status !== 'none' && (
                                <div 
                                  className={cn(
                                    "flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-black animate-in zoom-in duration-300",
                                    gratuityEligibility.status === 'eligible' ? "bg-primary-green/10 text-primary-green" : "bg-slate-100 text-text-muted"
                                  )}
                                  title={gratuityEligibility.status === 'eligible' ? 'Employee is eligible for Gratuity payout.' : `${gratuityEligibility.days} days remaining for eligibility`}
                                >
                                  <ShieldCheck size={10} />
                                  {gratuityEligibility.status === 'eligible' ? (isFteContractValue ? 'Eligible (FTE)' : 'Eligible (Std)') : 'Not Eligible'}
                                </div>
                              )}
                            </div>
                            <SearchableSelect
                              label="Employee Status"
                              required={true}
                              options={employeeStatuses.length > 0 ? employeeStatuses.map(s => ({ value: s.id.toString(), label: s.name })) : ["Active", "Terminated", "Resigned", "Left Without Notice"].map(s => ({ value: s, label: s }))}
                              value={watch('employee_status_id') || watch('employee_status') || ''}
                              onChange={(val) => {
                                const masterStatus = employeeStatuses.find(s => s.id.toString() === val);
                                if (masterStatus) {
                                  setValue('employee_status_id', val);
                                  setValue('employee_status', masterStatus.name);
                                } else {
                                  setValue('employee_status', val);
                                }
                              }}
                              placeholder="Select Status"
                            />
                          </div>
                          <div className="space-y-1">
                            <SearchableSelect
                              label="Employment Type"
                              options={employmentTypes.length > 0 ? employmentTypes.map(t => ({ value: t.id.toString(), label: t.name })) : ["Permanent", "Trainee", "Apprentice", "Probationary"].map(t => ({ value: t, label: t }))}
                              value={watch('employment_type_id') || watch('employment_type') || ''}
                              onChange={(val) => {
                                const masterType = employmentTypes.find(t => t.id.toString() === val);
                                if (masterType) {
                                  setValue('employment_type_id', val);
                                  setValue('employment_type', masterType.name);
                                } else {
                                  setValue('employment_type', val);
                                }
                              }}
                              placeholder="Select Type"
                            />
                            <div className="flex items-center gap-2 mt-1">
                              <input 
                                type="checkbox" 
                                id="is_fte_contract"
                                {...register('is_fte_contract')}
                                className="h-3 w-3 rounded text-primary-navy"
                              />
                              <label htmlFor="is_fte_contract" className="text-[9px] font-bold text-primary-navy uppercase cursor-pointer">Fixed-Term Contract (FTE)</label>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] textile-header text-text-muted uppercase">Joining Date (*)</label>
                            <input type="date" {...register('joining_date')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] textile-header text-text-muted uppercase">Book Joining Date</label>
                            <input type="date" {...register('book_joining_date')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">Leaving Date</label>
                          <input type="date" {...register('leaving_date')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                        </div>
      
                        {currentMode === 'P' && watch('leaving_date') && (
                          <div className="p-4 bg-primary-navy/5 border border-primary-navy/20 rounded-lg space-y-4 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between border-b border-primary-navy/10 pb-2">
                              <div className="flex items-center gap-2 text-primary-navy">
                                <CheckCircle2 size={16} />
                                <h4 className="text-[10px] font-black uppercase tracking-widest">F&F Settlement Preview</h4>
                              </div>
                              <span className="text-[8px] font-bold text-text-muted">STATUTORY ESTIMATE</span>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="flex justify-between items-center bg-white p-2 rounded border border-app-border">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck size={14} className={estimatedGratuity > 0 ? "text-primary-green" : "text-slate-300"} />
                                  <span className="text-[10px] font-bold text-primary-navy">GRATUITY COMPONENT</span>
                                </div>
                                <span className={cn(
                                  "text-xs font-black",
                                  estimatedGratuity > 0 ? "text-primary-navy" : "text-text-muted"
                                )}>
                                  ₹{estimatedGratuity.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              
                              {estimatedGratuity > 0 ? (
                                <div className="text-[9px] text-primary-green font-bold flex items-center gap-1">
                                  <CheckCircle2 size={10} /> 
                                  Employee eligible for Gratuity payout
                                </div>
                              ) : (
                                <div className="text-[9px] text-text-muted italic flex items-center gap-1">
                                  <ShieldAlert size={10} /> 
                                  Criteria not met for Gratuity payout.
                                </div>
                              )}
      
                              <div className="bg-primary-navy text-white p-3 rounded-lg flex justify-between items-center shadow-md">
                                <span className="text-[10px] font-black uppercase tracking-tighter">Net Settlement Estimate</span>
                                <span className="text-sm font-black">₹{estimatedGratuity.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                            
                            <p className="text-[8px] text-text-muted leading-tight">
                              * This is a provisional calculation. Actual settlement includes leave encashment, bonus, and salary dues. 
                              Calculation: ({watch('wage_amount')}/26) * 15 * Completed Years.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
      
                    <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4">
                      <h3 className="textile-header font-bold text-primary-navy border-b border-app-border pb-2">Organisational Info</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <SearchableSelect
                            label="Group"
                            options={groups.map(g => ({ value: g.id.toString(), label: g.name }))}
                            value={watch('group_id') || ''}
                            onChange={(val) => setValue('group_id', val)}
                            placeholder="Select Group"
                          />
                        </div>
                        <div className="space-y-1">
                          <SearchableSelect
                            label="Department"
                            required={true}
                            options={departments
                              .filter(d => !selectedGroupId || d.group_id === Number(selectedGroupId))
                              .map(d => ({ value: d.id.toString(), label: d.name }))
                            }
                            value={watch('department_id') || ''}
                            onChange={(val) => setValue('department_id', val)}
                            placeholder="Select Department"
                          />
                        </div>
                        <div className="space-y-1">
                          <SearchableSelect
                            label="Designation"
                            required={true}
                            options={designations.map(d => ({ value: d.id.toString(), label: d.name }))}
                            value={watch('designation_id') || ''}
                            onChange={(val) => {
                              setValue('designation_id', val);
                              const selected = designations.find(d => d.id.toString() === val);
                              if (selected) setValue('designation', selected.name);
                            }}
                            placeholder="Select Designation"
                          />
                        </div>
                        <div className="space-y-1">
                          <SearchableSelect
                            label="Location"
                            options={locations.map(l => ({ value: l.id.toString(), label: l.name }))}
                            value={watch('location_id') || ''}
                            onChange={(val) => setValue('location_id', val)}
                            placeholder="Select Location"
                          />
                        </div>
                        <div className="space-y-1">
                          <SearchableSelect
                            label="Division"
                            options={divisions
                              .filter(d => !selectedLocationId || d.location_id === Number(selectedLocationId))
                              .map(d => ({ value: d.id.toString(), label: d.name }))
                            }
                            value={watch('division_id') || ''}
                            onChange={(val) => setValue('division_id', val)}
                            placeholder="Select Division"
                          />
                        </div>
                        <div className="space-y-1">
                          <SearchableSelect
                            label="Category"
                            options={categories.map(c => ({ value: c.id.toString(), label: c.name }))}
                            value={watch('category_id') || ''}
                            onChange={(val) => setValue('category_id', val)}
                            placeholder="Select Category"
                          />
                        </div>
                        <div className="space-y-1">
                          <SearchableSelect
                            label="Class"
                            options={classes.map(c => ({ value: c.id.toString(), label: c.name }))}
                            value={watch('class_id') || ''}
                            onChange={(val) => setValue('class_id', val)}
                            placeholder="Select Class"
                          />
                        </div>
                        {!isRoot && (
                          <div className="space-y-1 animate-in fade-in duration-300">
                            <SearchableSelect
                              label="Shift Allocation"
                              required={true}
                              options={shifts.map(s => ({ value: s.id.toString(), label: s.name }))}
                              value={watch('shift_id') || ''}
                              onChange={(val) => setValue('shift_id', val)}
                              placeholder="Select Shift"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
      
                  <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4">
                    <h3 className="textile-header font-bold text-primary-navy border-b border-app-border pb-2">Assignment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <EmployeeSearchSelect
                          label="Reporting To"
                          employees={employees}
                          value={watch('reporting_employee_id') || ''}
                          onChange={(val) => setValue('reporting_employee_id', val ? String(val) : '')}
                          placeholder="Search Employee"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] textile-header text-text-muted uppercase">Referenced By</label>
                        <input {...register('referenced_by')} placeholder="Referral Name" className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                      </div>
                    </div>
      
                    {/* Vigilance Section */}
                    <div className="pt-6 border-t border-app-border space-y-4">
                      <div className="flex items-center gap-2 text-primary-navy">
                        <ShieldAlert size={18} />
                        <h3 className="text-sm font-bold uppercase tracking-tight">Vigilance Control</h3>
                      </div>
                      
                      <div className="bg-slate-50 p-4 rounded-xl border border-app-border space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <label className="text-xs font-bold text-primary-navy">Mark as Blacklisted</label>
                            <p className="text-[10px] text-text-muted">Restrict transactions for this employee</p>
                          </div>
                          <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-navy/20 disabled:cursor-not-allowed disabled:opacity-50">
                            <input 
                              type="checkbox"
                              disabled={!isSuperAdmin && !([])?.find(p => p.page === 'Payroll')?.can_process_blacklist}
                              {...register('blacklist_status')}
                              className="peer h-6 w-11 cursor-pointer appearance-none rounded-full border border-slate-300 bg-slate-200 checked:bg-primary-red transition-all"
                            />
                            <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                          </div>
                        </div>
      
                        {watch('blacklist_status') && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Effective Date</label>
                              <input 
                                type="date"
                                required
                                {...register('blacklist_effective_date')}
                                className="w-full bg-white border border-app-border p-2 text-xs rounded outline-none focus:border-primary-navy"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Remarks</label>
                              <textarea 
                                required
                                {...register('blacklist_remarks')}
                                rows={2}
                                className="w-full bg-white border border-app-border p-2 text-xs rounded outline-none focus:border-primary-navy"
                                placeholder="Reason for blacklisting..."
                              />
                            </div>
                            {watch('blacklist_authorizer_name') && (
                              <div className="md:col-span-2 flex items-center gap-2 p-2 bg-primary-red/5 border border-primary-red/10 rounded text-[10px] text-primary-red font-bold">
                                <Lock size={12} />
                                AUTHORIZED BY: {watch('blacklist_authorizer_name')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Tabs.Content>
      
                {/* Wages & Weekly Off Tab */}
    </FormProvider>
  );
}
