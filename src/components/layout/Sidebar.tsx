import React, { useState } from 'react';
import { authorize } from '../../lib/rbac';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Settings, 
  Users, 
  Fingerprint, 
  Database, 
  ChevronRight,
  Clock,
  Package,
  MapPin,
  Calculator,
  FileText,
  PieChart,
  BarChart,
  ShieldCheck,
  ZapOff,
  CreditCard,
  UserCircle,
  ShieldAlert,
  Award,
  IndianRupee,
  Calendar,
  RotateCcw,
  Plus,
  Minus,
  ChevronLeft,
  Menu,
  Activity,
  MessageSquare,
  Link2,
  Link2Off,
  Coffee,
  FileSpreadsheet,
  Cloud,
  ClipboardList,
  AlertTriangle
} from 'lucide-react';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { useModule } from '../../contexts/ModuleContext';

import { getReportsForRoleAndModule } from '../../registry/ReportRegistry';

interface SidebarProps {
  currentUser: any;
  onLogout: () => void;
}

import { useAuthStore } from '../../store/authStore';
const pageMapping: Record<string, string> = {
  "/user-management/access-control": "USER_MGMT_VIEW",
  "/user-management/system-connection": "USER_MGMT_VIEW",
  "/transactions/attendance": "Attendance.view",
  "/transactions/salary": "Payroll.view",
  "/reports/engine": "ReportingEngine.view",
  "/reports/cost-mis": "CostMIS.view",
  "/transactions/rokda-management": "CashWorker.view",
  "/transactions/cash-management": "CashManagement.view",
  "/transactions/daily-mis": "DailyMIS.view",
  "/employee/master": "Employee.view",
  "/hr-settings/company": "SETTINGS_VIEW",
  "/transactions/advance": "Advance.view"
};

const Authorized: React.FC<{ 
  path: string, 
  children: React.ReactNode, 
  currentMode: string, 
  isConnected: boolean, 
  currentRole: string, 
  moduleScope: string, 
  currentUser: any 
}> = React.memo(({ path, children, currentMode, isConnected, currentRole, moduleScope, currentUser }) => {
  // Mode-based restrictions
  if ((path === '/transactions/rokda-management' || path === '/transactions/cash-management' || path === '/transactions/daily-mis') && currentMode !== 'K') return <></>;
  
  // Circuit Breaker Restriction
  if (currentMode === 'K' && !isConnected) return <></>;
  
  // SuperAdmin check
  if (currentRole === 'SUPERADMIN') {
     return <>{children}</>;
  }
  
  const permissionStr = pageMapping[path];
  if (!permissionStr) return <>{children}</>; // Default allow for unspecified routes initially
  
  // Check using authorize from RBAC cache
  if (moduleScope !== 'BOTH' && moduleScope !== currentMode) return <></>;
  
  // Use dynamic RBAC if mapping is present
  const hasPerm = authorize(currentUser, `${permissionStr}.view`, currentMode as 'K'|'P') || authorize(currentUser, permissionStr, currentMode as 'K'|'P');
  
  return hasPerm ? <>{children}</> : <></>;
});

export default function Sidebar({ currentUser, onLogout }: SidebarProps) {
  const { currentMode, isConnected } = useModule();
  const { permissionMap, moduleScope } = useAuthStore();
  const user = useAuthStore(state => state.user);
  const currentRole = currentUser?.role || 'ADMIN'; // Default

  const availableReports = getReportsForRoleAndModule(currentRole, currentMode as 'K' | 'P');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "Masters & Settings": true,
    "Employee Master": true,
    "Transactions": true,
    "Reports & Analytics": true,
    "User Management": true
  });
  const [expandedSubGroups, setExpandedSubGroups] = useState<Record<string, boolean>>({
    "Organisational": true,
    "Shift & Work day": false,
    "Salary Settings": false
  });

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const toggleSubGroup = (title: string) => {
    setExpandedSubGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // Theme configuration based on currentModule
  const theme = currentMode === 'K' 
    ? {
        bg: 'bg-indigo-950',
        accent: 'text-amber-400',
        accentBg: 'bg-amber-400',
        hover: 'hover:bg-amber-400/10',
        active: 'bg-amber-400 text-indigo-950',
        border: 'border-indigo-900',
        ring: 'ring-amber-400/30'
      }
    : {
        bg: 'bg-slate-950',
        accent: 'text-emerald-400',
        accentBg: 'bg-emerald-400',
        hover: 'hover:bg-emerald-400/10',
        active: 'bg-emerald-400 text-slate-950',
        border: 'border-slate-800',
        ring: 'ring-emerald-400/30'
      };

  const menuGroups = [
    {
      title: "Masters & Settings",
      icon: <Database size={22} />,
      subGroups: [
        {
          title: "Organisational",
          items: [
            { label: "Company Settings", path: "/hr-settings/company", icon: <Database size={16} /> },
                        { label: "Bank Master", path: "/hr-settings/bank-master", icon: <CreditCard size={16} /> },
            { label: "Pincode Master", path: "/hr-settings/pincode-master", icon: <MapPin size={16} /> },
            { label: "Class & Category", path: "/hr-settings/class-category", icon: <Database size={16} /> },
            { label: "Location & Division", path: "/hr-settings/location-division", icon: <MapPin size={16} /> },
            { label: "Group & Department", path: "/hr-settings/group-department", icon: <Settings size={16} /> },
            { label: "Designation Master", path: "/hr-settings/designations", icon: <Award size={16} /> },
            { label: "Canteen Settings", path: "/hr-settings/canteen-settings", icon: <Coffee size={16} /> },
          ]
        },
        {
          title: "Shift & Work day",
          items: [
            { label: "Weekly Off Settings", path: "/hr-settings/weekly-off", icon: <Clock size={16} /> },
            { label: "Working Day Types", path: "/hr-settings/day-types", icon: <Calculator size={16} /> },
            { label: "Shift Settings", path: "/hr-settings/shifts", icon: <Clock size={16} /> },
            { label: "Holiday Master", path: "/hr-settings/holidays", icon: <Calendar size={16} /> },
            { label: "Leave Configurations", path: "/hr-settings/leave-settings", icon: <Calendar size={16} /> },
            { label: "Grievance Settings", path: "/hr-settings/grievance-settings", icon: <ShieldAlert size={16} /> },
          ]
        },
        {
          title: "Salary Settings",
          items: [
            { label: "Salary Heads", path: "/hr-settings/salary-heads", icon: <Calculator size={16} /> },
            { label: "Salary Slabs", path: "/hr-settings/salary-slabs", icon: <Calculator size={16} /> },
            { label: "Piece Rate Config", path: "/hr-settings/piece-rate", icon: <Settings size={16} /> },
            { label: "Statutory Settings", path: "/hr-settings/statutory-settings", icon: <ShieldCheck size={16} /> },
            { label: "Loan Types", path: "/hr-settings/loan-types", icon: <Calculator size={16} /> },
          ]
        }
      ]
    },
    {
      title: "Employee Master",
      icon: <UserCircle size={22} />,
      items: [
        { label: "Employee Master", path: "/employee/master", icon: <UserCircle size={16} /> },
      ]
    },
    {
      title: "Transactions",
      icon: <Fingerprint size={22} />,
      items: [
        { label: "Attendance Entry", path: "/transactions/attendance", icon: <Fingerprint size={16} /> },
        { label: "Salary Processing", path: "/transactions/salary", icon: <Calculator size={16} /> },
        { label: "Final Payroll Export", path: "/transactions/final-payroll", icon: <Calculator size={16} /> },
        { label: "Arrear Entry", path: "/transactions/arrear-entry", icon: <RotateCcw size={16} /> },
        { label: "Bank Transfers", path: "/transactions/bank-transfers", icon: <FileSpreadsheet size={16} /> },
        { label: "Advance Processing", path: "/transactions/advance", icon: <Calculator size={16} /> },
        { label: "Loan Application", path: "/transactions/loan-application", icon: <Calculator size={16} /> },
        { label: "Leave Credit Entry", path: "/transactions/leave-credit-entry", icon: <Calendar size={16} /> },
        { label: "Grievance Entry", path: "/transactions/grievance-entry", icon: <MessageSquare size={16} /> },
        { label: "Canteen Entry", path: "/transactions/canteen-entry", icon: <Coffee size={16} /> },
        { label: "Assets & Deposits", path: "/transactions/asset-tracker", icon: <Package size={16} /> },
        ...(currentMode === 'K' ? [
          { label: "Cash Worker Management", path: "/transactions/rokda-management", icon: <IndianRupee size={16} /> },
          { label: "Cash Management", path: "/transactions/cash-management", icon: <IndianRupee size={16} /> },
          { label: "Daily MIS", path: "/transactions/daily-mis", icon: <Activity size={16} /> },
          { label: "Payroll Exceptions", path: "/transactions/payroll-exceptions", icon: <AlertTriangle size={16} /> }
        ] : []),
        { label: "Earning Transaction", path: "/transactions/earning", icon: <Plus size={16} /> },
        { label: "Deduction Transaction", path: "/transactions/deduction", icon: <Minus size={16} /> },
        { label: "Production Entry", path: "/transactions/production", icon: <ClipboardList size={16} /> },

      ]
    },
    {
      title: "Reports & Analytics",
      icon: <PieChart size={22} />,
      items: availableReports.map(rpt => ({
        label: rpt.label,
        path: rpt.path,
        icon: rpt.icon || <FileText size={16} />
      }))
    },
    {
      title: "User Management",
      icon: <ShieldCheck size={22} />,
      items: [
        { label: "User Access Control", path: "/user-management/access-control", icon: <ShieldCheck size={16} /> },
        { label: "System Connection", path: "/user-management/system-connection", icon: <Activity size={16} /> },
      ]
    }
  ];



  const isSyncing = isConnected;

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isCollapsed ? 64 : 260 }}
      className={cn(
        "flex flex-col h-screen sticky top-0 border-r shadow-2xl z-50 transition-colors duration-500",
        theme.bg,
        theme.border
      )}
    >
      {/* Header */}
      <div className={cn("p-4 flex items-center justify-between border-b", theme.border)}>
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-3"
            >
              <div className={cn("w-8 h-8 flex items-center justify-center rounded shadow-inner", theme.accentBg)}>
                <Database className={currentMode === 'K' ? "text-indigo-950" : "text-slate-950"} size={18} />
              </div>
              <div>
                <h1 className="text-sm font-black leading-none text-white tracking-tighter">HR-UDAN</h1>
                <p className={cn("text-[8px] font-mono uppercase tracking-[0.2em]", theme.accent)}>TEXTILE ERP</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-1.5 rounded-md transition-all hover:bg-white/10 text-white/50 hover:text-white",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 custom-scrollbar space-y-2">
        {menuGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            {!isCollapsed && (
              <button 
                onClick={() => toggleGroup(group.title)}
                className={cn(
                  "w-full px-6 py-3 text-sm font-bold font-mono uppercase tracking-widest opacity-90 hover:opacity-100 flex items-center justify-between transition-all",
                  theme.accent
                )}
              >
                <div className="flex items-center gap-3">
                  {group.icon}
                  <span>{group.title}</span>
                </div>
                <ChevronRight size={14} className={cn("transition-transform duration-300", expandedGroups[group.title] && "rotate-90")} />
              </button>
            )}
            
            <AnimatePresence initial={false}>
              {(isCollapsed || expandedGroups[group.title]) && (
                <motion.div 
                  initial={isCollapsed ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-1"
                >
                  {group.subGroups ? (
                    group.subGroups.map((sub, subIdx) => (
                      <div key={subIdx} className="space-y-1">
                        {!isCollapsed && (
                          <button 
                            onClick={() => toggleSubGroup(sub.title)}
                            className="w-full px-8 py-2 text-[11px] font-black uppercase tracking-wider text-white/60 hover:text-white/90 flex items-center justify-between transition-all"
                          >
                            <span>{sub.title}</span>
                            <ChevronRight size={10} className={cn("transition-transform duration-300", expandedSubGroups[sub.title] && "rotate-90")} />
                          </button>
                        )}
                        
                        <AnimatePresence initial={false}>
                          {(isCollapsed || expandedSubGroups[sub.title]) && (
                            <motion.div
                              initial={isCollapsed ? false : { height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              {sub.items.map((item, itemIdx) => (
                                <Authorized 
                                  key={itemIdx} 
                                  path={item.path}
                                  currentMode={currentMode}
                                  isConnected={isConnected}
                                  currentRole={currentRole}
                                  moduleScope={moduleScope}
                                  currentUser={currentUser}
                                >
                                  <SidebarItem 
                                    item={item}
                                    isCollapsed={isCollapsed}
                                    theme={theme}
                                  />
                                </Authorized>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-1">
                      {group.items.map((item, itemIdx) => (
                        <Authorized 
                          key={itemIdx} 
                          path={item.path}
                          currentMode={currentMode}
                          isConnected={isConnected}
                          currentRole={currentRole}
                          moduleScope={moduleScope}
                          currentUser={currentUser}
                        >
                          <SidebarItem 
                            item={item}
                            isCollapsed={isCollapsed}
                            theme={theme}
                          />
                        </Authorized>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Footer / Circuit Breaker */}
      <div className={cn("p-4 border-t space-y-4", theme.border)}>
        {/* Circuit Breaker Status */}
        <div className={cn(
          "p-2 rounded-lg border flex items-center gap-3 transition-all duration-300",
          isSyncing ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20",
          isCollapsed ? "justify-center" : "px-3"
        )}>
          <div className="relative">
            {isSyncing ? (
              <Link2 size={16} className="text-emerald-400" />
            ) : (
              <Link2Off size={16} className="text-rose-400" />
            )}
            {isSyncing && (
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-emerald-400 rounded-full -z-10"
              />
            )}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-tighter text-white/40 leading-none mb-1">Circuit Breaker</p>
              <p className={cn(
                "text-[10px] font-bold truncate",
                isSyncing ? "text-emerald-400" : "text-rose-400"
              )}>
                {isSyncing ? "SYNC ACTIVE" : "SYNC SEVERED"}
              </p>
            </div>
          )}
        </div>

        {/* User Info */}
        {!isCollapsed && (
          <div className="flex items-center gap-3 px-2">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border", theme.border)}>
              <UserCircle size={16} className="text-white/40" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{currentUser?.name}</p>
              <p className={cn("text-[9px] font-mono truncate uppercase opacity-50", theme.accent)}>{currentUser?.role}</p>
            </div>
          </div>
        )}

        <button 
          onClick={onLogout}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2 text-[10px] font-mono uppercase tracking-widest rounded-md transition-all border",
            theme.border,
            "bg-white/5 text-white/40 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30"
          )}
        >
          <ZapOff size={14} />
          {!isCollapsed && "Logout System"}
        </button>
      </div>
    </motion.aside>
  );
}

const SidebarItem: React.FC<{ item: any, isCollapsed: boolean, theme: any }> = ({ item, isCollapsed, theme }) => {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => cn(
        "flex items-center gap-3 px-4 py-2 text-sm transition-all relative group",
        isActive 
          ? theme.active
          : cn("text-white/50", theme.hover, "hover:text-white")
      )}
    >
      <div className={cn("shrink-0 transition-transform duration-300 group-hover:scale-110", isCollapsed && "mx-auto")}>
        {item.icon}
      </div>
      
      {!isCollapsed && (
        <motion.span 
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 textile-header font-medium truncate"
        >
          {item.label}
        </motion.span>
      )}

      {/* Tooltip for collapsed state */}
      {isCollapsed && (
        <div className={cn(
          "absolute left-full ml-4 px-2 py-1 rounded bg-slate-900 text-white text-[10px] font-mono uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100] border",
          theme.border
        )}>
          {item.label}
        </div>
      )}
    </NavLink>
  );
};
