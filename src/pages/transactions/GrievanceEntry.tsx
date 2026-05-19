import React, { useState, useEffect, useMemo } from 'react';
import { invokeCommand as invoke } from '../../services/apiClient';
import { 
  User, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Calendar,
  ShieldAlert,
  Save,
  UserCheck,
  EyeOff,
  MessageSquare,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { useModule } from '../../contexts/ModuleContext';
import { Employee } from '../../types';
import EmployeeSearchSelect from '../../components/form/EmployeeSearchSelect';

interface GrievanceCategory {
  id: number;
  name: string;
  criticality: 'Low' | 'Medium' | 'High' | 'Critical';
  resolution_limit_days: number;
  status?: number;
}

export default function GrievanceEntry() {
  const { currentMode } = useModule();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<GrievanceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    fetchMasterData();
  }, [currentMode]);

  const fetchMasterData = async () => {
    setIsLoading(true);
    try {
      const [empData, catData] = await Promise.all([
        invoke<Employee[]>('master_crud', { tableName: 'employees', operation: 'list', moduleType: currentMode }),
        invoke<GrievanceCategory[]>('master_crud', { tableName: 'grievance_categories', operation: 'list', moduleType: currentMode })
      ]);
      setEmployees(empData);
      setCategories(catData.filter(c => c.status === 1 || (c as any).status === undefined));
    } catch (err) {
      toast.error("Failed to load master data");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id.toString() === selectedCategoryId);
  }, [selectedCategoryId, categories]);

  const expectedResolutionDate = useMemo(() => {
    if (!selectedCategory) return null;
    return addDays(new Date(), selectedCategory.resolution_limit_days);
  }, [selectedCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId && !isAnonymous) {
      toast.error("Please select an employee or check 'Remain Anonymous'");
      return;
    }
    if (!selectedCategoryId) {
      toast.error("Please select a grievance category");
      return;
    }
    if (!description.trim()) {
      toast.error("Please provide a description");
      return;
    }

    setIsSaving(true);
    try {
      await invoke('master_crud', {
        tableName: 'grievances',
        operation: 'create',
        data: {
          employee_id: isAnonymous ? null : parseInt(selectedEmpId),
          category_id: parseInt(selectedCategoryId),
          description,
          is_anonymous: isAnonymous ? 1 : 0,
          expected_resolution_date: expectedResolutionDate ? format(expectedResolutionDate, 'yyyy-MM-dd') : null,
          status: 'OPEN'
        },
        moduleType: currentMode
      });
      toast.success("Grievance submitted successfully");
      resetForm();
    } catch (err) {
      toast.error("Failed to submit grievance");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedEmpId('');
    setSelectedCategoryId('');
    setDescription('');
    setIsAnonymous(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Grievance Entry</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Transactions // Employee Relations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="textile-card p-8 bg-white border-app-border">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Employee Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                    <User size={12} /> Employee Information
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-4 h-4 rounded border-app-border text-primary-navy focus:ring-primary-navy"
                    />
                    <span className="text-xs font-medium text-text-muted group-hover:text-primary-navy transition-colors flex items-center gap-1">
                      <EyeOff size={14} /> Remain Anonymous
                    </span>
                  </label>
                </div>

                {!isAnonymous && (
                  <EmployeeSearchSelect 
                    label="Employee Information"
                    employees={employees}
                    selectedIds={selectedEmpId ? [parseInt(selectedEmpId)] : []}
                    onChange={(ids) => setSelectedEmpId(ids[0]?.toString() || '')}
                    placeholder="Search by Employee Code or Name..."
                  />
                )}
              </div>

              {/* Category & Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldAlert size={12} /> Grievance Category
                  </label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="app-input h-12"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={12} /> Expected Resolution
                  </label>
                  <div className="app-input h-12 bg-gray-50 flex items-center px-4 font-mono text-sm text-primary-navy">
                    {expectedResolutionDate ? format(expectedResolutionDate, 'PPP') : 'Select category to calculate...'}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                  <MessageSquare size={12} /> Detailed Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="app-input min-h-[200px] p-4 text-base leading-relaxed"
                  placeholder="Please describe the grievance in detail. Include dates, locations, and any witnesses if applicable..."
                />
              </div>

              <div className="pt-4 border-t border-app-border flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="app-btn app-btn-primary flex items-center gap-2 px-8 h-12"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Submit Grievance
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {selectedCategory && (
            <div className={`textile-card p-6 border-l-4 animate-in zoom-in-95 duration-300 ${
              selectedCategory.criticality === 'Critical' || selectedCategory.criticality === 'High' 
                ? 'border-l-red-600 bg-red-50/30' 
                : 'border-l-primary-navy bg-white'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-primary-navy uppercase tracking-wider text-sm">Category Insight</h3>
                { (selectedCategory.criticality === 'High' || selectedCategory.criticality === 'Critical') && (
                  <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded animate-pulse">
                    URGENT
                  </span>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-app-border flex items-center justify-center text-primary-navy shadow-sm">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-text-muted uppercase">Criticality</p>
                    <p className={`text-sm font-bold ${
                      selectedCategory.criticality === 'Critical' ? 'text-red-700' :
                      selectedCategory.criticality === 'High' ? 'text-orange-700' :
                      'text-primary-navy'
                    }`}>{selectedCategory.criticality}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-app-border flex items-center justify-center text-primary-navy shadow-sm">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-text-muted uppercase">SLA Limit</p>
                    <p className="text-sm font-bold text-primary-navy">{selectedCategory.resolution_limit_days} Working Days</p>
                  </div>
                </div>

                <div className="p-3 bg-white/50 rounded-md border border-app-border/50">
                  <p className="text-[10px] text-text-muted leading-relaxed italic">
                    "This grievance will be routed to the appropriate department for resolution within the specified SLA. You will receive updates on your registered contact."
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="textile-card p-6 bg-primary-navy text-white">
            <h3 className="font-bold uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
              <AlertCircle size={18} /> Important Note
            </h3>
            <ul className="space-y-3 text-xs opacity-90 leading-relaxed list-disc pl-4">
              <li>Anonymous submissions are handled with strict confidentiality.</li>
              <li>Please provide as much detail as possible to expedite resolution.</li>
              <li>False reporting may lead to disciplinary action as per company policy.</li>
              <li>You can track the status of your grievance in the 'Grievance Tracking' section.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
