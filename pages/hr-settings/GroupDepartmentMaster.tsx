import React, { useState, useEffect, useRef } from 'react';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Settings, 
  ChevronRight, 
  ChevronDown,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  Save,
  Calendar,
  DollarSign,
  UserCheck,
  Download,
  Upload,
  RefreshCw,
  Database,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { EmployeeSearchSelect } from '../../components/form/EmployeeSearchSelect';
import * as Tabs from '@radix-ui/react-tabs';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from '../../utils/xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { Pagination } from '../../components/common/Pagination';

import { useModule } from '../../contexts/ModuleContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Group {
  id: number;
  name: string;
  description: string;
  status: number;
  group_id?: number;
}

interface Department {
  id: number;
  group_id: number;
  name: string;
  description: string;
  status: number;
  department_id?: number;
}

interface DeptSettings {
  default_location_id?: number;
  default_division_id?: number;
  default_class_id?: number;
  default_category_id?: number;
  default_shift_id?: number;
  default_reporting_employee_id?: number;
}

interface StandardRate {
  id: number;
  designation_id: number;
  designation_name?: string;
  standard_rate: number;
  manpower: number;
  effective_date: string;
}

interface Designation {
  id: number;
  name: string;
  status: number;
}

export default function GroupDepartmentMaster() {
  const { currentMode } = useModule();

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  const [groups, setGroups] = useState<Group[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<number[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'group' | 'department' | 'rate', id: number, name: string } | null>(null);

  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', status: 1 });
  const [deptForm, setDeptForm] = useState({ group_id: 0, name: '', description: '', status: 1 });
  
  const deptFileRef = useRef<HTMLInputElement>(null);
  const rateFileRef = useRef<HTMLInputElement>(null);

  // Settings State
  const [deptSettings, setDeptSettings] = useState<DeptSettings>({});
  const [standardRates, setStandardRates] = useState<StandardRate[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [newRateForm, setNewRateForm] = useState({ designation_id: 0, standard_rate: 0, manpower: 0, effective_date: '' });

  // Master Data for Dropdowns
  const [locations, setLocations] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeList, setShowEmployeeList] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const downloadTemplate = () => {
    const headers = [['Group', 'Department', 'Reporting Employee (IRA)', 'Default Location', 'Default Division', 'Default Class', 'Default Category', 'Default Shift', 'Description', 'Status']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Department_Template.xlsx");
  };

  const downloadRateTemplate = () => {
    const headers = [['Department', 'Designation', 'Standard Rate', 'Manpower', 'Effective Date']];
    // Pre-populate with existing department names as requested
    const deptRows = departments.map(d => [d.name, '', '', '', '']);
    const wsData = [...headers, ...deptRows];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Standard Rates Template");
    XLSX.writeFile(wb, "Standard_Rates_Template.xlsx");
  };

  const handleBulkRateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = await XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      try {
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
        
        if (jsonData.length === 0) {
          toast.error("No valid records found in file");
          return;
        }

        const chunkSize = 200;
        for (let i = 0; i < jsonData.length; i += chunkSize) {
          const chunk = jsonData.slice(i, i + chunkSize);
          await fetchApi('/api/master-data/cmd/bulkUploadStandardRates', { method: 'POST', body: JSON.stringify({
            records: chunk,
            moduleType: currentMode
          }) });
        }
        
        toast.success(`Standard Rates bulk upload successful (${jsonData.length} records)`);
        fetchData();
      } catch (error) {
        console.error('Bulk upload error:', error);
        toast.error("Bulk upload failed");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = await XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      try {
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
        
        // Refactor: Validation and Defaulting to Active
        const validatedData = jsonData.filter(row => {
          const deptName = row.Department || row.department || row.name;
          return !!deptName; // Only include rows with a department name
        }).map(row => ({
          ...row,
          Status: 1 // Force all uploaded departments to be active
        }));

        if (validatedData.length === 0) {
          toast.error("No valid records found in file");
          return;
        }

        const chunkSize = 200;
        for (let i = 0; i < validatedData.length; i += chunkSize) {
          const chunk = validatedData.slice(i, i + chunkSize);
          await fetchApi('/api/master-data/cmd/bulkUploadDepartments', { method: 'POST', body: JSON.stringify({
            records: chunk,
            moduleType: currentMode
          }) });
        }
        
        toast.success(`Bulk upload successful (${validatedData.length} records)`);
        fetchData();
      } catch (error) {
        toast.error("Bulk upload failed");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleClearAll = () => {
    console.log("handleClearAll triggered");
    setIsClearAllModalOpen(true);
  };

  const confirmClearAll = async () => {
    try {
      await fetchApi('/api/master-data/cmd/clearOrgData', { method: 'POST', body: JSON.stringify({ moduleType: currentMode }) });
      toast.success("All data cleared successfully");
      setIsClearAllModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Failed to clear data");
    }
  };

  const handleDelete = async (type: 'group' | 'department' | 'rate', id: number, name: string) => {
    setDeleteConfirm({ type, id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    
    try {
      if (type === 'rate') {
        await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
          tableName: 'standard_rates',
          operation: 'delete',
          id,
          moduleType: currentMode
        }) });
        setStandardRates(prev => prev.filter(r => r.id !== id));
      } else {
        await fetchApi('/api/system/cmd/deleteOrgUnit', { method: 'POST', body: JSON.stringify({ unitType: type, id, moduleType: currentMode }) });
        fetchData();
      }
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(typeof error === 'string' ? error : 'Failed to delete');
    }
  };

  const fetchData = async () => {
    try {
      const [gData, dData, hierarchy, classes, categories, shifts, employees, desigData] = await Promise.all([
        fetchApi<Group[]>('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({ tableName: 'groups', operation: 'list', moduleType: currentMode }) }),
        fetchApi<Department[]>('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({ tableName: 'departments', operation: 'list', moduleType: currentMode }) }),
        fetchApi<any[]>('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({ tableName: 'org_hierarchy', operation: 'list', moduleType: currentMode }) }),
        fetchApi<any[]>('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({ tableName: 'classes', operation: 'list', moduleType: currentMode }) }),
        fetchApi<any[]>('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({ tableName: 'categories', operation: 'list', moduleType: currentMode }) }),
        fetchApi<any[]>('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({ tableName: 'shifts', operation: 'list', moduleType: currentMode }) }),
        fetchApi<any[]>('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({ tableName: 'employees', operation: 'list', moduleType: currentMode }) }),
        fetchApi<Designation[]>('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({ tableName: 'designations', operation: 'list', moduleType: currentMode }) })
      ]);
      
      setGroups(Array.isArray(gData) ? gData.map((g: any) => {
        const id = Number(g.id || g.id);
        const parentId = g.group_id !== undefined ? g.group_id : g.groupId;
        return { 
          ...g, 
          id, 
          group_id: parentId ? Number(parentId) : null 
        };
      }) : []);
      
      setDepartments(Array.isArray(dData) ? dData.map((d: any) => {
        const id = Number(d.id || d.id);
        const groupId = d.group_id !== undefined ? d.group_id : d.groupId;
        return { 
          ...d, 
          id, 
          group_id: Number(groupId) 
        };
      }) : []);
      
      const hierarchyData = Array.isArray(hierarchy) ? hierarchy : [];
      setLocations(hierarchyData.filter(h => h.type === 'Location'));
      setDivisions(hierarchyData.filter(h => h.type === 'Division'));
      setClasses(Array.isArray(classes) ? classes : []);
      setCategories(Array.isArray(categories) ? categories : []);
      setShifts(Array.isArray(shifts) ? shifts : []);
      setEmployees(Array.isArray(employees) ? employees : []);
      setDesignations(Array.isArray(desigData) ? desigData.filter(d => d.status === 1) : []);
    } catch (error) {
      toast.error("Failed to fetch data");
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentMode]);

  // Root groups for pagination (only those at the top level)
  const rootGroups = groups.filter(g => !g.group_id);
  const totalPages = Math.ceil(rootGroups.length / pageSize);
  const paginatedRootGroups = rootGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleGroup = (groupId: number) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  // Hierarchical Filter Logic
  const { filteredGroups, filteredDepartments, searchExpandedIds } = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return { 
        filteredGroups: groups, 
        filteredDepartments: departments, 
        searchExpandedIds: [] as number[] 
      };
    }

    const term = searchTerm.toLowerCase();
    const groupMatches = new Set<number>();
    const deptMatches = new Set<number>();
    const expandedIds = new Set<number>();

    // 1. Identify direct matches in departments
    departments.forEach(d => {
      if ((d.name || "").toLowerCase().includes(term) || (d.description && (d.description || "").toLowerCase().includes(term))) {
        deptMatches.add(d.id);
        // Mark all parent groups up the tree as expanded
        let pid = d.group_id;
        while (pid) {
          expandedIds.add(pid);
          const parent = groups.find(g => g.id === pid);
          pid = parent?.group_id || 0;
        }
      }
    });

    // 2. Identify direct matches in groups
    groups.forEach(g => {
      if ((g.name || "").toLowerCase().includes(term) || (g.description && (g.description || "").toLowerCase().includes(term))) {
        groupMatches.add(g.id);
        // Mark ancestors down the tree as expanded (to show children)
        // Actually, just mark parents up the tree as expanded to show this group
        let pid = g.group_id;
        while (pid) {
          expandedIds.add(pid);
          const parent = groups.find(g => g.id === pid);
          pid = parent?.group_id || 0;
        }
      }
    });

    // 3. Final visibility: a group is visible if it matches or is an ancestor of a match
    const visibleGroupIds = new Set([...groupMatches, ...expandedIds]);
    
    return {
      filteredGroups: groups.filter(g => visibleGroupIds.has(g.id)),
      filteredDepartments: departments.filter(d => deptMatches.has(d.id) || visibleGroupIds.has(d.group_id)),
      searchExpandedIds: Array.from(expandedIds)
    };
  }, [searchTerm, groups, departments]);

  // Auto-expansion when searching
  useEffect(() => {
    if (searchTerm.trim() && searchExpandedIds.length > 0) {
      setExpandedGroups(prev => [...new Set([...prev, ...searchExpandedIds])]);
    }
  }, [searchTerm, searchExpandedIds]);

  const handleSyncKtoP = async () => {
    setIsSyncing(true);
    try {
      await fetchApi('/api/system/cmd/syncKToP', { method: 'POST' });
      toast.success("Designations and Standard Rates synced to Statutory successfully");
    } catch (error: any) {
      toast.error(error.error || "Failed to sync data to Statutory");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Duplicate check
    const isDuplicate = groups.some(g => 
      (g.name || "").toLowerCase() === (groupForm.name || "").toLowerCase() && 
      g.id !== editingGroup?.id
    );
    if (isDuplicate) {
      toast.error("A group with this name already exists");
      return;
    }

    try {
      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'groups',
        operation: editingGroup ? 'update' : 'create',
        id: editingGroup?.id,
        data: groupForm,
        moduleType: currentMode
      }) });
      toast.success(`Group ${editingGroup ? 'updated' : 'created'} successfully`);
      setIsGroupModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Error saving group");
    }
  };

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Duplicate check
    const isDuplicate = departments.some(d => 
      (d.name || "").toLowerCase() === (deptForm.name || "").toLowerCase() && 
      d.id !== editingDept?.id
    );
    if (isDuplicate) {
      toast.error("A department with this name already exists");
      return;
    }

    try {
      const isNew = !editingDept;
      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'departments',
        operation: editingDept ? 'update' : 'create',
        id: editingDept?.id,
        data: deptForm,
        moduleType: currentMode
      }) });
      toast.success(`Department ${editingDept ? 'updated' : 'created'} successfully`);
      
      if (isNew) {
        setExpandedGroups(prev => [...new Set([...prev, deptForm.group_id])]);
      }
      
      setIsDeptModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Error saving department");
    }
  };

  const openSettings = async (dept: Department) => {
    setSelectedDept(dept);
    setEmployeeSearch('');
    setShowEmployeeList(false);
    try {
      const [settings, rates] = await Promise.all([
        fetchApi('/api/master-data/cmd/getDeptSettings', { method: 'POST', body: JSON.stringify({ deptId: dept.id, moduleType: currentMode }) }),
        fetchApi('/api/master-data/cmd/getDeptStandardRates', { method: 'POST', body: JSON.stringify({ deptId: dept.id, moduleType: currentMode }) })
      ]);
      setDeptSettings(settings);
      setStandardRates(Array.isArray(rates) ? rates : []);
      
      // Initialize employee search with the name of the reporting employee if it exists
      if (settings.default_reporting_employee_id) {
        const emp = employees.find(e => e.id === settings.default_reporting_employee_id);
        if (emp) setEmployeeSearch(emp.name);
      }
      
      setIsSettingsModalOpen(true);
    } catch (error) {
      toast.error("Failed to fetch department settings");
    }
  };

  const saveSettings = async () => {
    if (!selectedDept) return;
    try {
      await fetchApi('/api/system/cmd/saveDepartmentSettings', { method: 'POST', body: JSON.stringify({
        deptId: selectedDept.id,
        settings: deptSettings,
        moduleType: currentMode
      }) });
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("Error saving settings");
    }
  };

  const addStandardRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return;
    try {
      await fetchApi('/api/system/cmd/saveDepartmentRate', { method: 'POST', body: JSON.stringify({
        deptId: selectedDept.id,
        rate: newRateForm,
        moduleType: currentMode
      }) });
      toast.success("Standard rate added");
      const rates = await fetchApi('/api/master-data/cmd/getDeptStandardRates', { method: 'POST', body: JSON.stringify({ deptId: selectedDept.id, moduleType: currentMode }) });
      setStandardRates(Array.isArray(rates) ? rates : []);
      setNewRateForm({ designation_id: 0, standard_rate: 0, manpower: 0, effective_date: '' });
    } catch (error) {
      toast.error("Error adding standard rate");
    }
  };

  const renderTree = (parentId: number | null = null, level: number = 0) => {
    const currentGroups = parentId === null 
      ? (searchTerm.trim() ? filteredGroups.filter(g => !g.group_id) : paginatedRootGroups) 
      : filteredGroups.filter(g => g.group_id === parentId);
    
    return currentGroups.map(group => {
      const isExpanded = expandedGroups.includes(group.id);
      const groupDepts = filteredDepartments.filter(d => d.group_id === group.id);
      const hasChildren = filteredGroups.some(g => g.group_id === group.id) || groupDepts.length > 0;

      return (
        <div key={group.id} className={cn("space-y-2", level > 0 && "ml-6 border-l-2 border-app-border/30 pl-4 mt-2")}>
          <div className="textile-card bg-white border-app-border overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between bg-slate-50/50 border-b border-app-border">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => toggleGroup(group.id)}
                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                >
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-primary-navy" />
                  <span className="font-bold text-primary-navy uppercase tracking-wider text-sm">{group.name}</span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                    group.status === 1 ? "bg-primary-green/10 text-primary-green" : "bg-primary-red/10 text-primary-red"
                  )}>
                    {group.status === 1 ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete('group', group.id, group.name);
                  }}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                  title="Delete Group"
                >
                  <Trash2 size={14} />
                </button>
                <button 
                  onClick={() => {
                    setEditingDept(null);
                    setDeptForm({ group_id: group.id, name: '', description: '', status: 1 });
                    setIsDeptModalOpen(true);
                  }}
                  className="text-xs flex items-center gap-1 text-primary-navy hover:underline font-bold"
                >
                  <Plus size={14} /> Add Dept
                </button>
                <button 
                  onClick={() => {
                    setEditingGroup(group);
                    setGroupForm({ name: group.name, description: group.description, status: group.status });
                    setIsGroupModalOpen(true);
                  }}
                  className="p-1.5 text-primary-navy hover:bg-primary-navy/10 rounded"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="animate-in slide-in-from-top-2 duration-200">
                {/* Render Sub-Groups Recursively */}
                {renderTree(group.id, level + 1)}
                
                {/* Render Departments */}
                <div className="divide-y divide-app-border">
                  {groupDepts.map(dept => (
                    <div key={dept.id} className="p-4 pl-12 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Users size={16} className="text-text-muted" />
                        <div>
                          <p className="text-sm font-medium text-primary-navy">{dept.name}</p>
                          <p className="text-[10px] text-text-muted italic">{dept.description || 'No description'}</p>
                        </div>
                        <span className={cn(
                          "text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                          dept.status === 1 ? "bg-primary-green/10 text-primary-green" : "bg-primary-red/10 text-primary-red"
                        )}>
                          {dept.status === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleDelete('department', dept.id, dept.name)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          title="Delete Department"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button 
                          onClick={() => openSettings(dept)}
                          className="p-1.5 text-primary-navy hover:bg-primary-navy/10 rounded flex items-center gap-1 text-xs font-bold"
                          title="Department Settings"
                        >
                          <Settings size={14} /> Settings
                        </button>
                        <button 
                          onClick={() => {
                            setEditingDept(dept);
                            setDeptForm({ group_id: dept.group_id, name: dept.name, description: dept.description, status: dept.status });
                            setIsDeptModalOpen(true);
                          }}
                          className="p-1.5 text-primary-navy hover:bg-primary-navy/10 rounded"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {groupDepts.length === 0 && !groups.some(g => g.group_id === group.id) && (
                    <div className="p-4 pl-12 text-xs text-text-muted italic">No departments or sub-groups found.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Clear All Confirmation Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 border border-red-100">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-primary-navy mb-2 uppercase tracking-wider">Clear All Data</h3>
              <p className="text-sm text-text-muted mb-6">
                <span className="text-red-600 font-bold">CRITICAL:</span> This will delete <span className="font-bold">ALL</span> Groups, Departments, and related settings. 
                This action cannot be undone. Are you sure?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsClearAllModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-app-border rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmClearAll}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 shadow-lg shadow-red-200 transition-all"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-navy textile-header tracking-tight">Group & Department Master</h1>
          <p className="text-text-muted text-sm">Define organizational hierarchy and departmental settings</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input 
              type="text"
              placeholder="Search hierarchy..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-white border border-app-border rounded-md text-sm focus:outline-none focus:border-primary-navy shadow-sm transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary-red transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {currentMode === 'K' && (
            <button 
              onClick={handleSyncKtoP}
              disabled={isSyncing}
              className="app-btn-outline flex items-center gap-2 text-primary-navy border-primary-navy/20 hover:bg-primary-navy/5"
              title="Sync Designations and Rates to Statutory"
            >
              <RefreshCw className={cn(isSyncing && "animate-spin")} size={16} />
              {isSyncing ? 'Syncing...' : 'Sync to Statutory'}
            </button>
          )}
          <input 
            type="file" 
            ref={deptFileRef} 
            className="hidden" 
            accept=".xlsx,.xls" 
            onChange={handleBulkUpload} 
          />
          <input 
            type="file" 
            ref={rateFileRef} 
            className="hidden" 
            accept=".xlsx,.xls" 
            onChange={handleBulkRateUpload} 
          />
          
          <div className="flex items-center gap-1 bg-white border border-app-border rounded-md p-1 shadow-sm">
            <div className="flex flex-col items-center border-r border-app-border pr-1">
              <span className="text-[8px] font-black text-primary-navy uppercase px-1">Dept Master</span>
              <div className="flex items-center">
                <button 
                  onClick={downloadTemplate}
                  className="p-1.5 text-text-muted hover:text-primary-navy transition-colors"
                  title="Download Dept Template"
                >
                  <Download size={14} />
                </button>
                <button 
                  onClick={() => deptFileRef.current?.click()}
                  className="p-1.5 text-text-muted hover:text-primary-navy transition-colors border-l border-app-border/50"
                  title="Bulk Upload Dept"
                >
                  <Upload size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center pl-1">
              <span className="text-[8px] font-black text-primary-green uppercase px-1">Rates & Manpower</span>
              <div className="flex items-center">
                <button 
                  onClick={downloadRateTemplate}
                  className="p-1.5 text-text-muted hover:text-primary-green transition-colors"
                  title="Download Rates Template"
                >
                  <Download size={14} />
                </button>
                <button 
                  onClick={() => rateFileRef.current?.click()}
                  className="p-1.5 text-text-muted hover:text-primary-green transition-colors border-l border-app-border/50"
                  title="Bulk Upload Rates"
                >
                  <Upload size={14} />
                </button>
              </div>
            </div>
          </div>
          <button 
            onClick={handleClearAll}
            className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-md text-xs font-bold hover:bg-red-100 transition-all shadow-sm"
            title="Clear All Data"
          >
            <Trash2 size={14} />
            Clear All
          </button>
          <button 
            onClick={() => {
              setEditingGroup(null);
              setGroupForm({ name: '', description: '', status: 1 });
              setIsGroupModalOpen(true);
            }}
            className="app-btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Add Group
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {renderTree()}
        {filteredGroups.length === 0 && (
          <div className="p-12 text-center bg-white border border-app-border rounded-lg border-dashed">
            <Database size={48} className="mx-auto text-text-muted opacity-20 mb-4" />
            <p className="text-sm font-bold text-primary-navy uppercase tracking-wider">
              {searchTerm.trim() ? `No results found for "${searchTerm}"` : 'No data found'}
            </p>
            <p className="text-xs text-text-muted">
              {searchTerm.trim() ? 'Try a different search term' : 'Start by adding groups and departments'}
            </p>
          </div>
        )}
      </div>

      {!searchTerm.trim() && rootGroups.length > pageSize && (
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={rootGroups.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-primary-navy mb-2 uppercase tracking-wider">Confirm Deletion</h3>
              <p className="text-sm text-text-muted mb-6">
                Are you sure you want to delete the {deleteConfirm.type} <span className="font-bold text-primary-navy">"{deleteConfirm.name}"</span>? 
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-app-border rounded-md text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-app-border flex items-center justify-between">
              <h3 className="textile-header font-bold text-primary-navy flex items-center gap-2 uppercase tracking-wider">
                <Building2 size={18} /> {editingGroup ? 'Edit Group' : 'Add New Group'}
              </h3>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-text-muted hover:text-primary-red">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleGroupSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase">Group Name (*)</label>
                <input
                  required
                  type="text"
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                  value={groupForm.name || ''}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase">Description</label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                  value={groupForm.description || ''}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="group-status"
                  className="rounded border-app-border text-primary-navy focus:ring-primary-navy"
                  checked={groupForm.status === 1}
                  onChange={(e) => setGroupForm({ ...groupForm, status: e.target.checked ? 1 : 0 })}
                />
                <label htmlFor="group-status" className="text-sm text-primary-navy font-medium">Active</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsGroupModalOpen(false)} className="flex-1 px-4 py-2 border border-app-border rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 app-btn-primary">Save Group</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dept Modal */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-app-border flex items-center justify-between">
              <h3 className="textile-header font-bold text-primary-navy flex items-center gap-2 uppercase tracking-wider">
                <Users size={18} /> {editingDept ? 'Edit Department' : 'Add New Department'}
              </h3>
              <button onClick={() => setIsDeptModalOpen(false)} className="text-text-muted hover:text-primary-red">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleDeptSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase">Department Name (*)</label>
                <input
                  required
                  type="text"
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                  value={deptForm.name || ''}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase">Description</label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                  value={deptForm.description || ''}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dept-status"
                  className="rounded border-app-border text-primary-navy focus:ring-primary-navy"
                  checked={deptForm.status === 1}
                  onChange={(e) => setDeptForm({ ...deptForm, status: e.target.checked ? 1 : 0 })}
                />
                <label htmlFor="dept-status" className="text-sm text-primary-navy font-medium">Active</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsDeptModalOpen(false)} className="flex-1 px-4 py-2 border border-app-border rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 app-btn-primary">Save Department</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && selectedDept && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-app-border flex items-center justify-between bg-primary-navy text-white">
              <div>
                <h3 className="textile-header font-bold flex items-center gap-2 uppercase tracking-wider">
                  <Settings size={18} /> Department Settings: {selectedDept.name}
                </h3>
                <p className="text-[10px] opacity-70">Configure default values and standard rates</p>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-white/70 hover:text-white">
                <XCircle size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <Tabs.Root defaultValue="defaults" className="w-full">
                <Tabs.List className="flex border-b border-app-border mb-6 gap-2">
                  <Tabs.Trigger 
                    value="defaults"
                    className="px-6 py-3 text-xs font-bold textile-header uppercase tracking-wider transition-all border-b-2 border-transparent data-[state=active]:border-primary-navy data-[state=active]:text-primary-navy text-text-muted"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} /> Default Values
                    </div>
                  </Tabs.Trigger>
                  <Tabs.Trigger 
                    value="standards"
                    className="px-6 py-3 text-xs font-bold textile-header uppercase tracking-wider transition-all border-b-2 border-transparent data-[state=active]:border-primary-navy data-[state=active]:text-primary-navy text-text-muted"
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign size={14} /> Standard Rates & Manpower
                    </div>
                  </Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="defaults" className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] textile-header text-text-muted uppercase">Default Location</label>
                        <select 
                          className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-md"
                          value={deptSettings.default_location_id || ''}
                          onChange={(e) => setDeptSettings({ ...deptSettings, default_location_id: Number(e.target.value) })}
                        >
                          <option value="">Select Location</option>
                          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] textile-header text-text-muted uppercase">Default Division</label>
                        <select 
                          className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-md"
                          value={deptSettings.default_division_id || ''}
                          onChange={(e) => setDeptSettings({ ...deptSettings, default_division_id: Number(e.target.value) })}
                        >
                          <option value="">Select Division</option>
                          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] textile-header text-text-muted uppercase">Default Class</label>
                        <select 
                          className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-md"
                          value={deptSettings.default_class_id || ''}
                          onChange={(e) => setDeptSettings({ ...deptSettings, default_class_id: Number(e.target.value) })}
                        >
                          <option value="">Select Class</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] textile-header text-text-muted uppercase">Default Category</label>
                        <select 
                          className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-md"
                          value={deptSettings.default_category_id || ''}
                          onChange={(e) => setDeptSettings({ ...deptSettings, default_category_id: Number(e.target.value) })}
                        >
                          <option value="">Select Category</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] textile-header text-text-muted uppercase">Default Shift</label>
                        <select 
                          className="w-full bg-slate-50 border border-app-border p-2 text-sm rounded-md"
                          value={deptSettings.default_shift_id || ''}
                          onChange={(e) => setDeptSettings({ ...deptSettings, default_shift_id: Number(e.target.value) })}
                        >
                          <option value="">Select Shift</option>
                          {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</option>)}
                        </select>
                      </div>
                        <div className="space-y-1 relative">
                          <EmployeeSearchSelect 
                            label="Reporting Employee (IRA)"
                            value={deptSettings.default_reporting_employee_id || null}
                            onChange={(id) => setDeptSettings({...deptSettings, default_reporting_employee_id: id ? Number(id) : undefined})}
                            employees={employees}
                            placeholder="Select Reporting Employee"
                          />
                        </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button onClick={saveSettings} className="app-btn-primary flex items-center gap-2">
                      <Save size={16} /> Save Default Values
                    </button>
                  </div>
                </Tabs.Content>

                <Tabs.Content value="standards" className="space-y-6 animate-in fade-in duration-300">
                  {currentMode === 'K' && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
                      <div className="p-2 bg-amber-100 rounded-md">
                        <UserCheck size={20} className="text-amber-700" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Statutory Notice</h4>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          Note: Designations and Manpower requirements synced from K to P automatically. 
                          However, Standard Rates for Statutory compliance (Module P) must be configured 
                          independently within the Statutory Module to satisfy audit requirements.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-50 p-4 rounded-lg border border-app-border">
                    <h4 className="text-xs font-bold text-primary-navy uppercase mb-4 flex items-center gap-2">
                      <Plus size={14} /> Add New Standard Rate
                    </h4>
                    <form onSubmit={addStandardRate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div className="space-y-1">
                        <label className="text-[10px] textile-header text-text-muted uppercase">Designation</label>
                        <select 
                          required
                          className="w-full bg-white border border-app-border p-2 text-sm rounded-md focus:ring-2 focus:ring-primary-navy/20 focus:border-primary-navy outline-none transition-all"
                          value={newRateForm.designation_id || ''}
                          onChange={(e) => setNewRateForm({ ...newRateForm, designation_id: Number(e.target.value) })}
                        >
                          <option value="">Select Designation</option>
                          {designations.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] textile-header text-text-muted uppercase">Standard Rate</label>
                        <input 
                          required
                          type="number"
                          className="w-full bg-white border border-app-border p-2 text-sm rounded-md"
                          value={newRateForm.standard_rate || ''}
                          onChange={(e) => setNewRateForm({ ...newRateForm, standard_rate: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] textile-header text-text-muted uppercase">Manpower</label>
                        <input 
                          required
                          type="number"
                          className="w-full bg-white border border-app-border p-2 text-sm rounded-md"
                          value={newRateForm.manpower || ''}
                          onChange={(e) => setNewRateForm({ ...newRateForm, manpower: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] textile-header text-text-muted uppercase">Effective Date</label>
                        <input 
                          required
                          type="date"
                          className="w-full bg-white border border-app-border p-2 text-sm rounded-md"
                          value={newRateForm.effective_date}
                          onChange={(e) => setNewRateForm({ ...newRateForm, effective_date: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-4 flex justify-end">
                        <button 
                          type="submit" 
                          disabled={!newRateForm.designation_id}
                          className="app-btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus size={16} /> Add Rate
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="textile-card bg-white border-app-border overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-app-border">
                          <th className="p-3 text-[10px] textile-header text-text-muted uppercase font-bold">Designation</th>
                          <th className="p-3 text-[10px] textile-header text-text-muted uppercase font-bold">Std Rate</th>
                          <th className="p-3 text-[10px] textile-header text-text-muted uppercase font-bold">Manpower</th>
                          <th className="p-3 text-[10px] textile-header text-text-muted uppercase font-bold">Effective Date</th>
                          <th className="p-3 text-[10px] textile-header text-text-muted uppercase font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standardRates.map(rate => (
                          <tr key={rate.id} className="border-b border-app-border hover:bg-slate-50">
                            <td className="p-3 text-sm font-medium text-primary-navy">
                              {rate.designation_name || designations.find(d => d.id === rate.designation_id)?.name || `ID: ${rate.designation_id}`}
                            </td>
                            <td className="p-3 text-sm font-mono">₹{rate.standard_rate.toLocaleString()}</td>
                            <td className="p-3 text-sm">{rate.manpower}</td>
                            <td className="p-3 text-sm flex items-center gap-1">
                              <Calendar size={12} className="text-text-muted" />
                              {new Date(rate.effective_date).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-right">
                              <button onClick={() => handleDelete('rate', rate.id, String(rate.designation_id))} className="p-1.5 text-primary-red hover:bg-primary-red/10 rounded">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {standardRates.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-text-muted italic">No standard rates defined.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Tabs.Content>
              </Tabs.Root>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
