import React, { useState, useEffect } from 'react';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import { 
  RefreshCw, Download, CheckCircle2, AlertCircle, Loader2, 
  Calendar, User, Search, Filter, Plus, 
  Clock, MapPin, Building2, Layers, Briefcase, 
  ChevronDown, AlertTriangle, MoreHorizontal, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useModule } from '../../contexts/ModuleContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LeaveConfig {
  id: number;
  leave_name: string;
  credit_type: string;
  leave_value: number;
  multiplier: number;
  status: number;
}

interface LeaveCreditPreview {
  emp_id: number;
  emp_code: string;
  emp_name: string;
  current_balance: number;
  calculated_credit: number;
}

export default function LeaveCreditEntry() {
  const { currentMode } = useModule();
  const [previews, setPreviews] = useState<LeaveCreditPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Filters
  const [deptId, setDeptId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [leaveConfigId, setLeaveConfigId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  // Master Data
  const [departments, setDepartments] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [leaveConfigs, setLeaveConfigs] = useState<LeaveConfig[]>([]);

  useEffect(() => {
    fetchMasterData();
  }, [currentMode]);

  const fetchMasterData = async () => {
    try {
      const data = await fetchApi<any>('/api/master-data/get-master-data', { method: 'POST', body: JSON.stringify({ moduleType: currentMode }) });
      setDepartments(Array.isArray(data.departments) ? data.departments : []);
      setLocations(Array.isArray(data.locations) ? data.locations : []);
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      
      const configs = await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({ 
        tableName: 'leave_configurations', 
        operation: 'list', 
        moduleType: currentMode 
      }) });
      setLeaveConfigs(configs.filter(c => c.status === 1));
    } catch (err) {
      toast.error("Failed to load master data");
    }
  };

  const handlePreview = async () => {
    if (!leaveConfigId) {
      toast.error("Please select a Leave Type");
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchApi('/api/employee/cmd/getLeaveCreditPreview', { method: 'POST', body: JSON.stringify({
        leaveConfigId: parseInt(leaveConfigId),
        deptId: deptId ? parseInt(deptId) : null,
        locationId: locationId ? parseInt(locationId) : null,
        categoryId: categoryId ? parseInt(categoryId) : null,
        effectiveDate,
        moduleType: currentMode
      }) });
      setPreviews(data);
    } catch (err) {
      toast.error("Failed to fetch preview");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostCredits = async () => {
    if (previews.length === 0) {
      toast.error("No credits to post. Run preview first.");
      return;
    }
    setIsPosting(true);
    try {
      await fetchApi('/api/employee/cmd/postLeaveCredits', { method: 'POST', body: JSON.stringify({
        leaveConfigId: parseInt(leaveConfigId),
        effectiveDate,
        credits: previews.map(p => ({
          emp_id: p.emp_id,
          amount: p.calculated_credit
        })),
        moduleType: currentMode
      })});
      toast.success("Leave credits posted successfully");
      setPreviews([]);
    } catch (err) {
      toast.error("Failed to post credits");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Leave Credit Entry</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Transactions // Leave Management</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handlePostCredits}
            disabled={isPosting || previews.length === 0}
            className="app-btn app-btn-primary flex items-center gap-2"
          >
            {isPosting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Post Credits
          </button>
        </div>
      </div>

      {/* Filters & Config */}
      <div className="textile-card p-6 bg-white border-app-border">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
              <MapPin size={12} /> Location
            </label>
            <select 
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="app-input text-sm"
            >
              <option value="">All Locations</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
              <Building2 size={12} /> Department
            </label>
            <select 
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              className="app-input text-sm"
            >
              <option value="">All Departments</option>
              {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
              <Layers size={12} /> Category
            </label>
            <select 
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="app-input text-sm"
            >
              <option value="">All Categories</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
              <Clock size={12} /> Leave Type
            </label>
            <select 
              value={leaveConfigId}
              onChange={(e) => setLeaveConfigId(e.target.value)}
              className="app-input text-sm"
            >
              <option value="">Select Leave Type</option>
              {leaveConfigs.map(config => <option key={config.id} value={config.id}>{config.leave_name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
              <Calendar size={12} /> Effective Date
            </label>
            <div className="flex gap-2">
              <input 
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="app-input text-sm"
              />
              <button 
                onClick={handlePreview}
                disabled={isLoading}
                className="app-btn app-btn-secondary p-2"
                title="Preview Credits"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="textile-card bg-white border-app-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-app-border">
                <th className="px-6 py-4 text-[10px] font-mono text-text-muted uppercase tracking-widest">Emp Code</th>
                <th className="px-6 py-4 text-[10px] font-mono text-text-muted uppercase tracking-widest">Employee Name</th>
                <th className="px-6 py-4 text-[10px] font-mono text-text-muted uppercase tracking-widest text-right">Current Balance</th>
                <th className="px-6 py-4 text-[10px] font-mono text-text-muted uppercase tracking-widest text-right">Calculated Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {previews.length > 0 ? (
                previews.map((item) => (
                  <tr key={item.emp_id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono font-bold text-primary-navy bg-gray-100 px-2 py-1 rounded">
                        {item.emp_code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-navy/10 flex items-center justify-center text-primary-navy font-bold text-xs">
                          {item.emp_name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-primary-navy">{item.emp_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-mono text-text-muted">{item.current_balance.toFixed(1)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-mono font-bold text-green-600">+{item.calculated_credit.toFixed(1)}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-text-muted">
                      <Search size={48} className="opacity-20" />
                      <p className="text-sm">No data to display. Select filters and click preview.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
