import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { FormProvider } from 'react-hook-form';
import { FileText, Link as LinkIcon, Download, Info, Landmark, History, Plus, Trash2, ShieldAlert, Loader2, Search } from 'lucide-react';
import { useEmployeeForm } from '../EmployeeFormContext';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function DocsTab() {
  const { 
    form, currentMode, isSuperAdmin, handleFileDownload, handleDuplicateCheck, employeeAge, 
    isExitDateLocked, addPfRecord, pfHistory, removePfRecord, 
    addEsiRecord, esiHistory, removeEsiRecord, 
    isIfscSearching, handleIfscSearch, addBankDetail, bankHistory, removeBankDetail 
  } = useEmployeeForm();
  const { register, formState: { errors }, watch, setValue } = form;

  return (
    <FormProvider {...form}>
                <Tabs.Content value="docs" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4">
                      <h3 className="textile-header font-bold text-primary-navy border-b border-app-border pb-2">Documents & IDs</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">Aadhar Number (*)</label>
                          <input 
                            {...register('aadhar_no')} 
                            onBlur={(e) => handleDuplicateCheck('aadhar_no', e.target.value, 'Aadhar Number')}
                            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono" 
                            placeholder="0000 0000 0000" 
                          />
                          {errors.aadhar_no && <p className="text-primary-red text-[10px]">{errors.aadhar_no.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">PAN Number</label>
                          <input 
                            {...register('pan_no')} 
                            onBlur={(e) => handleDuplicateCheck('pan_no', e.target.value, 'PAN Number')}
                            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono uppercase" 
                            placeholder="ABCDE1234F" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">Driving Licence</label>
                          <input 
                            {...register('driving_licence')} 
                            onBlur={(e) => handleDuplicateCheck('driving_licence', e.target.value, 'Driving Licence')}
                            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">Voter ID</label>
                          <input 
                            {...register('voter_id')} 
                            onBlur={(e) => handleDuplicateCheck('voter_id', e.target.value, 'Voter ID')}
                            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">Passport Number</label>
                          <input 
                            {...register('passport_no')} 
                            onBlur={(e) => handleDuplicateCheck('passport_no', e.target.value, 'Passport Number')}
                            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">UAN (PF)</label>
                          <input 
                            {...register('uan_no')} 
                            onBlur={(e) => handleDuplicateCheck('uan_no', e.target.value, 'UAN Number')}
                            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono" 
                          />
                        </div>
      
                        {employeeAge >= 58 && (
                          <div className="md:col-span-2 flex items-center justify-between p-3 bg-primary-navy/5 border border-primary-navy/10 rounded-lg animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary-navy/10 rounded-full flex items-center justify-center text-primary-navy">
                                <History size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-primary-navy">Cessation of EPS contribution</p>
                                <p className="text-[10px] text-text-muted">Statutory age 58 reached. Auto-exempt by default.</p>
                              </div>
                            </div>
                            <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-navy/20">
                              <input 
                                type="checkbox"
                                {...register('eps_exempt')}
                                className="peer h-6 w-11 cursor-pointer appearance-none rounded-full border border-slate-300 bg-slate-200 checked:bg-primary-navy transition-all"
                              />
                              <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                            </div>
                          </div>
                        )}
      
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">PF Number</label>
                          <input 
                            {...register('pf_number')} 
                            onBlur={(e) => handleDuplicateCheck('pf_number', e.target.value, 'PF Number')}
                            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">PF Joining Date</label>
                          <input type="date" {...register('pf_joining_date')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">PF Exit Date</label>
                          <input 
                            type="date" 
                            {...register('pf_exit_date')} 
                            disabled={isExitDateLocked}
                            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md disabled:opacity-50" 
                          />
                        </div>
                        <div className="space-y-1">
                          <SearchableSelect
                            label="PF Exit Reason"
                            options={[
                              "RETIREMENT",
                              "DEATH IN SERVICE",
                              "SUPERANNUATION",
                              "PERMANENT DISABLEMENT",
                              "CESSATION (SHORT SERVICE)"
                            ].map(r => ({ value: r, label: r }))}
                            value={watch('pf_exit_reason') || ''}
                            onChange={(val) => setValue('pf_exit_reason', val)}
                            placeholder="Select Reason"
                          />
                        </div>
                        <div className="md:col-span-2 pt-1">
                          <button
                            type="button"
                            onClick={addPfRecord}
                            className="w-full flex items-center justify-center gap-2 py-1.5 px-4 bg-primary-navy/10 text-primary-navy text-[10px] font-bold rounded-md hover:bg-primary-navy/20 transition-all border border-primary-navy/20"
                          >
                            <Plus size={12} /> Add PF Record to History
                          </button>
                        </div>
      
                        {pfHistory.length > 0 && (
                          <div className="md:col-span-2 mt-2 space-y-2">
                            <h4 className="text-[10px] font-bold text-primary-navy uppercase border-b border-app-border pb-1">PF History</h4>
                            <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                              {pfHistory.map((item, idx) => (
                                <div key={idx} className="p-2 bg-slate-50 border border-app-border rounded-md text-[10px] relative group">
                                  <button
                                    type="button"
                                    onClick={() => removePfRecord(idx)}
                                    className="absolute top-1 right-1 text-primary-red opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                    <p><span className="font-bold">PF No:</span> {item.pf_number}</p>
                                    <p><span className="font-bold">Join:</span> {item.pf_joining_date}</p>
                                    <p><span className="font-bold">Exit:</span> {item.pf_exit_date || 'N/A'}</p>
                                    <p className="col-span-2"><span className="font-bold">Reason:</span> {item.pf_exit_reason || 'N/A'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
      
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">ESI IP Number</label>
                          <input 
                            {...register('esi_ip_number')} 
                            onBlur={(e) => handleDuplicateCheck('esi_ip_number', e.target.value, 'ESI IP Number')}
                            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono" 
                          />
                          {(Number(watch('wage_amount')) > 21000 || employeeAge < 18) && (
                            <p className="text-[9px] text-primary-red font-bold mt-1 animate-pulse flex items-center gap-1">
                              <ShieldAlert size={10} /> 
                              {employeeAge < 18 ? 'RESTRICTED: Minor Employee' : 'RESTRICTED: Wage > ₹21,000'}
                              - ESI IP generation NOT recommended
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">ESI Joining Date</label>
                          <input type="date" {...register('esi_joining_date')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                        </div>
                        <div className="md:col-span-2 pt-1">
                          <button
                            type="button"
                            onClick={addEsiRecord}
                            className="w-full flex items-center justify-center gap-2 py-1.5 px-4 bg-primary-navy/10 text-primary-navy text-[10px] font-bold rounded-md hover:bg-primary-navy/20 transition-all border border-primary-navy/20"
                          >
                            <Plus size={12} /> Add ESI Record to History
                          </button>
                        </div>
      
                        {esiHistory.length > 0 && (
                          <div className="md:col-span-2 mt-2 space-y-2">
                            <h4 className="text-[10px] font-bold text-primary-navy uppercase border-b border-app-border pb-1">ESI History</h4>
                            <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                              {esiHistory.map((item, idx) => (
                                <div key={idx} className="p-2 bg-slate-50 border border-app-border rounded-md text-[10px] relative group">
                                  <button
                                    type="button"
                                    onClick={() => removeEsiRecord(idx)}
                                    className="absolute top-1 right-1 text-primary-red opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                  <div className="grid grid-cols-2 gap-x-2">
                                    <p><span className="font-bold">ESI No:</span> {item.esi_ip_number}</p>
                                    <p><span className="font-bold">Join:</span> {item.esi_joining_date}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
      
                        <div className="flex flex-col gap-4 pt-4 md:col-span-2">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" {...register('voluntary_pf_applicable')} id="voluntaryPf" className="w-4 h-4 text-primary-navy border-app-border rounded focus:ring-primary-navy" />
                            <label htmlFor="voluntaryPf" className="text-xs textile-header text-text-muted uppercase cursor-pointer">Voluntary PF Applicable</label>
                          </div>
      
                          {watch('voluntary_pf_applicable') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300 bg-slate-50 p-4 rounded-lg border border-app-border">
                              <div className="space-y-1">
                                <SearchableSelect
                                  label="Voluntary PF Type"
                                  options={["Percentage", "Amount"].map(t => ({ value: t, label: t }))}
                                  value={watch('voluntary_pf_type') || 'Percentage'}
                                  onChange={(val) => setValue('voluntary_pf_type', val as any)}
                                  placeholder="Select Type"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] textile-header text-text-muted uppercase">
                                  {watch('voluntary_pf_type') === 'Percentage' ? 'Percentage (%)' : 'Amount (₹)'}
                                </label>
                                <input 
                                  type="number" 
                                  {...register('voluntary_pf_value', { valueAsNumber: true })} 
                                  className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono" 
                                  placeholder={watch('voluntary_pf_type') === 'Percentage' ? 'e.g. 12' : 'e.g. 1000'}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
      
                    <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4">
                      <h3 className="textile-header font-bold text-primary-navy border-b border-app-border pb-2">Payment Details</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <SearchableSelect
                            label="Payment Mode"
                            options={["Bank Transfer", "Cash", "Cheque"].map(m => ({ value: m, label: m }))}
                            value={watch('payment_mode') || ''}
                            onChange={(val) => setValue('payment_mode', val as any)}
                            placeholder="Select Mode"
                          />
                        </div>
                        
                        {(watch('payment_mode') === 'Bank Transfer' || watch('payment_mode') === 'Cheque') && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">IFSC Code</label>
                              <div className="relative">
                                <input 
                                  {...register('ifsc_code')} 
                                  className="w-full bg-slate-50 border border-app-border p-2 pr-10 text-sm rounded-md font-mono uppercase focus:outline-none focus:border-primary-navy" 
                                  placeholder="HDFC0001234"
                                />
                                <button
                                  type="button"
                                  onClick={handleIfscSearch}
                                  disabled={isIfscSearching}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-navy hover:text-primary-navy/70 disabled:opacity-50"
                                >
                                  {isIfscSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                </button>
                              </div>
                            </div>
      
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">Bank Name</label>
                              <input {...register('bank_name')} className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-md focus:outline-none focus:border-primary-navy" />
                            </div>
      
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">Account Number</label>
                              <input 
                                {...register('account_no')} 
                                onBlur={(e) => handleDuplicateCheck('account_no', e.target.value, 'Account Number')}
                                className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-md font-mono focus:outline-none focus:border-primary-navy" 
                              />
                            </div>
      
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">Employee Name (As per bank records)</label>
                              <input {...register('as_per_bank_name')} className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-md focus:outline-none focus:border-primary-navy" />
                            </div>
      
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">Effective Date</label>
                              <input type="date" {...register('bank_effective_date')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                            </div>
      
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={addBankDetail}
                                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary-navy text-white text-xs font-bold rounded-md hover:bg-opacity-90 transition-all"
                              >
                                <Plus size={14} /> Add Bank Detail
                              </button>
                            </div>
      
                            {bankHistory.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <h4 className="text-[10px] font-bold text-primary-navy uppercase border-b border-app-border pb-1">Bank History</h4>
                                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                                  {bankHistory.map((item, idx) => (
                                    <div key={idx} className="p-2 bg-slate-50 border border-app-border rounded-md text-[10px] relative group">
                                      <button
                                        type="button"
                                        onClick={() => removeBankDetail(idx)}
                                        className="absolute top-1 right-1 text-primary-red opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                        <p><span className="font-bold">IFSC:</span> {item.ifsc_code}</p>
                                        <p><span className="font-bold">Bank:</span> {item.bank_name}</p>
                                        <p className="col-span-2"><span className="font-bold">A/C:</span> {item.account_no}</p>
                                        <p className="col-span-2"><span className="font-bold">Name:</span> {item.as_per_bank_name}</p>
                                        <p><span className="font-bold">Date:</span> {item.bank_effective_date}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Tabs.Content>
      
                {/* Employment History Tab */}
    </FormProvider>
  );
}
