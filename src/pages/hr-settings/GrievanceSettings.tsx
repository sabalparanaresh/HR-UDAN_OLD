import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  ShieldAlert,
  Clock,
  Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import { useModule } from '../../contexts/ModuleContext';

interface GrievanceCategory {
  id?: number;
  name: string;
  criticality: 'Low' | 'Medium' | 'High' | 'Critical';
  resolution_limit_days: number;
  escalation_thresholds: string; // JSON string
  status: number;
}

export default function GrievanceSettings() {
  const { currentMode } = useModule();
  const [categories, setCategories] = useState<GrievanceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState<GrievanceCategory>({
    name: '',
    criticality: 'Medium',
    resolution_limit_days: 7,
    escalation_thresholds: JSON.stringify({ level1: 3, level2: 5 }),
    status: 1
  });

  useEffect(() => {
    fetchCategories();
  }, [currentMode]);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<GrievanceCategory[]>('master_crud', {
        tableName: 'grievance_categories',
        operation: 'list',
        moduleType: currentMode
      });
      setCategories(data);
    } catch (err) {
      toast.error("Failed to fetch grievance categories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Category name is required");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await invoke('master_crud', {
          tableName: 'grievance_categories',
          operation: 'update',
          id: editingId,
          data: formData,
          moduleType: currentMode
        });
        toast.success("Category updated successfully");
      } else {
        await invoke('master_crud', {
          tableName: 'grievance_categories',
          operation: 'create',
          data: formData,
          moduleType: currentMode
        });
        toast.success("Category created successfully");
      }
      resetForm();
      fetchCategories();
    } catch (err) {
      toast.error("Failed to save category");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (category: GrievanceCategory) => {
    setEditingId(category.id!);
    setFormData({
      name: category.name,
      criticality: category.criticality,
      resolution_limit_days: category.resolution_limit_days,
      escalation_thresholds: category.escalation_thresholds,
      status: category.status
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await invoke('master_crud', {
        tableName: 'grievance_categories',
        operation: 'delete',
        id,
        moduleType: currentMode
      });
      toast.success("Category deleted successfully");
      fetchCategories();
    } catch (err) {
      toast.error("Failed to delete category");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      criticality: 'Medium',
      resolution_limit_days: 7,
      escalation_thresholds: JSON.stringify({ level1: 3, level2: 5 }),
      status: 1
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Grievance Settings</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">HR Settings // Grievance Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="textile-card p-6 bg-white border-app-border sticky top-6">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b border-app-border">
              <Settings2 className="text-primary-navy" size={20} />
              <h3 className="text-lg font-bold text-primary-navy">
                {editingId ? 'Edit Category' : 'Add New Category'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Category Name</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="app-input"
                  placeholder="e.g. Workplace Safety"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Criticality</label>
                <select
                  value={formData.criticality || 'Low'}
                  onChange={(e) => setFormData({ ...formData, criticality: e.target.value as any })}
                  className="app-input"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Resolution Limit (Days)</label>
                <input
                  type="number"
                  value={formData.resolution_limit_days || 0}
                  onChange={(e) => setFormData({ ...formData, resolution_limit_days: parseInt(e.target.value) })}
                  className="app-input"
                  min="1"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Escalation Thresholds (JSON)</label>
                <textarea
                  value={formData.escalation_thresholds || ''}
                  onChange={(e) => setFormData({ ...formData, escalation_thresholds: e.target.value })}
                  className="app-input font-mono text-xs h-24"
                  placeholder='{"level1": 3, "level2": 5}'
                />
                <p className="text-[10px] text-text-muted mt-1 italic">Define days for Level 1 and Level 2 escalation.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="app-btn app-btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {editingId ? 'Update' : 'Save'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="app-btn app-btn-secondary px-4"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2">
          <div className="textile-card bg-white border-app-border overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-app-border flex justify-between items-center">
              <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wider">Existing Categories</h3>
              <span className="text-[10px] font-mono bg-primary-navy/10 text-primary-navy px-2 py-0.5 rounded-full">
                {categories.length} Total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-app-border">
                    <th className="px-6 py-4 text-[10px] font-mono text-text-muted uppercase tracking-widest">Category</th>
                    <th className="px-6 py-4 text-[10px] font-mono text-text-muted uppercase tracking-widest">Criticality</th>
                    <th className="px-6 py-4 text-[10px] font-mono text-text-muted uppercase tracking-widest text-center">Limit</th>
                    <th className="px-6 py-4 text-[10px] font-mono text-text-muted uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <Loader2 className="animate-spin mx-auto text-primary-navy" size={32} />
                      </td>
                    </tr>
                  ) : categories.length > 0 ? (
                    categories.map((category) => (
                      <tr key={category.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-primary-navy">{category.name}</span>
                            <span className="text-[10px] font-mono text-text-muted">ID: #{category.id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            category.criticality === 'Critical' ? 'bg-red-100 text-red-700' :
                            category.criticality === 'High' ? 'bg-orange-100 text-orange-700' :
                            category.criticality === 'Medium' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            <ShieldAlert size={10} />
                            {category.criticality}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-mono font-bold text-primary-navy">{category.resolution_limit_days}</span>
                            <span className="text-[10px] text-text-muted uppercase">Days</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(category)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(category.id!)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3 text-text-muted">
                          <AlertCircle size={48} className="opacity-20" />
                          <p className="text-sm">No grievance categories defined yet.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
