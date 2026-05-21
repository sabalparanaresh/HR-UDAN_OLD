import React, { useState, useEffect, useRef } from 'react';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import * as Tabs from '@radix-ui/react-tabs';
import * as XLSX from '../../utils/xlsx';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Download, 
  Upload, 
  CheckCircle2, 
  XCircle,
  Database,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useModule } from '../../contexts/ModuleContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MasterItem {
  id: number;
  name: string;
  description: string;
  status: number;
}

const MasterTab = ({ 
  title, 
  apiPath, 
  icon: Icon 
}: { 
  title: string; 
  apiPath: string; 
  icon: React.ReactNode 
}) => {
  const { currentMode } = useModule();

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  const [items, setItems] = useState<MasterItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', status: 1 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    try {
      const data = await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: apiPath,
        operation: 'list',
        moduleType: currentMode
      }) });
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(`Failed to fetch ${title}s`);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [apiPath, currentMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: apiPath,
        operation: editingItem ? 'update' : 'create',
        id: editingItem?.id,
        data: formData,
        moduleType: currentMode
      }) });

      toast.success(`${title} ${editingItem ? 'updated' : 'created'} successfully`);
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ name: '', description: '', status: 1 });
      fetchItems();
    } catch (error) {
      toast.error(`Error saving ${title}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(`Are you sure you want to delete this ${title}?`)) return;
    try {
      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: apiPath,
        operation: 'delete',
        id,
        moduleType: currentMode
      }) });
      toast.success(`${title} deleted successfully`);
      fetchItems();
    } catch (error) {
      toast.error(`Error deleting ${title}`);
    }
  };

  const downloadTemplate = () => {
    const headers = [['name', 'description', 'status']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${title}_Template.xlsx`);
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
          await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
            tableName: apiPath,
            operation: 'bulk_create',
            data: chunk,
            moduleType: currentMode
          }) });
        }
        
        toast.dismiss(loadingToast);
        toast.success(`Bulk upload successful (${jsonData.length} records)`);
        fetchItems();
      } catch (error) {
        toast.error("Bulk upload failed");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const filteredItems = items.filter(item => 
    (item.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (item.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input
            type="text"
            placeholder={`Search ${title}s...`}
            className="w-full pl-10 pr-4 py-2 bg-white border border-app-border rounded-md text-sm focus:outline-none focus:border-primary-navy"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => {
              setEditingItem(null);
              setFormData({ name: '', description: '', status: 1 });
              setIsModalOpen(true);
            }}
            className="app-btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add {title}
          </button>
          <button 
            onClick={downloadTemplate}
            className="p-2 border border-app-border rounded-md hover:bg-slate-50 text-text-muted" 
            title="Download Template"
          >
            <Download size={16} />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 border border-app-border rounded-md hover:bg-slate-50 text-text-muted" 
            title="Bulk Upload"
          >
            <Upload size={16} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx, .xls" 
            onChange={handleBulkUpload} 
          />
        </div>
      </div>

      <div className="textile-card bg-white border-app-border overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-app-border">
              <th className="p-4 text-[10px] textile-header text-text-muted uppercase font-bold">Name</th>
              <th className="p-4 text-[10px] textile-header text-text-muted uppercase font-bold">Description</th>
              <th className="p-4 text-[10px] textile-header text-text-muted uppercase font-bold">Status</th>
              <th className="p-4 text-[10px] textile-header text-text-muted uppercase font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id} className="border-b border-app-border hover:bg-slate-50 transition-colors">
                <td className="p-4 text-sm font-medium text-primary-navy">{item.name}</td>
                <td className="p-4 text-sm text-text-muted">{item.description || '-'}</td>
                <td className="p-4">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                    Number(item.status) === 1 ? "bg-primary-green/10 text-primary-green" : "bg-primary-red/10 text-primary-red"
                  )}>
                    {Number(item.status) === 1 ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                    {Number(item.status) === 1 ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => {
                        setEditingItem(item);
                        setFormData({ name: item.name, description: item.description, status: item.status });
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-primary-navy hover:bg-primary-navy/10 rounded-md transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-primary-red hover:bg-primary-red/10 rounded-md transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-text-muted italic">
                  No {title.toLowerCase()}s found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-app-border flex items-center justify-between">
              <h3 className="textile-header font-bold text-primary-navy flex items-center gap-2">
                {Icon} {editingItem ? `Edit ${title}` : `Add New ${title}`}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-primary-red">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase">Name (*)</label>
                <input
                  required
                  type="text"
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] textile-header text-text-muted uppercase">Description</label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="status"
                  className="rounded border-app-border text-primary-navy focus:ring-primary-navy"
                  checked={formData.status === 1}
                  onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 1 : 0 })}
                />
                <label htmlFor="status" className="text-sm text-primary-navy font-medium">Active</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-app-border rounded-md text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 app-btn-primary"
                >
                  {editingItem ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default function ClassCategoryMaster() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-navy textile-header tracking-tight">Enterprise Master Settings</h1>
          <p className="text-text-muted text-sm">Manage employee classes and categories</p>
        </div>
      </div>

      <Tabs.Root defaultValue="class" className="w-full">
        <Tabs.List className="flex border-b border-app-border mb-6 gap-2">
          <Tabs.Trigger 
            value="class"
            className="px-6 py-3 text-sm font-bold textile-header uppercase tracking-wider transition-all border-b-2 border-transparent data-[state=active]:border-primary-navy data-[state=active]:text-primary-navy text-text-muted hover:text-primary-navy"
          >
            <div className="flex items-center gap-2">
              <Database size={16} /> Class Master
            </div>
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="category"
            className="px-6 py-3 text-sm font-bold textile-header uppercase tracking-wider transition-all border-b-2 border-transparent data-[state=active]:border-primary-navy data-[state=active]:text-primary-navy text-text-muted hover:text-primary-navy"
          >
            <div className="flex items-center gap-2">
              <Users size={16} /> Category Master
            </div>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="class" className="animate-in fade-in slide-in-from-left-4 duration-300">
          <MasterTab title="Class" apiPath="classes" icon={<Database size={18} />} />
        </Tabs.Content>

        <Tabs.Content value="category" className="animate-in fade-in slide-in-from-right-4 duration-300">
          <MasterTab title="Category" apiPath="categories" icon={<Users size={18} />} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
