import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, CheckCircle2, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Finds and focuses the next focusable element in the DOM.
 * Scans for inputs, selects, textareas, and buttons.
 */
export const focusNextElement = (currentElement: HTMLElement) => {
  const form = currentElement.closest('form') || currentElement.closest('.employee-master-form') || document.body;
  if (!form) return;

  const focusableSelector = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([type="submit"]), [tabindex="0"]';
  const focusable = Array.from(form.querySelectorAll(focusableSelector)) as HTMLElement[];
  
  const index = focusable.indexOf(currentElement);
  if (index > -1 && index < focusable.length - 1) {
    const next = focusable[index + 1];
    next.focus();
    if (next instanceof HTMLInputElement) {
      next.select();
    }
  }
};

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label: string;
  options: (string | SelectOption)[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Select...",
  required = false,
  error,
  className,
  disabled = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const normalizedOptions = useMemo(() => options.map(opt => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  ), [options]);

  const filteredOptions = useMemo(() => {
    if (!search) return normalizedOptions;
    const searchStr = search.toLowerCase().trim();
    
    const scored = normalizedOptions.map(opt => {
      const labelStr = String(opt.label || "").toLowerCase();
      const valueStr = String(opt.value || "").toLowerCase();
      
      let score = -1;
      // Exact match on value (code) or label
      if (valueStr === searchStr || labelStr === searchStr) score = 3;
      // Stars with on value (code) or first/last part of label
      else if (valueStr.startsWith(searchStr) || labelStr.startsWith(searchStr)) score = 2;
      // Includes check
      else if (labelStr.includes(searchStr) || valueStr.includes(searchStr)) score = 1;
      
      return { opt, score };
    }).filter(x => x.score >= 0);

    return scored
      .sort((a, b) => b.score - a.score || a.opt.label.localeCompare(b.opt.label))
      .map(x => x.opt);
  }, [normalizedOptions, search]);

  const selectedOption = normalizedOptions.find(opt => {
    if (opt.value === value) return true;
    if (!value || !opt.value) return false;
    if (!isNaN(parseFloat(opt.value)) && !isNaN(parseFloat(value))) {
      return parseFloat(opt.value) === parseFloat(value);
    }
    return false;
  });

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
    if (triggerRef.current) {
      setTimeout(() => focusNextElement(triggerRef.current!), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case ' ':
        // If search exactly matches an option (case-insensitive), select it
        const exactMatch = filteredOptions.find(opt => String(opt.label || "").toLowerCase() === search.trim().toLowerCase());
        if (exactMatch && search.trim() !== "") {
          e.preventDefault();
          handleSelect(exactMatch.value);
        }
        break;
    }
  };

  return (
    <div className={cn("space-y-1 relative", className)} ref={containerRef}>
      <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-tight">
        {label} {required && "(*)"}
      </label>
      
      <div 
        ref={triggerRef}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full bg-slate-50 border border-app-border p-2 text-sm rounded-md flex items-center justify-between cursor-pointer transition-all focus:ring-2 focus:ring-primary-navy/20 outline-none",
          disabled && "opacity-50 cursor-not-allowed grayscale",
          isOpen && "border-primary-navy/40 shadow-sm"
        )}
      >
        <span className={cn(
          "font-medium truncate",
          (!value || value === "0") ? "text-slate-400 italic" : "text-slate-700 font-mono"
        )}>
          {selectedOption ? selectedOption.label : (value && value !== "0" ? value : placeholder)}
        </span>
        <ChevronDown size={14} className={cn("transition-transform text-slate-400", isOpen && "rotate-180 text-primary-navy")} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] w-full mt-1 bg-white border border-app-border rounded-md shadow-xl overflow-hidden flex flex-col"
            style={{ maxHeight: '300px' }}
          >
            <div className="p-2 border-b border-app-border bg-slate-50/50 sticky top-0 z-10">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  autoFocus
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-app-border rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-navy/20 transition-all font-mono"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                />
                {search && (
                  <X 
                    size={12} 
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-primary-navy" 
                    onClick={(e) => { e.stopPropagation(); setSearch(""); }}
                  />
                )}
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 py-1" ref={listRef}>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => (
                  <div 
                    key={`${opt.value}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(opt.value);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors font-mono",
                      idx === highlightedIndex ? "bg-primary-navy/10 text-primary-navy" : "text-slate-600 hover:bg-slate-50",
                      value === opt.value && "bg-primary-navy/5 font-bold text-primary-navy border-l-2 border-primary-navy"
                    )}
                  >
                    <span>{opt.label}</span>
                    {value === opt.value && <CheckCircle2 size={12} className="text-primary-navy" />}
                  </div>
                ))
              ) : (
                <div className="px-3 py-4 text-xs text-slate-400 italic text-center">No matches found</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {error && <p className="text-primary-red text-[10px] font-bold mt-1 px-1">{error}</p>}
    </div>
  );
}

interface MultiSearchableSelectProps {
  label: string;
  options: (string | SelectOption)[];
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSearchableSelect({
  label,
  options,
  value = [],
  onChange,
  placeholder = "Select multiple...",
  required = false,
  error,
  className,
  disabled = false
}: MultiSearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions = useMemo(() => options.map(opt => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  ), [options]);

  const filteredOptions = useMemo(() => {
    if (!search) return normalizedOptions;
    const searchStr = search.toLowerCase().trim();
    
    const scored = normalizedOptions.map(opt => {
      const labelStr = String(opt.label || "").toLowerCase();
      const valueStr = String(opt.value || "").toLowerCase();
      
      let score = -1;
      if (valueStr === searchStr || labelStr === searchStr) score = 3;
      else if (valueStr.startsWith(searchStr) || labelStr.startsWith(searchStr)) score = 2;
      else if (labelStr.includes(searchStr) || valueStr.includes(searchStr)) score = 1;
      
      return { opt, score };
    }).filter(x => x.score >= 0);

    return scored
      .sort((a, b) => b.score - a.score || a.opt.label.localeCompare(b.opt.label))
      .map(x => x.opt);
  }, [normalizedOptions, search]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (optValue: string) => {
    const newValue = value.includes(optValue)
      ? value.filter(v => v !== optValue)
      : [...value, optValue];
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          toggleOption(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        // Tab out closes multi-select dropdown
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className={cn("space-y-1 relative", className)} ref={containerRef}>
      <label className="text-[10px] textile-header text-text-muted uppercase font-bold tracking-tight">
        {label} {required && "(*)"}
      </label>
      
      <div 
        ref={triggerRef}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full bg-slate-50 border border-app-border p-2 text-sm rounded-md flex flex-wrap gap-1.5 items-center justify-between cursor-pointer min-h-[40px] focus:ring-2 focus:ring-primary-navy/20 transition-all outline-none",
          disabled && "opacity-50 cursor-not-allowed grayscale",
          isOpen && "border-primary-navy/40 shadow-sm"
        )}
      >
        <div className="flex flex-wrap gap-1.5">
          {value.length > 0 ? (
            value.map((v, idx) => (
              <span key={`${v}-${idx}`} className="bg-primary-navy text-white text-[9px] px-2 py-0.5 rounded flex items-center gap-1.5 font-mono shadow-sm hover:bg-primary-navy/90 transition-colors">
                {v}
                <X 
                  size={10} 
                  className="cursor-pointer hover:text-red-300" 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(v);
                  }}
                />
              </span>
            ))
          ) : (
            <span className="text-slate-400 italic">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={14} className={cn("transition-transform text-slate-400 shrink-0", isOpen && "rotate-180 text-primary-navy")} />
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] w-full mt-1 bg-white border border-app-border rounded-md shadow-xl overflow-hidden flex flex-col"
            style={{ maxHeight: '300px' }}
          >
            <div className="p-2 border-b border-app-border bg-slate-50/50 sticky top-0 z-10 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  autoFocus
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-app-border rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-navy/20 transition-all font-mono"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex gap-2 justify-between px-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(normalizedOptions.map(o => o.value));
                    setIsOpen(false);
                  }}
                  className="text-[10px] uppercase font-bold text-primary-navy hover:underline"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange([]);
                    setSearch('');
                  }}
                  className="text-[10px] uppercase font-bold text-red-600 hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 py-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => (
                  <div 
                    key={`${opt.value}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(opt.value);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors font-mono",
                      idx === highlightedIndex ? "bg-primary-navy/10 text-primary-navy" : "text-slate-600 hover:bg-slate-50",
                      value.includes(opt.value) && "bg-primary-navy/5 font-bold text-primary-navy"
                    )}
                  >
                    <span>{opt.label}</span>
                    {value.includes(opt.value) && <CheckCircle2 size={12} className="text-primary-navy" />}
                  </div>
                ))
              ) : (
                <div className="px-3 py-4 text-xs text-slate-400 italic text-center">No matches found</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {error && <p className="text-primary-red text-[10px] font-bold mt-1 px-1">{error}</p>}
    </div>
  );
}
