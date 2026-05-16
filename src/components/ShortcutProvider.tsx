import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { XCircle, Keyboard } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useHotkeys } from '../hooks/useHotkeys';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Shortcut {
  key: string;
  description: string;
  category?: string;
}

interface ShortcutContextType {
  registerShortcut: (shortcut: Shortcut) => void;
  unregisterShortcut: (key: string) => void;
  shortcuts: Shortcut[];
}

const ShortcutContext = createContext<ShortcutContextType | undefined>(undefined);

export function ShortcutProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const registerShortcut = useCallback((shortcut: Shortcut) => {
    setShortcuts((prev) => {
      const exists = prev.find((s) => s.key === shortcut.key);
      if (exists && exists.description === shortcut.description) return prev;
      
      // If key exists but description is different, update it
      if (exists) {
        return prev.map(s => s.key === shortcut.key ? shortcut : s);
      }
      
      return [...prev, shortcut];
    });
  }, []);

  const unregisterShortcut = useCallback((key: string) => {
    setShortcuts((prev) => {
      const filtered = prev.filter((s) => s.key !== key);
      if (filtered.length === prev.length) return prev;
      return filtered;
    });
  }, []);

  useHotkeys('alt+/', () => {
    setIsHelpOpen((prev) => !prev);
  }, { preventDefault: true });

  useHotkeys('escape', () => {
    if (isHelpOpen) {
      setIsHelpOpen(false);
    }
  }, { preventDefault: false });

  return (
    <ShortcutContext.Provider value={{ registerShortcut, unregisterShortcut, shortcuts }}>
      {children}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-app-border">
            <div className="p-6 border-b border-app-border bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-navy/10 flex items-center justify-center text-primary-navy">
                  <Keyboard size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-primary-navy uppercase tracking-wider font-mono">Keyboard Shortcuts</h2>
                  <p className="text-text-muted text-xs font-mono">Global Efficiency Engine Registry</p>
                </div>
              </div>
              <button 
                onClick={() => setIsHelpOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <XCircle size={20} className="text-text-muted" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shortcuts.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-app-border hover:border-primary-navy transition-colors group">
                    <span className="text-sm font-bold text-primary-navy font-mono uppercase tracking-tight">{s.description}</span>
                    <div className="flex gap-1">
                      {s.key.split('+').map((k, i) => (
                        <kbd key={i} className="px-2 py-1 bg-white border border-app-border rounded shadow-sm text-[10px] font-bold text-primary-navy uppercase font-mono min-w-[24px] text-center group-hover:bg-primary-navy group-hover:text-white transition-colors">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-app-border text-center">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Press <kbd className="px-1.5 py-0.5 bg-white border border-app-border rounded shadow-sm">ESC</kbd> to close</p>
            </div>
          </div>
        </div>
      )}
    </ShortcutContext.Provider>
  );
}

export const useShortcutRegistry = () => {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error('useShortcutRegistry must be used within a ShortcutProvider');
  }
  return context;
};

export const useRegisterShortcut = (shortcut: Shortcut) => {
  const { registerShortcut, unregisterShortcut } = useShortcutRegistry();
  const { key, description } = shortcut;
  
  useEffect(() => {
    registerShortcut({ key, description });
    return () => unregisterShortcut(key);
  }, [key, description, registerShortcut, unregisterShortcut]);
};
