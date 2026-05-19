import React from 'react';
import { useReportingStore } from '../../store/reportingStore';
import { Filter } from 'lucide-react';

export function DynamicFiltersBar() {
  const { filters, setFilter } = useReportingStore();

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setFilter(e.target.name as any, e.target.value);
  };

  return (
    <div className="bg-white border-b p-4 shadow-sm z-10 relative">
      <div className="flex items-center gap-2 mb-4 text-slate-700">
        <Filter size={18} />
        <h3 className="font-semibold text-sm uppercase tracking-wider">Report Filters</h3>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Month</label>
          <select name="month" value={filters.month} onChange={handleFilterChange} className="w-full border border-slate-300 rounded p-1.5 text-sm">
            <option value="">All</option>
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Year</label>
          <select name="year" value={filters.year} onChange={handleFilterChange} className="w-full border border-slate-300 rounded p-1.5 text-sm">
            <option value="">All</option>
            <option value="2023">2023</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Department</label>
          <select name="department" value={filters.department} onChange={handleFilterChange} className="w-full border border-slate-300 rounded p-1.5 text-sm">
            <option value="">All</option>
            <option value="hr">HR</option>
            <option value="it">IT</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Employee</label>
          <input type="text" name="employee" placeholder="Search..." value={filters.employee} onChange={handleFilterChange} className="w-full border border-slate-300 rounded p-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
          <select name="category" value={filters.category} onChange={handleFilterChange} className="w-full border border-slate-300 rounded p-1.5 text-sm">
            <option value="">All</option>
            <option value="staff">Staff</option>
            <option value="worker">Worker</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Division</label>
          <select name="division" value={filters.division} onChange={handleFilterChange} className="w-full border border-slate-300 rounded p-1.5 text-sm">
            <option value="">All</option>
            <option value="div1">Division 1</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Contractor</label>
          <select name="contractor" value={filters.contractor} onChange={handleFilterChange} className="w-full border border-slate-300 rounded p-1.5 text-sm">
            <option value="">All</option>
            <option value="c1">Contractor 1</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Shift</label>
          <select name="shift" value={filters.shift} onChange={handleFilterChange} className="w-full border border-slate-300 rounded p-1.5 text-sm">
            <option value="">All</option>
            <option value="general">General</option>
            <option value="night">Night</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
          <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full border border-slate-300 rounded p-1.5 text-sm">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
    </div>
  );
}
