import React, { useState, useEffect, useMemo } from 'react';
import { invokeCommand as invoke } from '../../services/apiClient';
import { 
  useReactTable, getCoreRowModel, flexRender, ColumnDef 
} from '@tanstack/react-table';
import { toast } from 'sonner';
import { Download, Trash2, Edit, Filter, Search, Loader2 } from 'lucide-react';
import { useModule } from '../../contexts/ModuleContext';
import { EmployeeSearchSelect } from '../form/EmployeeSearchSelect';
import { format } from 'date-fns';

interface HistoryTableProps {
  moduleType: 'CANTEEN' | 'ROKDA' | 'MIS';
}

export function HistoryTable({ moduleType }: HistoryTableProps) {
  const { currentMode } = useModule();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filters
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [empId, setEmpId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [classId, setClassId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [batchId, setBatchId] = useState('');
  
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());

  const [editingRow, setEditingRow] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');

  const handleEditClick = (row: any) => {
    if (isAuditBlocked(row)) {
      toast.error("Blocked by Audit Circuit Breaker");
      return;
    }
    setEditingRow(row);
    setEditAmount(row.amount?.toString() || '0');
    setEditDate(row.date ? row.date.substring(0, 10) : '');
  };

  const saveEdit = async () => {
    if (!editingRow) return;
    try {
      await invoke('update_transaction', {
        targetModule: moduleType,
        id: editingRow.id,
        updateData: {
          amount: parseFloat(editAmount) || 0,
          date: editDate || editingRow.date
        },
        moduleType: currentMode
      });
      toast.success("Transaction updated");
      setEditingRow(null);
      fetchHistory();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
  };
  const [masterData, setMasterData] = useState<any>({});
  
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const res: any = await invoke('get_master_data', { moduleType: currentMode });
        setMasterData(res);
      } catch (e: any) {
        console.error("Failed to load master data", e);
      }
    };
    fetchMasterData();
  }, [currentMode]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await invoke<any>('get_transaction_history', {
        targetModule: moduleType,
        startDate,
        endDate,
        empId,
        departmentId,
        divisionId,
        locationId,
        groupId,
        classId,
        categoryId,
        designationId,
        batchId,
        limit: pageSize,
        offset: page * pageSize,
        moduleType: currentMode
      });
      setData(res.data);
      setTotal(res.total);
      setSelectedRowIds(new Set()); // Reset selections
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [startDate, endDate, empId, departmentId, divisionId, locationId, groupId, classId, categoryId, designationId, batchId, page, moduleType, currentMode]);

  const toggleSelection = (id: number) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  const toggleAll = () => {
    if (selectedRowIds.size === data.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(data.map(d => d.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRowIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedRowIds.size} transactions?`)) return;
    
    try {
      await invoke('bulk_delete_transactions', {
        targetModule: moduleType,
        ids: Array.from(selectedRowIds),
        moduleType: currentMode
      });
      toast.success("Transactions deleted");
      fetchHistory();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  const isAuditBlocked = (row: any) => {
    // If in P mode, block if created_by doesn't start with 'P_' or isn't specifically marked as audit.
    // Assuming transactions synced from K will not have a P_ prefix or might have a K_ prefix or null.
    if (currentMode === 'K') return false; 
    return !row.created_by?.startsWith('P_');
  };

  const deleteSingle = async (row: any) => {
    if (isAuditBlocked(row)) {
      toast.error("Blocked by Audit Circuit Breaker");
      return;
    }
    if (!window.confirm("Delete this transaction?")) return;
    try {
      await invoke('bulk_delete_transactions', {
        targetModule: moduleType,
        ids: [row.id],
        moduleType: currentMode
      });
      toast.success("Transaction deleted");
      fetchHistory();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => {
    return [
      {
         id: 'select',
         header: () => (
           <input 
             type="checkbox" 
             checked={data.length > 0 && selectedRowIds.size === data.length} 
             onChange={toggleAll}
             className="rounded border-gray-300"
           />
         ),
         cell: ({ row }) => (
           <input 
             type="checkbox" 
             checked={selectedRowIds.has(row.original.id)} 
             onChange={() => toggleSelection(row.original.id)}
             className="rounded border-gray-300"
           />
         )
      },
      { accessorKey: 'date', header: 'Date' },
      { accessorKey: 'batch_id', header: 'Batch ID' },
      { accessorKey: 'emp_code', header: 'Code' },
      { accessorKey: 'emp_name', header: 'Name' },
      { accessorKey: 'amount', header: 'Amount' },
      {
         id: 'actions',
         header: 'Actions',
         cell: ({ row }) => {
           const blocked = isAuditBlocked(row.original);
           return (
             <div className="flex gap-2">
                <button 
                  onClick={() => handleEditClick(row.original)}
                  disabled={blocked}
                  className={`p-1.5 rounded transition ${blocked ? 'text-gray-300 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-50'}`}
                >
                  <Edit size={16} />
                </button>
                <button 
                  onClick={() => deleteSingle(row.original)}
                  disabled={blocked}
                  className={`p-1.5 rounded transition ${blocked ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}
                >
                  <Trash2 size={16} />
                </button>
             </div>
           );
         }
      }
    ];
  }, [data, selectedRowIds, currentMode]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="textile-card p-6 bg-white border-app-border">
       <div className="flex justify-between items-center mb-6">
         <h3 className="font-bold uppercase tracking-wider text-primary-navy">Transaction History</h3>
         <div className="flex gap-2">
            <button onClick={handleBulkDelete} disabled={selectedRowIds.size === 0} className="app-btn bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-2">
              <Trash2 size={16} /> Delete Selected
            </button>
         </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="app-input h-10 w-full text-xs" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="app-input h-10 w-full text-xs" />
          </div>
          <div className="md:col-span-2 lg:col-span-2">
             <EmployeeSearchSelect 
               label="Employee"
               employees={masterData.employees || []}
               selectedIds={empId ? [parseInt(empId)] : []}
               onChange={(ids) => setEmpId(ids[0]?.toString() || '')}
               placeholder="All Employees"
             />
          </div>
          <div>
             <label className="text-[10px] font-bold text-gray-500 uppercase">Batch ID</label>
             <input type="text" placeholder="Batch ID" value={batchId} onChange={e => setBatchId(e.target.value)} className="app-input h-10 w-full text-xs" />
          </div>
          
          <div>
             <label className="text-[10px] font-bold text-gray-500 uppercase">Location</label>
             <select value={locationId} onChange={e => setLocationId(e.target.value)} className="app-input h-10 w-full text-xs">
                <option value="">All Locations</option>
                {masterData.locations?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
             </select>
          </div>
          <div>
             <label className="text-[10px] font-bold text-gray-500 uppercase">Division</label>
             <select value={divisionId} onChange={e => setDivisionId(e.target.value)} className="app-input h-10 w-full text-xs">
                <option value="">All Divisions</option>
                {masterData.divisions?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
             </select>
          </div>
          <div>
             <label className="text-[10px] font-bold text-gray-500 uppercase">Group</label>
             <select value={groupId} onChange={e => setGroupId(e.target.value)} className="app-input h-10 w-full text-xs">
                <option value="">All Groups</option>
                {masterData.groups?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
             </select>
          </div>
          <div>
             <label className="text-[10px] font-bold text-gray-500 uppercase">Department</label>
             <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="app-input h-10 w-full text-xs">
                <option value="">All Departments</option>
                {masterData.departments?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
             </select>
          </div>
          <div>
             <label className="text-[10px] font-bold text-gray-500 uppercase">Designation</label>
             <select value={designationId} onChange={e => setDesignationId(e.target.value)} className="app-input h-10 w-full text-xs">
                <option value="">All Designations</option>
                {masterData.designations?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
             </select>
          </div>
          <div>
             <label className="text-[10px] font-bold text-gray-500 uppercase">Class</label>
             <select value={classId} onChange={e => setClassId(e.target.value)} className="app-input h-10 w-full text-xs">
                <option value="">All Classes</option>
                {masterData.classes?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
             </select>
          </div>
          <div>
             <label className="text-[10px] font-bold text-gray-500 uppercase">Category</label>
             <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="app-input h-10 w-full text-xs">
                <option value="">All Categories</option>
                {masterData.categories?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
             </select>
          </div>
       </div>

       <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
               {table.getHeaderGroups().map(hg => (
                 <tr key={hg.id}>
                    {hg.headers.map(h => (
                      <th key={h.id} className="p-3 font-bold text-gray-600 uppercase tracking-widest text-[10px]">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                 </tr>
               ))}
            </thead>
            <tbody className="divide-y divide-gray-100">
               {isLoading ? (
                 <tr>
                    <td colSpan={columns.length} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-primary-navy" /></td>
                 </tr>
               ) : data.length === 0 ? (
                 <tr>
                    <td colSpan={columns.length} className="p-8 text-center text-gray-500">No transactions found</td>
                 </tr>
               ) : (
                 table.getRowModel().rows.map(row => (
                   <tr key={row.id} className="hover:bg-gray-50">
                      {row.getVisibleCells().map(cell => (
                         <td key={cell.id} className="p-3 font-mono">
                           {flexRender(cell.column.columnDef.cell, cell.getContext())}
                         </td>
                      ))}
                   </tr>
                 ))
               )}
            </tbody>
          </table>
       </div>
       
       <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-gray-500 font-mono">Showing {data.length} of {total}</span>
          <div className="flex gap-2">
             <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-gray-100 rounded">Prev</button>
             <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-gray-100 rounded">Next</button>
          </div>
       </div>

       {editingRow && (
         <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
           <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
             <h3 className="font-bold text-lg mb-4 text-primary-navy">Edit Transaction</h3>
             <div className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                 <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="app-input w-full" />
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Amount</label>
                 <input type="number" step="any" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="app-input w-full" />
               </div>
             </div>
             <div className="flex justify-end gap-3 mt-6">
               <button onClick={() => setEditingRow(null)} className="app-btn bg-gray-100 text-gray-600 hover:bg-gray-200">Cancel</button>
               <button onClick={saveEdit} className="app-btn app-btn-primary">Save Changes</button>
             </div>
           </div>
         </div>
       )}
    </div>
  );
}
