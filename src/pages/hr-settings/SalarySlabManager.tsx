import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import { 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle, 
  ChevronRight, 
  Calculator,
  Info,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from '../../utils/xlsx';
import { useModule } from '../../contexts/ModuleContext';
import { cn } from '../../lib/utils';
import MasterUsageWarningModal from '../../components/common/MasterUsageWarningModal';

interface SalaryHead {
  id: number;
  name: string;
  type: 'EARNING' | 'DEDUCTION';
  is_part_of_ctc: boolean;
}

interface SlabComponent {
  id?: number;
  salary_head_id: number;
  calculation_type: 'FIXED' | 'PERCENT_CTC' | 'PERCENT_HEAD' | 'RESIDUAL';
  parent_head_id?: number;
  value: number;
}

interface SalarySlab {
  id?: number;
  name: string;
  description: string;
  status: boolean;
  components: SlabComponent[];
}

const SalarySlabManager: React.FC = () => {
  const { currentMode } = useModule();
  const [slabs, setSlabs] = useState<SalarySlab[]>([]);
  const [salaryHeads, setSalaryHeads] = useState<SalaryHead[]>([]);
  const [selectedSlab, setSelectedSlab] = useState<SalarySlab | null>(null);
  const [testSalaryRate, setTestSalaryRate] = useState<number>(50000);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [warningModalProps, setWarningModalProps] = useState<{isOpen: boolean, message?: string, onProceed?: () => void}>({isOpen: false});

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  useEffect(() => {
    fetchSlabs();
    fetchSalaryHeads();
  }, [currentMode]);

  const fetchSlabs = async () => {
    try {
      const data = await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'salary_slabs',
        operation: 'list',
        moduleType: currentMode
      }) });
      
      const processed = (Array.isArray(data) ? data : []).map(slab => {
        let components = [];
        if (Array.isArray(slab.components)) {
          components = slab.components;
        } else if (typeof slab.components === 'string') {
          try {
            components = JSON.parse(slab.components);
            if (!Array.isArray(components)) components = [];
          } catch (e) {
            components = [];
          }
        }
        return {
          ...slab,
          status: slab.status === 1 || slab.status === true,
          components
        };
      });
      
      setSlabs(processed);
    } catch (error) {
      toast.error('Failed to fetch salary slabs');
    }
  };

  const fetchSalaryHeads = async () => {
    try {
      const data = await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'salary_heads',
        operation: 'list',
        moduleType: currentMode
      }) });
      if (Array.isArray(data)) {
        setSalaryHeads(data);
      }
    } catch (error) {
      toast.error('Failed to fetch salary heads');
    }
  };

  const handleCreateNew = () => {
    setSelectedSlab({
      name: '',
      description: '',
      status: true,
      components: []
    });
  };

  const handleAddComponent = () => {
    if (!selectedSlab) return;
    const newComponent: SlabComponent = {
      salary_head_id: salaryHeads[0]?.id || 0,
      calculation_type: 'FIXED',
      value: 0
    };
    setSelectedSlab({
      ...selectedSlab,
      components: [...selectedSlab.components, newComponent]
    });
  };

  const handleRemoveComponent = (index: number) => {
    if (!selectedSlab) return;
    const newComponents = [...selectedSlab.components];
    newComponents.splice(index, 1);
    setSelectedSlab({
      ...selectedSlab,
      components: newComponents
    });
  };

  const handleComponentChange = (index: number, field: keyof SlabComponent, value: any) => {
    if (!selectedSlab) return;
    const newComponents = [...selectedSlab.components];
    newComponents[index] = { ...newComponents[index], [field]: value };
    
    // Reset parent_head_id if calculation type is not PERCENT_HEAD
    if (field === 'calculation_type' && value !== 'PERCENT_HEAD') {
      delete newComponents[index].parent_head_id;
    }

    setSelectedSlab({
      ...selectedSlab,
      components: newComponents
    });
  };

  const calculateBreakdown = useMemo(() => {
    if (!selectedSlab || !Array.isArray(selectedSlab.components)) return [];
    
    const breakdown: { headName: string; formula: string; amount: number }[] = [];
    let totalNonResidual = 0;
    const headAmounts: Record<number, number> = {};

    // First pass: Calculate non-residual components
    selectedSlab.components.forEach((comp) => {
      if (comp.calculation_type === 'RESIDUAL') return;

      const head = salaryHeads.find(h => h.id === comp.salary_head_id);
      let amount = 0;
      let formula = '';

      if (comp.calculation_type === 'FIXED') {
        amount = comp.value;
        formula = `Fixed: ${amount.toLocaleString()}`;
      } else if (comp.calculation_type === 'PERCENT_CTC') {
        amount = (testSalaryRate * comp.value) / 100;
        formula = `${comp.value}% of CTC (${testSalaryRate.toLocaleString()})`;
      } else if (comp.calculation_type === 'PERCENT_HEAD' && comp.parent_head_id) {
        const parentAmount = headAmounts[comp.parent_head_id] || 0;
        const parentHead = salaryHeads.find(h => h.id === comp.parent_head_id);
        amount = (parentAmount * comp.value) / 100;
        formula = `${comp.value}% of ${parentHead?.name || 'Unknown'} (${parentAmount.toLocaleString()})`;
      }

      headAmounts[comp.salary_head_id] = amount;
      totalNonResidual += amount;
      breakdown.push({
        headName: head?.name || 'Unknown',
        formula,
        amount
      });
    });

    // Second pass: Calculate residual components
    selectedSlab.components.forEach((comp) => {
      if (comp.calculation_type !== 'RESIDUAL') return;

      const head = salaryHeads.find(h => h.id === comp.salary_head_id);
      const amount = Math.max(0, testSalaryRate - totalNonResidual);
      const formula = `Residual (CTC - ${totalNonResidual.toLocaleString()})`;

      breakdown.push({
        headName: head?.name || 'Unknown',
        formula,
        amount
      });
    });

    return breakdown;
  }, [selectedSlab, testSalaryRate, salaryHeads]);

  const totalAmount = calculateBreakdown.reduce((sum, item) => sum + item.amount, 0);
  const totalNonResidual = (selectedSlab && Array.isArray(selectedSlab.components)) 
    ? selectedSlab.components
        .filter(c => c.calculation_type !== 'RESIDUAL')
        .reduce((sum, comp) => {
          if (comp.calculation_type === 'FIXED') return sum + comp.value;
          if (comp.calculation_type === 'PERCENT_CTC') return sum + (testSalaryRate * comp.value) / 100;
          if (comp.calculation_type === 'PERCENT_HEAD' && comp.parent_head_id) {
            // This is a bit complex for a simple sum, but let's approximate or use the breakdown
            const item = calculateBreakdown.find(b => b.headName === salaryHeads.find(h => h.id === comp.salary_head_id)?.name);
            return sum + (item?.amount || 0);
          }
          return sum;
        }, 0)
    : 0;

  const isOverLimit = totalNonResidual > testSalaryRate;

  const processSave = async () => {
    try {
      if (!selectedSlab) return;
      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'salary_slabs',
        operation: selectedSlab.id ? 'update' : 'create',
        id: selectedSlab.id,
        data: {
          name: selectedSlab.name,
          description: selectedSlab.description,
          status: selectedSlab.status ? 1 : 0,
          components: selectedSlab.components
        },
        moduleType: currentMode
      }) });

      toast.success(`Salary slab ${selectedSlab.id ? 'updated' : 'created'} successfully ${currentMode === 'K' ? '(Auto-synced to P)' : ''}`);
      fetchSlabs();
      setSelectedSlab(null);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save salary slab');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSlab) return;
    if (!selectedSlab.name) {
      toast.error('Slab name is required');
      return;
    }

    setLoading(true);

    if (selectedSlab.id) {
       try {
           const respData = await fetchApi('/api/system/cmd/getMasterUsage', { method: 'POST', body: JSON.stringify({ table: 'salary_slabs', id: selectedSlab.id, moduleType: currentMode }) });
           
           if (respData && respData.usageCount > 0) {
               setWarningModalProps({
                 isOpen: true,
                 message: `This slab is currently linked to employees and used in transactions. Altering it will create a variance in reports. Updating this slab will overwrite previous settings for any future recalculations. Update from Current Date?`,
                 onProceed: () => {
                   setWarningModalProps({isOpen: false});
                   processSave();
                 }
               });
               setLoading(false);
               return;
           }
       } catch (err) {
           console.error("Usage check failed", err);
       }
    }
    
    await processSave();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this slab?')) return;

    try {
      await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
        tableName: 'salary_slabs',
        operation: 'delete',
        id,
        moduleType: currentMode
      }) });

      toast.success('Salary slab deleted successfully');
      fetchSlabs();
      if (selectedSlab?.id === id) setSelectedSlab(null);
    } catch (error) {
      toast.error('Failed to delete salary slab');
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'name', 'description', 'status',
      'Salary Head 1', 'Calc Type 1', 'Value (%) / Amount 1', 'Parent Head 1',
      'Salary Head 2', 'Calc Type 2', 'Value (%) / Amount 2', 'Parent Head 2',
      'Salary Head 3', 'Calc Type 3', 'Value (%) / Amount 3', 'Parent Head 3',
      'Salary Head 4', 'Calc Type 4', 'Value (%) / Amount 4', 'Parent Head 4',
      'Salary Head 5', 'Calc Type 5', 'Value (%) / Amount 5', 'Parent Head 5'
    ];
    
    const example = [
      'Standard Executive Slab', 
      'Base structure for executives', 
      '1', 
      'BASIC', '% of CTC', '60', '',
      'BONUS', '% of Head', '8.33', 'BASIC',
      'LEAVE', '% of CTC', '5', '',
      'CONVEYANCE', '% of CTC', '10', '',
      'HRA', 'Residual', '', ''
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    
    // Set column widths for better readability
    const wscols = [
      { wch: 25 }, { wch: 30 }, { wch: 8 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Salary Slab Template");
    XLSX.writeFile(wb, "Salary_Slabs_Template.xlsx");
    toast.success("Template downloaded successfully");
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;
      
      try {
        const wb = await XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Use header: 1 to get array of arrays for easier column indexing
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (rows.length <= 1) {
          toast.error("No data found in the file");
          setLoading(false);
          return;
        }

        const headers = rows[0].map(h => String(h).trim().toLowerCase());
        
        // Map common variations of calculation types
        const mapCalcType = (type: any): SlabComponent['calculation_type'] => {
          const s = String(type || '').toUpperCase().trim();
          if (s.includes('FIXED')) return 'FIXED';
          if (s.includes('% OF CTC') || s.includes('PERCENT_CTC')) return 'PERCENT_CTC';
          if (s.includes('% OF HEAD') || s.includes('PERCENT_HEAD')) return 'PERCENT_HEAD';
          if (s.includes('RESIDUAL')) return 'RESIDUAL';
          return 'FIXED'; // Default
        };

        const missingHeads = new Set<string>();

        const findHeadId = (name: any) => {
          if (!name) return undefined;
          const s = String(name).trim().toLowerCase().replace(/\s+/g, ' ');
          const head = salaryHeads.find(h => String(h.name || '').toLowerCase().trim().replace(/\s+/g, ' ') === s);
          if (!head) missingHeads.add(String(name));
          return head?.id;
        };

        const slabsData = rows.slice(1).map(row => {
          const name = row[0];
          if (!name) return null;
          
          const description = row[1] || '';
          const status = String(row[2]).toLowerCase() === 'active' || row[2] == '1' ? 1 : 0;

          const components: SlabComponent[] = [];
          
          // Process up to 10 potential component slots (image shows 5, but let's be flexible)
          for (let i = 0; i < 10; i++) {
            const baseIdx = 3 + (i * 4);
            if (baseIdx >= row.length) break;

            const headName = row[baseIdx];
            if (!headName) continue;

            const calcTypeStr = row[baseIdx + 1];
            const valueVal = row[baseIdx + 2];
            const parentHeadName = row[baseIdx + 3];

            const headId = findHeadId(headName);
            if (!headId) {
              console.warn(`Salary Head "${headName}" not found. Skipping component.`);
              continue;
            }

            const component: SlabComponent = {
              salary_head_id: headId,
              calculation_type: mapCalcType(calcTypeStr),
              value: parseFloat(valueVal) || 0
            };

            if (component.calculation_type === 'PERCENT_HEAD' && parentHeadName) {
              const pId = findHeadId(parentHeadName);
              if (pId) component.parent_head_id = pId;
            }

            components.push(component);
          }

          return {
            name,
            description,
            status,
            components: JSON.stringify(components)
          };
        }).filter(Boolean);

        if (slabsData.length === 0) {
          toast.error("No valid salary slab data found");
          setLoading(false);
          return;
        }

        if (missingHeads.size > 0) {
          toast.warning(`Note: Some salary heads were not found: ${Array.from(missingHeads).join(', ')}. These components were skipped.`);
        }

        const CHUNK_SIZE = 500;
        const total = slabsData.length;
        
        for (let i = 0; i < total; i += CHUNK_SIZE) {
          const chunk = slabsData.slice(i, i + CHUNK_SIZE);
          await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
            tableName: 'salary_slabs',
            operation: 'bulk_create',
            data: chunk,
            moduleType: currentMode
          }) });
        }
        
        toast.success(`Bulk upload successful (${slabsData.length} records processed)`);
        fetchSlabs();
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(err.error || "Bulk upload failed. Ensure headers follow the template.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-indigo-600" />
            Salary Slab Manager
          </h1>
          <p className="text-gray-500 mt-1">Define and manage salary structures for employees</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm p-1">
            <button 
              onClick={downloadTemplate}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-md transition-all flex items-center gap-2 text-xs font-bold"
              title="Download Template"
            >
              <Download size={16} />
              <span className="hidden sm:inline">TEMPLATE</span>
            </button>
            <div className="w-[1px] h-4 bg-gray-200 mx-1" />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-md transition-all flex items-center gap-2 text-xs font-bold"
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

          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create New Slab
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Slab List */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-semibold text-gray-700">Defined Slabs</h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[calc(100vh-250px)] overflow-y-auto">
              {slabs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  No slabs defined yet
                </div>
              ) : (
                slabs.map((slab) => (
                  <div
                    key={slab.id}
                    onClick={() => setSelectedSlab(slab)}
                    className={`p-4 cursor-pointer transition-all hover:bg-indigo-50/30 group ${
                      selectedSlab?.id === slab.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className={`font-medium ${selectedSlab?.id === slab.id ? 'text-indigo-700' : 'text-gray-900'}`}>
                          {slab.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{slab.description}</p>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(slab.id!);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        slab.status ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {slab.status ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {Array.isArray(slab.components) ? slab.components.length : 0} Components
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Slab Builder */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {selectedSlab ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-700">
                    {selectedSlab.id ? 'Edit Slab' : 'New Slab Builder'}
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedSlab(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {loading ? 'Saving...' : 'Save Slab'}
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-700">Slab Name</label>
                      <input
                        type="text"
                        value={selectedSlab.name || ''}
                        onChange={(e) => setSelectedSlab({ ...selectedSlab, name: e.target.value })}
                        placeholder="e.g., Standard Executive Slab"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-700">Test Salary Rate (CTC)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                        <input
                          type="number"
                          value={testSalaryRate || 0}
                          onChange={(e) => setTestSalaryRate(Number(e.target.value))}
                          className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-xs font-medium text-gray-700">Description</label>
                      <textarea
                        value={selectedSlab.description || ''}
                        onChange={(e) => setSelectedSlab({ ...selectedSlab, description: e.target.value })}
                        placeholder="Briefly describe this slab structure..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* Components List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        Salary Components
                        <span className="text-[10px] font-normal px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                          {Array.isArray(selectedSlab.components) ? selectedSlab.components.length : 0}
                        </span>
                      </h3>
                      <button
                        onClick={handleAddComponent}
                        className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Component
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(!Array.isArray(selectedSlab.components) || selectedSlab.components.length === 0) ? (
                        <div className="p-8 border-2 border-dashed border-gray-100 rounded-xl text-center text-gray-400">
                          No components added. Click "Add Component" to start.
                        </div>
                      ) : (
                        selectedSlab.components.map((comp, index) => (
                          <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-12 gap-4 items-end">
                            <div className="col-span-3 space-y-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Salary Head</label>
                              <select
                                value={comp.salary_head_id || ''}
                                onChange={(e) => handleComponentChange(index, 'salary_head_id', Number(e.target.value))}
                                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="">Select Head</option>
                                {salaryHeads.map(head => (
                                  <option key={head.id} value={head.id}>{head.name}</option>
                                ))}
                              </select>
                            </div>

                            <div className="col-span-3 space-y-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Calc Type</label>
                              <select
                                value={comp.calculation_type || 'FIXED'}
                                onChange={(e) => handleComponentChange(index, 'calculation_type', e.target.value)}
                                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="FIXED">Fixed Amount</option>
                                <option value="PERCENT_CTC">% of CTC</option>
                                <option value="PERCENT_HEAD">% of Head</option>
                                <option value="RESIDUAL">Residual</option>
                              </select>
                            </div>

                            {comp.calculation_type === 'PERCENT_HEAD' && (
                              <div className="col-span-3 space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Parent Head</label>
                                <select
                                  value={comp.parent_head_id || ''}
                                  onChange={(e) => handleComponentChange(index, 'parent_head_id', Number(e.target.value))}
                                  className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                  <option value="">Select Head</option>
                                  {salaryHeads
                                    .filter(h => h.id !== comp.salary_head_id)
                                    .map(head => (
                                      <option key={head.id} value={head.id}>{head.name}</option>
                                    ))}
                                </select>
                              </div>
                            )}

                            <div className={`${comp.calculation_type === 'PERCENT_HEAD' ? 'col-span-2' : 'col-span-5'} space-y-1`}>
                              <label className="text-[10px] font-bold text-gray-500 uppercase">
                                {comp.calculation_type === 'FIXED' ? 'Amount' : comp.calculation_type === 'RESIDUAL' ? 'N/A' : 'Percentage'}
                              </label>
                              <input
                                type="number"
                                disabled={comp.calculation_type === 'RESIDUAL'}
                                value={comp.value || 0}
                                onChange={(e) => handleComponentChange(index, 'value', Number(e.target.value))}
                                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                              />
                            </div>

                            <div className="col-span-1 flex justify-center pb-1">
                              <button
                                onClick={() => handleRemoveComponent(index)}
                                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Live Preview Breakdown
                  </h2>
                  <div className="text-sm font-medium text-gray-500">
                    Total: <span className="text-gray-900 font-bold">₹{totalAmount.toLocaleString()}</span>
                  </div>
                </div>
                <div className="p-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100">
                        <th className="px-6 py-3">Head Name</th>
                        <th className="px-6 py-3">Calculation Logic</th>
                        <th className="px-6 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {calculateBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/30 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-700">{item.headName}</td>
                          <td className="px-6 py-4 text-xs text-gray-500">{item.formula}</td>
                          <td className="px-6 py-4 text-sm font-mono font-semibold text-right text-indigo-600">
                            ₹{item.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {calculateBreakdown.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-gray-400 text-sm italic">
                            No components to preview
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50/80 font-bold">
                        <td colSpan={2} className="px-6 py-4 text-sm text-gray-700 text-right">Total Calculated CTC</td>
                        <td className="px-6 py-4 text-sm font-mono text-right text-indigo-700">
                          ₹{totalAmount.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Validation Warning */}
              {isOverLimit && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-pulse">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-red-800">Validation Warning: Over CTC Limit</h4>
                    <p className="text-xs text-red-700 mt-1">
                      The sum of components (₹{totalNonResidual.toLocaleString()}) exceeds the Test Salary Rate (₹{testSalaryRate.toLocaleString()}). 
                      Residual components will be calculated as ₹0. Please adjust your values.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-[600px] flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl text-center p-12">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                <Calculator className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">No Slab Selected</h3>
              <p className="text-gray-500 max-w-xs mt-2">
                Select a slab from the list on the left or create a new one to start building the salary structure.
              </p>
              <button
                onClick={handleCreateNew}
                className="mt-6 flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create New Slab
              </button>
            </div>
          )}
        </div>
      </div>

      <MasterUsageWarningModal 
        isOpen={warningModalProps.isOpen}
        onClose={() => setWarningModalProps({isOpen: false})}
        onProceed={warningModalProps.onProceed || (() => {})}
        message={warningModalProps.message || ""}
      />
    </div>
  );
};

export default SalarySlabManager;
