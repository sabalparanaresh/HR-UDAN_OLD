import React, { useMemo, useState, useEffect } from 'react';
import { 
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  FilterFn,
  ColumnDef,
} from '@tanstack/react-table';
import { invokeCommand } from '../../services/apiClient';

// Identity mapping for paths in web mode
const safeConvertFileSrc = (path: string) => {
  if (!path) return '';
  try {
    return path;
  } catch (e) {
    return path;
  }
};

import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Edit2,
  Trash2,
  Filter,
  ArrowUpDown,
  UserCircle,
  ShieldAlert,
  Lock,
  Plus,
  Loader2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Employee, User, PagePermission } from '../../types';
import { MultiSelect } from '../common/MultiSelect';
import { Pagination } from '../common/Pagination';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface EmployeeTableProps {
  data: Employee[];
  totalRecords?: number;
  pageIndex?: number;
  pageSize?: number;
  onPaginationChange?: (page: number, size: number) => void;
  onSearchChange?: (search: string) => void;
  onFilterChange?: (filters: any) => void;
  manualPagination?: boolean;
  departments: { id: number; name: string }[];
  designations: { id: number; name: string }[];
  locations: { id: number; name: string }[];
  divisions: { id: number; name: string }[];
  classes: { id: number; name: string }[];
  categories: { id: number; name: string }[];
  groups: { id: number; name: string }[];
  onEdit: (employee: Employee) => void;
  onDelete: (id: number) => void;
  onBulkDelete?: (ids: number[]) => void;
  onSync?: (employee: Employee) => void;
  permissions?: PagePermission;
  currentMode?: 'K' | 'P';
}

const globalFilterFn: FilterFn<any> = (row, columnId, value, addMeta) => {
  return true;
};

export default function EmployeeTable({ 
  data, 
  totalRecords = 0,
  pageIndex = 0,
  pageSize = 10,
  onPaginationChange,
  onSearchChange,
  onFilterChange,
  manualPagination = false,
  departments, 
  designations, 
  locations,
  divisions,
  classes,
  categories,
  groups,
  onEdit, 
  onDelete,
  onBulkDelete,
  onSync,
  permissions,
  currentMode = 'K'
}: EmployeeTableProps) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [columnFilters, setColumnFilters] = useState<any[]>([]);
  const [rowSelection, setRowSelection] = useState({});

  // Search Debouncing
  useEffect(() => {
    if (searchInput === globalFilter) {
      setIsDebouncing(false);
      return;
    }
    setIsDebouncing(true);
    const timer = setTimeout(() => {
      setGlobalFilter(searchInput);
      if (onSearchChange) onSearchChange(searchInput);
      setIsDebouncing(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchInput, globalFilter, onSearchChange]);

  useEffect(() => {
    if (onFilterChange && manualPagination) {
      const filters = Object.fromEntries(columnFilters.map(f => [f.id, f.value]));
      onFilterChange(filters);
    }
  }, [columnFilters, onFilterChange, manualPagination]);

  // Priority Matching Logic for Client Side
  const prioritizedData = useMemo(() => {
    if (manualPagination) return data;
    if (!globalFilter) return data;
    const input = String(globalFilter || '').toLowerCase().trim();
    
    const scored = data.map(emp => {
      const code = String(emp.emp_code || '').toLowerCase();
      const first = (emp.first_name || '').toLowerCase();
      const last = (emp.last_name || '').toLowerCase();
      const full = `${first} ${last}`;
      
      let score = -1;
      if (code === input) score = 3;
      else if (code.startsWith(input)) score = 2;
      else if (first.startsWith(input) || last.startsWith(input)) score = 1;
      else {
        const fullFields = [
          emp.emp_code, emp.aadhar_no, emp.voter_id, emp.passport_no,
          emp.driving_licence, emp.pf_number, emp.uan_no, emp.esi_ip_number,
          emp.mobile, emp.mobile2, emp.cug_mobile, emp.first_name,
          emp.middle_name, emp.last_name, emp.full_name_aadhar
        ];
        if (fullFields.some(f => String(f || '').toLowerCase().includes(input))) {
          score = 0;
        }
      }
      return { emp, score };
    }).filter(x => x.score >= 0);

    return scored
      .sort((a, b) => b.score - a.score || a.emp.emp_code.localeCompare(b.emp.emp_code))
      .map(x => x.emp);
  }, [data, globalFilter]);

  const columnHelper = createColumnHelper<Employee>();

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <div className="flex items-center justify-center pr-2">
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="w-4 h-4 rounded border-slate-300 text-primary-navy focus:ring-primary-navy cursor-pointer"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center pr-2">
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-slate-300 text-primary-navy focus:ring-primary-navy cursor-pointer"
          />
        </div>
      ),
    }),
    columnHelper.display({
      id: 'profile',
      header: 'Profile',
      cell: info => {
        const emp = info.row.original;
        const initials = `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`.toUpperCase();
        
        return (
          <div className="flex items-center justify-center">
            {emp.photo_path ? (
              <img 
                src={safeConvertFileSrc(emp.photo_path)} 
                alt={emp.emp_code}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-[10px] border border-slate-200 uppercase">
                {initials || <UserCircle size={14} />}
              </div>
            )}
          </div>
        );
      },
    }),
    ...(currentMode === 'K' ? [
      columnHelper.display({
        id: 'sync',
        header: 'Sync',
        cell: info => {
          const row = info.row.original;
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onSync) onSync(row);
              }}
              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
              title="Sync to Pakka"
            >
              <Plus size={16} />
            </button>
          );
        },
      })
    ] : []),
    columnHelper.accessor('emp_code', {
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-primary-navy transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Code
          <ArrowUpDown size={14} />
        </button>
      ),
      cell: info => <span className="font-mono font-bold text-primary-navy">{info.getValue()}</span>,
    }),
    columnHelper.accessor('first_name', {
      header: 'Name',
      cell: info => {
        const row = info.row.original;
        return (
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 leading-tight">
              {[row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')}
            </span>
            {Boolean(row.blacklist_status) && (
              <span className="flex items-center gap-1 text-[10px] text-red-600 font-bold uppercase tracking-wider">
                <Lock size={10} /> Blacklisted
              </span>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor('division_id', {
      header: 'Division',
      cell: info => {
        const divId = info.getValue();
        const div = divisions?.find(d => d.id.toString() === divId?.toString());
        return <span className="text-sm text-slate-600">{div?.name || divId || 'N/A'}</span>;
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;
        return filterValue.includes(Number(row.getValue(columnId)));
      },
    }),
    columnHelper.accessor('class_id', {
      header: 'Class',
      cell: info => {
        const clsId = info.getValue();
        const cls = classes?.find(c => c.id.toString() === clsId?.toString());
        return <span className="text-sm text-slate-600">{cls?.name || clsId || 'N/A'}</span>;
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;
        return filterValue.includes(Number(row.getValue(columnId)));
      },
    }),
    columnHelper.accessor('group_id', {
      header: 'Group',
      cell: info => {
        const grpId = info.getValue();
        const grp = groups?.find(g => g.id.toString() === grpId?.toString());
        return <span className="text-sm text-slate-600">{grp?.name || grpId || 'N/A'}</span>;
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;
        return filterValue.includes(Number(row.getValue(columnId)));
      },
    }),
    columnHelper.accessor('department_id', {
      header: 'Department',
      cell: info => {
        const deptId = info.getValue();
        const dept = departments?.find(d => d.id.toString() === deptId?.toString());
        return <span className="text-sm text-slate-600">{dept?.name || deptId || 'N/A'}</span>;
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;
        return filterValue.includes(Number(row.getValue(columnId)));
      },
    }),
    columnHelper.accessor('designation', {
      header: 'Designation',
      cell: info => {
        const desId = info.getValue();
        const des = designations?.find(d => d.id.toString() === desId?.toString());
        return <span className="text-sm text-slate-600">{des?.name || desId || 'N/A'}</span>;
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;
        return filterValue.includes(Number(row.getValue(columnId)));
      },
    }),
    columnHelper.accessor('aadhar_no', {
      header: 'Aadhar',
      cell: info => <span className="text-xs font-mono text-slate-500">{info.getValue()}</span>,
    }),
    columnHelper.accessor('mobile', {
      header: 'Mobile',
      cell: info => <span className="text-xs font-mono text-slate-500">{info.getValue()}</span>,
    }),
    columnHelper.accessor('employee_status', {
      header: 'Status',
      cell: info => {
        const status = info.getValue() || 'Active';
        const isActive = status === 'Active';
        return (
          <span className={cn(
            "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
            isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}>
            {status}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: info => {
        const row = info.row.original;
        return (
          <div className="flex items-center gap-2">
            {permissions?.addUpdate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(row);
                }}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                title="Edit Employee"
              >
                <Edit2 size={16} />
              </button>
            )}
            {permissions?.delete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (row.id) onDelete(row.id);
                }}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Delete Employee"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        );
      },
    }),
    // Hidden columns for filtering
    columnHelper.accessor('location_id', {
      id: 'location_id',
      header: 'Location',
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;
        return filterValue.includes(Number(row.getValue(columnId)));
      },
    }),
    columnHelper.accessor('category_id', {
      id: 'category_id',
      header: 'Category',
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;
        return filterValue.includes(Number(row.getValue(columnId)));
      },
    }),
  ], [currentMode, departments, designations, locations, divisions, classes, categories, groups, permissions, onEdit, onDelete]);

  const table = useReactTable({
    data: prioritizedData,
    columns,
    pageCount: manualPagination ? Math.ceil(totalRecords / pageSize) : undefined,
    state: {
      globalFilter: manualPagination ? undefined : globalFilter,
      columnFilters: manualPagination ? [] : columnFilters,
      rowSelection,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    manualPagination,
    manualFiltering: manualPagination,
    onPaginationChange: (updater) => {
      if (onPaginationChange) {
        const nextState = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater;
        onPaginationChange(nextState.pageIndex, nextState.pageSize);
      }
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      columnVisibility: {
        location_id: false,
        category_id: false,
      },
      rowSelection: {},
    },
  });

  const isAllPageSelected = table.getIsAllPageRowsSelected();
  const selectedCount = Object.keys(rowSelection).length;
  const totalFilteredCount = table.getFilteredRowModel().rows.length;
  const isGlobalSelected = selectedCount === totalFilteredCount && totalFilteredCount > 0;

  return (
    <div className="space-y-4">
      {/* Table Controls */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        {/* Bulk Selection Notification */}
        {isAllPageSelected && totalFilteredCount > table.getState().pagination.pageSize && !isGlobalSelected && (
          <div className="bg-primary-navy/5 border border-primary-navy/10 p-2 rounded-lg flex items-center justify-center gap-2 text-xs">
            <span className="text-slate-600">All <strong>{table.getPaginationRowModel().rows.length}</strong> employees on this page are selected.</span>
            <button 
              onClick={() => table.toggleAllRowsSelected(true)}
              className="text-primary-navy font-bold hover:underline"
            >
              Select all {totalFilteredCount} employees in this list
            </button>
          </div>
        )}
        {isGlobalSelected && (
          <div className="bg-primary-navy/5 border border-primary-navy/10 p-2 rounded-lg flex items-center justify-center gap-2 text-xs">
            <span className="text-slate-600">All <strong>{totalFilteredCount}</strong> employees are selected.</span>
            <button 
              onClick={() => setRowSelection({})}
              className="text-primary-navy font-bold hover:underline"
            >
              Clear selection
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by Code, Name, or Aadhar..."
              className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-navy/20 focus:border-primary-navy outline-none transition-all text-sm"
            />
            {isDebouncing && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 size={16} className="animate-spin text-slate-400" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {Object.keys(rowSelection).length > 0 && permissions?.delete && (
              <button
                onClick={() => {
                  const selectedIds = table.getSelectedRowModel().rows.map(r => r.original.id!).filter(Boolean);
                  if (onBulkDelete && selectedIds.length > 0) {
                    onBulkDelete(selectedIds);
                    setRowSelection({});
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-all shadow-md"
              >
                <Trash2 size={14} />
                Bulk Delete ({Object.keys(rowSelection).length})
              </button>
            )}

            <div className="flex items-center gap-2 text-xs text-text-muted font-bold uppercase">
              <Filter size={14} />
              Quick Filters
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          <MultiSelect 
            label="Location" 
            options={locations} 
            selected={(table.getColumn('location_id')?.getFilterValue() as number[]) || []}
            onChange={(val) => table.getColumn('location_id')?.setFilterValue(val)}
          />
          <MultiSelect 
            label="Division" 
            options={divisions} 
            selected={(table.getColumn('division_id')?.getFilterValue() as number[]) || []}
            onChange={(val) => table.getColumn('division_id')?.setFilterValue(val)}
          />
          <MultiSelect 
            label="Class" 
            options={classes} 
            selected={(table.getColumn('class_id')?.getFilterValue() as number[]) || []}
            onChange={(val) => table.getColumn('class_id')?.setFilterValue(val)}
          />
          <MultiSelect 
            label="Category" 
            options={categories} 
            selected={(table.getColumn('category_id')?.getFilterValue() as number[]) || []}
            onChange={(val) => table.getColumn('category_id')?.setFilterValue(val)}
          />
          <MultiSelect 
            label="Group" 
            options={groups} 
            selected={(table.getColumn('group_id')?.getFilterValue() as number[]) || []}
            onChange={(val) => table.getColumn('group_id')?.setFilterValue(val)}
          />
          <MultiSelect 
            label="Department" 
            options={departments} 
            selected={(table.getColumn('department_id')?.getFilterValue() as number[]) || []}
            onChange={(val) => table.getColumn('department_id')?.setFilterValue(val)}
          />
          <MultiSelect 
            label="Designation" 
            options={designations} 
            selected={(table.getColumn('designation')?.getFilterValue() as number[]) || []}
            onChange={(val) => table.getColumn('designation')?.setFilterValue(val)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id}
                      className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map(row => (
                  <tr 
                    key={row.id}
                    onClick={() => onEdit(row.original)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-4">
                      <Search size={32} className="opacity-20" />
                      <div>
                        <p className="text-sm font-medium">No employees found matching your criteria</p>
                        <p className="text-xs opacity-60">Try adjusting your filters or add a new record.</p>
                      </div>
                      {permissions?.addUpdate && (
                        <button
                          onClick={() => {
                            // This is a bit tricky since onEdit is passed but handleAddNew is not.
                            // However, we can use a custom event or just rely on the header button.
                            // For now, let's just show the message.
                            // Actually, let's pass a new prop or just use the header button.
                            const headerBtn = document.querySelector('button.app-btn-primary') as HTMLButtonElement;
                            headerBtn?.click();
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-primary-navy text-white text-xs font-bold rounded-lg hover:bg-opacity-90 transition-all shadow-md"
                        >
                          <Plus size={16} />
                          Add First Employee
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination 
          currentPage={table.getState().pagination.pageIndex + 1}
          totalPages={table.getPageCount()}
          totalRecords={table.getFilteredRowModel().rows.length}
          pageSize={table.getState().pagination.pageSize}
          onPageChange={(page) => table.setPageIndex(page - 1)}
        />
      </div>
    </div>
  );
}
