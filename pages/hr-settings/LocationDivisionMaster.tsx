import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Download, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  FileSpreadsheet,
  X,
  Save,
  Building2
} from 'lucide-react';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import { useModule } from '../../contexts/ModuleContext';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import * as XLSX from '../../utils/xlsx';
import { Pagination } from '../../components/common/Pagination';
import { motion, AnimatePresence } from 'motion/react';

interface OrgRecord {
  id: number;
  name: string;
  type: 'Location' | 'Division';
  parent_id: number | null;
  description: string;
  status: number;
}

export default function LocationDivisionMaster() {
  const { currentMode } = useModule();
  const [records, setRecords] = useState<OrgRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OrgRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const pageSize = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'Location' as 'Location' | 'Division',
    parent_id: '',
    description: '',
    status: true
  });

  useEffect(() => {
    fetchData();
  }, [currentMode]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({ 
        tableName: 'org_hierarchy', 
        operation: 'list', 
        moduleType: currentMode 
      }) });
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  const getParentName = (parentId: number | null) => {
    if (!parentId) return '-';
    const parent = records.find(r => r.id === parentId);
    return parent ? parent.name : `ID: ${parentId}`;
  };

  const filteredRecords = records.filter(rec => 
    (rec.name || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
    (rec.type || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
    (rec.description && (rec.description || "").toLowerCase().includes((searchTerm || "").toLowerCase())) ||
    (getParentName(rec.parent_id) || "").toLowerCase().includes((searchTerm || "").toLowerCase())
  );

  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const currentItems = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.type === 'Division' && !formData.parent_id) {
        toast.error("Parent Location is required for Divisions");
        return;
      }

      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'org_hierarchy',
        operation: editingRecord ? 'update' : 'create',
        id: editingRecord?.id,
        data: {
          name: formData.name,
          type: formData.type,
          parent_id: formData.type === 'Division' ? Number(formData.parent_id) : null,
          description: formData.description,
          status: formData.status ? 1 : 0
        },
        moduleType: currentMode
      }) });

      toast.success(editingRecord ? "Record updated" : "Record created");
      setIsModalOpen(false);
      setEditingRecord(null);
      fetchData();
    } catch (error) {
      toast.error(typeof error === 'string' ? error : "Failed to save record");
    }
  };

  const handleEdit = (rec: OrgRecord) => {
    setEditingRecord(rec);
    setFormData({
      name: rec.name,
      type: rec.type,
      parent_id: rec.parent_id?.toString() || '',
      description: rec.description || '',
      status: rec.status === 1
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'org_hierarchy',
        operation: 'delete',
        id,
        moduleType: currentMode
      }) });
      toast.success("Record deleted");
      setDeleteConfirmId(null);
      fetchData();
    } catch (error) {
      toast.error(typeof error === 'string' ? error : "Failed to delete record");
    }
  };

  const downloadTemplate = () => {
    const template = [
      { 'Name': 'DURGA', 'Type': 'Location', 'Parent Location': '', 'Status': 'Active', 'Description': 'Main Factory' },
      { 'Name': 'DURGA-OVERAL', 'Type': 'Division', 'Parent Location': 'DURGA', 'Status': 'Active', 'Description': 'Overall Division' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Location_Division_Template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = await XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        const recordsToCreate = (data as any[]).map(row => {
          const parentName = row['Parent Location'] || row['ParentLocation'] || row['ParentID'];
          let parentId = null;
          
          if (parentName) {
            // Try to find by name first
            const parent = records.find(r => r.name === parentName && r.type === 'Location');
            if (parent) {
              parentId = parent.id;
            } else if (!isNaN(Number(parentName))) {
              // Fallback to ID if it's a number
              parentId = Number(parentName);
            }
          }

          return {
            name: row['Name'],
            type: row['Type'],
            parent_id: parentId,
            parent_name: parentName, // Send name to backend for resolution if ID not found
            status: (row['Status'] || 'Active').toString().toLowerCase() === 'active' ? 1 : 0,
            description: row['Description'] || ''
          };
        }).filter(r => r.name && r.type);

        if (recordsToCreate.length === 0) {
          toast.error("No valid records found in file");
          return;
        }

        await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
          tableName: 'org_hierarchy',
          operation: 'bulk_create',
          data: recordsToCreate,
          moduleType: currentMode
        }) });

        toast.success(`${recordsToCreate.length} records processed`);
        fetchData();
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to process file");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary-navy textile-header tracking-tight flex items-center gap-3">
            <Building2 size={32} />
            Location & Division Master
          </h1>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Module ORG-01 // Organisational Structure</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-md border border-app-border hover:bg-white transition-all shadow-sm"
          >
            <Download size={14} /> Template
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-navy text-white text-xs font-bold rounded-md shadow-md hover:shadow-lg transition-all"
          >
            <Upload size={14} /> Bulk Upload
          </button>
          <button 
            onClick={() => {
              setEditingRecord(null);
              setFormData({
                name: '',
                type: 'Location',
                parent_id: '',
                description: '',
                status: true
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-green text-white text-xs font-bold rounded-md shadow-md hover:shadow-lg transition-all"
          >
            <Plus size={14} /> Add New
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls" />
        </div>
      </div>

      <div className="textile-card bg-white border-app-border shadow-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-app-border bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <h3 className="textile-header font-bold text-primary-navy uppercase text-sm">Hierarchy Records</h3>
            <span className="bg-primary-navy/10 text-primary-navy text-[10px] font-mono px-2 py-0.5 rounded-full border border-primary-navy/20">
              {filteredRecords.length} TOTAL
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

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-app-border text-[10px] textile-header text-text-muted uppercase tracking-wider">
                <th className="p-4">Name</th>
                <th className="p-4">Type</th>
                <th className="p-4">Parent Location</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/30">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-primary-navy mb-2" size={24} />
                    <p className="text-xs text-text-muted font-mono uppercase">Loading Data...</p>
                  </td>
                </tr>
              ) : currentItems.length > 0 ? currentItems.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-4">
                    <div className="text-xs font-black text-primary-navy uppercase tracking-tight">{rec.name}</div>
                    {rec.description && <div className="text-[10px] text-text-muted mt-0.5">{rec.description}</div>}
                  </td>
                  <td className="p-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                      rec.type === 'Location' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"
                    )}>
                      {rec.type}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-bold text-primary-navy uppercase">
                    {getParentName(rec.parent_id)}
                  </td>
                  <td className="p-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border flex items-center gap-1 w-fit",
                      rec.status === 1 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                    )}>
                      {rec.status === 1 ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {rec.status === 1 ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <AnimatePresence mode="wait">
                        {deleteConfirmId === rec.id ? (
                          <motion.div key="confirm" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex items-center gap-2">
                            <button onClick={() => handleDelete(rec.id)} className="px-2 py-1 bg-red-600 text-white text-[9px] font-bold rounded uppercase hover:bg-red-700">Confirm</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 bg-slate-200 text-slate-600 text-[9px] font-bold rounded uppercase hover:bg-slate-300">Cancel</button>
                          </motion.div>
                        ) : (
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(rec)} className="p-1.5 text-primary-navy hover:bg-primary-navy/10 rounded transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => setDeleteConfirmId(rec.id)} className="p-1.5 text-primary-red hover:bg-primary-red/10 rounded transition-colors"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </AnimatePresence>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 opacity-30">
                      <FileSpreadsheet size={48} />
                      <p className="text-sm font-bold textile-header uppercase">No Records Found</p>
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
          totalRecords={filteredRecords.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-primary-navy/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-app-border bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-primary-navy tracking-tight uppercase">
                {editingRecord ? 'Edit Record' : 'Add New Record'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-primary-red transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Name (*)</label>
                <input
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-app-border p-2.5 text-xs rounded-md outline-none focus:border-primary-navy transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Type (*)</label>
                  <select
                    value={formData.type || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any, parent_id: e.target.value === 'Location' ? '' : prev.parent_id }))}
                    className="w-full bg-slate-50 border border-app-border p-2.5 text-xs rounded-md outline-none focus:border-primary-navy transition-colors"
                  >
                    <option value="Location">Location</option>
                    <option value="Division">Division</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Parent Location</label>
                  <select
                    disabled={formData.type === 'Location'}
                    value={formData.parent_id || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, parent_id: e.target.value }))}
                    className="w-full bg-slate-50 border border-app-border p-2.5 text-xs rounded-md outline-none focus:border-primary-navy transition-colors disabled:opacity-50"
                  >
                    <option value="">-- Select Parent --</option>
                    {records.filter(r => r.type === 'Location').map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-slate-50 border border-app-border p-2.5 text-xs rounded-md outline-none focus:border-primary-navy transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-app-border rounded-md">
                <span className="text-[10px] textile-header text-text-muted uppercase font-bold">Status</span>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, status: !prev.status }))}
                  className={cn(
                    "w-10 h-5 rounded-full p-1 transition-colors relative",
                    formData.status ? "bg-primary-green" : "bg-slate-300"
                  )}
                >
                  <div className={cn("w-3 h-3 bg-white rounded-full shadow-sm transition-transform", formData.status ? "translate-x-5" : "translate-x-0")} />
                </button>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-100 text-text-main rounded-lg text-sm font-bold hover:bg-slate-200 transition-all">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-primary-navy text-white rounded-lg text-sm font-bold hover:bg-primary-navy/90 transition-all shadow-md flex items-center justify-center gap-2">
                  <Save size={18} /> {editingRecord ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
