import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { FormProvider } from 'react-hook-form';
import { Camera, Image as ImageIcon, MapPin, Search, Upload, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useEmployeeForm } from '../EmployeeFormContext';
import { SearchableSelect, MultiSearchableSelect } from '../../../components/common/SearchableSelect';
import PincodeSearch from '../../../components/form/PincodeSearch';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper function
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function GeneralTab() {
  const { 
    form, 
    photoPreview, 
    signaturePreview, 
    photoInputRef, 
    signatureInputRef, 
    handlePhotoChange, 
    handleSignatureChange,
    isManualCodeAllowed,
    setIsBiometricManuallyEdited,
    employeeAge,
    isDifferentlyAbled,
    isCurrentManualEntry,
    setIsCurrentManualEntry,
    isCurrentPincodeVerified,
    setIsCurrentPincodeVerified,
    currentPincodeResults,
    setCurrentPincodeResults,
    isPermSameAsCurrent,
    isPermManualEntry,
    setIsPermManualEntry,
    isPermPincodeVerified,
    setIsPermPincodeVerified,
    permPincodeResults,
    setPermPincodeResults,
    currentMode,
    isSuperAdmin
  } = useEmployeeForm();

  const { register, formState: { errors }, watch, setValue } = form;

  return (
    <FormProvider {...form}>
                        <Tabs.Content value="general" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4">
                      <div className="flex items-start gap-6">
                        <div className="space-y-4">
                          <input 
                            type="file" 
                            ref={photoInputRef} 
                            className="hidden" 
                            accept=".jpg,.jpeg,.png,.bmp" 
                            onChange={handlePhotoChange} 
                          />
                          <input 
                            type="file" 
                            ref={signatureInputRef} 
                            className="hidden" 
                            accept=".jpg,.jpeg,.png,.bmp" 
                            onChange={handleSignatureChange} 
                          />
                          <div 
                            onClick={() => photoInputRef.current?.click()}
                            className="w-32 h-32 bg-slate-100 rounded-full border-2 border-dashed border-app-border flex flex-col items-center justify-center text-text-muted hover:bg-slate-200 cursor-pointer transition-colors overflow-hidden"
                          >
                            {photoPreview ? (
                              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <>
                                <Upload size={24} />
                                <span className="text-[10px] uppercase font-bold mt-2">Upload Photo</span>
                              </>
                            )}
                          </div>
                          <div 
                            onClick={() => signatureInputRef.current?.click()}
                            className="w-32 h-16 bg-slate-100 rounded border-2 border-dashed border-app-border flex flex-col items-center justify-center text-text-muted hover:bg-slate-200 cursor-pointer transition-colors overflow-hidden"
                          >
                            {signaturePreview ? (
                              <img src={signaturePreview} alt="Signature Preview" className="w-full h-full object-contain" />
                            ) : (
                              <>
                                <Upload size={16} />
                                <span className="text-[8px] uppercase font-bold mt-1">Upload Signature</span>
                              </>
                            )}
                          </div>
                        </div>
      
                        <div className="flex-1 space-y-4">
                          <h3 className="textile-header font-bold text-primary-navy border-b border-app-border pb-2">Personal Information</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase flex items-center gap-1">
                                Employee Code (*)
                                {!isManualCodeAllowed && <Lock size={10} className="text-primary-navy" />}
                              </label>
                              <input 
                                {...register('emp_code')} 
                                readOnly={!isManualCodeAllowed}
                                className={cn(
                                  "w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono",
                                  !isManualCodeAllowed && "bg-slate-200 cursor-not-allowed"
                                )} 
                              />
                              {errors.emp_code && <p className="text-primary-red text-[10px]">{errors.emp_code.message}</p>}
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">Biometric / Device ID</label>
                              <input 
                                {...register('biometric_id')} 
                                onChange={(e) => {
                                  setIsBiometricManuallyEdited(true);
                                  register('biometric_id').onChange(e);
                                }}
                                className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md font-mono" 
                              />
                            </div>
                            <div></div>
      
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">First Name (*)</label>
                              <input {...register('first_name')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                              {errors.first_name && <p className="text-primary-red text-[10px]">{errors.first_name.message}</p>}
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">Middle Name</label>
                              <input {...register('middle_name')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">Last Name (*)</label>
                              <input {...register('last_name')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                              {errors.last_name && <p className="text-primary-red text-[10px]">{errors.last_name.message}</p>}
                            </div>
      
                            <div className="sm:col-span-3 space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">Full Name as per Aadhar (*)</label>
                              <input {...register('full_name_aadhar')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                              {errors.full_name_aadhar && <p className="text-primary-red text-[10px]">{errors.full_name_aadhar.message}</p>}
                            </div>
      
                            <div className="sm:col-span-3 space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">Father / Husband / Guardian Name (*)</label>
                              <input {...register('father_husband_guardian_name')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                              {errors.father_husband_guardian_name && <p className="text-primary-red text-[10px]">{errors.father_husband_guardian_name.message}</p>}
                            </div>
      
                            <SearchableSelect 
                              label="Gender"
                              required
                              options={["Male", "Female", "Other"]}
                              value={watch('gender') || ''}
                              onChange={(val) => setValue('gender', val as any)}
                              error={errors.gender?.message}
                            />
                            <SearchableSelect 
                              label="Marital Status"
                              required
                              options={["Unmarried", "Married", "Divorced", "Widow/Widower"]}
                              value={watch('marital_status') || ''}
                              onChange={(val) => setValue('marital_status', val as any)}
                              error={errors.marital_status?.message}
                            />
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] textile-header text-text-muted uppercase">Birth Date (*)</label>
                                {employeeAge > 0 && employeeAge < 18 && (
                                  <span className="flex items-center gap-1 text-[9px] bg-primary-red/10 text-primary-red px-1.5 py-0.5 rounded-full font-black animate-pulse">
                                    <ShieldCheck size={10} />
                                    MINOR COMPLIANCE
                                  </span>
                                )}
                              </div>
                              <input type="date" {...register('dob')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                              {errors.dob && <p className="text-primary-red text-[10px]">{errors.dob.message}</p>}
                            </div>
      
                            <SearchableSelect 
                              label="Religion"
                              options={["Hindu", "Muslim", "Sikh", "Buddha", "Jain", "Cristian", "Atheist", "Other"]}
                              value={watch('religion') || ''}
                              onChange={(val) => setValue('religion', val)}
                            />
                            <SearchableSelect 
                              label="Blood Group"
                              options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
                              value={watch('blood_group') || ''}
                              onChange={(val) => setValue('blood_group', val)}
                            />
                            <SearchableSelect 
                              label="Qualification"
                              options={["Illiterate", "Primary", "Secondary", "Higher Secondary", "Diploma", "Graduate", "Postgraduate", "Doctorate", "Other"]}
                              value={watch('qualification') || ''}
                              onChange={(val) => setValue('qualification', val)}
                            />
      
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="checkbox" 
                                  id="is_differently_abled"
                                  {...register('is_differently_abled')}
                                  className="w-4 h-4 rounded border-app-border text-primary-navy focus:ring-primary-navy"
                                />
                                <label htmlFor="is_differently_abled" className="text-[10px] textile-header text-text-muted uppercase cursor-pointer">
                                  Is differently abled?
                                </label>
                              </div>
                              {isDifferentlyAbled && (
                                <div className="flex-1">
                                  <MultiSearchableSelect 
                                    label="Disability Type"
                                    options={["Locomotive", "Hearing", "Visual"]}
                                    value={watch('disability_type') || []}
                                    onChange={(val) => setValue('disability_type', val)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
      
                    <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4">
                      <h3 className="textile-header font-bold text-primary-navy border-b border-app-border pb-2">Contact Information</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">Mobile 1</label>
                          <input {...register('mobile')} maxLength={10} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                          {errors.mobile && <p className="text-primary-red text-[10px]">{errors.mobile.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">Mobile 2</label>
                          <input {...register('mobile2')} maxLength={10} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                          {errors.mobile2 && <p className="text-primary-red text-[10px]">{errors.mobile2.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">Email</label>
                          <input {...register('email')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                          {errors.email && <p className="text-primary-red text-[10px]">{errors.email.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] textile-header text-text-muted uppercase">CUG Mobile</label>
                          <input {...register('cug_mobile')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                        </div>
                      </div>
      
                      <div className="space-y-4 pt-4 border-t border-app-border">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-primary-navy uppercase">Current Address</h4>
                          <button 
                            type="button"
                            onClick={() => setIsCurrentManualEntry(!isCurrentManualEntry)}
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase transition-all",
                              isCurrentManualEntry ? "bg-primary-navy text-white" : "bg-slate-100 text-text-muted hover:bg-slate-200"
                            )}
                          >
                            <Lock size={10} className={cn(!isCurrentManualEntry && "text-primary-navy")} />
                            {isCurrentManualEntry ? "Manual Entry Active" : "Lookup Mode"}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <PincodeSearch 
                            defaultValue={watch('current_pincode')}
                            moduleType={currentMode}
                            onResult={(results) => {
                              setCurrentPincodeResults(results);
                              setIsCurrentManualEntry(false);
                              if (results.length >= 1) {
                                // Default to first result for speed, but let user select other if multiple
                                const first = results[0];
                                setValue('current_pincode', first.pincode);
                                setValue('current_post_office', first.officename);
                                setValue('current_district', first.districtname);
                                setValue('current_state', first.statename);
                                setIsCurrentPincodeVerified(true);
                              }
                            }}
                            onNotFound={() => {
                              setIsCurrentManualEntry(true);
                              setIsCurrentPincodeVerified(false);
                              setCurrentPincodeResults([]);
                            }}
                          />
      
                          {currentPincodeResults.length > 0 && !isCurrentManualEntry ? (
                            <SearchableSelect 
                              label="Post Office"
                              options={currentPincodeResults.map(r => ({ value: r.officename || '', label: `${r.officename} (${r.districtname})` }))}
                              value={watch('current_post_office') || ''}
                              onChange={(val) => {
                                const selected = currentPincodeResults.find(r => r.officename === val);
                                if (selected) {
                                  setValue('current_post_office', selected.officename);
                                  setValue('current_district', selected.districtname);
                                  setValue('current_state', selected.statename);
                                  setIsCurrentPincodeVerified(true);
                                }
                              }}
                              placeholder="Select Office..."
                            />
                          ) : (
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">Post Office</label>
                              <input 
                                {...register('current_post_office')} 
                                readOnly={!isCurrentManualEntry}
                                className={cn(
                                  "w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md",
                                  !isCurrentManualEntry && "bg-slate-100 cursor-not-allowed"
                                )} 
                              />
                            </div>
                          )}
      
                          <div className="sm:col-span-2 space-y-1">
                            <label className="text-[10px] textile-header text-text-muted uppercase">Current Address (Full)</label>
                            <input {...register('current_address')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[10px] textile-header text-text-muted uppercase">District</label>
                            <input 
                              {...register('current_district')} 
                              readOnly={!isCurrentManualEntry}
                              className={cn(
                                "w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md",
                                !isCurrentManualEntry && "bg-slate-100 cursor-not-allowed"
                              )} 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] textile-header text-text-muted uppercase">State</label>
                            <input 
                              {...register('current_state')} 
                              readOnly={!isCurrentManualEntry}
                              className={cn(
                                "w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md",
                                !isCurrentManualEntry && "bg-slate-100 cursor-not-allowed"
                              )} 
                            />
                          </div>
                          {isCurrentPincodeVerified && (
                            <div className="sm:col-span-4 flex items-center gap-2 text-primary-green text-[10px] font-bold uppercase animate-in fade-in slide-in-from-left-2">
                              <CheckCircle2 size={12} />
                              Address Verified via Pincode Master
                            </div>
                          )}
                        </div>
                      </div>
      
                      <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 rounded-lg border border-app-border/50 transition-all hover:bg-slate-100/80">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            id="is_perm_same_as_current"
                            {...register('is_perm_same_as_current')}
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-300 bg-white checked:border-primary-navy checked:bg-primary-navy transition-all focus:outline-none focus:ring-2 focus:ring-primary-navy/20"
                          />
                          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                            </svg>
                          </div>
                        </div>
                        <label htmlFor="is_perm_same_as_current" className="text-xs font-medium text-primary-navy cursor-pointer select-none">
                          Permanent Address same as Current Address
                        </label>
                      </div>
      
                      {!isPermSameAsCurrent && (
                        <div className="space-y-4 pt-4 border-t border-app-border animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-primary-navy uppercase">Permanent Address</h4>
                            <button 
                              type="button"
                              onClick={() => setIsPermManualEntry(!isPermManualEntry)}
                              className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase transition-all",
                                isPermManualEntry ? "bg-primary-navy text-white" : "bg-slate-100 text-text-muted hover:bg-slate-200"
                              )}
                            >
                              <Lock size={10} className={cn(!isPermManualEntry && "text-primary-navy")} />
                              {isPermManualEntry ? "Manual Entry Active" : "Lookup Mode"}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <PincodeSearch 
                              defaultValue={watch('perm_pincode')}
                              moduleType={currentMode}
                              onResult={(results) => {
                                setPermPincodeResults(results);
                                setIsPermManualEntry(false);
                              if (results.length >= 1) {
                                // Default to first result for speed, but let user select other if multiple
                                const first = results[0];
                                setValue('perm_pincode', first.pincode);
                                setValue('perm_post_office', first.officename);
                                setValue('perm_district', first.districtname);
                                setValue('perm_state', first.statename);
                                setIsPermPincodeVerified(true);
                              }
                              }}
                              onNotFound={() => {
                                setIsPermManualEntry(true);
                                setIsPermPincodeVerified(false);
                                setPermPincodeResults([]);
                              }}
                            />
      
                            {permPincodeResults.length > 0 && !isPermManualEntry ? (
                              <SearchableSelect 
                                label="Post Office"
                                options={permPincodeResults.map(r => ({ value: r.officename || '', label: `${r.officename} (${r.districtname})` }))}
                                value={watch('perm_post_office') || ''}
                                onChange={(val) => {
                                  const selected = permPincodeResults.find(r => r.officename === val);
                                  if (selected) {
                                    setValue('perm_post_office', selected.officename);
                                    setValue('perm_district', selected.districtname);
                                    setValue('perm_state', selected.statename);
                                    setIsPermPincodeVerified(true);
                                  }
                                }}
                                placeholder="Select Office..."
                              />
                            ) : (
                              <div className="space-y-1">
                                <label className="text-[10px] textile-header text-text-muted uppercase">Post Office</label>
                                <input 
                                  {...register('perm_post_office')} 
                                  readOnly={!isPermManualEntry}
                                  className={cn(
                                    "w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md",
                                    !isPermManualEntry && "bg-slate-100 cursor-not-allowed"
                                  )} 
                                />
                              </div>
                            )}
      
                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">Permanent Address (Full)</label>
                              <input {...register('perm_address')} className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">District</label>
                              <input 
                                {...register('perm_district')} 
                                readOnly={!isPermManualEntry}
                                className={cn(
                                  "w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md",
                                  !isPermManualEntry && "bg-slate-100 cursor-not-allowed"
                                )} 
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] textile-header text-text-muted uppercase">State</label>
                              <input 
                                {...register('perm_state')} 
                                readOnly={!isPermManualEntry}
                                className={cn(
                                  "w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md",
                                  !isPermManualEntry && "bg-slate-100 cursor-not-allowed"
                                )} 
                              />
                            </div>
                            {isPermPincodeVerified && (
                              <div className="sm:col-span-4 flex items-center gap-2 text-primary-green text-[10px] font-bold uppercase animate-in fade-in slide-in-from-left-2">
                                <CheckCircle2 size={12} />
                                Address Verified via Pincode Master
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Tabs.Content>
      
                {/* Employment Details Tab */}
    </FormProvider>
  );
}
