import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Upload, 
  Database, 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Building2,
  RefreshCw,
  List
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';

import { useModule } from '../../contexts/ModuleContext';
import BulkBankUpload from '../../components/BulkBankUpload';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BankRecord {
  id?: string;
  bank_name: string;
  ifsc: string;
  branch: string;
  sync_status: 'API' | 'MANUAL' | 'IMPORT' | 'API_SYNC';
  updated_at: string;
}

export default function BankMaster() {
  const { currentMode } = useModule();
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [banks, setBanks] = useState<BankRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(localStorage.getItem('bank_master_last_sync'));
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  
  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;
  
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  // Form State
  const [formData, setFormData] = useState<Omit<BankRecord, 'sync_status' | 'updated_at'>>({
    bank_name: '',
    ifsc: '',
    branch: '',
  });

  // Fetch data from backend with search support
  const fetchBanks = async (query: string = '', page: number = 1) => {
    setIsLoading(true);
    try {
      const response = await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        table_name: 'banks',
        operation: 'list',
        module_type: currentMode,
        search: query,
        limit: itemsPerPage,
        offset: (page - 1) * itemsPerPage,
        include_total: true
      }) }) as { rows: BankRecord[]; total: number };
      
      setBanks(response.rows || []);
      setTotalRecords(response.total || 0);
    } catch (err) {
      console.error("Failed to load banks:", err);
      toast.error("Failed to load banks");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks(searchQuery, currentPage);
  }, [currentMode, searchQuery, currentPage]);

  // RBI Sync Logic
  const handleSyncRBI = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress(0);
    
    try {
      toast.info("Connecting to Razorpay IFSC Gateway...");
      // 1. Fetch Bank List (Object with CODE: NAME)
      const bankData = await fetchApi('/api/master-data/cmd/getOgdBankList', { method: 'POST' }) as Record<string, string>;
      const bankCodes = Object.keys(bankData);
      
      // Major banks for deeper sync first, followed by others up to a reasonable limit for this turns
      // We'll prioritize the top 20 major banks by their standard IFSC codes
      const priorityCodes = ['HDFC', 'SBIN', 'ICIC', 'UTIB', 'PUNB', 'KKBK', 'BARB', 'CNRB', 'IBKL', 'IDFB', 'UBIN', 'IOBA', 'MAHB', 'PSIB', 'UCBA', 'ANDS', 'CORP', 'ORBC', 'SYNB', 'VIJB'];
      const banksToSync = [...new Set([...priorityCodes, ...bankCodes])].slice(0, 30); // Sync top 30 banks
      
      const totalSteps = banksToSync.length;
      let totalImported = 0;
      
      for (let i = 0; i < banksToSync.length; i++) {
        const bankTag = banksToSync[i];
        setSyncProgress(Math.round(((i) / totalSteps) * 100));
        
        try {
          // Fetch from backend proxy
          const branchData = await fetchApi('/api/master-data/cmd/getOgdBankBranches', { method: 'POST', body: JSON.stringify({ bankTag }) }) as Record<string, any>;
          
          if (branchData && Object.keys(branchData).length > 0) {
            const records = Object.entries(branchData).map(([ifsc, details]) => ({
              bank_name: details.BANK,
              ifsc: ifsc,
              branch: details.BRANCH,
              sync_status: 'API_SYNC' as const
            }));
            
            // Bulk upsert to Local DB
            // Chunked on frontend to avoid NGINX 413 Payload Too Large limits
            const CHUNK_SIZE = 5000;
            for (let j = 0; j < records.length; j += CHUNK_SIZE) {
              const chunk = records.slice(j, j + CHUNK_SIZE);
              await fetchApi('/api/master-data/cmd/bulkBankImport', { method: 'POST', body: JSON.stringify({
                records: chunk,
                module_type: currentMode
              }) });
            }
            totalImported += records.length;
          }
        } catch (e) {
          console.warn(`[Bank Sync] Skipping ${bankTag} - might not have a direct JSON file or network issue`, e);
        }
      }
      
      const now = new Date().toLocaleString();
      setLastSyncedAt(now);
      localStorage.setItem('bank_master_last_sync', now);
      toast.success(`Razorpay IFSC Sync Complete! Synced ${totalImported} branches.`);
      fetchBanks(searchQuery);
    } catch (err: any) {
      console.error("Sync Error:", err);
      toast.error(`Sync Failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.ifsc.length !== 11) {
      toast.error("IFSC must be 11 characters");
      return;
    }

    const isDuplicate = banks.some(b => b.ifsc.toUpperCase() === formData.ifsc.toUpperCase() && b.id !== isEditing);
    if (isDuplicate) {
      toast.error("Duplicate IFSC code detected");
      return;
    }

    setIsLoading(true);
    try {
      const data = {
        ...formData,
        ifsc: formData.ifsc.toUpperCase(),
        sync_status: isEditing ? banks.find(b => b.ifsc === isEditing)?.sync_status : 'MANUAL',
        updated_at: new Date().toISOString()
      };

      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        table_name: 'banks',
        operation: isEditing ? 'update' : 'create',
        data,
        id: isEditing,
        module_type: currentMode
      }) });
      
      toast.success(isEditing ? "Bank record updated" : "Bank record added");
      fetchBanks();
      resetForm();
    } catch (err) {
      toast.error("Failed to save bank record");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      bank_name: '',
      ifsc: '',
      branch: '',
    });
    setIsEditing(null);
  };

  const handleEdit = (record: BankRecord) => {
    setIsEditing(record.ifsc);
    setFormData({
      bank_name: record.bank_name || '',
      ifsc: record.ifsc || '',
      branch: record.branch || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this bank record?")) {
      try {
        await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
          table_name: 'banks',
          operation: 'delete',
          id,
          module_type: currentMode
        }) });
        toast.success("Record deleted");
        fetchBanks();
      } catch (err) {
        toast.error("Failed to delete bank record");
      }
    }
  };


  const filteredBanks = useMemo(() => {
    // Note: Backend handles primary search, this is for secondary filtering if dataset is small
    // But since fetchBanks already filters, we just return the banks state
    return banks;
  }, [banks]);

  // Reset page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(totalRecords / itemsPerPage);
  const paginatedBanks = banks;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy flex items-center gap-3">
            <Database className="text-primary-navy" size={32} />
            Bank Master
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-text-muted text-sm font-mono uppercase tracking-wider">
              Financial Institutions // Branch Management
            </p>
            {lastSyncedAt && (
              <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded font-bold border border-green-200 animate-in fade-in">
                LAST SYNCED: {lastSyncedAt}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBulkUpload(!showBulkUpload)}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold transition-all rounded-lg border-2 border-primary-navy bg-white text-primary-navy hover:bg-slate-50"
          >
            {showBulkUpload ? <List size={14} /> : <Upload size={14} />}
            {showBulkUpload ? 'VIEW MASTER' : 'BULK UPLOAD'}
          </button>
          

          <button
            onClick={handleSyncRBI}
            disabled={isSyncing}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 text-xs font-bold transition-all rounded-lg border-2 border-primary-navy",
              isSyncing ? "bg-slate-100 text-text-muted cursor-not-allowed" : "bg-primary-navy text-white hover:bg-white hover:text-primary-navy shadow-lg"
            )}
          >
            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            SYNC WITH RBI MASTER
          </button>
        </div>
      </div>

      {/* Sync Progress Bar */}
      {isSyncing && (
        <div className="bg-white border-2 border-primary-navy p-6 rounded-xl shadow-2xl space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <h4 className="textile-header font-black text-primary-navy uppercase text-lg italic">RBI MASTER SYNCHRONIZATION</h4>
              <p className="text-xs font-mono text-text-muted">
                Transaction Phase: <span className="text-primary-navy font-bold">DOWNLOADING_MASTER_CHUNKS</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-primary-navy font-mono">
                {syncProgress}%
              </div>
            </div>
          </div>
          <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden border-2 border-app-border p-1">
            <div 
              className="h-full bg-primary-navy rounded-full transition-all duration-500 ease-out shadow-[0_0_15px_rgba(30,41,59,0.4)]"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Progress Monitor */}
      {isLoading && importProgress && (
        <div className="bg-white border-2 border-primary-navy p-6 rounded-xl shadow-2xl space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <h4 className="textile-header font-black text-primary-navy uppercase text-lg">Batch Import in Progress</h4>
              <p className="text-xs font-mono text-text-muted">
                Transaction Phase: <span className="text-primary-navy font-bold">SQL_IMMEDIATE_WRITE</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-primary-navy font-mono">
                {Math.round((importProgress.current / importProgress.total) * 100)}%
              </div>
              <div className="text-[10px] font-mono text-text-muted uppercase">
                Processing {importProgress.current} of {importProgress.total} records
              </div>
            </div>
          </div>
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-app-border p-1">
            <div 
              className="h-full bg-primary-navy rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(30,41,59,0.3)]"
              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {showBulkUpload ? (
        <BulkBankUpload onSuccess={() => fetchBanks()} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="textile-card p-6 bg-white border-app-border shadow-xl">
            <div className="flex items-center justify-between border-b border-app-border pb-3 mb-4">
              <h3 className="textile-header font-bold text-primary-navy flex items-center gap-2">
                {isEditing ? <Edit2 size={18} /> : <Plus size={18} />}
                {isEditing ? 'Edit Bank Record' : 'Manual Entry'}
              </h3>
              {isEditing && (
                <button onClick={resetForm} className="text-text-muted hover:text-primary-red transition-colors">
                  <X size={18} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">IFSC Code (*)</label>
                <div className="relative">
                  <input
                    required
                    name="ifsc"
                    value={formData.ifsc}
                    onChange={handleInputChange}
                    maxLength={11}
                    className="w-full bg-slate-50 border border-app-border p-2.5 text-sm font-mono focus:outline-none focus:border-primary-navy transition-colors rounded-md uppercase"
                    placeholder="HDFC0001234"
                  />
                  {isLoading && (
                    <div className="absolute right-3 top-2.5">
                      <Loader2 className="animate-spin text-primary-navy" size={16} />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Bank Name (*)</label>
                <input
                  required
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                  placeholder="e.g. HDFC Bank"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Branch (*)</label>
                <input
                  required
                  name="branch"
                  value={formData.branch}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                  placeholder="Branch Name"
                />
              </div>

              <button
                type="submit"
                className="w-full app-btn app-btn-primary py-3 textile-header font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {isEditing ? <Save size={18} /> : <Plus size={18} />}
                {isEditing ? 'Update Record' : 'Add to Master'}
              </button>
            </form>
          </div>
        </div>

        {/* Bank List Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="textile-card bg-white border-app-border shadow-xl overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-app-border bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <h3 className="textile-header font-bold text-primary-navy uppercase text-sm">Bank Directory</h3>
                <span className="bg-primary-navy/10 text-primary-navy text-[10px] font-mono px-2 py-0.5 rounded-full border border-primary-navy/20">
                  {totalRecords} RECORDS
                </span>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search IFSC or Bank..."
                  className="w-full bg-white border border-app-border pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-app-border">
                    <th className="p-3 text-[10px] textile-header text-text-muted uppercase tracking-wider w-1/4">IFSC / Sync</th>
                    <th className="p-3 text-[10px] textile-header text-text-muted uppercase tracking-wider w-2/3">Bank & Branch</th>
                    <th className="p-3 text-[10px] textile-header text-text-muted uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/30">
                  {paginatedBanks.length > 0 ? paginatedBanks.map((bank) => (
                    <tr key={bank.ifsc} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="font-mono text-sm font-black text-primary-navy tracking-tighter uppercase text-base">
                            {bank.ifsc}
                          </div>
                          <div className={cn(
                            "inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-sm border",
                            bank.sync_status === 'API_SYNC' ? "bg-indigo-50 text-indigo-700 border-indigo-200" : 
                            bank.sync_status === 'IMPORT' ? "bg-blue-50 text-blue-700 border-blue-200" : 
                            "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                            {bank.sync_status === 'API_SYNC' ? <CheckCircle2 size={10} /> : 
                             bank.sync_status === 'IMPORT' ? <FileSpreadsheet size={10} /> : 
                             <Database size={10} />}
                            {bank.sync_status}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-text-main uppercase">{bank.bank_name}</div>
                          <div className="text-[10px] text-text-muted font-mono">{bank.branch}</div>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(bank)}
                            className="p-1.5 text-primary-navy hover:bg-primary-navy/10 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(bank.ifsc)}
                            className="p-1.5 text-primary-red hover:bg-primary-red/10 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3 opacity-30">
                          <Database size={48} />
                          <div className="space-y-2">
                            <p className="text-sm font-bold textile-header uppercase">IFSC NOT FOUND IN LOCAL DATABASE</p>
                            <p className="text-xs text-text-muted">
                              Try <span className="font-bold text-primary-navy">'SYNC WITH RBI MASTER'</span> or add the record manually above.
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-3 bg-slate-50 border-t border-app-border flex items-center justify-between">
                <div className="text-[10px] text-text-muted font-mono uppercase">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1 text-[10px] font-bold border border-app-border rounded hover:bg-white disabled:opacity-30 transition-colors"
                  >
                    PREV
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-3 py-1 text-[10px] font-bold border border-app-border rounded hover:bg-white disabled:opacity-30 transition-colors"
                  >
                    NEXT
                  </button>
                </div>
              </div>
            )}
            
            {/* Footer Stats */}
            <div className="mt-auto p-3 bg-slate-50 border-t border-app-border flex justify-between items-center text-[9px] font-mono text-text-muted uppercase tracking-widest">
              <div className="flex gap-4">
                <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-primary-green" /> System Verified</span>
                <span className="flex items-center gap-1"><AlertCircle size={10} className="text-primary-navy" /> {totalRecords} Total Entries</span>
              </div>
              <div>
                Last Updated: {banks.length > 0 ? new Date(banks[0].updated_at).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
