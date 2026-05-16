import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  RefreshCw, Download, CheckCircle2, AlertCircle, Loader2, 
  Fingerprint, Calendar, User, Search, Filter, Plus, 
  Edit2, Clock, MapPin, Building2, Layers, Briefcase, 
  ChevronDown, AlertTriangle, MoreHorizontal, Lock,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ShieldAlert, Save, X, ShieldCheck
} from 'lucide-react';
import { 
  addMinutes, 
  parse, 
  format, 
  eachDayOfInterval, 
  isSunday, 
  isSameDay 
} from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User as UserType, Employee } from '../../types';
import { useModule } from '../../contexts/ModuleContext';
import { usePermission } from '../../hooks/useRBAC';
import { useRegisterShortcut } from '../../components/common/ShortcutProvider';
import { Pagination } from '../../components/common/Pagination';
import { SearchableSelect, MultiSearchableSelect } from '../../components/common/SearchableSelect';
import { EmployeeSearchSelect } from '../../components/form/EmployeeSearchSelect';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AttendancePunch {
  id: number;
  punch_in: string | null;
  punch_out: string | null;
  worked_mins: number;
  is_missed: boolean;
}

interface AttendanceLog {
  id: number;
  emp_id: number;
  emp_code: string;
  emp_name: string;
  department_name: string;
  designation_name: string;
  shift_name: string;
  shift_id: number | null;
  machine_name: string;
  date: string;
  punch_in: string | null;
  punch_out: string | null;
  total_time_mins: number;
  worked_mins: number;
  outside_mins: number;
  attendance_value: number;
  status: string;
  is_missed_punch: boolean;
  blacklist_status?: boolean;
  punches: AttendancePunch[];
}

const AttendanceEntry: React.FC<{ currentUser: UserType | null }> = ({ currentUser }) => {
  const { currentMode } = useModule();
  const canEdit = usePermission('Attendance.edit');
  const canExport = usePermission('Attendance.export');
  const canApprove = usePermission('Attendance.approve');
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [editingLogs, setEditingLogs] = useState<Record<number, { punch_in: string, punch_out: string }>>({});
  const [isLoading, setIsLoading] = useState(true);

  useRegisterShortcut({ key: 'Arrows', description: 'Grid Navigation (Excel Mode)' });
  useRegisterShortcut({ key: 'Enter', description: 'Save Row & Move Down' });
  const [isFetching, setIsFetching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const canProcessBlacklist = isSuperAdmin || ([])?.find(p => p.page === 'Payroll')?.can_process_blacklist;

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  // Filters
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [deptId, setDeptId] = useState<string[]>([]);
  const [locationId, setLocationId] = useState<string[]>([]);
  const [divisionId, setDivisionId] = useState<string[]>([]);
  const [groupId, setGroupId] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string[]>([]);
  const [classId, setClassId] = useState<string[]>([]);
  const [designationId, setDesignationId] = useState<string[]>([]);
  const [machineName, setMachineName] = useState<string[]>([]);
  const [punchesFilter, setPunchesFilter] = useState<'ALL' | 'MISSED'>('ALL');

  // Master Data for Filters
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);

  const [shifts, setShifts] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);

  const fetchMasterData = async () => {
    try {
      const data = await invoke<any>('get_master_data', { moduleType: currentMode });
      
      setDepartments(Array.isArray(data.departments) ? data.departments : []);
      setEmployees(Array.isArray(data.employees) ? data.employees : []);
      setLocations(Array.isArray(data.locations) ? data.locations : []);
      setDivisions(Array.isArray(data.divisions) ? data.divisions : []);
      setGroups(Array.isArray(data.groups) ? data.groups : []);
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setClasses(Array.isArray(data.classes) ? data.classes : []);
      setDesignations(Array.isArray(data.designations) ? data.designations : []);
      setMachines(Array.isArray(data.machines) ? data.machines : []);
      setShifts(Array.isArray(data.shifts) ? data.shifts : []);
      setHolidays(Array.isArray(data.holidays) ? data.holidays : []);
    } catch (err) {
      console.error("Failed to load master data:", err);
      toast.error("Failed to load master data");
    }
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<AttendanceLog[]>('get_attendance_logs', {
        filters: {
          fromDate,
          toDate,
          empCodes: employees.filter(e => selectedEmpIds.includes(e.id)).map(e => e.emp_code),
          departmentId: deptId,
          locationId,
          divisionId,
          groupId,
          categoryId,
          classId,
          designationId,
          machineName,
          isMissed: punchesFilter === 'MISSED'
        },
        moduleType: currentMode
      });
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to load attendance logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
    fetchLogs();
  }, [
    currentMode, 
    fromDate, 
    toDate, 
    locationId, 
    divisionId, 
    groupId, 
    deptId, 
    categoryId, 
    classId, 
    designationId, 
    punchesFilter,
    machineName,
    selectedEmpIds
  ]);

  const totalPages = Math.ceil(logs.length / pageSize);
  const currentItems = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleFetchRecords = async () => {
    setIsFetching(true);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress(prev => (prev >= 90 ? 90 : prev + 10));
    }, 200);

    try {
      toast.info("Connecting to biometric device via Rust backend...");
      // In a real app, we'd get these from settings
      const connectionString = "Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=C:\\Biometric\\data.mdb";
      const deviceEntryType = "Multi-Row";
      
      const biometricLogs = await invoke<any[]>('fetch_biometric_logs', { 
        connectionString, 
        deviceEntryType,
        moduleType: currentMode
      });
      
      // Save to backend
      const result = await invoke<any>('save_biometric_logs', { 
        logs: biometricLogs,
        moduleType: currentMode
      });
      
      setProgress(100);
      setTimeout(() => {
        setIsFetching(false);
        toast.success(`Successfully fetched and saved ${result.savedCount} records via Rust!`);
        fetchLogs();
      }, 500);
    } catch (err) {
      toast.error("Failed to fetch records");
      setIsFetching(false);
    } finally {
      clearInterval(interval);
    }
  };

  const handleProcessAttendance = async () => {
    setIsProcessing(true);
    try {
      await invoke('process_attendance', {
        fromDate,
        toDate,
        moduleType: currentMode
      });
      toast.success("Attendance processed successfully!");
      fetchLogs();
    } catch (err) {
      toast.error("Failed to process attendance");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--:--';
    return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isGhostModalOpen, setIsGhostModalOpen] = useState(false);
  const [isExcelUploadModalOpen, setIsExcelUploadModalOpen] = useState(false);
  const [manualData, setManualData] = useState({
    emp_id: '',
    date: new Date().toISOString().split('T')[0],
    punch_in: '',
    punch_out: ''
  });

  const manualDateRef = useRef<HTMLInputElement>(null);

  const handleEdit = (log: AttendanceLog) => {
    if (log.blacklist_status) {
      if (canProcessBlacklist) {
        toast.warning("Authorized Override: Processing Blacklisted Employee");
      } else {
        toast.error("Vigilance Lock: Access Restricted for Blacklisted Employee");
        return;
      }
    }
    setManualData({
      emp_id: log.emp_id.toString(),
      date: log.date,
      punch_in: log.punch_in ? new Date(log.punch_in).toTimeString().slice(0, 5) : '',
      punch_out: log.punch_out ? new Date(log.punch_out).toTimeString().slice(0, 5) : ''
    });
    setIsManualModalOpen(true);
  };
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Construct full ISO strings for punch in/out
      const punchInFull = manualData.punch_in ? `${manualData.date}T${manualData.punch_in}` : null;
      const punchOutFull = manualData.punch_out ? `${manualData.date}T${manualData.punch_out}` : null;

      await invoke('save_manual_attendance', {
        emp_id: parseInt(manualData.emp_id),
        date: manualData.date,
        punch_in: punchInFull,
        punch_out: punchOutFull,
        shift_id: null,
        module_type: currentMode
      });

      toast.success("Manual entry saved successfully");
      setIsManualModalOpen(false);
      fetchLogs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    }
  };

  const handleGridKeyDown = (e: React.KeyboardEvent, rowIndex: number, col: 'in' | 'out') => {
    const target = e.target as HTMLInputElement;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="${col}"]`) as HTMLInputElement;
      next?.focus();
      next?.select();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = document.querySelector(`[data-row="${rowIndex - 1}"][data-col="${col}"]`) as HTMLInputElement;
      prev?.focus();
      prev?.select();
    } else if (e.key === 'ArrowRight' && target.selectionEnd === target.value.length) {
      if (col === 'in') {
        e.preventDefault();
        const right = document.querySelector(`[data-row="${rowIndex}"][data-col="out"]`) as HTMLInputElement;
        right?.focus();
        right?.select();
      }
    } else if (e.key === 'ArrowLeft' && target.selectionStart === 0) {
      if (col === 'out') {
        e.preventDefault();
        const left = document.querySelector(`[data-row="${rowIndex}"][data-col="in"]`) as HTMLInputElement;
        left?.focus();
        left?.select();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRow(rowIndex);
      const nextRow = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="in"]`) as HTMLInputElement;
      nextRow?.focus();
      nextRow?.select();
    }
  };

  const handleSaveRow = async (rowIndex: number) => {
    const log = currentItems[rowIndex];
    const edit = editingLogs[log.id];
    if (!edit) return;

    try {
      await invoke('save_manual_attendance', {
        emp_id: log.emp_id,
        date: log.date,
        punch_in: edit.punch_in,
        punch_out: edit.punch_out,
        shift_id: log.shift_id,
        module_type: currentMode
      });
      
      toast.info(`Row Saved: ${log.emp_name}`, {
        duration: 1000,
        className: "font-mono text-[10px] uppercase tracking-widest border-primary-navy/20 bg-white/80 backdrop-blur-md"
      });
      
      // Remove from editing state
      setEditingLogs(prev => {
        const next = { ...prev };
        delete next[log.id];
        return next;
      });

      // Re-fetch to get calculated durations
      fetchLogs();
    } catch (err) {
      toast.error("Failed to save row");
    }
  };

  const totalAttendance = logs.reduce((sum, log) => sum + (log.attendance_value || 0), 0);
  const avgWorkedMins = logs.length > 0 
    ? logs.reduce((sum, log) => sum + (log.worked_mins || 0), 0) / logs.length 
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-black text-primary-navy tracking-tight">Attendance Entry</h2>
          <p className="text-text-muted text-sm">Manage and update employee punches for Part A (Actual MIS).</p>
        </div>
        <div className="flex gap-2">
          {currentMode === 'P' && (
            <button 
              onClick={() => setIsGhostModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all shadow-md"
            >
              <Fingerprint size={16} /> Ghost Punches
            </button>
          )}
          <button 
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-app-border rounded-lg text-sm font-bold text-primary-navy hover:bg-slate-50 transition-all shadow-sm"
          >
            <Plus size={16} /> Manual Entry
          </button>
          <button 
            onClick={() => setIsExcelUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-app-border rounded-lg text-sm font-bold text-primary-navy hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={16} /> Bulk Excel Upload
          </button>
          <button 
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-app-border rounded-lg text-sm font-bold text-primary-navy hover:bg-slate-50 transition-all shadow-sm"
          >
            <Plus size={16} /> Monthly Bulk Entry
          </button>
          <button 
            onClick={handleFetchRecords}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 bg-primary-navy text-white rounded-lg text-sm font-bold hover:bg-primary-navy/90 transition-all shadow-md disabled:opacity-50"
          >
            {isFetching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Fetch Records
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-app-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-app-border bg-slate-50/50 flex items-center gap-2">
          <Filter size={16} className="text-primary-navy" />
          <span className="text-xs font-black text-primary-navy uppercase tracking-wider">Filters</span>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
              <Calendar size={10} /> From Date
            </label>
            <input 
              type="date" 
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full bg-white border border-app-border p-2.5 text-xs rounded-lg focus:ring-2 focus:ring-primary-navy/10 focus:border-primary-navy outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
              <Calendar size={10} /> To Date
            </label>
            <input 
              type="date" 
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full bg-white border border-app-border p-2.5 text-xs rounded-lg focus:ring-2 focus:ring-primary-navy/10 focus:border-primary-navy outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <MultiSearchableSelect 
              label="Location" 
              options={locations.map(l => ({ value: l.id.toString(), label: l.name }))} 
              value={locationId}
              onChange={setLocationId}
              placeholder="Select Location"
            />
          </div>
          <div className="space-y-2">
            <MultiSearchableSelect 
              label="Division" 
              options={divisions.map(d => ({ value: d.id.toString(), label: d.name }))} 
              value={divisionId}
              onChange={setDivisionId}
              placeholder="Select Division"
            />
          </div>
          <div className="space-y-2">
            <MultiSearchableSelect 
              label="Group" 
              options={groups.map(g => ({ value: g.id.toString(), label: g.name }))} 
              value={groupId}
              onChange={setGroupId}
              placeholder="Select Group"
            />
          </div>
          <div className="space-y-2">
            <MultiSearchableSelect 
              label="Department" 
              options={departments.map(d => ({ value: d.id.toString(), label: d.name }))} 
              value={deptId}
              onChange={setDeptId}
              placeholder="Select Department"
            />
          </div>
          <div className="space-y-2">
            <MultiSearchableSelect 
              label="Machine" 
              options={machines.map(m => ({ value: m.name, label: m.name }))} 
              value={machineName}
              onChange={setMachineName}
              placeholder="Select Machine"
            />
          </div>
          <div className="space-y-2">
            <MultiSearchableSelect 
              label="Designation" 
              options={designations.map(d => ({ value: d.id.toString(), label: d.name }))} 
              value={designationId}
              onChange={setDesignationId}
              placeholder="Select Designation"
            />
          </div>
          <div className="space-y-2">
            <MultiSearchableSelect 
              label="Category" 
              options={categories.map(c => ({ value: c.id.toString(), label: c.name }))} 
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Select Category"
            />
          </div>
          <div className="space-y-2">
            <MultiSearchableSelect 
              label="Class" 
              options={classes.map(c => ({ value: c.id.toString(), label: c.name }))} 
              value={classId}
              onChange={setClassId}
              placeholder="Select Class"
            />
          </div>
          <div className="space-y-2">
            <EmployeeSearchSelect 
              label="Employee Filter"
              employees={employees}
              value={selectedEmpIds.length > 0 ? selectedEmpIds : undefined}
              selectedIds={selectedEmpIds}
              onChange={(val) => setSelectedEmpIds(Array.isArray(val) ? val.map(id => Number(id)) : [])}
              placeholder="Search by name or code..."
              isMulti={true}
            />
          </div>
          <div className="space-y-2">
            <SearchableSelect 
              label="Punches Filter"
              options={[
                { value: "ALL", label: "All Records" },
                { value: "MISSED", label: "Missed Punches Only" }
              ]}
              value={punchesFilter}
              onChange={(val) => setPunchesFilter(val as 'ALL' | 'MISSED')}
              placeholder="Filter Punches"
            />
          </div>
          <div className="flex items-end">
            <button 
              onClick={fetchLogs}
              className="w-full bg-primary-navy text-white py-2.5 rounded-lg text-xs font-bold hover:bg-primary-navy/90 transition-all shadow-sm"
            >
              Apply Filters
            </button>
          </div>
          <div className="flex items-end">
            {canApprove && <button 
              onClick={handleProcessAttendance}
              disabled={isProcessing}
              className="w-full bg-primary-green text-white py-2.5 rounded-lg text-xs font-bold hover:bg-primary-green/90 transition-all shadow-sm disabled:opacity-50"
            >
              {isProcessing ? <Loader2 size={14} className="animate-spin inline mr-2" /> : <CheckCircle2 size={14} className="inline mr-2" />}
              Process Attendance
            </button>}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white border border-app-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-app-border bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-primary-navy" />
            <span className="text-xs font-black text-primary-navy uppercase tracking-wider">Attendance Logs</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-text-muted uppercase tracking-tighter">Total Attendance</span>
              <span className="bg-primary-green/10 text-primary-green text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-primary-green/20">
                {totalAttendance.toFixed(1)}
              </span>
            </div>
            <div className="flex flex-col items-end border-l border-app-border pl-3">
              <span className="text-[9px] font-black text-text-muted uppercase tracking-tighter">Avg. Worked Hrs</span>
              <span className="bg-primary-navy/10 text-primary-navy text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-primary-navy/20">
                {formatMins(Math.round(avgWorkedMins))}
              </span>
            </div>
            <div className="flex flex-col items-end border-l border-app-border pl-3">
              <span className="text-[9px] font-black text-text-muted uppercase tracking-tighter">Count</span>
              <span className="bg-slate-100 text-text-main text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-app-border">
                {logs.length}
              </span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50 border-b border-app-border">
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">Code</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">Name</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">Department</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">Machine</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">Designation</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">Shift</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">Date</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">In</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">Out</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">Total Time</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">Worked Hrs</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">Outside Hrs</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase">Attendance</th>
                <th className="p-3 text-[10px] font-black text-primary-navy uppercase text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {isLoading ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center">
                    <Loader2 size={32} className="animate-spin mx-auto text-primary-navy/20" />
                    <p className="text-text-muted text-xs mt-2 font-mono uppercase">Loading attendance data...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center">
                    <AlertCircle size={32} className="mx-auto text-primary-red/20" />
                    <p className="text-text-muted text-xs mt-2 font-mono uppercase">No records found for the selected criteria.</p>
                  </td>
                </tr>
              ) : (
                currentItems.map((log, idx) => (
                  <tr key={log.id} className={cn(
                    "hover:bg-slate-50 transition-colors group",
                    log.is_missed_punch && "bg-red-50/30"
                  )}>
                    <td className="p-3 text-xs font-bold text-primary-navy">{log.emp_code}</td>
                    <td className="p-3 text-xs font-medium text-text-main">
                      <div className="flex items-center gap-2">
                        {log.emp_name || 'N/A'}
                        {Boolean(log.blacklist_status) && (
                          <div className="relative group/lock">
                            <Lock size={12} className="text-primary-red" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-primary-red text-white text-[10px] rounded opacity-0 group-hover/lock:opacity-100 transition-all whitespace-nowrap pointer-events-none z-50">
                              Vigilance Lock: Blacklisted
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-text-muted">{log.department_name || '-'}</td>
                    <td className="p-3 text-xs text-text-muted">{log.machine_name || '-'}</td>
                    <td className="p-3 text-xs text-text-muted">{log.designation_name || '-'}</td>
                    <td className="p-3 text-xs text-text-muted">{log.shift_name || '-'}</td>
                    <td className="p-3 text-xs font-mono">{log.date}</td>
                    <td className="p-2">
                      <input 
                        type="time"
                        data-row={idx}
                        data-col="in"
                        value={editingLogs[log.id]?.punch_in?.slice(11, 16) || (log.punch_in ? new Date(log.punch_in).toTimeString().slice(0, 5) : '')}
                        onChange={(e) => {
                          const time = e.target.value;
                          const fullDate = log.date + 'T' + time;
                          setEditingLogs(prev => ({ ...prev, [log.id]: { ...prev[log.id], punch_in: fullDate, punch_out: prev[log.id]?.punch_out || log.punch_out || '' } }));
                        }}
                        onKeyDown={(e) => handleGridKeyDown(e, idx, 'in')}
                        className="w-full bg-transparent border-none p-1 text-xs font-mono text-primary-green font-bold focus:ring-1 focus:ring-primary-navy/20 rounded outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="time"
                        data-row={idx}
                        data-col="out"
                        value={editingLogs[log.id]?.punch_out?.slice(11, 16) || (log.punch_out ? new Date(log.punch_out).toTimeString().slice(0, 5) : '')}
                        onChange={(e) => {
                          const time = e.target.value;
                          const fullDate = log.date + 'T' + time;
                          setEditingLogs(prev => ({ ...prev, [log.id]: { ...prev[log.id], punch_out: fullDate, punch_in: prev[log.id]?.punch_in || log.punch_in || '' } }));
                        }}
                        onKeyDown={(e) => handleGridKeyDown(e, idx, 'out')}
                        className="w-full bg-transparent border-none p-1 text-xs font-mono text-primary-red font-bold focus:ring-1 focus:ring-primary-navy/20 rounded outline-none"
                      />
                    </td>
                    <td className="p-3 text-xs font-mono">{formatMins(log.total_time_mins)}</td>
                    <td className="p-3 text-xs font-mono font-bold text-primary-navy">{formatMins(log.worked_mins)}</td>
                    <td className="p-3 text-xs font-mono text-text-muted">{formatMins(log.outside_mins)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-primary-navy/10 text-primary-navy text-[10px] font-bold rounded">
                        {log.attendance_value}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(log)}
                          className="p-1.5 text-text-muted hover:text-primary-navy hover:bg-white rounded transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        {Boolean(log.is_missed_punch) && (
                          <div className="relative group/tooltip">
                            <AlertTriangle size={14} className="text-primary-red" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-primary-red text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 transition-all whitespace-nowrap pointer-events-none">
                              Missed Punch Detected
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={logs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>
      {/* Bulk Entry Modal */}
      <BulkEntryModal 
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        shifts={shifts}
        selectedEmpIds={selectedEmpIds}
        employees={employees}
        holidays={holidays}
        currentMode={currentMode}
        onComplete={fetchLogs}
        initialFromDate={fromDate}
        initialToDate={toDate}
        deptId={deptId}
        locationId={locationId}
        divisionId={divisionId}
        groupId={groupId}
        categoryId={categoryId}
        designationId={designationId}
      />

      <GhostPunchesModal 
        isOpen={isGhostModalOpen}
        onClose={() => setIsGhostModalOpen(false)}
        employees={employees}
        onComplete={fetchLogs}
        initialMonth={format(new Date(), 'MM-yyyy')}
        filters={{
          departmentId: deptId,
          locationId,
          divisionId,
          groupId,
          categoryId,
          designationId
        }}
      />

      {/* Manual Entry Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-primary-navy/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-app-border bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-primary-navy tracking-tight">Manual Attendance Entry</h3>
              <button onClick={() => setIsManualModalOpen(false)} className="text-text-muted hover:text-primary-red transition-colors">
                <AlertCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <EmployeeSearchSelect
                  label="Employee"
                  required={true}
                  employees={employees}
                  value={manualData.emp_id}
                  onChange={(id) => setManualData({...manualData, emp_id: id?.toString() || ''})}
                  placeholder="Select Employee..."
                  nextFieldRef={manualDateRef}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Date</label>
                <input 
                  ref={manualDateRef}
                  type="date"
                  required
                  value={manualData.date}
                  onChange={e => setManualData({...manualData, date: e.target.value})}
                  className="w-full bg-white border border-app-border p-2.5 text-xs rounded-lg outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Punch In</label>
                  <input 
                    type="time"
                    required
                    value={manualData.punch_in}
                    onChange={e => setManualData({...manualData, punch_in: e.target.value})}
                    className="w-full bg-white border border-app-border p-2.5 text-xs rounded-lg outline-none focus:ring-2 focus:ring-primary-navy/10 focus:border-primary-navy"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Punch Out</label>
                  <input 
                    type="time"
                    required
                    value={manualData.punch_out}
                    onChange={e => setManualData({...manualData, punch_out: e.target.value})}
                    className="w-full bg-white border border-app-border p-2.5 text-xs rounded-lg outline-none focus:ring-2 focus:ring-primary-navy/10 focus:border-primary-navy"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-text-main rounded-lg text-sm font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-navy text-white rounded-lg text-sm font-bold hover:bg-primary-navy/90 transition-all shadow-md"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceEntry;

interface GhostPunchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: any[];
  onComplete: () => void;
  initialMonth: string;
  filters: any;
}

const GhostPunchesModal: React.FC<GhostPunchesModalProps> = ({ 
  isOpen, onClose, employees, onComplete, initialMonth, filters
}) => {
  const [monthYear, setMonthYear] = useState(initialMonth);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await invoke('generate_ghost_punches', {
        monthYear,
        filters
      });
      toast.success("Statutory Ghost Punches generated successfully!");
      onComplete();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate ghost punches");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary-navy/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-app-border"
      >
        <div className="p-6 border-b border-app-border bg-emerald-50 flex justify-between items-center text-emerald-900">
          <div className="flex items-center gap-2">
            <Fingerprint size={20} />
            <h3 className="font-black uppercase tracking-tight text-sm text-emerald-900">Statutory Ghost Generator</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-emerald-100 rounded-full transition-colors">
            <X size={20} className="text-emerald-800" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex gap-3">
            <ShieldAlert className="text-emerald-600 shrink-0" size={18} />
            <div className="space-y-1">
              <p className="text-[10px] text-emerald-800 leading-relaxed font-black uppercase tracking-tight">
                COMPLIANCE AUTOMATION
              </p>
              <p className="text-[10px] text-emerald-700/80 leading-relaxed font-bold">
                This tool fills gaps in attendance for statutory compliance. It respects holidays and weekly offs, generating punches that satisfy a 1.0 attendance value for all remaining days in the month.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
              <Calendar size={10} /> Select Month (MM-YYYY)
            </label>
            <input 
              type="text" 
              placeholder="04-2026"
              value={monthYear}
              onChange={e => setMonthYear(e.target.value)}
              className="w-full bg-slate-50 border border-app-border p-2.5 text-xs rounded-lg outline-none focus:border-emerald-500 transition-all font-mono"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-app-border">
            <button 
              onClick={onClose}
              className="px-6 py-2 text-xs font-bold text-text-muted hover:bg-slate-100 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isGenerating && <Loader2 size={14} className="animate-spin" />}
              Generate Punches
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

interface BulkEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shifts: any[];
  selectedEmpIds: number[];
  employees: any[];
  holidays: any[];
  currentMode: string;
  onComplete: () => void;
  initialFromDate: string;
  initialToDate: string;
  deptId: string[];
  locationId: string[];
  divisionId: string[];
  groupId: string[];
  categoryId: string[];
  designationId: string[];
}

const BulkEntryModal: React.FC<BulkEntryModalProps> = ({ 
  isOpen, onClose, shifts, selectedEmpIds, employees, holidays, currentMode, onComplete,
  initialFromDate, initialToDate,
  deptId, locationId, divisionId, groupId, categoryId, designationId
}) => {
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [shiftId, setShiftId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Use the new heavy-lifting command
      const res = await invoke<any>('bulk_attendance_v2', {
        fromDate,
        toDate,
        filters: {
          departmentId: deptId,
          locationId,
          divisionId,
          groupId,
          categoryId,
          designationId
        },
        moduleType: currentMode
      });

      if (res.status === 'success') {
        const { summary } = res;
        toast.success(`Generated ${summary.total_records} records for ${summary.processed_employees} employees`);
        if (summary.skipped_missing_shift.length > 0) {
          console.warn("Skipped for missing shift:", summary.skipped_missing_shift);
          toast.warning(`Skipped ${summary.skipped_missing_shift.length} employees due to missing shift in Master`, {
            duration: 5000
          });
        }
        onComplete();
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to generate attendance");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary-navy/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-app-border"
      >
        <div className="p-6 border-b border-app-border bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-2 text-primary-navy">
            <Clock size={20} />
            <h3 className="font-black uppercase tracking-tight text-sm">Monthly Bulk Entry (Auto-Shift)</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex gap-3">
            <ShieldCheck className="text-emerald-600 shrink-0" size={18} />
            <div className="space-y-1">
              <p className="text-[10px] text-emerald-800 leading-relaxed font-black uppercase tracking-tight">
                Backend-Driven Processing
              </p>
              <p className="text-[10px] text-emerald-700/80 leading-relaxed font-bold">
                The system will automatically identify employees based on your current filters and fetch their assigned shifts from the Employee Master.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                <Calendar size={10} /> From Date
              </label>
              <input 
                type="date" 
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full bg-slate-50 border border-app-border p-2.5 text-xs rounded-lg outline-none focus:border-primary-navy transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1">
                <Calendar size={10} /> To Date
              </label>
              <input 
                type="date" 
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full bg-slate-50 border border-app-border p-2.5 text-xs rounded-lg outline-none focus:border-primary-navy transition-all"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <h4 className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em] mb-2">Applied Active Filters</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries({
                Dept: deptId,
                Loc: locationId,
                Div: divisionId,
                Grp: groupId,
                Cat: categoryId,
                Desig: designationId
              }).map(([key, val]) => val && (
                <span key={key} className="px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-bold text-primary-navy uppercase">
                  {key}: {val}
                </span>
              ))}
              {!deptId && !locationId && !divisionId && !groupId && !categoryId && !designationId && (
                <span className="text-[9px] font-bold text-amber-600 uppercase">Warning: Processing ALL Active Employees</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-app-border">
            <button 
              onClick={onClose}
              className="px-6 py-2 text-xs font-bold text-text-muted hover:bg-slate-100 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2 bg-primary-navy text-white rounded-lg text-xs font-bold hover:bg-primary-navy/90 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isGenerating && <Loader2 size={14} className="animate-spin" />}
              Generate Attendance
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
