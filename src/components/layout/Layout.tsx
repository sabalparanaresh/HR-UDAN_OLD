import RBACDebugPanel from '../common/RBACDebugPanel';
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Toaster, toast } from 'sonner';
import { LayoutDashboard, Database, Cloud } from 'lucide-react';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useRegisterShortcut } from '../common/ShortcutProvider';
import { useModule } from '../../contexts/ModuleContext';
import { CircuitBreaker } from '../layout/CircuitBreaker';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  currentUser: any;
  onLogout: () => void;
}

export default function Layout({ currentUser, onLogout }: LayoutProps) {
  const { currentMode, isConnected } = useModule();
  const setLastRoute = useWorkspaceStore(state => state.setLastRoute);
  const toggleWorkspace = useWorkspaceStore(state => state.toggleWorkspace);
  const lastRoutes = useWorkspaceStore(state => state.lastRoutes);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Mode-based route protection
    const path = location.pathname;
    
    // K module only routes
    if (currentMode === 'P' && (path.includes('rokda-management') || path.includes('daily-mis'))) {
      const fallback = '/reports/dashboard';
      navigate(fallback);
      toast.info("Redirected to Module P Dashboard", { description: "This feature is not available in P Module" });
    }
  }, [currentMode, location.pathname, navigate]);

  useEffect(() => {
    if (location.pathname !== '/') {
      setLastRoute(currentMode, location.pathname + location.search);
    }
  }, [location.pathname, location.search, currentMode, setLastRoute]);

  const applyFeedback = (el: HTMLElement) => {
    el.classList.add('animate-pulse-ring');
    setTimeout(() => {
      el.classList.remove('animate-pulse-ring');
    }, 600);
  };

  useRegisterShortcut({ key: 'alt+shift+k', description: 'Workspace Toggle (Module K/P)' });
  useHotkeys('alt+shift+k', () => {
    const nextMode = currentMode === 'K' ? 'P' : 'K';
    toggleWorkspace();
    
    // Apply shell transition (e.g. body flash or layout fade)
    document.body.classList.add('workspace-transition-flash');
    setTimeout(() => document.body.classList.remove('workspace-transition-flash'), 300);

    const nextRoute = lastRoutes[nextMode] || '/reports/dashboard';
    navigate(nextRoute);
    
    toast.success(`Switched to Module ${nextMode}`, { 
        duration: 1500,
        className: "font-mono text-[10px] uppercase tracking-widest border-primary-navy/20 bg-white/80 backdrop-blur-md"
    });
  }, { globalOverride: true });

  useRegisterShortcut({ key: 'alt+s', description: 'Save / Update Data' });
  useHotkeys('alt+s', () => {
    const saveButton = (document.querySelector('[data-shortcut="save"]') as HTMLElement) || 
      Array.from(document.querySelectorAll('button')).find(btn => 
        btn.type === 'submit' || 
        btn.textContent?.toLowerCase()?.includes('save') || 
        btn.textContent?.toLowerCase()?.includes('submit') ||
        btn.textContent?.toLowerCase()?.includes('commit') ||
        btn.textContent?.toLowerCase()?.includes('update')
      );
    if (saveButton) {
      applyFeedback(saveButton);
      saveButton.click();
      toast.info("Command Executed: Save / Update", { 
        duration: 1500,
        className: "font-mono text-[10px] uppercase tracking-widest border-primary-navy/20 bg-white/80 backdrop-blur-md"
      });
    }
  }, { globalOverride: true });

  useRegisterShortcut({ key: 'alt+n', description: 'Focus First Input' });
  useHotkeys('alt+n', () => {
    const firstInput = (document.querySelector('[data-shortcut="new"]') as HTMLElement) || 
      document.querySelector('input:not([type="hidden"]), textarea, select') as HTMLElement;
    if (firstInput) {
      applyFeedback(firstInput);
      firstInput.focus();
      toast.info("Command Executed: Focus Input", { 
        duration: 1000,
        className: "font-mono text-[10px] uppercase tracking-widest border-primary-navy/20 bg-white/80 backdrop-blur-md"
      });
    }
  }, { globalOverride: true });

  useRegisterShortcut({ key: 'alt+f', description: 'Focus Search' });
  useHotkeys('alt+f', () => {
    const searchInput = (document.querySelector('[data-shortcut="search"]') as HTMLElement) || 
      Array.from(document.querySelectorAll('input')).find(input => 
        input.placeholder?.toLowerCase()?.includes('search') || 
        input.placeholder?.toLowerCase()?.includes('employee code') ||
        input.type === 'search'
      ) as HTMLElement;
    if (searchInput) {
      applyFeedback(searchInput);
      searchInput.focus();
      toast.info("Command Executed: Focus Search", { 
        duration: 1000,
        className: "font-mono text-[10px] uppercase tracking-widest border-primary-navy/20 bg-white/80 backdrop-blur-md"
      });
    }
  }, { globalOverride: true });

  useRegisterShortcut({ key: 'escape', description: 'Close Modal / Blur' });
  useHotkeys('escape', () => {
    // Try to find a close button in a modal
    const closeButton = document.querySelector('button[onClick*="setIsModalOpen(false)"], button[onClick*="setIsGroupModalOpen(false)"], button[onClick*="setIsDeptModalOpen(false)"]') as HTMLElement;
    if (closeButton) {
      closeButton.click();
    } else {
      (document.activeElement as HTMLElement)?.blur();
    }
  }, { preventDefault: false });

  useRegisterShortcut({ key: 'alt+/', description: 'Show Help Modal' });

  return (
    <div className="flex min-h-screen bg-app-bg text-text-main">
      <Sidebar currentUser={currentUser} onLogout={onLogout} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-app-border flex items-center px-8 justify-between bg-white/80 backdrop-blur-md sticky top-0 z-40 shadow-sm transition-colors duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-md border border-app-border">
              <LayoutDashboard size={18} className="text-primary-navy" />
            </div>
            <div>
              <h2 className="textile-header text-lg font-bold text-primary-navy">
                System Dashboard {currentMode === 'P' ? '(Statutory)' : '(Primary)'}
              </h2>
              <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">Mill Management // Real-Time</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end border-r border-app-border pr-4">
              <span className="text-[10px] font-mono text-text-muted uppercase">System State</span>
              {isConnected ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                  <Cloud size={12} className="text-emerald-600" />
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                  Statutory Sync Active
                </span>
              ) : (
                <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                  <Cloud size={12} className="text-amber-600" />
                  <div className="w-1.5 h-1.5 bg-amber-600 rounded-full" />
                  Audit Mode — K Module Disconnected
                </span>
              )}
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-mono text-text-muted uppercase">Session Status</span>
              <span className="text-xs font-bold text-primary-green flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-primary-green rounded-full animate-pulse" />
                SECURE_ENCRYPTED
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto relative overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMode}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto min-h-full"
            >
              <CircuitBreaker />
              <Outlet context={{ currentUser }} />
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="h-8 border-t border-app-border bg-white px-8 flex items-center justify-between text-[10px] font-mono text-text-muted">
          <div className="flex gap-6">
            <span>SERVER: <span className="text-primary-green font-bold">ONLINE</span></span>
            <span>LATENCY: <span className="text-primary-navy font-bold">12ms</span></span>
            <span>DB_VERSION: <span className="text-primary-green font-bold">v2.4.1-LTS</span></span>
          </div>
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1.5">
              <Database size={10} />
              DASHBOARD_LIVE
            </span>
            <span className="text-primary-navy font-black">© 2026 HR-UDAN // TEXTILE ERP</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

