import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  Save, 
  Eye, 
  Building2,
  Settings2,
  ChevronRight,
  Loader2,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import { useModule } from '../../contexts/ModuleContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
type ColumnNature = 'Static' | 'Dynamic' | 'Incremental' | 'Blank';
type DataType = 'Text' | 'Amount' | 'Number' | 'Date';
type DataSource = 'Employee Master' | 'Salary Processed' | 'Loans' | 'Bank A/c Settings' | 'Bank Transfer';

interface BankColumn {
  id: string;
  headerName: string;
  nature: ColumnNature;
  dataType: DataType;
  dataSource?: DataSource;
  field?: string;
  staticValue?: string;
  format?: string;
}

interface BankConfig {
  id?: number;
  bank_name?: string;
  bankName?: string;
  columns: BankColumn[];
}

// Constants for Dynamic Fields
const FIELD_OPTIONS: Record<DataSource, string[]> = {
  'Employee Master': ['emp_code', 'first_name', 'middle_name', 'last_name', 'bank_name', 'account_no', 'ifsc_code', 'aadhar_no', 'pan_no'],
  'Salary Processed': ['net_salary', 'gross_salary', 'month', 'working_days', 'basic', 'hra', 'conveyance', 'total_deductions'],
  'Loans': ['loan_amount', 'installment_amount', 'balance_amount'],
  'Bank A/c Settings': ['CMS_CLIENT_CODE', 'CMS_PRODUCT_CODE', 'PAYMENT_TYPE_IDENTIFIER', 'REFERENCE_START_NO', 'ACCOUNT_NO', 'IFSC_CODE'],
  'Bank Transfer': ['Payment Date', 'Employee Name', 'Bank A/c Number of Employee', 'Bank IFSC code of Employee', 'Employee Phone number', 'Employee Email', 'Narration']
};

interface SortableColumnRowProps {
  key?: React.Key;
  column: BankColumn;
  onUpdate: (id: string, updates: Partial<BankColumn>) => void;
  onRemove: (id: string) => void;
}

// Sortable Item Component
function SortableColumnRow({ 
  column, 
  onUpdate, 
  onRemove 
}: SortableColumnRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="flex items-start gap-3 bg-white p-4 rounded-lg border border-app-border shadow-sm group animate-in fade-in slide-in-from-left-2"
    >
      <div {...attributes} {...listeners} className="mt-2 cursor-grab active:cursor-grabbing text-slate-400 hover:text-primary-navy transition-colors">
        <GripVertical size={20} />
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Header Name */}
        <div className="space-y-1">
          <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Header Name</label>
          <input 
            value={column.headerName || ''}
            onChange={(e) => onUpdate(column.id, { headerName: e.target.value })}
            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
            placeholder="e.g. Account Number"
          />
        </div>

        {/* Nature */}
        <div className="space-y-1">
          <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Nature</label>
          <select 
            value={column.nature || 'Static'}
            onChange={(e) => onUpdate(column.id, { nature: e.target.value as ColumnNature })}
            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
          >
            <option value="Static">Static</option>
            <option value="Dynamic">Dynamic</option>
            <option value="Incremental">Incremental</option>
            <option value="Blank">Blank</option>
          </select>
        </div>

        {/* Data Type */}
        <div className="space-y-1">
          <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Data Type</label>
          <select 
            value={column.dataType || 'Text'}
            onChange={(e) => onUpdate(column.id, { dataType: e.target.value as DataType })}
            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
          >
            <option value="Text">Text</option>
            <option value="Amount">Amount</option>
            <option value="Number">Number</option>
            <option value="Date">Date</option>
          </select>
        </div>

        {/* Conditional Fields */}
        {column.nature === 'Dynamic' && (
          <>
            <div className="space-y-1">
              <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Data Source</label>
              <select 
                value={column.dataSource || 'Employee Master'}
                onChange={(e) => onUpdate(column.id, { dataSource: e.target.value as DataSource, field: FIELD_OPTIONS[e.target.value as DataSource][0] })}
                className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
              >
                <option value="Employee Master">Employee Master</option>
                <option value="Salary Processed">Salary Processed</option>
                <option value="Loans">Loans</option>
                <option value="Bank A/c Settings">Bank A/c Settings</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Field</label>
              <select 
                value={column.field || ''}
                onChange={(e) => onUpdate(column.id, { field: e.target.value })}
                className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
              >
                {column.dataSource && FIELD_OPTIONS[column.dataSource].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {column.nature === 'Static' && (
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Static Value</label>
            <input 
              value={column.staticValue || ''}
              onChange={(e) => onUpdate(column.id, { staticValue: e.target.value })}
              className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
              placeholder="Fixed text..."
            />
          </div>
        )}

        {column.nature === 'Incremental' && (
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Incremental Info</label>
            <div className="p-2 text-xs text-text-muted italic bg-slate-50 border border-app-border rounded-md">
              Auto-incrementing sequence (1, 2, 3...)
            </div>
          </div>
        )}

        {column.nature === 'Blank' && (
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Blank Column</label>
            <div className="p-2 text-xs text-text-muted italic bg-slate-50 border border-app-border rounded-md">
              Column will be empty in export.
            </div>
          </div>
        )}

        {/* Format */}
        <div className="space-y-1">
          <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Format</label>
          <input 
            value={column.format || ''}
            onChange={(e) => onUpdate(column.id, { format: e.target.value })}
            className="w-full bg-slate-50 border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-md"
            placeholder={column.dataType === 'Date' ? 'DD/MM/YYYY' : column.dataType === 'Amount' ? '0.00' : 'Format...'}
          />
        </div>
      </div>

      <button 
        onClick={() => onRemove(column.id)}
        className="mt-6 p-2 text-primary-red hover:bg-primary-red/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

interface BankExcelConfiguratorProps {
  standalone?: boolean;
  initialBankName?: string;
  onClose?: () => void;
}

export default function BankExcelConfigurator({ 
  standalone = true, 
  initialBankName,
  onClose 
}: BankExcelConfiguratorProps) {
  const { currentMode } = useModule();
  const [bankName, setBankName] = useState(initialBankName || '');
  const [columns, setColumns] = useState<BankColumn[]>([]);
  const [configs, setConfigs] = useState<BankConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchConfigs();
  }, [currentMode]);

  useEffect(() => {
    if (initialBankName && configs.length > 0) {
      const existing = configs.find(c => (c.bankName || c.bank_name || '').toLowerCase() === initialBankName.toLowerCase());
      if (existing) {
        handleSelectConfig(existing);
      } else {
        setBankName(initialBankName);
        setColumns([]);
        setSelectedConfigId(null);
      }
    }
  }, [initialBankName, configs]);

  const fetchConfigs = async () => {
    try {
      const data = await fetchApi<BankConfig[]>('/api/banking/configs', { headers: { 'x-module-type': currentMode } });
      setConfigs(data);
    } catch (err) {
      console.error("Failed to fetch configs:", err);
    }
  };

  const handleAddColumn = () => {
    const newCol: BankColumn = {
      id: Math.random().toString(36).substr(2, 9),
      headerName: '',
      nature: 'Dynamic',
      dataType: 'Text',
      dataSource: 'Employee Master',
      field: 'emp_code',
      format: ''
    };
    setColumns([...columns, newCol]);
  };

  const handleUpdateColumn = (id: string, updates: Partial<BankColumn>) => {
    setColumns(columns.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleRemoveColumn = (id: string) => {
    setColumns(columns.filter(c => c.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = async () => {
    if (!bankName) {
      toast.error("Please enter a Bank Name");
      return;
    }
    if (columns.length === 0) {
      toast.error("Please add at least one column");
      return;
    }

    setIsLoading(true);
    try {
      await fetchApi('/api/banking/configs', {
        method: 'POST',
        headers: { 'x-module-type': currentMode },
        body: JSON.stringify({
          id: selectedConfigId,
          bank_name: bankName,
          columns
        })
      });
      toast.success("Configuration saved successfully");
      fetchConfigs();
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectConfig = (config: BankConfig) => {
    setSelectedConfigId(config.id || null);
    setBankName(config.bankName || config.bank_name || '');
    setColumns(config.columns);
  };

  const handleNewConfig = () => {
    setSelectedConfigId(null);
    setBankName('');
    setColumns([]);
  };

  // Dummy Data for Preview
  const dummyEmployees = [
    { emp_code: 'EMP001', first_name: 'Rajesh', last_name: 'Kumar', bank_name: 'HDFC', account_no: '1234567890', ifsc_code: 'HDFC0001', net_salary: 45000, month: '2024-03' },
    { emp_code: 'EMP002', first_name: 'Suresh', last_name: 'Patil', bank_name: 'ICICI', account_no: '9876543210', ifsc_code: 'ICIC0002', net_salary: 38000, month: '2024-03' },
    { emp_code: 'EMP003', first_name: 'Anita', last_name: 'Sharma', bank_name: 'SBI', account_no: '5544332211', ifsc_code: 'SBIN0003', net_salary: 52000, month: '2024-03' },
  ];

  const getPreviewValue = (col: BankColumn, rowIndex: number) => {
    if (col.nature === 'Incremental') return rowIndex + 1;
    if (col.nature === 'Static') return col.staticValue || '';
    if (col.nature === 'Dynamic') {
      const emp = dummyEmployees[rowIndex];
      const val = (emp as any)[col.field || ''];
      if (col.dataType === 'Amount') return Number(val || 0).toFixed(2);
      return val || '';
    }
    return '';
  };

  return (
    <div className={cn("space-y-6", !standalone && "p-1")}>
      {standalone && (
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl textile-header font-black flex items-center gap-3 text-primary-navy">
              <FileSpreadsheet size={32} />
              Bank Excel Configurator
            </h2>
            <p className="text-sm font-mono text-primary-navy/70 uppercase tracking-widest">
              Export Templates // Custom Mapping Engine
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              className="app-btn app-btn-outline flex items-center gap-2"
            >
              <Eye size={18} />
              {isPreviewOpen ? 'Hide Preview' : 'Show Preview'}
            </button>
            <button 
              onClick={handleSave}
              disabled={isLoading}
              className="app-btn app-btn-primary flex items-center gap-2 shadow-md"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save Config
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Existing Configs */}
        {standalone && (
          <div className="lg:col-span-1 space-y-4">
            <div className="textile-card p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-app-border pb-2">
                <h3 className="text-xs textile-header font-bold text-primary-navy uppercase">Saved Templates</h3>
                <button onClick={handleNewConfig} className="text-primary-navy hover:bg-primary-navy/10 p-1 rounded transition-colors">
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {configs.length > 0 ? configs.map(c => (
                  <button 
                    key={c.id}
                    onClick={() => handleSelectConfig(c)}
                    className={cn(
                      "w-full text-left p-3 rounded-md text-sm font-bold transition-all flex items-center justify-between group",
                      selectedConfigId === c.id ? "bg-primary-navy text-white shadow-md" : "bg-slate-50 text-text-main hover:bg-slate-100 border border-app-border"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 size={16} />
                      {c.bankName || c.bank_name}
                    </div>
                    <ChevronRight size={14} className={cn("transition-transform", selectedConfigId === c.id ? "translate-x-1" : "opacity-0 group-hover:opacity-100")} />
                  </button>
                )) : (
                  <p className="text-[10px] text-text-muted italic text-center py-4">No templates found.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main: Configurator */}
        <div className={cn(standalone ? "lg:col-span-3" : "lg:col-span-4", "space-y-6")}>
          <div className="textile-card p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] textile-header text-text-muted uppercase font-bold">Bank Name / Template Name</label>
                <input 
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  disabled={!standalone && !!initialBankName}
                  className="w-full bg-slate-50 border border-app-border p-3 text-lg font-bold text-primary-navy focus:outline-none focus:border-primary-navy rounded-md disabled:opacity-70"
                  placeholder="e.g. HDFC Bulk Salary Export"
                />
              </div>
              <div className="flex gap-2 self-end">
                {!standalone && (
                  <>
                    <button 
                      onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                      className="app-btn app-btn-outline flex items-center gap-2 h-12"
                    >
                      <Eye size={18} />
                      {isPreviewOpen ? 'Hide' : 'Preview'}
                    </button>
                    <button 
                      onClick={handleSave}
                      disabled={isLoading}
                      className="app-btn app-btn-primary flex items-center gap-2 h-12 shadow-md"
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      Save
                    </button>
                  </>
                )}
                <button 
                  onClick={handleAddColumn}
                  className="app-btn app-btn-outline flex items-center gap-2 h-12"
                >
                  <Plus size={18} />
                  Add Column
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-app-border pb-2">
                <h3 className="text-xs textile-header font-bold text-primary-navy uppercase">Column Mapping</h3>
                <span className="text-[10px] text-text-muted font-mono">{columns.length} Columns Defined</span>
              </div>

              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={columns.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {columns.map((col) => (
                      <SortableColumnRow 
                        key={col.id} 
                        column={col} 
                        onUpdate={handleUpdateColumn}
                        onRemove={handleRemoveColumn}
                      />
                    ))}
                    {columns.length === 0 && (
                      <div className="text-center py-12 border-2 border-dashed border-app-border rounded-xl bg-slate-50/50">
                        <p className="text-text-muted text-sm italic">No columns added yet. Click 'Add Column' to start mapping.</p>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>

          {/* Preview Section */}
          {isPreviewOpen && columns.length > 0 && (
            <div className="textile-card p-6 space-y-4 animate-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between border-b border-app-border pb-2">
                <h3 className="text-xs textile-header font-bold text-primary-navy uppercase flex items-center gap-2">
                  <Eye size={16} />
                  Live Preview (First 3 Rows)
                </h3>
                <div className="flex gap-2">
                  <div className="px-2 py-1 bg-primary-green/10 text-primary-green text-[8px] font-bold rounded uppercase">Dummy Data Active</div>
                </div>
              </div>
              
              <div className="overflow-x-auto border border-app-border rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-app-border">
                      {columns.map((col, idx) => (
                        <th key={idx} className="p-3 text-[10px] textile-header text-primary-navy font-black uppercase whitespace-nowrap border-r border-app-border last:border-r-0">
                          {col.headerName || `Col ${idx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2].map((rowIndex) => (
                      <tr key={rowIndex} className="border-b border-app-border last:border-b-0 hover:bg-slate-50 transition-colors">
                        {columns.map((col, colIdx) => (
                          <td key={colIdx} className="p-3 text-xs font-mono text-text-main border-r border-app-border last:border-r-0">
                            {getPreviewValue(col, rowIndex)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[9px] text-text-muted italic">Note: This preview uses sample employee data to demonstrate the mapping logic.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
