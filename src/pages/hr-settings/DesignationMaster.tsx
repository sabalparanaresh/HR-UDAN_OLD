import React, { useState, useEffect, useRef } from 'react';
import { invokeCommand as invoke } from '../../services/apiClient';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  Briefcase,
  Award,
  FileText,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from '../../utils/xlsx';

import { useModule } from '../../contexts/ModuleContext';
import { Pagination } from '../../components/common/Pagination';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Designation {
  id: number;
  name: string;
  skill_level: string;
  job_description: string;
  status: number;
  created_at: string;
}

const SKILL_LEVELS = [
  'Highly Skilled',
  'Skilled',
  'Semi-Skilled',
  'Unskilled'
];

export default function DesignationMaster() {
  const { currentMode } = useModule();

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  const [designations, setDesignations] = useState<Designation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    skill_level: 'Skilled',
    job_description: '',
    status: 1
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDesignations = async () => {
    try {
      const data = await invoke<Designation[]>('master_crud', {
        tableName: 'designations',
        operation: 'list',
        moduleType: currentMode
      });
      setDesignations(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error("Failed to fetch designations");
    }
  };

  useEffect(() => {
    fetchDesignations();
  }, [currentMode]);

  const downloadTemplate = () => {
    const headers = [['name', 'skill_level', 'job_description', 'status']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "designation_template.xlsx");
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
        const loadingToast = toast.loading(`Processing ${jsonData.length} records...`);
        const chunkSize = 200;
        
        for (let i = 0; i < jsonData.length; i += chunkSize) {
          const chunk = jsonData.slice(i, i + chunkSize).map(item => ({
            ...item,
            status: (item.status?.toString().toLowerCase() === 'active' || item.status === 1 || item.status === '1' || item.status === true) ? 1 : 0
          }));
          await invoke('master_crud', {
            tableName: 'designations',
            operation: 'bulk_create',
            data: chunk,
            moduleType: currentMode
          });
        }
        
        toast.dismiss(loadingToast);
        toast.success(`Bulk upload successful (${jsonData.length} records)`);
        fetchDesignations();
      } catch (error) {
        toast.error("Bulk upload failed");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  useEffect(() => {
    fetchDesignations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Word count validation (approximate)
    const wordCount = formData.job_description.trim().split(/\s+/).filter(Boolean).length;
    if (formData.job_description && wordCount > 500) {
      toast.error("Job description cannot exceed 500 words");
      return;
    }

    try {
      await invoke('master_crud', {
        tableName: 'designations',
        operation: editingDesignation ? 'update' : 'create',
        id: editingDesignation?.id,
        data: formData,
        moduleType: currentMode
      });

      toast.success(`Designation ${editingDesignation ? 'updated' : 'created'} successfully`);
      setIsModalOpen(false);
      fetchDesignations();
    } catch (error) {
      toast.error("Error saving designation");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this designation?")) return;
    try {
      await invoke('master_crud', {
        tableName: 'designations',
        operation: 'delete',
        id,
        moduleType: currentMode
      });
      toast.success("Designation deleted successfully");
      fetchDesignations();
    } catch (error: any) {
      const errorMsg = typeof error === 'string' ? error : (error.error || "Error deleting designation");
      toast.error(errorMsg);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear ALL designations? This action cannot be undone.")) return;
    
    try {
      await invoke('master_crud', {
        tableName: 'designations',
        operation: 'clear_all',
        moduleType: currentMode
      });
      toast.success("All designations cleared successfully");
      fetchDesignations();
    } catch (error: any) {
      const errorMsg = typeof error === 'string' ? error : (error.error || "Failed to clear designations");
      toast.error(errorMsg);
    }
  };

  const filteredDesignations = designations.filter(d => 
    (d.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (d.skill_level?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (d.job_description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredDesignations.length / pageSize);
  const currentItems = filteredDesignations.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-navy textile-header tracking-tight flex items-center gap-3">
            Designation Master
            <span className="bg-primary-navy/10 text-primary-navy text-[10px] font-mono px-2 py-0.5 rounded-full border border-primary-navy/20">
              {filteredDesignations.length} RECORDS
            </span>
          </h1>
          <p className="text-text-muted text-sm">Define roles, skill levels, and job descriptions</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx,.xls" 
            onChange={handleBulkUpload} 
          />
          <div className="flex items-center gap-1 bg-white border border-app-border rounded-md p-1 shadow-sm">
            <button 
              onClick={downloadTemplate}
              className="p-2 text-text-muted hover:text-primary-navy transition-colors"
              title="Download Template"
            >
              <Download size={16} />
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-text-muted hover:text-primary-navy transition-colors border-l border-app-border"
              title="Bulk Upload"
            >
              <Upload size={16} />
            </button>
            <button 
              onClick={handleClearAll}
              className="p-2 text-primary-red hover:bg-primary-red/10 transition-colors border-l border-app-border"
              title="Clear All"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input 
              type="text" 
              data-shortcut="search"
              placeholder="Search designations..." 
              className="pl-10 pr-4 py-2 bg-white border border-app-border rounded-md text-sm focus:outline-none focus:border-primary-navy w-64 shadow-sm"
              value={searchTerm || ''}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            data-shortcut="new"
            onClick={() => {
              setEditingDesignation(null);
              setFormData({ name: '', skill_level: 'Skilled', job_description: '', status: 1 });
              setIsModalOpen(true);
            }}
            className="app-btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Add Designation
          </button>
        </div>
      </div>

      <div className="textile-card bg-white border-app-border overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-app-border">
              <th className="p-4 text-[10px] textile-header text-text-muted uppercase font-bold">Designation Name</th>
              <th className="p-4 text-[10px] textile-header text-text-muted uppercase font-bold">Skill Level</th>
              <th className="p-4 text-[10px] textile-header text-text-muted uppercase font-bold">Job Description</th>
              <th className="p-4 text-[10px] textile-header text-text-muted uppercase font-bold">Status</th>
              <th className="p-4 text-[10px] textile-header text-text-muted uppercase font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {currentItems.map((designation) => (
              <tr key={designation.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-navy/5 rounded flex items-center justify-center text-primary-navy">
                      <Briefcase size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary-navy uppercase tracking-wide">{designation.name}</p>
                      <p className="text-[10px] text-text-muted font-mono">ID: DES-{designation.id.toString().padStart(3, '0')}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Award size={14} className="text-text-muted" />
                    <span className="text-sm font-medium text-primary-navy">{designation.skill_level}</span>
                  </div>
                </td>
                <td className="p-4">
                  <p className="text-xs text-text-muted line-clamp-2 max-w-[300px]">
                    {designation.job_description || 'No description provided'}
                  </p>
                </td>
                <td className="p-4">
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                    Number(designation.status) === 1 ? "bg-primary-green/10 text-primary-green" : "bg-primary-red/10 text-primary-red"
                  )}>
                    {Number(designation.status) === 1 ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingDesignation(designation);
                        setFormData({
                          name: designation.name,
                          skill_level: designation.skill_level,
                          job_description: designation.job_description || '',
                          status: designation.status
                        });
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-primary-navy hover:bg-primary-navy/10 rounded-md transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(designation.id)}
                      className="p-2 text-primary-red hover:bg-primary-red/10 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredDesignations.length === 0 && (
              <tr>
                <td colSpan={5} className="p-12 text-center text-text-muted italic">
                  No designations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={filteredDesignations.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 border-b border-app-border flex items-center justify-between bg-primary-navy text-white">
              <h3 className="textile-header font-bold flex items-center gap-2 uppercase tracking-wider">
                <Briefcase size={18} /> {editingDesignation ? 'Edit Designation' : 'Add New Designation'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Designation Name (*)</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-slate-50 border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy rounded-md uppercase font-bold"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. SENIOR WEAVER"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Skill Level (*)</label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                    value={formData.skill_level || ''}
                    onChange={(e) => setFormData({ ...formData, skill_level: e.target.value })}
                  >
                    {SKILL_LEVELS.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold flex items-center gap-1">
                    <FileText size={12} /> Job Description
                  </label>
                  <span className={cn(
                    "text-[10px] font-mono",
                    formData.job_description.trim().split(/\s+/).filter(Boolean).length > 500 ? "text-primary-red" : "text-text-muted"
                  )}>
                    {formData.job_description.trim().split(/\s+/).filter(Boolean).length} / 500 words
                  </span>
                </div>
                <textarea
                  rows={8}
                  className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy rounded-md resize-none"
                  value={formData.job_description || ''}
                  onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
                  placeholder="Enter detailed job description and responsibilities..."
                />
              </div>

              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-md border border-app-border">
                <input
                  type="checkbox"
                  id="status"
                  className="w-4 h-4 rounded border-app-border text-primary-navy focus:ring-primary-navy"
                  checked={formData.status === 1}
                  onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 1 : 0 })}
                />
                <label htmlFor="status" className="text-sm text-primary-navy font-bold uppercase tracking-wide">Active Designation</label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-app-border">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 px-4 py-2.5 border border-app-border rounded-md text-sm font-bold text-text-muted hover:bg-slate-50 transition-colors uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  data-shortcut="save"
                  className="flex-1 app-btn-primary py-2.5 font-bold uppercase tracking-wider shadow-lg"
                >
                  {editingDesignation ? 'Update Designation' : 'Save Designation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
