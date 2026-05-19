import React, { useState, useEffect } from 'react';
import { invokeCommand as invoke } from '../../services/apiClient';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  Calculator,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

import { useModule } from '../../contexts/ModuleContext';

interface LoanSlab {
  id?: number;
  min_months: number;
  max_months: number | null;
  multiplier: number;
  max_tenure: number;
}

interface LoanType {
  id: number;
  name: string;
  description: string;
  allowed_classes: string;
  allowed_categories: string;
  interest_rate: number;
  interest_applicability?: string;
  flexibility_in_policy?: number;
  status: number;
  created_at: string;
  slabs: LoanSlab[];
}

interface MasterData {
  id: number;
  name: string;
  status: number;
}

export default function LoanTypes() {
  const { currentMode } = useModule();
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  const [classes, setClasses] = useState<MasterData[]>([]);
  const [categories, setCategories] = useState<MasterData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    allowed_classes: [] as number[],
    allowed_categories: [] as number[],
    interest_rate: 0,
    interest_applicability: 'Notional Earning',
    flexibility_in_policy: false,
    status: true,
    slabs: [
      { min_months: 0, max_months: 6, multiplier: 0, max_tenure: 0 },
      { min_months: 6, max_months: 12, multiplier: 1, max_tenure: 3 },
      { min_months: 12, max_months: null, multiplier: 2, max_tenure: 4 }
    ] as LoanSlab[]
  });

  useEffect(() => {
    fetchLoanTypes();
    fetchMasterData();
  }, [currentMode]);

  const fetchLoanTypes = async () => {
    try {
      const data = await invoke<LoanType[]>('master_crud', {
        tableName: 'loan_types',
        operation: 'list',
        moduleType: currentMode
      });
      setLoanTypes(Array.isArray(data) ? data.map(item => ({
        ...item,
        slabs: typeof item.slabs === 'string' ? JSON.parse(item.slabs) : (item.slabs || [])
      })) : []);
    } catch (error) {
      toast.error('Failed to fetch loan types');
    }
  };

  const fetchMasterData = async () => {
    try {
      const [classesData, categoriesData] = await Promise.all([
        invoke<MasterData[]>('master_crud', { tableName: 'classes', operation: 'list', moduleType: currentMode }),
        invoke<MasterData[]>('master_crud', { tableName: 'categories', operation: 'list', moduleType: currentMode })
      ]);
      setClasses(Array.isArray(classesData) ? classesData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      toast.error('Failed to fetch master data');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...formData,
        interest_applicability: formData.interest_applicability,
        flexibility_in_policy: formData.flexibility_in_policy ? 1 : 0,
        allowed_classes: formData.allowed_classes.join(','),
        allowed_categories: formData.allowed_categories.join(','),
        slabs: JSON.stringify(formData.slabs),
        status: formData.status ? 1 : 0
      };

      await invoke('master_crud', {
        tableName: 'loan_types',
        operation: editingId ? 'update' : 'create',
        id: editingId,
        data: dataToSave,
        moduleType: currentMode
      });

      toast.success(editingId ? 'Loan type updated' : 'Loan type created');
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        allowed_classes: [],
        allowed_categories: [],
        interest_rate: 0,
        interest_applicability: 'Notional Earning',
        flexibility_in_policy: false,
        status: true,
        slabs: [
          { min_months: 0, max_months: 6, multiplier: 0, max_tenure: 0 },
          { min_months: 6, max_months: 12, multiplier: 1, max_tenure: 3 },
          { min_months: 12, max_months: null, multiplier: 2, max_tenure: 4 }
        ]
      });
      fetchLoanTypes();
    } catch (error) {
      toast.error('Failed to save loan type');
    }
  };

  const handleEdit = (type: LoanType) => {
    setEditingId(type.id);
    setFormData({
      name: type.name,
      description: type.description,
      allowed_classes: type.allowed_classes ? type.allowed_classes.split(',').map(Number) : [],
      allowed_categories: type.allowed_categories ? type.allowed_categories.split(',').map(Number) : [],
      interest_rate: type.interest_rate || 0,
      interest_applicability: type.interest_applicability || 'Notional Earning',
      flexibility_in_policy: !!type.flexibility_in_policy,
      status: !!type.status,
      slabs: type.slabs || []
    });
    setIsModalOpen(true);
  };

  const addSlab = () => {
    setFormData({
      ...formData,
      slabs: [...formData.slabs, { min_months: 0, max_months: null, multiplier: 0, max_tenure: 0 }]
    });
  };

  const removeSlab = (index: number) => {
    setFormData({
      ...formData,
      slabs: formData.slabs.filter((_, i) => i !== index)
    });
  };

  const updateSlab = (index: number, field: keyof LoanSlab, value: any) => {
    const newSlabs = [...formData.slabs];
    newSlabs[index] = { ...newSlabs[index], [field]: value };
    setFormData({ ...formData, slabs: newSlabs });
  };

  const toggleSelection = (field: 'allowed_classes' | 'allowed_categories', id: number) => {
    const current = [...formData[field]];
    if (current.includes(id)) {
      setFormData({ ...formData, [field]: current.filter(i => i !== id) });
    } else {
      setFormData({ ...formData, [field]: [...current, id] });
    }
  };

  const handleDelete = async (type: LoanType) => {
    if (!confirm(`Are you sure you want to delete ${type.name}?`)) return;
    try {
      await invoke('master_crud', {
        tableName: 'loan_types',
        operation: 'delete',
        id: type.id,
        moduleType: currentMode
      });
      toast.success('Loan type deleted');
      fetchLoanTypes();
    } catch (error) {
      toast.error('Failed to delete loan type');
    }
  };

  const getNamesFromIds = (idsString: string, masterData: MasterData[]) => {
    if (!idsString) return 'None';
    const ids = idsString.split(',').map(Number);
    const names = masterData
      .filter(item => ids.includes(item.id))
      .map(item => item.name);
    return names.length > 0 ? names.join(', ') : 'None';
  };

  const filteredTypes = loanTypes.filter(t => 
    (t.name || "").toLowerCase().includes((searchTerm || "").toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Loan Types</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">HR-Settings // Loan Parameters</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({
              name: '',
              description: '',
              allowed_classes: [],
              allowed_categories: [],
              interest_rate: 0,
              status: true,
              interest_applicability: 'Notional Earning',
              flexibility_in_policy: false,
              slabs: [
                { min_months: 0, max_months: 6, multiplier: 0, max_tenure: 0 },
                { min_months: 6, max_months: 12, multiplier: 1, max_tenure: 3 },
                { min_months: 12, max_months: null, multiplier: 2, max_tenure: 4 }
              ]
            });
            setIsModalOpen(true);
          }}
          className="app-btn app-btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Define New Loan Type
        </button>
      </div>

      <div className="textile-card p-4 bg-white border-app-border flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input 
            type="text" 
            placeholder="Search loan types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-app-border rounded-md text-sm focus:outline-none focus:border-primary-navy transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTypes.map((type) => (
          <div key={type.id} className="textile-card bg-white border-app-border overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-slate-50 rounded-lg border border-app-border group-hover:bg-primary-navy/5 transition-colors">
                  <Calculator className="text-primary-navy" size={24} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(type)} className="p-2 text-text-muted hover:text-primary-navy hover:bg-primary-navy/5 rounded-md transition-all">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(type)} className="p-2 text-text-muted hover:text-primary-red hover:bg-primary-red/5 rounded-md transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-primary-navy textile-header">{type.name}</h3>
                <p className="text-xs text-text-muted line-clamp-2 mt-1">{type.description}</p>
              </div>

              <div className="space-y-4 pt-4 border-t border-app-border">
                <div>
                  <p className="text-[10px] font-mono text-text-muted uppercase mb-2">Applicability Slabs</p>
                  <div className="space-y-2">
                    {type.slabs?.map((slab, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-app-border text-[11px]">
                        <span className="font-mono text-primary-navy">
                          {slab.min_months}-{slab.max_months || '∞'} Mo
                        </span>
                        <span className="font-bold text-primary-navy">{slab.multiplier}x Multiplier</span>
                        <span className="text-text-muted">{slab.max_tenure} Mo Tenure</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-text-muted uppercase">Allowed Classes</p>
                    <p className="text-[11px] font-bold text-primary-navy line-clamp-1">
                      {getNamesFromIds(type.allowed_classes, classes)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-text-muted uppercase">Allowed Categories</p>
                    <p className="text-[11px] font-bold text-primary-navy line-clamp-1">
                      {getNamesFromIds(type.allowed_categories, categories)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-primary-navy/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl rounded-xl shadow-2xl border border-app-border overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-app-border flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="textile-header text-xl font-bold text-primary-navy">
                {editingId ? 'Edit Loan Type' : 'Define New Loan Type'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-primary-navy transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* Top Section - 3 Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Column 1 */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Loan Type Name</label>
                      <input 
                        required
                        type="text" 
                        value={formData.name || ''}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full p-3 bg-slate-50 border border-app-border rounded-md text-sm focus:outline-none focus:border-primary-navy transition-colors"
                        placeholder="e.g., Personal Loan, Emergency Loan"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Description</label>
                      <textarea 
                        value={formData.description || ''}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full p-3 bg-slate-50 border border-app-border rounded-md text-sm focus:outline-none focus:border-primary-navy transition-colors h-[116px] resize-none"
                        placeholder="Brief description of the loan purpose..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Interest (%)</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={Number.isNaN(formData.interest_rate) ? '' : formData.interest_rate}
                          onChange={(e) => setFormData({...formData, interest_rate: parseFloat(e.target.value) || 0})}
                          className="w-full p-3 bg-slate-50 border border-app-border rounded-md text-sm focus:outline-none focus:border-primary-navy transition-colors"
                          placeholder="e.g., 5.5"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest leading-tight block truncate" title="Interest Rate Applicability">Applicability</label>
                        <select 
                          value={formData.interest_applicability}
                          onChange={(e) => setFormData({...formData, interest_applicability: e.target.value})}
                          className="w-full p-3 bg-slate-50 border border-app-border rounded-md text-sm focus:outline-none focus:border-primary-navy"
                        >
                          <option value="Notional Earning">Notional Earning</option>
                          <option value="Actual Earning">Actual Earning</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Column 2 */}
                  <div className="space-y-6 flex flex-col">
                    <div className="space-y-2 flex-1">
                      <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest block">Allowed Classes</label>
                      <div className="grid grid-cols-2 gap-2 h-[220px] overflow-y-auto p-3 bg-slate-50 border border-app-border rounded-md">
                        {classes.filter(c => c.status === 1 || formData.allowed_classes.includes(c.id)).map(c => (
                          <label key={c.id} className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox"
                              checked={formData.allowed_classes.includes(c.id)}
                              onChange={() => toggleSelection('allowed_classes', c.id)}
                              className="w-4 h-4 text-primary-navy border-app-border rounded focus:ring-primary-navy"
                            />
                            <span className="text-xs text-primary-navy group-hover:text-primary-navy/70 transition-colors">{c.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer group pt-2 shrink-0">
                      <input 
                        type="checkbox"
                        checked={formData.flexibility_in_policy}
                        onChange={(e) => setFormData({...formData, flexibility_in_policy: e.target.checked})}
                        className="w-4 h-4 mt-0.5 text-primary-navy border-app-border rounded focus:ring-primary-navy"
                      />
                      <div>
                        <span className="text-sm font-bold text-primary-navy">Flexibility in policy</span>
                        <p className="text-[10px] text-text-muted mt-1 leading-relaxed">System allows override when saving/approving if eligibility is not met.</p>
                      </div>
                    </label>
                  </div>

                  {/* Column 3 */}
                  <div className="space-y-6 flex flex-col">
                    <div className="space-y-2 flex-1">
                      <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest block">Allowed Categories</label>
                      <div className="grid grid-cols-2 gap-2 h-[220px] overflow-y-auto p-3 bg-slate-50 border border-app-border rounded-md">
                        {categories.filter(c => c.status === 1 || formData.allowed_categories.includes(c.id)).map(c => (
                          <label key={c.id} className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox"
                              checked={formData.allowed_categories.includes(c.id)}
                              onChange={() => toggleSelection('allowed_categories', c.id)}
                              className="w-4 h-4 text-primary-navy border-app-border rounded focus:ring-primary-navy"
                            />
                            <span className="text-xs text-primary-navy group-hover:text-primary-navy/70 transition-colors">{c.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2 shrink-0">
                      <input 
                        type="checkbox" 
                        id="status"
                        checked={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.checked})}
                        className="w-4 h-4 text-primary-navy border-app-border rounded focus:ring-primary-navy"
                      />
                      <label htmlFor="status" className="text-sm font-bold text-primary-navy">Active Type</label>
                    </div>
                  </div>
                </div>

                {/* Bottom Section - Slabs */}
                <div className="pt-6 border-t border-app-border">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Applicability Slabs</label>
                    <button 
                      type="button"
                      onClick={addSlab}
                      className="text-[10px] font-bold text-primary-navy hover:bg-slate-50 border border-app-border px-3 py-1.5 rounded flex items-center gap-1 transition-colors uppercase tracking-widest"
                    >
                      <Plus size={14} /> Add Slab
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto border border-app-border rounded-lg shadow-sm">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-app-border text-[9px] font-mono text-text-muted uppercase tracking-wider">
                          <th className="p-3 w-1/4">Min Months</th>
                          <th className="p-3 w-1/4">Max Months (0 for ∞)</th>
                          <th className="p-3 w-1/4">Multiplier (x Salary)</th>
                          <th className="p-3 w-1/4">Max Tenure (Mo)</th>
                          <th className="p-3 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.slabs.map((slab, idx) => (
                          <tr key={idx} className="border-b border-app-border last:border-0 hover:bg-slate-50/50 transition-colors">
                            <td className="p-2">
                              <input 
                                type="number"
                                value={Number.isNaN(slab.min_months) ? '' : slab.min_months}
                                onChange={(e) => updateSlab(idx, 'min_months', parseInt(e.target.value) || 0)}
                                className="w-full p-2 bg-white border border-app-border rounded text-sm focus:outline-none focus:border-primary-navy"
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                type="number"
                                value={slab.max_months === null ? 0 : slab.max_months}
                                onChange={(e) => updateSlab(idx, 'max_months', parseInt(e.target.value) || null)}
                                className="w-full p-2 bg-white border border-app-border rounded text-sm focus:outline-none focus:border-primary-navy"
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                type="number"
                                step="0.1"
                                value={Number.isNaN(slab.multiplier) ? '' : slab.multiplier}
                                onChange={(e) => updateSlab(idx, 'multiplier', parseFloat(e.target.value) || 0)}
                                className="w-full p-2 bg-white border border-app-border rounded text-sm focus:outline-none focus:border-primary-navy"
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                type="number"
                                value={Number.isNaN(slab.max_tenure) ? '' : slab.max_tenure}
                                onChange={(e) => updateSlab(idx, 'max_tenure', parseInt(e.target.value) || 0)}
                                className="w-full p-2 bg-white border border-app-border rounded text-sm focus:outline-none focus:border-primary-navy"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button 
                                type="button"
                                onClick={() => removeSlab(idx)}
                                className="text-text-muted hover:text-primary-red p-1.5 rounded transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              <div className="flex gap-3 p-6 border-t border-app-border bg-slate-50 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-app-border bg-white text-text-muted font-bold rounded-md hover:bg-slate-100 transition-all text-xs uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-primary-navy text-white font-bold rounded-md hover:bg-primary-navy/90 transition-all text-xs uppercase tracking-widest shadow-md"
                >
                  {editingId ? 'Update Parameters' : 'Save Parameters'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
