import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Upload, 
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from '../../utils/xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { invokeCommand as invoke } from '../../services/apiClient';
import { useModule } from '../../contexts/ModuleContext';
import { Pagination } from '../common/Pagination';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MasterItem {
  id: number;
  name: string;
  description: string;
  status: number;
  created_at: string;
  location_id?: number;
  division_id?: number;
  class_id?: number;
  category_id?: number;
  group_id?: number;
  department_id?: number;
}

export interface FilterState {
  locations: number[];
  divisions: number[];
  classes: number[];
  categories: number[];
  groups: number[];
  departments: number[];
}

interface MasterPageProps {
  title: string;
  apiEndpoint: string;
  icon: React.ReactNode;
  moduleCode: string;
  hideHeader?: boolean;
  parentFilter?: {
    key: string;
    value: number | null;
    label: string;
    options: { id: number; name: string }[];
  };
}

export const useFilteredData = (items: MasterItem[], filters: FilterState, searchTerm: string) => {
  return React.useMemo(() => {
    const searchStr = searchTerm.toLowerCase().trim();
    
    // 1. Scored Search Logic
    const scored = items.map(item => {
      const name = (item.name?.toLowerCase() || '');
      const desc = (item.description?.toLowerCase() || '');
      
      let score = -1;
      if (!searchStr) {
        score = 0;
      } else {
        if (name === searchStr) score = 3;
        else if (name.startsWith(searchStr)) score = 2;
        else if (name.includes(searchStr) || desc.includes(searchStr)) score = 1;
      }
      return { item, score };
    }).filter(x => x.score >= 0);

    // 2. Filter Logic
    const filtered = scored.filter(({ item }) => {
      const checkFilter = (itemValue: any, filterValues: number[]) => {
        if (!filterValues || filterValues.length === 0) return true;
        if (itemValue === undefined || itemValue === null) return true;
        return filterValues.includes(Number(itemValue));
      };

      const matchesLocation = checkFilter(item.location_id, filters.locations);
      const matchesDivision = checkFilter(item.division_id, filters.divisions);
      const matchesClass = checkFilter(item.class_id, filters.classes);
      const matchesCategory = checkFilter(item.category_id, filters.categories);
      const matchesGroup = checkFilter(item.group_id, filters.groups);
      const matchesDepartment = checkFilter(item.department_id, filters.departments);

      return matchesLocation && matchesDivision && matchesClass && matchesCategory && matchesGroup && matchesDepartment;
    });

    // 3. Sort by Score and Name
    if (searchStr) {
      return filtered
        .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
        .map(x => x.item);
    }
    
    return filtered.map(x => x.item);
  }, [items, filters, searchTerm]);
};

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
  const containerRef = useRef<HTMLDivElement>(null);

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
            className="absolute z-50 w-64 mt-1 bg-white border border-app-border rounded-md shadow-xl max-h-60 overflow-y-auto p-2"
          >
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-app-border">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{label} Options</span>
              {selected.length > 0 && (
                <button 
                  onClick={() => onChange([])}
                  className="text-[9px] text-primary-red hover:underline font-bold"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-1">
              {options.map(opt => (
                <label 
                  key={opt.id}
                  className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.id)}
                    onChange={() => toggleOption(opt.id)}
                    className="rounded border-app-border text-primary-navy focus:ring-primary-navy"
                  />
                  <span className="text-xs text-primary-navy truncate">{opt.name}</span>
                </label>
              ))}
              {options.length === 0 && (
                <div className="p-4 text-center text-[10px] text-text-muted italic">
                  No options available
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function MasterPage({ title, apiEndpoint, icon, moduleCode, hideHeader = false, parentFilter }: MasterPageProps) {
  const { currentMode } = useModule();

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  const [items, setItems] = useState<MasterItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter Master Data
  const [masterData, setMasterData] = useState<{
    locations: any[];
    divisions: any[];
    classes: any[];
    categories: any[];
    groups: any[];
    departments: any[];
  }>({
    locations: [],
    divisions: [],
    classes: [],
    categories: [],
    groups: [],
    departments: []
  });

  const [filters, setFilters] = useState<FilterState>({
    locations: [],
    divisions: [],
    classes: [],
    categories: [],
    groups: [],
    departments: []
  });

  const [formData, setFormData] = useState<any>({
    name: '',
    description: '',
    status: true
  });

  useEffect(() => {
    if (parentFilter?.key && parentFilter.value) {
      setFormData((prev: any) => ({ ...prev, [parentFilter.key]: parentFilter.value }));
    }
  }, [parentFilter]);

  useEffect(() => {
    fetchItems();
    fetchFilterMasterData();
  }, [apiEndpoint, currentMode]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const apiFilters: any = {};
      if (parentFilter?.key && parentFilter.value) {
        apiFilters[parentFilter.key] = parentFilter.value;
      }

      const data = await invoke<MasterItem[]>('master_crud', {
        tableName: apiEndpoint,
        operation: 'list',
        moduleType: currentMode,
        filters: Object.keys(apiFilters).length > 0 ? apiFilters : null
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(`Failed to fetch ${title}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFilterMasterData = async () => {
    try {
      const endpoints = [
        'locations', 'divisions', 'classes', 'categories', 'groups', 'departments'
      ];
      const results = await Promise.all(
        endpoints.map(ep => invoke<any[]>('master_crud', {
          tableName: ep,
          operation: 'list',
          moduleType: currentMode,
          filters: null
        }))
      );
      setMasterData({
        locations: results[0],
        divisions: results[1],
        classes: results[2],
        categories: results[3],
        groups: results[4],
        departments: results[5]
      });
    } catch (error) {
      console.error("Failed to fetch filter master data", error);
    }
  };

  const filteredItems = useFilteredData(items, filters, searchTerm);
  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const currentItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleStatus = () => {
    setFormData(prev => ({ ...prev, status: !prev.status }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    try {
      await invoke('master_crud', {
        tableName: apiEndpoint,
        operation: isEditing ? 'update' : 'create',
        id: isEditing,
        data: {
          ...formData,
          status: formData.status ? 1 : 0
        },
        moduleType: currentMode,
        filters: null
      });

      toast.success(isEditing ? "Record updated" : "Record created");
      resetForm();
      fetchItems();
    } catch (error) {
      toast.error(typeof error === 'string' ? error : "Failed to save");
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: true,
      ...(parentFilter?.key && parentFilter.value ? { [parentFilter.key]: parentFilter.value } : {})
    });
    setIsEditing(null);
  };

  const handleEdit = (item: MasterItem) => {
    setIsEditing(item.id);
    setFormData({
      name: item.name,
      description: item.description || '',
      status: item.status === 1,
      ...(parentFilter?.key ? { [parentFilter.key]: item[parentFilter.key as keyof MasterItem] } : {})
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke('master_crud', {
        tableName: apiEndpoint,
        operation: 'delete',
        id,
        moduleType: currentMode,
        filters: null
      });
      toast.success("Record deleted");
      setDeleteConfirmId(null);
      fetchItems();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const downloadTemplate = () => {
    const template = [
      { Name: 'Example Name', Description: 'Example Description', Status: 'Active' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `${title}_Template.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = await XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (rawData.length === 0) {
          toast.error("Excel file is empty");
          return;
        }

        // Helper for case-insensitive key access
        const getVal = (obj: any, targetKey: string) => {
          const keys = Object.keys(obj);
          const foundKey = keys.find(k => k.toLowerCase().trim().replace('*', '') === targetKey.toLowerCase());
          return foundKey ? obj[foundKey] : undefined;
        };

        const records = rawData.map((row: any) => {
          const name = getVal(row, 'name') || getVal(row, 'title');
          const description = getVal(row, 'description') || getVal(row, 'desc') || '';
          const rawStatus = (getVal(row, 'status') || 'Active').toString().toLowerCase().trim();
          const status = (rawStatus === 'active' || rawStatus === '1' || rawStatus === 'true') ? 1 : 0;

          return { name, description, status };
        }).filter(r => r.name);

        if (records.length === 0) {
          toast.error("No valid records found (Name column is required)");
          return;
        }

        setIsLoading(true);
        // Batch requests with Promise.allSettled for robust feedback
        const results = await Promise.allSettled(
          records.map(record => invoke('master_crud', {
            tableName: apiEndpoint,
            operation: 'create',
            data: record,
            moduleType: currentMode,
            filters: null
          }))
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        if (succeeded > 0) {
          toast.success(`Successfully imported ${succeeded} ${title} records`);
        }
        if (failed > 0) {
          toast.error(`Failed to import ${failed} records. Check data formats.`);
        }

        fetchItems();
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error) {
        console.error("Bulk Upload Error:", error);
        toast.error("Error processing Excel file");
        if (fileInputRef.current) fileInputRef.current.value = '';
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleClearAll = async () => {
    if (!confirm(`Are you sure you want to clear ALL ${title} records? This action cannot be undone.`)) return;
    
    try {
      await invoke('master_crud', {
        tableName: apiEndpoint,
        operation: 'clear_all',
        moduleType: currentMode
      });
      toast.success(`All ${title} records cleared successfully`);
      fetchItems();
    } catch (error: any) {
      const errorMsg = typeof error === 'string' ? error : (error.error || `Failed to clear ${title}`);
      toast.error(errorMsg);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-3xl textile-header font-black text-primary-navy flex items-center gap-3">
              {icon}
              {title} Master
            </h2>
            <p className="text-text-muted text-sm font-mono uppercase tracking-wider">
              Module {moduleCode} // Organisational Hierarchy
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-md border border-app-border hover:bg-white transition-all shadow-sm"
            >
              <Download size={14} />
              Template
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-primary-navy text-white text-xs font-bold rounded-md shadow-md hover:shadow-lg transition-all"
            >
              <Upload size={14} />
              Bulk Upload
            </button>
            <button 
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2 bg-primary-red text-white text-xs font-bold rounded-md shadow-md hover:shadow-lg transition-all"
            >
              <Trash2 size={14} />
              Clear All
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".xlsx, .xls"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="textile-card p-6 bg-white border-app-border shadow-xl">
            <div className="flex items-center justify-between border-b border-app-border pb-3 mb-6">
              <h3 className="textile-header font-bold text-primary-navy flex items-center gap-2 uppercase text-sm">
                {isEditing ? <Edit2 size={16} /> : <Plus size={16} />}
                {isEditing ? 'Edit Record' : 'Add New Record'}
              </h3>
              {isEditing && (
                <button onClick={resetForm} className="text-text-muted hover:text-primary-red transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {parentFilter && (
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold">{parentFilter.label} (*)</label>
                  <select
                    required
                    name={parentFilter.key}
                    value={formData[parentFilter.key] || ''}
                    onChange={(e) => setFormData((prev: any) => ({ ...prev, [parentFilter.key]: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                  >
                    <option value="">Select {parentFilter.label}</option>
                    {parentFilter.options.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Name (*)</label>
                <input
                  required
                  name="name"
                  value={formData.name || ""}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                  placeholder={`Enter ${title} Name`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Description</label>
                <textarea
                  name="description"
                  value={formData.description || ""}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full bg-slate-50 border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md resize-none"
                  placeholder="Optional details..."
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-app-border rounded-md">
                <div className="space-y-0.5">
                  <p className="text-[10px] textile-header text-text-muted uppercase font-bold">Status</p>
                  <p className="text-[11px] font-bold text-primary-navy">{formData.status ? 'ACTIVE' : 'INACTIVE'}</p>
                </div>
                <button
                  type="button"
                  onClick={toggleStatus}
                  className={cn(
                    "w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out relative",
                    formData.status ? "bg-primary-green" : "bg-slate-300"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
                    formData.status ? "translate-x-6" : "translate-x-0"
                  )} />
                </button>
              </div>

              <button
                type="submit"
                className="w-full app-btn app-btn-primary py-3 textile-header font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {isEditing ? <Save size={18} /> : <Plus size={18} />}
                {isEditing ? 'Update Record' : 'Save Record'}
              </button>
            </form>
          </div>
        </div>

        {/* List Section */}
        <div className="lg:col-span-8 space-y-4">
          <div className="textile-card bg-white border-app-border shadow-xl overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-app-border bg-slate-50 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <h3 className="textile-header font-bold text-primary-navy uppercase text-sm">Existing {title}s</h3>
                  <span className="bg-primary-navy/10 text-primary-navy text-[10px] font-mono px-2 py-0.5 rounded-full border border-primary-navy/20">
                    {filteredItems.length} RECORDS
                  </span>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-app-border pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-primary-navy rounded-md transition-all"
                  />
                </div>
              </div>

              {/* Filter Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-app-border/50">
                <MultiSelect 
                  label="Location" 
                  options={masterData.locations} 
                  selected={filters.locations}
                  onChange={(ids) => setFilters(prev => ({ ...prev, locations: ids }))}
                />
                <MultiSelect 
                  label="Division" 
                  options={masterData.divisions} 
                  selected={filters.divisions}
                  onChange={(ids) => setFilters(prev => ({ ...prev, divisions: ids }))}
                />
                <MultiSelect 
                  label="Class" 
                  options={masterData.classes} 
                  selected={filters.classes}
                  onChange={(ids) => setFilters(prev => ({ ...prev, classes: ids }))}
                />
                <MultiSelect 
                  label="Category" 
                  options={masterData.categories} 
                  selected={filters.categories}
                  onChange={(ids) => setFilters(prev => ({ ...prev, categories: ids }))}
                />
                <MultiSelect 
                  label="Group" 
                  options={masterData.groups} 
                  selected={filters.groups}
                  onChange={(ids) => setFilters(prev => ({ ...prev, groups: ids }))}
                />
                <MultiSelect 
                  label="Department" 
                  options={masterData.departments} 
                  selected={filters.departments}
                  onChange={(ids) => setFilters(prev => ({ ...prev, departments: ids }))}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-app-border">
                    <th className="p-4 text-[10px] textile-header text-text-muted uppercase tracking-wider">Name</th>
                    <th className="p-4 text-[10px] textile-header text-text-muted uppercase tracking-wider">Description</th>
                    <th className="p-4 text-[10px] textile-header text-text-muted uppercase tracking-wider">Status</th>
                    <th className="p-4 text-[10px] textile-header text-text-muted uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/30">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center">
                        <Loader2 className="animate-spin mx-auto text-primary-navy mb-2" size={24} />
                        <p className="text-xs text-text-muted font-mono uppercase">Loading Data...</p>
                      </td>
                    </tr>
                  ) : currentItems.length > 0 ? currentItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4">
                        <div className="text-xs font-black text-primary-navy uppercase tracking-tight">{item.name}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-[11px] text-text-muted truncate max-w-[200px]" title={item.description}>
                          {item.description || <span className="italic opacity-50">No description</span>}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border flex items-center gap-1 w-fit",
                          item.status === 1 
                            ? "bg-green-50 text-green-700 border-green-200" 
                            : "bg-red-50 text-red-700 border-red-200"
                        )}>
                          {item.status === 1 ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          {item.status === 1 ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <AnimatePresence mode="wait">
                            {deleteConfirmId === item.id ? (
                              <motion.div
                                key="confirm"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="flex items-center gap-2"
                              >
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="px-2 py-1 bg-red-600 text-white text-[9px] font-bold rounded uppercase hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-1 bg-slate-200 text-slate-600 text-[9px] font-bold rounded uppercase hover:bg-slate-300"
                                >
                                  Cancel
                                </button>
                              </motion.div>
                            ) : (
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-1.5 text-primary-navy hover:bg-primary-navy/10 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(item.id)}
                                  className="p-1.5 text-primary-red hover:bg-primary-red/10 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3 opacity-30">
                          <FileSpreadsheet size={48} />
                          <div className="space-y-1">
                            <p className="text-sm font-bold textile-header uppercase">No Records Found</p>
                            <p className="text-xs">Add your first record or use bulk upload</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={filteredItems.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}