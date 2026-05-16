import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Search, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MultiSelect = ({ 
  label, 
  options, 
  selected, 
  onChange 
}: { 
  label: string; 
  options: { id: number; name: string }[]; 
  selected: number[]; 
  onChange: (ids: number[]) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return options;

    const scored = options.map(opt => {
      const name = (opt.name || '').toLowerCase();
      let score = -1;
      
      if (name === term) score = 3;
      else if (name.startsWith(term)) score = 2;
      else if (name.includes(term)) score = 1;
      
      return { opt, score };
    }).filter(x => x.score >= 0);

    return scored
      .sort((a, b) => b.score - a.score || (a.opt.name || '').localeCompare(b.opt.name || ''))
      .map(x => x.opt);
  }, [options, searchTerm]);

  useEffect(() => {
    setActiveIndex(filteredOptions.length > 0 ? 0 : -1);
  }, [searchTerm, filteredOptions.length]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (id: number) => {
    if (selected.includes(id)) {
      onChange(selected.filter(i => i !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          toggleOption(filteredOptions[activeIndex].id);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // Ensure scroll follows active index
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-xs border rounded-md transition-all bg-white",
          selected.length > 0 ? "border-primary-navy ring-1 ring-primary-navy/20" : "border-app-border hover:border-primary-navy"
        )}
      >
        <span className="truncate max-w-[100px]">
          {selected.length === 0 ? label : `${selected.length} ${label}s`}
        </span>
        <Plus size={12} className={cn("transition-transform", isOpen && "rotate-45")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-72 mt-1 bg-white border border-app-border rounded-lg shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-2 border-b border-app-border bg-slate-50/50">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{label} Filter</span>
                <div className="flex gap-2">
                  {filteredOptions.length > 0 && selected.length < filteredOptions.length && (
                    <button 
                      onClick={() => onChange(filteredOptions.map(o => o.id))}
                      className="text-[9px] text-primary-navy hover:underline font-bold uppercase tracking-tight"
                    >
                      Select All
                    </button>
                  )}
                  {selected.length > 0 && (
                    <button 
                      onClick={() => onChange([])}
                      className="text-[9px] text-primary-red hover:underline font-bold uppercase tracking-tight"
                    >
                      Clear ({selected.length})
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                <input 
                  ref={inputRef}
                  type="text"
                  placeholder={`Search ${label}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-white border border-app-border pl-7 pr-2 py-1.5 text-[11px] rounded focus:outline-none focus:border-primary-navy transition-colors font-medium"
                />
              </div>
            </div>

            <div 
              ref={listRef}
              className="max-h-60 overflow-y-auto p-1 space-y-0.5 scrollbar-thin scrollbar-thumb-slate-200"
            >
              {filteredOptions.map((opt, index) => {
                const isSelected = selected.includes(opt.id);
                const isActive = index === activeIndex;
                
                return (
                  <div 
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors group",
                      isActive ? "bg-primary-navy/5" : "hover:bg-slate-50",
                      isSelected && "text-primary-navy font-bold"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-all",
                        isSelected ? "bg-primary-navy border-primary-navy" : "border-app-border group-hover:border-primary-navy"
                      )}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                      <span className="text-xs truncate">{opt.name}</span>
                    </div>
                  </div>
                );
              })}
              
              {filteredOptions.length === 0 && (
                <div className="p-8 text-center space-y-1">
                  <Search size={20} className="mx-auto text-text-muted opacity-20" />
                  <p className="text-[10px] text-text-muted italic">No matching results</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
