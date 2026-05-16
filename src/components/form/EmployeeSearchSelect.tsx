import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Filter, User, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { invoke } from '@tauri-apps/api/tauri';
import { useModule } from '../../contexts/ModuleContext';
import { Employee } from '../../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface SearchEmployee {
  id: number;
  emp_code: string;
  name: string;
  designation_name?: string;
  department_name?: string;
  group_name?: string;
}

export interface EmployeeSearchSelectProps {
  value?: number | string | null | number[] | string[];
  selectedIds?: number[];
  onChange?: (val: any) => void;
  onSelect?: (emp: SearchEmployee) => void;
  placeholder?: string;
  isMulti?: boolean;
  label?: string;
  required?: boolean;
  className?: string;
  nextFieldRef?: React.RefObject<any>;
  effectiveDate?: string;
  employees?: Employee[];
}

export const EmployeeSearchSelect = ({ 
  value,
  selectedIds = [], 
  onChange, 
  onSelect,
  placeholder = "Select Employee...",
  isMulti = false,
  label,
  required = false,
  className,
  nextFieldRef,
  effectiveDate,
  employees = []
}: EmployeeSearchSelectProps) => {
  const { currentMode } = useModule();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [backendResults, setBackendResults] = useState<SearchEmployee[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedEmployeesLocal, setSelectedEmployeesLocal] = useState<SearchEmployee[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeValues = useMemo(() => {
    if (value !== undefined) {
      if (value === null || value === '') return [];
      if (Array.isArray(value)) return value.map(v => Number(v));
      return [Number(value)];
    }
    return selectedIds;
  }, [value, selectedIds]);

  const selectedDisplayItems = useMemo(() => {
    return activeValues.map(id => {
      const fromProps = employees.find(e => e.id === id);
      if (fromProps) return { id, emp_code: fromProps.emp_code, name: `${fromProps.first_name} ${fromProps.last_name || ''}`.trim() };
      const fromLocal = selectedEmployeesLocal.find(e => e.id === id);
      if (fromLocal) return fromLocal;
      return { id, emp_code: '...', name: 'Employee' };
    });
  }, [activeValues, employees, selectedEmployeesLocal]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let isActive = true;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const q = searchTerm.trim();
      const input = q.toLowerCase();
      
      try {
        let results: any[] = [];
        if (employees && employees.length > 0) {
          // Local filtering if employees prop is provided
          const scored = employees.map(emp => {
            const rawCode = String(emp.emp_code || '').trim();
            const code = rawCode.toLowerCase();
            const numericInput = input.replace(/^0+/, '');
            const numericCode = code.replace(/^0+/, '');
            const first = String((emp as any).first_name || (emp as any).name || '').toLowerCase();
            const last = String((emp as any).last_name || '').toLowerCase();
            const full = `${first} ${last}`;
            
            let score = -1;
            if (code === input || (numericInput && numericCode === numericInput)) score = 10;
            else if (code.startsWith(input) || (numericInput && numericCode.startsWith(numericInput))) score = 8;
            else if (code.includes(input)) score = 6;
            else if (first.startsWith(input) || last.startsWith(input)) score = 4;
            else if (full.includes(input)) score = 2;
            else {
              const fullFields = [
                emp.emp_code, (emp as any).aadhar_no, (emp as any).voter_id, (emp as any).passport_no,
                (emp as any).driving_licence, (emp as any).pf_number, (emp as any).uan_no, (emp as any).esi_ip_number,
                (emp as any).mobile, (emp as any).mobile2, (emp as any).cug_mobile, (emp as any).first_name,
                (emp as any).middle_name, (emp as any).last_name, (emp as any).full_name_aadhar, (emp as any).name
              ];
              if (fullFields.some(f => String(f || '').toLowerCase().includes(input))) {
                score = 0;
              }
            }
            return { emp, score };
          }).filter(x => x.score >= 0);
          
          results = scored
            .sort((a, b) => b.score - a.score || String(a.emp.emp_code).localeCompare(String(b.emp.emp_code), undefined, {numeric: true}))
            .map(x => x.emp)
            .slice(0, 25);
        } else {
          // Backend filter
          results = await invoke<SearchEmployee[]>('search_employees', {
            query: q,
            moduleType: currentMode
          });
          
          if (results && input) {
            results = results.map((emp: any) => {
              const rawCode = String(emp.emp_code || '').trim();
              const code = rawCode.toLowerCase();
              const numericInput = input.replace(/^0+/, '');
              const numericCode = code.replace(/^0+/, '');
              const nameWords = String(emp.name || '').toLowerCase().split(' ');
              const first = nameWords[0] || '';
              const last = nameWords[nameWords.length - 1] || '';
              
              let score = -1;
              if (code === input || (numericInput && numericCode === numericInput)) score = 10;
              else if (code.startsWith(input) || (numericInput && numericCode.startsWith(numericInput))) score = 8;
              else if (code.includes(input)) score = 6;
              else if (first.startsWith(input) || last.startsWith(input)) score = 4;
              else if (String(emp.name || '').toLowerCase().includes(input)) score = 2;
              else score = 0;
              return { emp, score };
            })
            .sort((a: any, b: any) => b.score - a.score || String(a.emp.emp_code).localeCompare(String(b.emp.emp_code), undefined, {numeric: true}))
            .map((x: any) => x.emp)
            .slice(0, 25);
          }
        }
        
        if (isActive) setBackendResults(results || []);
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        if (isActive) setIsSearching(false);
      }
    }, 300);
    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [searchTerm, isOpen, currentMode, employees]);

  useEffect(() => {
    setActiveIndex(backendResults.length > 0 ? 0 : -1);
  }, [backendResults, searchTerm, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  const handleSelect = (emp: SearchEmployee) => {
    const id = emp.id;
    if (!selectedEmployeesLocal.find(e => e.id === id)) {
      setSelectedEmployeesLocal(prev => [...prev, emp]);
    }

    if (onSelect) {
      onSelect(emp);
    }

    if (isMulti) {
      const newIds = activeValues.includes(id) ? activeValues.filter(i => i !== id) : [...activeValues, id];
      onChange?.(value !== undefined ? newIds : newIds);
      setSearchTerm('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // For single select, onChange normally expects an array of IDs in old code or single ID in new code.
      // But the LoanApplication code currently sets `selectedIds=[...]` and expects `onChange(ids: number[])`.
      // We will supply back the array backward compatible if value is undefined.
      if (value !== undefined) {
        onChange?.(id);
      } else {
        onChange?.([id]);
      }
      setIsOpen(false);
      setSearchTerm('');
      if (nextFieldRef && nextFieldRef.current) {
        setTimeout(() => nextFieldRef.current.focus(), 50);
      } else {
        setTimeout(() => (containerRef.current?.querySelector('div[tabindex="0"]') as HTMLElement)?.focus(), 50);
      }
    }
  };

  const removeSelected = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMulti) {
      onChange?.(value !== undefined ? activeValues.filter(i => i !== id) : activeValues.filter(i => i !== id));
    } else {
      onChange?.(value !== undefined ? null : []);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'Tab':
        if (backendResults.length > 0) {
          e.preventDefault();
          handleSelect(backendResults[activeIndex >= 0 ? activeIndex : 0]);
        } else {
          setIsOpen(false);
        }
        break;
      case ' ':
        if (searchTerm.trim() !== '' && !searchTerm.includes(' ')) {
          if (backendResults.length > 0) {
            e.preventDefault();
            handleSelect(backendResults[activeIndex >= 0 ? activeIndex : 0]);
          }
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev < backendResults.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        const idx = activeIndex === -1 ? 0 : activeIndex;
        if (idx >= 0 && idx < backendResults.length) {
          handleSelect(backendResults[idx]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className={cn("space-y-1.5", className)} ref={containerRef}>
      {label && (
        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
          {label} {required && <span className="text-primary-red">*</span>}
        </label>
      )}
      
      <div className="relative w-full">
        <div 
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          className={cn(
            "flex flex-wrap items-center gap-1.5 min-h-[42px] px-3 py-1.5 bg-white border border-app-border rounded-lg cursor-pointer transition-all focus:ring-2 focus:ring-primary-navy/10 focus:border-primary-navy outline-none shadow-sm w-full",
            isOpen && "ring-2 ring-primary-navy/10 border-primary-navy"
          )}
        >
          {selectedDisplayItems.length === 0 && !isOpen && (
            <span className="text-xs text-text-muted">{placeholder}</span>
          )}
          
          {isMulti ? (
            <div className="flex flex-wrap gap-1">
              {selectedDisplayItems.map(emp => (
                <div key={emp.id} className="flex items-center gap-1 px-2 py-0.5 bg-primary-navy/5 border border-primary-navy/10 rounded-md animate-in zoom-in-95 duration-150">
                  <span className="text-[10px] font-mono font-bold text-primary-navy">{emp.emp_code}</span>
                  <span className="text-[10px] font-medium text-primary-navy truncate max-w-[80px]">
                    - {emp.name}
                  </span>
                  <button onClick={(e) => removeSelected(emp.id, e)} className="p-0.5 hover:bg-primary-navy/10 rounded-full text-primary-navy transition-colors">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            selectedDisplayItems[0] && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-primary-navy">{selectedDisplayItems[0].emp_code}</span>
                <span className="text-xs font-medium text-text-main">- {selectedDisplayItems[0].name}</span>
              </div>
            )
          )}
          
          <div className="ml-auto flex items-center gap-2 text-text-muted">
            {!isMulti && selectedDisplayItems.length > 0 && (
              <X 
                size={14} 
                className="cursor-pointer hover:text-red-500 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange?.(value !== undefined ? null : []);
                  setIsOpen(false);
                }}
              />
            )}
            <ChevronDown size={14} className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
          </div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.98 }}
              animate={{ opacity: 1, y: 2, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.98 }}
              className="absolute z-[100] w-full mt-1 bg-white border border-app-border rounded-xl shadow-2xl overflow-hidden origin-top"
            >
              <div className="p-2 border-b border-app-border bg-slate-50/50 flex items-center gap-2">
                <Search size={14} className="text-text-muted" />
                <input 
                  ref={inputRef}
                  type="text"
                  placeholder="Search code or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-none text-xs outline-none focus:ring-0 p-1"
                />
              </div>

              <div ref={listRef} className="max-h-64 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-primary-navy/10">
                {backendResults.map((emp, index) => {
                  const isSelected = activeValues.includes(emp.id);
                  const isActive = index === activeIndex;
                  const isExactMatch = searchTerm.trim() !== '' && emp.emp_code.toLowerCase() === searchTerm.trim().toLowerCase();

                  return (
                    <div 
                      key={emp.id}
                      onClick={() => handleSelect(emp)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all",
                        isActive ? "bg-primary-navy/5" : "hover:bg-slate-50",
                        isSelected && "bg-primary-navy/10",
                        isExactMatch && index === 0 ? "bg-green-50 border border-green-200" : ""
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0",
                          isSelected ? "bg-primary-navy text-white border-primary-navy" : "bg-slate-100 text-text-muted border-app-border"
                        )}>
                          {isSelected ? <UserCheck size={14} /> : <User size={14} />}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-primary-navy">{emp.emp_code}</span>
                            <span className="text-[11px] font-medium text-text-main">- {emp.name}</span>
                          </div>
                          {emp.designation_name && (
                            <span className="text-[9px] text-text-muted uppercase tracking-widest">{emp.designation_name}</span>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check size={14} className="text-primary-navy shrink-0" />}
                    </div>
                  );
                })}

                {backendResults.length === 0 && !isSearching && searchTerm && (
                  <div className="p-8 text-center space-y-2">
                    <Filter size={24} className="mx-auto text-text-muted opacity-20" />
                    <p className="text-xs text-text-muted italic">No matching employees found</p>
                  </div>
                )}
                {backendResults.length === 0 && isSearching && (
                  <div className="p-8 text-center space-y-2">
                    <p className="text-xs text-text-muted italic">Searching...</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EmployeeSearchSelect;
