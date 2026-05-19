import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { invokeCommand as invoke } from '../../services/apiClient';
import { 
  Save, 
  Calculator, 
  Users,
  Activity,
  IndianRupee,
  Download,
  Trash2,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useModule } from '../../contexts/ModuleContext';
import { withModuleGuard } from '../../components/layout/ModuleGuard';
import { User as UserType } from '../../types';
import { useDailyMIS, DailyMISEntry } from '../../hooks/useDailyMIS';
import { EmployeeSearchSelect } from '../../components/form/EmployeeSearchSelect';
import { HistoryTable } from '../../components/table/HistoryTable';
import * as Tabs from '@radix-ui/react-tabs';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';

interface DailyMISManagementProps {
  currentUser: UserType | null;
  onRedirect: () => void;
}

function DailyMISManagement({ currentUser }: DailyMISManagementProps) {
  const { currentMode } = useModule();
  const [masterData, setMasterData] = useState<any>({});
  
  // Header State
  const [voucherDate, setVoucherDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedShift, setSelectedShift] = useState('1');
  const [runningMachines, setRunningMachines] = useState<string>('0');
  const [reportingEmpId, setReportingEmpId] = useState('');

  // Auto-fill fields
  const [autoFields, setAutoFields] = useState({
    locationId: '',
    divisionId: '',
    groupId: '',
    departmentId: ''
  });

  const { entries, setEntries, loading, fetchEntries, saveBatch } = useDailyMIS(voucherDate);

  // Active cell state for clear blue border
  const [activeCell, setActiveCell] = useState<{rowId: string | number, colId: string} | null>(null);

  useEffect(() => {
    fetchMasterData();
  }, [currentMode]);

  const fetchMasterData = async () => {
    try {
      const data = await invoke<any>('get_master_data', { moduleType: currentMode });
      setMasterData(data);
    } catch (err) {
      toast.error("Failed to load master data");
    }
  };

  const handleReportingEmpChange = (empId: string) => {
    setReportingEmpId(empId);
    if (!empId) {
      setAutoFields({ locationId: '', divisionId: '', groupId: '', departmentId: '' });
      return;
    }

    const emp = masterData.employees?.find((e: any) => e.id.toString() === empId);
    if (emp) {
      setAutoFields({
        locationId: emp.location_id?.toString() || '',
        divisionId: emp.division_id?.toString() || '',
        groupId: emp.group_id?.toString() || '',
        departmentId: emp.department_id?.toString() || ''
      });
    }
  };

  useEffect(() => {
    if (entries.length === 0 && !loading) {
      spawnRow();
    }
  }, [entries.length, loading]);

  const spawnRow = useCallback(() => {
    setEntries(prev => [...prev, {
      id: Date.now() + Math.random(),
      date: voucherDate,
      emp_id: 0,
      emp_code: '',
      name: '',
      master_designation: '',
      current_designation: '',
      standard_rate: 0,
      worked_rate: 0,
      variance: 0
    }]);
  }, [setEntries, voucherDate]);

  const removeRow = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
    if (entries.length === 1) {
      setTimeout(() => spawnRow(), 0);
    }
  };

  const getRate = (deptId: string | undefined, designationName: string) => {
    // If no department explicitly selected for grid, try to general rate logic or use 0
    // Actually standard_rates just has designation mapping often. Let's find first matching designation rate.
    if (!designationName) return 0;
    const rateRecord = masterData.standard_rates?.find(
      (r: any) => r.designation === designationName
    );
    return rateRecord ? rateRecord.standard_rate : 0;
  };

  const handleUpdateEntry = (index: number, field: keyof DailyMISEntry, value: any) => {
    setEntries(prev => {
      const newEntries = [...prev];
      const entry = { ...newEntries[index], [field]: value };
      
      // Auto fetch employee on emp_code change & tab
      if (field === 'emp_code') {
        const emp = masterData.employees?.find((e: any) => e.emp_code === value);
        if (emp) {
          entry.emp_id = emp.id;
          entry.name = emp.name;
          const masterDesig = masterData.designations?.find((d: any) => d.id === emp.designation_id)?.name || '';
          entry.master_designation = masterDesig;
          
          if (!entry.current_designation) {
             entry.current_designation = masterDesig;
          }
        } else {
          entry.emp_id = 0;
          entry.name = '';
          entry.master_designation = '';
        }
      }

      // Update rates if current designation changes or emp code fetches designation
      if (field === 'current_designation' || field === 'emp_code') {
        const stdRate = getRate(undefined, entry.current_designation);
        entry.standard_rate = stdRate;
        entry.worked_rate = stdRate;
        entry.variance = 0;
      }

      if (field === 'worked_rate') {
          entry.variance = (entry.standard_rate || 0) - Number(value);
      }

      newEntries[index] = entry;
      return newEntries;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (field === 'current_designation') {
        e.preventDefault();
        // Spawn new row and focus next emp_code
        spawnRow();
        setTimeout(() => {
          const nextRowElement = document.getElementById(`entry-${index + 1}-emp_code`);
          if (nextRowElement) nextRowElement.focus();
        }, 50);
      } else if (field === 'emp_code') {
          // just let it tab to next field
      }
    }
  };

  const columns = useMemo<ColumnDef<DailyMISEntry>[]>(() => [
    {
      id: 'actions',
      header: '',
      size: 40,
      cell: ({ row }) => (
        <button
           onClick={() => removeRow(row.index)}
           className="text-red-400 hover:text-red-600 focus:outline-none"
        >
           <Trash2 size={14} />
        </button>
      )
    },
    {
      accessorKey: 'emp_code',
      header: 'Worker Code',
      size: 150,
      cell: ({ row, getValue }) => {
        const value = getValue() as string;
        // Validation check for duplicates
        const isDuplicate = entries.filter((e, i) => i !== row.index && e.emp_code && e.emp_code === value).length > 0;
        return (
          <input
            id={`entry-${row.index}-emp_code`}
            value={value || ''}
            onChange={e => handleUpdateEntry(row.index, 'emp_code', e.target.value)}
            onKeyDown={e => handleKeyDown(e, row.index, 'emp_code')}
            onFocus={() => setActiveCell({ rowId: row.id, colId: 'emp_code' })}
            onBlur={() => setActiveCell(null)}
            className={`w-full bg-transparent px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 rounded ${isDuplicate ? 'bg-red-100 text-red-900 font-bold placeholder-red-400 border border-red-500' : ''}`}
            placeholder="Type code..."
            autoComplete="off"
          />
        );
      }
    },
    {
      accessorKey: 'name',
      header: 'Name',
      size: 200,
      cell: ({ getValue }) => <div className="px-2 py-1 text-sm text-text-muted truncate">{getValue() as string}</div>
    },
    {
      accessorKey: 'master_designation',
      header: 'Master Desig',
      size: 150,
      cell: ({ getValue }) => <div className="px-2 py-1 text-sm text-text-muted truncate">{getValue() as string}</div>
    },
    {
      accessorKey: 'current_designation',
      header: 'Current Desig',
      size: 150,
      cell: ({ row, getValue }) => {
        const value = getValue() as string;
        return (
          <input
            id={`entry-${row.index}-current_designation`}
            value={value || ''}
            onChange={e => handleUpdateEntry(row.index, 'current_designation', e.target.value)}
            onKeyDown={e => handleKeyDown(e, row.index, 'current_designation')}
            onFocus={() => setActiveCell({ rowId: row.id, colId: 'current_designation' })}
            onBlur={() => setActiveCell(null)}
            className="w-full bg-transparent px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 rounded"
            placeholder="Type to edit..."
            list="designations-list"
            autoComplete="off"
          />
        );
      }
    },
    {
      accessorKey: 'standard_rate',
      header: 'Std Rate (₹)',
      size: 100,
      cell: ({ getValue }) => <div className="px-2 py-1 text-right text-sm font-mono">{Number(getValue() || 0).toFixed(2)}</div>
    },
    {
      accessorKey: 'worked_rate',
      header: 'Worked Rate (₹)',
      size: 120,
      cell: ({ row, getValue }) => {
        const value = getValue() as number;
        return (
          <input
            type="number"
            value={value || ''}
            onChange={e => handleUpdateEntry(row.index, 'worked_rate', Number(e.target.value))}
            onFocus={() => setActiveCell({ rowId: row.id, colId: 'worked_rate' })}
            onBlur={() => setActiveCell(null)}
            className="w-full bg-transparent px-2 py-1 text-right text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 rounded"
          />
        );
      }
    },
    {
      accessorKey: 'variance',
      header: 'Variance',
      size: 100,
      cell: ({ getValue }) => {
        const val = Number(getValue() || 0);
        return (
          <div className={`px-2 py-1 text-right text-sm font-mono ${val < 0 ? 'text-red-500 font-bold' : val > 0 ? 'text-green-500' : 'text-gray-500'}`}>
            {val.toFixed(2)}
          </div>
        );
      }
    }
  ], [entries, masterData]);

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totals = useMemo(() => {
    return entries.reduce((acc, curr) => ({
      standard: acc.standard + (curr.standard_rate || 0),
      worked: acc.worked + (curr.worked_rate || 0),
      variance: acc.variance + (curr.variance || 0)
    }), { standard: 0, worked: 0, variance: 0 });
  }, [entries]);

  const handleBulkSave = async () => {
    const validEntries = entries.filter(e => e.emp_id && e.emp_code);
    if (validEntries.length === 0) {
      toast.error('No valid entries to save');
      return;
    }
    
    // validation for duplicates
    const codes = validEntries.map(e => e.emp_code);
    const duplicates = codes.filter((val, i, arr) => arr.indexOf(val) !== i);
    if (duplicates.length > 0) {
        toast.error(`Fix duplicate entries for Worker Codes: ${duplicates.join(', ')}`);
        return;
    }

    try {
      await saveBatch(validEntries);
    } catch (e) {
       // error handled in hook
    }
  };

  const handleDownloadTemplate = () => {
    // Generate CSV template
    const headers = ['Worker Code', 'Current Designation', 'Worked Rate'];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\nE001,Master Weaver,500\nE002,Helper,300";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daily_mis_template_${voucherDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      <datalist id="designations-list">
        {masterData.designations?.map((d: any) => (
          <option key={d.id} value={d.name} />
        ))}
      </datalist>

      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Daily MIS Entry</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Transactions // Fast Data Entry</p>
        </div>
      </div>

      <Tabs.Root defaultValue="entry" className="w-full">
        <Tabs.List className="flex border-b border-app-border mb-6">
          <Tabs.Trigger value="entry" className="px-6 py-3 font-bold text-sm uppercase text-text-muted data-[state=active]:text-primary-navy data-[state=active]:border-b-2 data-[state=active]:border-primary-navy hover:text-primary-navy transition-colors">
            Entry Form
          </Tabs.Trigger>
          <Tabs.Trigger value="history" className="px-6 py-3 font-bold text-sm uppercase text-text-muted data-[state=active]:text-primary-navy data-[state=active]:border-b-2 data-[state=active]:border-primary-navy hover:text-primary-navy transition-colors">
            History
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="entry" className="space-y-6 outline-none">
          <div className="flex justify-end gap-3">
            <button
              onClick={handleDownloadTemplate}
              className="app-btn bg-white border border-gray-200 text-primary-navy flex items-center gap-2 px-6 h-11"
            >
              <Download size={18} />
              Download Template
            </button>
            <button
              onClick={handleBulkSave}
              disabled={loading}
              className="app-btn app-btn-primary flex items-center gap-2 px-8 h-11 shadow-xl shadow-primary-navy/20"
            >
              <Save size={18} />
              Bulk Save
            </button>
          </div>

      {/* MIS Header Card */}
      <div className="textile-card bg-white border-app-border overflow-hidden shadow-sm">
        <div className="bg-primary-navy px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 text-white">
            <Activity size={18} className="text-amber-400" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em]">MIS Header Information</h3>
          </div>
          <div className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
            Module K // Production MIS
          </div>
        </div>
        
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                 Date
              </label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="app-input h-11 text-sm font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                 Shift
              </label>
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                {['1', '2', '3'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedShift(s)}
                    className={`flex-1 py-2 text-xs font-black rounded-md transition-all ${
                      selectedShift === s 
                        ? 'bg-primary-navy text-white shadow-md' 
                        : 'text-text-muted hover:bg-gray-200'
                    }`}
                  >
                    SHIFT {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                 Running Machines
              </label>
              <input
                type="number"
                step="0.1"
                value={runningMachines}
                onChange={(e) => setRunningMachines(e.target.value)}
                className="app-input h-11 text-sm font-bold"
                placeholder="0.0"
              />
            </div>

            <div className="space-y-2">
              <EmployeeSearchSelect 
                label="Reporting Employee"
                employees={masterData.employees || []}
                selectedIds={reportingEmpId ? [parseInt(reportingEmpId)] : []}
                onChange={(ids) => handleReportingEmpChange(Array.isArray(ids) ? ids[0]?.toString() : '')}
                isMulti={false}
                placeholder="Search Reporting Employee..."
              />
            </div>
          </div>

          {/* Auto-filled Read-only fields */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-app-border/50">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                Location
              </label>
              <select
                value={autoFields.locationId}
                onChange={(e) => setAutoFields({ ...autoFields, locationId: e.target.value })}
                className="app-input h-10 text-xs font-bold w-full"
              >
                <option value="">Select Location</option>
                {masterData.locations?.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                Division
              </label>
              <select
                value={autoFields.divisionId}
                onChange={(e) => setAutoFields({ ...autoFields, divisionId: e.target.value })}
                className="app-input h-10 text-xs font-bold w-full"
              >
                <option value="">Select Division</option>
                {masterData.divisions?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                Group
              </label>
              <select
                value={autoFields.groupId}
                onChange={(e) => setAutoFields({ ...autoFields, groupId: e.target.value })}
                className="app-input h-10 text-xs font-bold w-full"
              >
                <option value="">Select Group</option>
                {masterData.groups?.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                Department
              </label>
              <select
                value={autoFields.departmentId}
                onChange={(e) => setAutoFields({ ...autoFields, departmentId: e.target.value })}
                className="app-input h-10 text-xs font-bold w-full"
              >
                <option value="">Select Department</option>
                {masterData.departments?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tanstack Table Grid */}
      <div className="textile-card bg-white border-app-border overflow-hidden shadow-sm">
        <div className="px-4 py-2 bg-gray-50 border-b border-app-border flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary-navy" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary-navy">MIS Data Grid {loading && '(Loading...)'}</h3>
          </div>
          <button
            onClick={spawnRow}
            className="flex items-center gap-1.5 text-[10px] font-black bg-primary-navy text-white px-3 py-1 rounded shadow-md"
          >
            <Plus size={14} /> NEW ROW
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="border-b border-app-border bg-gray-50/50">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-2 py-2 text-left text-[10px] font-mono text-text-muted uppercase tracking-widest" style={{ width: header.column.getSize() }}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-app-border">
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-primary-navy/[0.02] transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td 
                       key={cell.id} 
                       className={`p-0 border-r border-app-border/30 last:border-r-0 ${activeCell?.rowId === row.id && activeCell?.colId === cell.column.id ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/20' : ''}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && !loading && (
             <div className="p-8 text-center text-gray-500 text-sm">No entries for this date. Press "New Row" to start.</div>
          )}
        </div>
      </div>

      {/* Live Footer */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-5xl px-4 z-40">
        <div className="textile-card bg-primary-navy text-white p-5 shadow-2xl flex justify-between items-center border-none ring-4 ring-white/10">
          <div className="flex gap-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                <Calculator size={24} />
              </div>
              <div>
                <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.2em]">Total Standard</p>
                <p className="text-2xl font-black tracking-tighter">₹ {totals.standard.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                <IndianRupee size={24} />
              </div>
              <div>
                <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.2em]">Total Worked</p>
                <p className="text-2xl font-black tracking-tighter">₹ {totals.worked.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.2em]">Total Variance</p>
                <p className={`text-2xl font-black tracking-tighter ${totals.variance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  ₹ {totals.variance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </Tabs.Content>
      <Tabs.Content value="history" className="outline-none">
        <HistoryTable moduleType="MIS" />
      </Tabs.Content>
    </Tabs.Root>
    </div>
  );
}

export default withModuleGuard(DailyMISManagement, 'K');
