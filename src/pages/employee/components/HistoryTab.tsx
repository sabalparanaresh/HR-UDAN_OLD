import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { FormProvider } from 'react-hook-form';
import { History, Building, Calendar, Wallet, Trash2, Plus } from 'lucide-react';
import { useEmployeeForm } from '../EmployeeFormContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function HistoryTab() {
  const { form, currentMode, isSuperAdmin, employmentHistory, setEmploymentHistory, addHistory, removeHistory } = useEmployeeForm();
  
  return (
    <FormProvider {...form}>
                <Tabs.Content value="history" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="textile-card p-6 bg-white border-app-border shadow-xl space-y-4">
                    <div className="flex justify-between items-center border-b border-app-border pb-2">
                      <h3 className="textile-header font-bold text-primary-navy">Previous Experience</h3>
                      <button type="button" onClick={addHistory} className="text-xs flex items-center gap-1 text-primary-navy hover:underline">
                        <Plus size={14} /> Add Experience
                      </button>
                    </div>
                    <div className="space-y-4">
                      {employmentHistory.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 bg-slate-50 rounded-lg border border-app-border relative group">
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase text-text-muted font-bold">Company</label>
                            <input 
                              value={item.company || ''} 
                              onChange={(e) => {
                                const newHistory = [...employmentHistory];
                                newHistory[idx].company = e.target.value;
                                setEmploymentHistory(newHistory);
                              }}
                              className="w-full bg-white border border-app-border p-1.5 text-xs rounded focus:outline-none focus:border-primary-navy" 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase text-text-muted font-bold">Role</label>
                            <input 
                              value={item.role || ''} 
                              onChange={(e) => {
                                const newHistory = [...employmentHistory];
                                newHistory[idx].role = e.target.value;
                                setEmploymentHistory(newHistory);
                              }}
                              className="w-full bg-white border border-app-border p-1.5 text-xs rounded focus:outline-none focus:border-primary-navy" 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase text-text-muted font-bold">Duration From</label>
                            <input 
                              type="month"
                              value={item.duration_from || ''} 
                              onChange={(e) => {
                                const newHistory = [...employmentHistory];
                                newHistory[idx].duration_from = e.target.value;
                                setEmploymentHistory(newHistory);
                              }}
                              className="w-full bg-white border border-app-border p-1.5 text-xs rounded focus:outline-none focus:border-primary-navy" 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase text-text-muted font-bold">Duration To</label>
                            <input 
                              type="month"
                              value={item.duration_to || ''} 
                              onChange={(e) => {
                                const newHistory = [...employmentHistory];
                                newHistory[idx].duration_to = e.target.value;
                                setEmploymentHistory(newHistory);
                              }}
                              className="w-full bg-white border border-app-border p-1.5 text-xs rounded focus:outline-none focus:border-primary-navy" 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase text-text-muted font-bold">Last Salary</label>
                            <input 
                              type="number"
                              value={item.last_salary || ''} 
                              onChange={(e) => {
                                const newHistory = [...employmentHistory];
                                newHistory[idx].last_salary = e.target.value;
                                setEmploymentHistory(newHistory);
                              }}
                              placeholder="0.00"
                              className="w-full bg-white border border-app-border p-1.5 text-xs rounded focus:outline-none focus:border-primary-navy font-mono" 
                            />
                          </div>
                          <div className="flex items-end pb-1 justify-center">
                            <button type="button" onClick={() => removeHistory(idx)} className="p-1.5 text-primary-red hover:bg-primary-red/10 rounded transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {employmentHistory.length === 0 && (
                        <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-app-border">
                          <History size={32} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-sm text-text-muted italic">No previous experience recorded.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Tabs.Content>
      
                {/* Salary Details Tab */}
    </FormProvider>
  );
}
