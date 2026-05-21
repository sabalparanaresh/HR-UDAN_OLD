import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Edit2, Trash2, Search, Filter, Lock,
  DollarSign, Percent, Calculator, 
  CheckCircle2, XCircle, AlertCircle, Loader2,
  ChevronRight, ArrowUpRight, ArrowDownRight,
  Download,
  Upload,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from '../../utils/xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import { useModule } from '../../contexts/ModuleContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SalaryHead {
  id: number;
  name: string;
  type: 'EARNING' | 'DEDUCTION';
  is_deduction?: number;
  system_head?: 
    | 'BASIC' | 'HRA' | 'CONVEYANCE' | 'INCENTIVE' | 'OTHER_ALLOWANCE' | 'OVERTIME' | 'ARREAR' | 'BONUS' | 'REPLACEMENT' | 'LEAVE_ENCASHMENT' | 'PRODUCTION_BONUS'
    | 'PROVIDENT_FUND' | 'ESI' | 'PROFESSIONAL_TAX' | 'LABOUR_WELFARE_FUND' | 'INCOME_TAX_TDS' | 'ADVANCE_SALARY' | 'LOAN_EMI' | 'OTHER_DEDUCTION';
  applicability?: 'K' | 'KP';
  allocation_type: 'K_ONLY' | 'KP' | 'STATUTORY';
  base_on: string | null;
  is_part_of_ctc: boolean;
  status: boolean;
  is_locked?: boolean;
}

export default function SalaryHeads() {
  const { currentMode } = useModule();

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  const [activeTab, setActiveTab] = useState<'EARNING' | 'DEDUCTION'>('EARNING');
  const [heads, setHeads] = useState<SalaryHead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [headToDelete, setHeadToDelete] = useState<number | null>(null);
  const [editingHead, setEditingHead] = useState<SalaryHead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedHeads, setSelectedHeads] = useState<number[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [formData, setFormData] = useState<Partial<SalaryHead>>({
    name: '',
    type: 'EARNING',
    system_head: 'BASIC',
    allocation_type: 'KP',
    applicability: 'K',
    base_on: '',
    is_part_of_ctc: true,
    status: true
  });

  const fetchHeads = async () => {
    setIsLoading(true);
    try {
      const filters: any = { type: activeTab };
      
      const data = await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'salary_heads',
        operation: 'list',
        moduleType: currentMode,
        filters: filters
      }) });
      
      // Ensure type is populated for UI consistency
      const mappedData = data.map(h => ({
        ...h,
        type: h.type || (h.is_deduction ? 'DEDUCTION' : 'EARNING')
      }));
      
      setHeads(mappedData);
    } catch (err) {
      toast.error("Failed to fetch salary heads");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHeads();
  }, [activeTab, currentMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { 
        ...formData, 
        type: activeTab,
        isDeduction: activeTab === 'DEDUCTION' 
      };
      
      // 1. Primary Operation (Current Mode)
      // The backend will handle auto-sync to P if applicability is 'KP'
      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'salary_heads',
        operation: editingHead ? 'update' : 'create',
        id: editingHead?.id,
        data: payload,
        moduleType: currentMode
      }) });

      toast.success(`Salary head ${editingHead ? 'updated' : 'created'} successfully`);
      
      // 2. Strict State Reset before Fetch
      setIsModalOpen(false);
      setEditingHead(null);
      setFormData({
        name: '',
        type: activeTab,
        system_head: activeTab === 'EARNING' ? 'BASIC' : 'PROVIDENT_FUND',
        allocation_type: 'KP',
        applicability: 'K',
        base_on: '',
        is_part_of_ctc: true,
        status: true
      });

      // 3. Final Fetch
      await fetchHeads();
    } catch (err: any) {
      toast.error(err.error || err.details || (typeof err === 'string' ? err : "Failed to save salary head"));
    }
  };

  const handleEdit = (head: SalaryHead) => {
    setEditingHead(head);
    setFormData({
      ...head,
      name: head.name || '',
      base_on: head.base_on || '',
      is_part_of_ctc: !!head.is_part_of_ctc,
      status: !!head.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    setHeadToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedHeads.length > 0) {
      setIsBulkDeleting(true);
      try {
        for (const id of selectedHeads) {
          await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
            tableName: 'salary_heads',
            operation: 'delete',
            id: id,
            moduleType: currentMode
          }) });
        }
        toast.success(`${selectedHeads.length} salary heads deleted successfully`);
        setSelectedHeads([]);
        setIsDeleteModalOpen(false);
        fetchHeads();
      } catch (err: any) {
        toast.error(err.details || err.error || "Failed to delete some salary heads");
      } finally {
        setIsBulkDeleting(false);
      }
      return;
    }

    if (!headToDelete) return;

    try {
      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'salary_heads',
        operation: 'delete',
        id: headToDelete,
        moduleType: currentMode
      }) });
      toast.success("Salary head deleted successfully");
      setIsDeleteModalOpen(false);
      setHeadToDelete(null);
      fetchHeads();
    } catch (err: any) {
      toast.error(err.details || err.error || (typeof err === 'string' ? err : "Failed to delete salary head"));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedHeads(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedHeads.length === filteredHeads.length) {
      setSelectedHeads([]);
    } else {
      setSelectedHeads(filteredHeads.map(h => h.id));
    }
  };

  const downloadTemplate = () => {
    const headers = [[
      'name', 
      'category', 
      'system_head', 
      'type',
      ...(currentMode === 'K' ? ['applicability'] : []),
      'base_on', 
      'is_part_of_ctc', 
      'status'
    ]];
    const example = [[
      'Basic Salary', 
      'EARNING', 
      'BASIC', 
      'KP',
      ...(currentMode === 'K' ? ['KP'] : []),
      '',
      '1', 
      '1'
    ]];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Salary Head Template");
    XLSX.writeFile(wb, "Salary_Heads_Template.xlsx");
    toast.success("Template downloaded successfully");
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;
      const wb = await XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      try {
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];
        if (rawData.length === 0) {
          toast.error("No data found in the file");
          return;
        }

        // --- Normalization Layer ---
        const normalizedData = rawData.map(row => {
          const newRow: any = {};
          
          // 1. Key Normalization: strip whitespace and special chars
          Object.keys(row).forEach(key => {
            const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
            newRow[cleanKey] = row[key];
          });

          // 2. Head Mapping & Value Normalization
          const systemHeadRaw = (newRow.system_head || '').toString().trim();
          let systemHeadClean = systemHeadRaw.toUpperCase().replace(/[\s-]+/g, '_');
          
          // Known Mapping Fallbacks/Aliases
          if (systemHeadClean === 'LABOUR_WELFARE_FUND_LWF' || systemHeadClean === 'LWF') systemHeadClean = 'LABOUR_WELFARE_FUND';
          if (systemHeadClean === 'PROVIDENT_FUND_PF' || systemHeadClean === 'PF') systemHeadClean = 'PROVIDENT_FUND';
          if (systemHeadClean === 'PROFESSIONAL_TAX_PT' || systemHeadClean === 'PT') systemHeadClean = 'PROFESSIONAL_TAX';
          if (systemHeadClean === 'INCOME_TAX_TDS' || systemHeadClean === 'TDS') systemHeadClean = 'INCOME_TAX_TDS';
          
          // 3. Category Normalization (Earnings/Deductions)
          const typeRaw = (newRow.category || newRow.type || '').toString().toUpperCase().trim();
          let typeClean: 'EARNING' | 'DEDUCTION' = 'EARNING'; // Default
          if (typeRaw.includes('DEDUCT')) {
            typeClean = 'DEDUCTION';
          } else if (typeRaw.includes('EARN')) {
            typeClean = 'EARNING';
          }

          // 4. Allocation Type / Applicability Normalization
          // User mentions: 'K Only', 'KP', 'Statutory'
          const allocArg = newRow.allocation_type || newRow.allocationType || newRow.applicability || (newRow.category ? newRow.type : null) || '';
          const allocRaw = allocArg.toString().toUpperCase().trim().replace(/[\s-]+/g, '_');
          let allocClean: 'K_ONLY' | 'KP' | 'STATUTORY' = 'KP'; // Default
          
          if (allocRaw.includes('K_ONLY') || allocRaw === 'K' || allocRaw === 'ONLY_K' || (allocRaw.includes('K') && !allocRaw.includes('P'))) {
            allocClean = 'K_ONLY';
          } else if (allocRaw.includes('KP') || (allocRaw.includes('K') && allocRaw.includes('P'))) {
            allocClean = 'KP';
          } else if (allocRaw.includes('STATUT') || allocRaw.includes('STAT') || allocRaw === 'P') {
            allocClean = 'STATUTORY';
          }

          // 5. Final Casting for Boolean/Numeric fields
          const isTrue = (val: any) => val === 1 || val === '1' || val === true || val === 'TRUE' || val === 'true';

          return {
            ...newRow,
            name: newRow.name?.toString().trim() || 'Untitled Head',
            type: typeClean,
            is_deduction: typeClean === 'DEDUCTION' ? 1 : 0,
            system_head: systemHeadClean || 'OTHER_ALLOWANCE',
            applicability: allocClean === 'KP' ? 'KP' : 'K', 
            allocation_type: allocClean,
            is_part_of_ctc: isTrue(newRow.is_part_of_ctc),
            status: isTrue(newRow.status === undefined ? 1 : newRow.status)
          };
        });

        const CHUNK_SIZE = 500;
        const total = normalizedData.length;
        
        for (let i = 0; i < total; i += CHUNK_SIZE) {
          const chunk = normalizedData.slice(i, i + CHUNK_SIZE);
          await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
            tableName: 'salary_heads',
            operation: 'bulk_create',
            data: chunk,
            moduleType: currentMode
          }) });
        }
        
        toast.success(`Bulk upload successful (${normalizedData.length} records processed)`);
        fetchHeads();
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(err.error || "Bulk upload failed");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };
  
  const filteredHeads = heads
    .filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((head, index, self) => 
      index === self.findIndex((t) => t.name === head.name)
    );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-black text-primary-navy tracking-tight">Salary Heads</h2>
          <p className="text-text-muted text-sm">Define and manage earning and deduction components.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-app-border rounded-lg shadow-sm p-1">
            <button 
              onClick={downloadTemplate}
              className="p-2 text-text-muted hover:text-primary-navy hover:bg-slate-50 rounded-md transition-all flex items-center gap-2 text-xs font-bold"
              title="Download Template"
            >
              <Download size={16} />
              <span className="hidden sm:inline">TEMPLATE</span>
            </button>
            <div className="w-[1px] h-4 bg-app-border mx-1" />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-text-muted hover:text-primary-navy hover:bg-slate-50 rounded-md transition-all flex items-center gap-2 text-xs font-bold"
              title="Bulk Upload"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">UPLOAD</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".xlsx, .xls"
              onChange={handleBulkUpload}
            />
          </div>

          {selectedHeads.length > 0 && (
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-red text-white rounded-lg text-sm font-bold hover:bg-primary-red/90 transition-all shadow-md animate-in slide-in-from-right-4"
            >
              <Trash2 size={16} /> Delete Selected ({selectedHeads.length})
            </button>
          )}
          <button 
            onClick={() => {
              setEditingHead(null);
              setFormData({
                name: '',
                type: activeTab,
                system_head: activeTab === 'EARNING' ? 'BASIC' : 'PROVIDENT_FUND',
                allocation_type: 'KP',
                applicability: 'K',
                base_on: '',
                is_part_of_ctc: true,
                status: true
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-navy text-white rounded-lg text-sm font-bold hover:bg-primary-navy/90 transition-all shadow-md"
          >
            <Plus size={16} /> Add Salary Head
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('EARNING')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
            activeTab === 'EARNING' 
              ? "bg-white text-primary-navy shadow-sm" 
              : "text-text-muted hover:text-primary-navy hover:bg-white/50"
          )}
        >
          <ArrowUpRight size={16} className={activeTab === 'EARNING' ? "text-primary-green" : ""} />
          Earnings
        </button>
        <button
          onClick={() => setActiveTab('DEDUCTION')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
            activeTab === 'DEDUCTION' 
              ? "bg-white text-primary-navy shadow-sm" 
              : "text-text-muted hover:text-primary-navy hover:bg-white/50"
          )}
        >
          <ArrowDownRight size={16} className={activeTab === 'DEDUCTION' ? "text-primary-red" : ""} />
          Deductions
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input 
            type="text"
            placeholder="Search salary heads..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-app-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-navy/10 focus:border-primary-navy transition-all"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex items-center justify-between px-2">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input 
            type="checkbox"
            checked={filteredHeads.length > 0 && selectedHeads.length === filteredHeads.length}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-app-border text-primary-navy focus:ring-primary-navy/20"
          />
          <span className="text-[10px] font-black text-text-muted uppercase tracking-widest group-hover:text-primary-navy transition-colors">Select All visible</span>
        </label>
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{filteredHeads.length} Results</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-20 text-center">
            <Loader2 size={40} className="animate-spin mx-auto text-primary-navy/20" />
            <p className="text-text-muted text-sm mt-4 font-bold uppercase tracking-widest">Loading Salary Heads...</p>
          </div>
        ) : filteredHeads.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white border border-dashed border-app-border rounded-2xl">
            <AlertCircle size={40} className="mx-auto text-text-muted/20" />
            <p className="text-text-muted text-sm mt-4 font-bold uppercase tracking-widest">No salary heads found</p>
          </div>
        ) : (
          filteredHeads.map((head) => (
            <div key={head.id} className={cn(
              "group bg-white border rounded-2xl p-6 hover:shadow-xl transition-all relative overflow-hidden",
              selectedHeads.includes(head.id) ? "border-primary-navy ring-1 ring-primary-navy/20" : "border-app-border hover:border-primary-navy/20"
            )}>
              <div className="absolute top-4 left-4 z-10">
                <input 
                  type="checkbox"
                  checked={selectedHeads.includes(head.id)}
                  onChange={() => toggleSelect(head.id)}
                  className="w-4 h-4 rounded border-app-border text-primary-navy focus:ring-primary-navy/20 cursor-pointer shadow-sm"
                />
              </div>
              <div className={cn(
                "absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 transition-transform group-hover:scale-110",
                activeTab === 'EARNING' ? "bg-primary-green" : "bg-primary-red"
              )} />
              
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-primary-navy tracking-tight">{head.name}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700">
                      {head.system_head}
                    </span>
                    {currentMode === 'K' && (
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                        head.allocation_type === 'KP' ? "bg-emerald-100 text-emerald-700" : 
                        head.allocation_type === 'K_ONLY' ? "bg-slate-100 text-slate-700" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {head.allocation_type?.replace('_', ' ')}
                      </span>
                    )}
                    {head.status ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-primary-green uppercase tracking-wider">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-primary-red uppercase tracking-wider">
                        <XCircle size={10} /> Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 transition-opacity">
                  <button 
                    onClick={() => handleEdit(head)}
                    className="p-2 text-text-muted hover:text-primary-navy hover:bg-slate-100 rounded-lg transition-all"
                    title="Edit Salary Head"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => !head.is_locked && handleDelete(head.id)}
                    disabled={head.is_locked}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      head.is_locked 
                        ? "text-gray-400 bg-gray-50 cursor-not-allowed" 
                        : "text-text-muted hover:text-primary-red hover:bg-red-50"
                    )}
                    title={head.is_locked ? "Used in Transactions" : "Delete Salary Head"}
                  >
                    {head.is_locked ? <Lock size={16} /> : <Trash2 size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-center pt-4 border-t border-app-border">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      head.is_part_of_ctc ? "bg-primary-green" : "bg-slate-300"
                    )} />
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Part of CTC</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-primary-navy/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 text-primary-red rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-black text-primary-navy tracking-tight mb-2">Confirm Delete</h3>
              <p className="text-text-muted text-sm mb-6">
                {selectedHeads.length > 0 
                  ? `Are you sure you want to delete ${selectedHeads.length} salary heads? This action cannot be undone.`
                  : "Are you sure you want to delete this salary head? This action cannot be undone."}
              </p>
              <div className="flex gap-3">
                <button 
                  disabled={isBulkDeleting}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setHeadToDelete(null);
                    if (selectedHeads.length === 0) setSelectedHeads([]);
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-text-main rounded-lg text-sm font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  disabled={isBulkDeleting}
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 bg-primary-red text-white rounded-lg text-sm font-bold hover:bg-primary-red/90 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isBulkDeleting && <Loader2 size={16} className="animate-spin" />}
                  {isBulkDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-primary-navy/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-app-border bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-primary-navy tracking-tight">
                {editingHead ? 'Edit' : 'Add'} {activeTab === 'EARNING' ? 'Earning' : 'Deduction'} Head
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-primary-red transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Head Name</label>
                <input 
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Basic Salary, HRA, PF"
                  className="w-full bg-white border border-app-border p-2.5 text-xs rounded-lg outline-none focus:ring-2 focus:ring-primary-navy/10 focus:border-primary-navy transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">System Head</label>
                <select 
                  value={formData.system_head}
                  onChange={e => setFormData({...formData, system_head: e.target.value as any})}
                  className="w-full bg-white border border-app-border p-2.5 text-xs rounded-lg outline-none cursor-pointer"
                >
                  {activeTab === 'EARNING' ? (
                    <>
                      <option value="BASIC">Basic</option>
                      <option value="HRA">HRA</option>
                      <option value="CONVEYANCE">Conveyance</option>
                      <option value="INCENTIVE">Incentive</option>
                      <option value="OTHER_ALLOWANCE">Other Allowance</option>
                      <option value="OVERTIME">Overtime</option>
                      <option value="ARREAR">Arrear</option>
                      <option value="BONUS">Bonus</option>
                      <option value="REPLACEMENT">Replacement</option>
                      <option value="LEAVE_ENCASHMENT">Leave Encashment</option>
                      <option value="PRODUCTION_BONUS">Production Bonus</option>
                    </>
                  ) : (
                    <>
                      <option value="PROVIDENT_FUND">Provident Fund (PF)</option>
                      <option value="ESI">ESI</option>
                      <option value="PROFESSIONAL_TAX">Professional Tax (PT)</option>
                      <option value="LABOUR_WELFARE_FUND">Labour Welfare Fund (LWF)</option>
                      <option value="INCOME_TAX_TDS">Income Tax (TDS)</option>
                      <option value="ADVANCE_SALARY">Advance Salary</option>
                      <option value="LOAN_EMI">Loan EMI</option>
                      <option value="OTHER_DEDUCTION">Other Deduction</option>
                    </>
                  )}
                </select>
              </div>

              {currentMode === 'K' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Allocation Type (Dual-Module)</label>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                    {(['K_ONLY', 'KP', 'STATUTORY'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({...formData, allocation_type: type})}
                        className={cn(
                          "flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all",
                          formData.allocation_type === type ? "bg-white text-primary-navy shadow-sm" : "text-text-muted hover:text-primary-navy"
                        )}
                      >
                        {type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox"
                    checked={formData.is_part_of_ctc}
                    onChange={e => setFormData({...formData, is_part_of_ctc: e.target.checked})}
                    className="w-4 h-4 rounded border-app-border text-primary-navy focus:ring-primary-navy/20"
                  />
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest group-hover:text-primary-navy transition-colors">Part of CTC</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox"
                    checked={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.checked})}
                    className="w-4 h-4 rounded border-app-border text-primary-navy focus:ring-primary-navy/20"
                  />
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest group-hover:text-primary-navy transition-colors">Active Status</span>
                </label>
              </div>

              <div className="pt-6 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-text-main rounded-lg text-sm font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary-navy text-white rounded-lg text-sm font-bold hover:bg-primary-navy/90 transition-all shadow-md"
                >
                  {editingHead ? 'Update' : 'Save'} Head
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
