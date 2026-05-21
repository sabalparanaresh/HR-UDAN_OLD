import React, { useState, useEffect, useMemo } from 'react';
import { usePermission } from '../../hooks/useRBAC';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import { 
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
  MapPin,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from '../../utils/xlsx';
import { useOutletContext } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useModule } from '../../contexts/ModuleContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PincodeRecord {
  id?: number;
  pincode: string;
  statename: string;
  districtname: string;
  officename: string;
  last_updated: string;
}

export default function PincodeMaster() {
  const { currentMode } = useModule();
  const { currentUser } = useOutletContext<{ currentUser: any }>();
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';

  const [records, setRecords] = useState<PincodeRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(localStorage.getItem('pincode_master_last_sync'));
  const [syncStatus, setSyncStatus] = useState('');
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  
  const canSyncPincode = usePermission('settings.edit') || usePermission('statutorySettings.edit');
  const canCreate = usePermission('settings.insert') || usePermission('statutorySettings.insert');
  const canEdit = usePermission('settings.edit') || usePermission('statutorySettings.edit');
  const canDelete = usePermission('settings.delete') || usePermission('statutorySettings.delete');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Form State
  const [formData, setFormData] = useState<Omit<PincodeRecord, 'last_updated'>>({
    pincode: '',
    statename: '',
    districtname: '',
    officename: '',
  });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, [currentPage, searchQuery, currentMode]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi('/api/master-data/cmd/getPincodeRecords', { method: 'POST', body: JSON.stringify({
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery,
        moduleType: currentMode
      }) });
      setRecords(data.records || []);
      setTotalRecords(data.total || 0);
    } catch (error) {
      toast.error("Failed to fetch pincode records");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.pincode.length !== 6) {
      toast.error("Pincode must be 6 digits");
      return;
    }

    try {
      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'pincode_master',
        operation: isEditing ? 'update' : 'create',
        id: isEditing,
        data: formData,
        moduleType: currentMode
      }) });
      toast.success(isEditing ? "Record updated" : "Record added");
      resetForm();
      fetchData();
    } catch (error) {
      toast.error("Failed to save record");
    }
  };

  const resetForm = () => {
    setFormData({
      pincode: '',
      statename: '',
      districtname: '',
      officename: '',
    });
    setIsEditing(null);
  };

  const handleEdit = (record: PincodeRecord) => {
    setIsEditing(record.id || null);
    setFormData({
      pincode: record.pincode,
      statename: record.statename,
      districtname: record.districtname,
      officename: record.officename,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;

    try {
      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'pincode_master',
        operation: 'delete',
        id: id,
        moduleType: currentMode
      }) });
      toast.success("Record deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete record");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result;
        if (!arrayBuffer) return;
        
        const data = new Uint8Array(arrayBuffer as ArrayBuffer);
        const wb = await XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];

        if (jsonData.length === 0) {
          toast.warning("The uploaded file is empty.");
          return;
        }

        setImportProgress({ current: 0, total: jsonData.length });
        setIsLoading(true);

        const chunkSize = 200;
        for (let i = 0; i < jsonData.length; i += chunkSize) {
          const chunk = jsonData.slice(i, i + chunkSize);
          const recordsToImport = chunk.map(row => {
            // Helper to find value by case-insensitive and space-insensitive keys
            const findVal = (keys: string[]) => {
              const rowKeys = Object.keys(row);
              for (const k of keys) {
                const match = rowKeys.find(rk => {
                  const normalizedRK = rk.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                  const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                  return normalizedRK === normalizedK;
                });
                if (match) return row[match];
              }
              return '';
            };

            const pincode = String(findVal(['Pincode', 'PIN', 'ZipCode', 'Zip', 'Pin Code']) || '').trim();
            const statename = String(findVal(['State', 'Statename', 'State Name', 'St']) || '').trim();
            const districtname = String(findVal(['District', 'Districtname', 'District Name', 'Dist']) || '').trim();
            const officename = String(findVal(['Office', 'Officename', 'Office Name', 'Post Office', 'Location']) || '').trim();

            if (!pincode || !statename || !districtname) {
              console.warn("Skipping incomplete record:", { pincode, statename, districtname, row });
            }

            return { pincode, statename, districtname, officename };
          }).filter(r => r.pincode && r.pincode.length === 6 && r.statename && r.districtname);

          if (recordsToImport.length > 0) {
            await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
              tableName: 'pincode_master',
              operation: 'bulk_create',
              data: { records: recordsToImport },
              moduleType: currentMode
            }) });
          }
          
          setImportProgress({ current: Math.min(i + chunkSize, jsonData.length), total: jsonData.length });
        }

        toast.success(`Imported ${jsonData.length} records successfully.`);
        fetchData();
      } catch (err) {
        toast.error("Failed to import Excel file. " + (err as Error).message);
      } finally {
        setIsLoading(false);
        setImportProgress(null);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset input
  };

  const handleSyncGovIn = async () => {
    if (isSyncing) return;
    
    if (!isSuperAdmin && !canSyncPincode) {
      toast.error("Access Denied: You do not have permission to modify settings.");
      return;
    }

    const resourceId = "6176ee09-3d56-4a3b-8115-21841576b2f6";
    
    setIsSyncing(true);
    setSyncStatus('Connecting to OGD Gateway...');
    setSyncProgress({ current: 0, total: 0 });

    try {
      let offset = 0;
      const limit = 2000;
      let hasMore = true;
      let totalFetched = 0;

      while (hasMore) {
        setSyncStatus(`Streaming Records... Offset: ${offset}`);
        
        // Use backend command instead of direct fetch to handle secrets securely
        const data = await fetchApi('/api/master-data/cmd/getOgdRecords', { method: 'POST', body: JSON.stringify({ offset, limit }) }) as any;
        
        const batch = data.records || [];
        const totalCount = parseInt(data.total || "0");
        
        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        totalFetched += batch.length;
        setSyncProgress({ current: totalFetched, total: totalCount });
        
        // Map OGD fields to SQLite schema
        const mappedRecords = batch.map((r: any) => ({
          pincode: String(r.pincode || ''),
          officename: String(r.officename || ''),
          districtname: String(r.districtname || ''),
          statename: String(r.statename || '')
        }));

        // Upsert to Local DB
        await fetchApi('/api/master-data/cmd/bulkPincodeUpsert', { method: 'POST', body: JSON.stringify({
          records: mappedRecords,
          moduleType: currentMode
        }) });

        offset += limit;

        if (totalFetched >= totalCount) {
          hasMore = false;
        }
      }

      setSyncStatus('Indexing Local DB...');
      await new Promise(r => setTimeout(r, 1000)); // Simulated indexing delay

      const now = new Date().toLocaleString();
      setLastSyncedAt(now);
      localStorage.setItem('pincode_master_last_sync', now);

      toast.success(`Successfully synced ${totalFetched} records with OGD Master`);
      fetchData();
    } catch (err: any) {
      console.error("Sync Error:", err);
      toast.error(`Sync Failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setSyncStatus('');
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      { Pincode: '395001', District: 'Surat', State: 'Gujarat', Office: 'Surat H.O' },
      { Pincode: '110001', District: 'New Delhi', State: 'Delhi', Office: 'G.P.O' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Pincode_Import_Template.xlsx");
  };

  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy flex items-center gap-3">
            <MapPin className="text-primary-navy" size={32} />
            Pincode Master
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-text-muted text-sm font-mono uppercase tracking-wider">
              Geographic Directory // Logistics Management
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
            onClick={handleSyncGovIn}
            disabled={isSyncing}
            className={cn(
              "flex items-center gap-3 px-6 py-2.5 text-xs font-black transition-all rounded-lg border-2 border-primary-navy",
              isSyncing ? "bg-slate-100 text-text-muted cursor-not-allowed opacity-50" : "bg-primary-navy text-white hover:bg-white hover:text-primary-navy shadow-lg"
            )}
          >
            {isSyncing ? <Loader2 size={16} className="animate-spin text-primary-navy" /> : <RefreshCw size={16} />}
            SYNC WITH GOV.IN (OGD API)
          </button>
        </div>
      </div>

      {/* Sync Status Overlay */}
      {isSyncing && (
        <div className="bg-white border-2 border-primary-navy p-6 rounded-xl shadow-2xl space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <h4 className="textile-header font-black text-primary-navy uppercase text-lg italic tracking-tighter">OGD MASTER SYNCHRONIZATION</h4>
              <p className="text-xs font-mono text-text-muted">
                Status: <span className="text-primary-navy font-bold">{syncStatus}</span>
              </p>
            </div>
            {syncProgress.total > 0 && (
              <div className="text-right">
                <div className="text-2xl font-black text-primary-navy font-mono">
                  {Math.round((syncProgress.current / syncProgress.total) * 100)}%
                </div>
                <div className="text-[10px] text-text-muted font-mono">
                  {syncProgress.current} / {syncProgress.total}
                </div>
              </div>
            )}
          </div>
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-app-border p-0.5">
            <div 
              className={cn(
                "h-full bg-primary-navy rounded-full transition-all duration-500 ease-out",
                syncProgress.total === 0 ? "animate-pulse" : ""
              )}
              style={{ width: syncProgress.total > 0 ? `${(syncProgress.current / syncProgress.total) * 100}%` : '20%' }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="textile-card p-6 bg-white border-app-border shadow-xl">
            <div className="flex items-center justify-between border-b border-app-border pb-3 mb-4">
              <h3 className="textile-header font-bold text-primary-navy flex items-center gap-2">
                {isEditing ? <Edit2 size={18} /> : <Plus size={18} />}
                {isEditing ? 'Edit Pincode' : 'Manual Entry'}
              </h3>
              {isEditing && (
                <button onClick={resetForm} className="text-text-muted hover:text-primary-red transition-colors">
                  <X size={18} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Pincode (*)</label>
                <input
                  required
                  name="pincode"
                  value={formData.pincode || ''}
                  onChange={handleInputChange}
                  maxLength={6}
                  disabled={!!isEditing || (!isEditing && !canCreate)}
                  className="w-full bg-slate-50 border border-app-border p-2.5 text-sm font-mono focus:outline-none focus:border-primary-navy transition-colors rounded-md disabled:opacity-50"
                  placeholder="6-digit PIN"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">District (*)</label>
                <input
                  required
                  name="districtname"
                  value={formData.districtname || ''}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                  placeholder="e.g. Surat"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">State (*)</label>
                <input
                  required
                  name="statename"
                  value={formData.statename || ''}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                  placeholder="e.g. Gujarat"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Office Name (Optional)</label>
                <input
                  name="officename"
                  value={formData.officename || ''}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-app-border p-2.5 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                  placeholder="e.g. Surat H.O"
                />
              </div>

              {(isEditing ? canEdit : canCreate) && (
              <button
                type="submit"
                className="w-full app-btn app-btn-primary py-3 textile-header font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {isEditing ? <Save size={18} /> : <Plus size={18} />}
                {isEditing ? 'Update Record' : 'Add to Master'}
              </button>
              )}
            </form>
          </div>

          {/* Offline Upload Area */}
          <div className="textile-card p-6 bg-slate-50 border-2 border-dashed border-primary-navy/20 rounded-xl space-y-4 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-primary-navy">
                <Upload size={24} />
                <h4 className="textile-header font-bold uppercase text-sm">Excel Import</h4>
              </div>
              <button 
                onClick={downloadTemplate}
                className="text-[9px] font-bold text-primary-navy hover:underline flex items-center gap-1 uppercase"
              >
                <FileSpreadsheet size={10} />
                Template
              </button>
            </div>
            {importProgress ? (
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase">
                  <span>Importing Records...</span>
                  <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-navy transition-all duration-300" 
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-[9px] text-text-muted font-mono">
                  Processed {importProgress.current} of {importProgress.total} records
                </p>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Bulk-populate your master data from Excel. 
                  Required columns: <span className="font-bold uppercase">Pincode, District, State</span>.
                </p>
                <label className="block">
                  <span className="sr-only">Choose file</span>
                  <input 
                    type="file" 
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    disabled={isLoading || !canCreate}
                    className="block w-full text-xs text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-[10px] file:font-black file:bg-primary-navy file:text-white hover:file:bg-slate-800 cursor-pointer transition-all disabled:opacity-50"
                  />
                </label>
              </>
            )}
            <div className="flex items-center gap-2 text-[9px] font-mono text-primary-navy uppercase bg-white/50 p-2 rounded border border-primary-navy/10">
              <FileSpreadsheet size={12} />
              Supports .xlsx and .xls formats
            </div>
          </div>
        </div>

        {/* List Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="textile-card bg-white border-app-border shadow-xl overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-app-border bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <h3 className="textile-header font-bold text-primary-navy uppercase text-sm">Pincode Directory</h3>
                <span className="bg-primary-navy/10 text-primary-navy text-[10px] font-mono px-2 py-0.5 rounded-full border border-primary-navy/20">
                  {totalRecords} RECORDS
                </span>
                
                {lastSyncedAt && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary-green/10 text-primary-green border border-primary-green/20 rounded-full text-[9px] font-black uppercase shadow-sm">
                    <RefreshCw size={10} className="animate-pulse" />
                    Last Sync: {new Date(lastSyncedAt).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search PIN or Location..."
                  className="w-full bg-white border border-app-border pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-primary-navy transition-colors rounded-md"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-app-border">
                    <th className="p-3 text-[10px] textile-header text-text-muted uppercase tracking-wider">Pincode</th>
                    <th className="p-3 text-[10px] textile-header text-text-muted uppercase tracking-wider">District</th>
                    <th className="p-3 text-[10px] textile-header text-text-muted uppercase tracking-wider">State</th>
                    <th className="p-3 text-[10px] textile-header text-text-muted uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/30">
                  {(records?.length || 0) > 0 ? records.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-3">
                        <div className="font-mono text-sm font-black text-primary-navy tracking-tighter uppercase">
                          {record.pincode}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-xs font-bold text-text-main uppercase">{record.districtname}</div>
                        {record.officename && <div className="text-[9px] text-text-muted font-mono">{record.officename}</div>}
                      </td>
                      <td className="p-3">
                        <div className="text-xs text-text-main uppercase">{record.statename}</div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit && (
                            <button
                              onClick={() => handleEdit(record)}
                              className="p-1.5 text-primary-navy hover:bg-primary-navy/10 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(record.id!)}
                              className="p-1.5 text-primary-red hover:bg-primary-red/10 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3 opacity-30">
                          <MapPin size={48} />
                          <div className="space-y-1">
                            <p className="text-sm font-bold textile-header uppercase">No Records Found</p>
                            <p className="text-xs">Add manually or import via Excel</p>
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
                    className="px-3 py-1 text-[10px] font-bold border border-app-border rounded hover:bg-white disabled:opacity-30 transition-colors flex items-center"
                  >
                    <ChevronLeft size={12} /> PREV
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-3 py-1 text-[10px] font-bold border border-app-border rounded hover:bg-white disabled:opacity-30 transition-colors flex items-center"
                  >
                    NEXT <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
            
            {/* Footer Stats */}
            <div className="mt-auto p-3 bg-slate-50 border-t border-app-border flex justify-between items-center text-[9px] font-mono text-text-muted uppercase tracking-widest">
              <div className="flex gap-4">
                <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-primary-green" /> Verified Data</span>
                <span className="flex items-center gap-1"><AlertCircle size={10} className="text-primary-navy" /> {totalRecords} Total Records</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
