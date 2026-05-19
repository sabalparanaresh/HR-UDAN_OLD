import React, { useState, useEffect, useRef } from 'react';
import { invokeCommand as invoke } from '../../services/apiClient';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  Calendar as CalendarIcon,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  List,
  Grid
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO,
  isWeekend
} from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from '../../utils/xlsx';

import { useModule } from '../../contexts/ModuleContext';
import { Pagination } from '../../components/common/Pagination';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Holiday {
  id: number;
  date: string;
  name: string;
  status: number;
}

export default function HolidayMaster() {
  const { currentMode } = useModule();

  const getUrl = (path: string) => currentMode === 'P' ? `/api/statutory${path}` : `/api${path}`;

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    name: '',
    status: 1
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHolidays = async () => {
    try {
      const data = await invoke<Holiday[]>('master_crud', {
        tableName: 'holidays',
        operation: 'list',
        moduleType: currentMode
      });
      setHolidays(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error("Failed to fetch holidays");
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [currentMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await invoke('master_crud', {
        tableName: 'holidays',
        operation: editingHoliday ? 'update' : 'create',
        id: editingHoliday?.id,
        data: formData,
        moduleType: currentMode
      });

      toast.success(`Holiday ${editingHoliday ? 'updated' : 'created'} successfully`);
      setIsModalOpen(false);
      fetchHolidays();
    } catch (error) {
      toast.error("Error saving holiday");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return;
    try {
      await invoke('master_crud', {
        tableName: 'holidays',
        operation: 'delete',
        id,
        moduleType: currentMode
      });
      toast.success("Holiday deleted successfully");
      fetchHolidays();
    } catch (error) {
      toast.error("Error deleting holiday");
    }
  };

  const downloadTemplate = () => {
    const headers = [['date', 'name', 'status']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "holiday_template.xlsx");
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = await XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      try {
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
        const chunkSize = 200;
        
        for (let i = 0; i < jsonData.length; i += chunkSize) {
          const chunk = jsonData.slice(i, i + chunkSize);
          await invoke('master_crud', {
            tableName: 'holidays',
            operation: 'bulk_create',
            data: chunk,
            moduleType: currentMode
          });
        }
        
        toast.success(`Bulk upload successful (${jsonData.length} records)`);
        fetchHolidays();
      } catch (error) {
        toast.error("Error during bulk upload");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const totalPages = Math.ceil(holidays.length / pageSize);
  const currentItems = holidays.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Calendar Logic
  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-lg border border-app-border shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-primary-navy uppercase tracking-wider">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-text-muted"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-navy hover:bg-slate-100 rounded-md transition-colors"
            >
              Today
            </button>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-text-muted"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="flex items-center bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode('calendar')}
            className={cn(
              "p-1.5 rounded-md transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider",
              viewMode === 'calendar' ? "bg-white text-primary-navy shadow-sm" : "text-text-muted hover:text-primary-navy"
            )}
          >
            <Grid size={14} /> Calendar
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={cn(
              "p-1.5 rounded-md transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider",
              viewMode === 'list' ? "bg-white text-primary-navy shadow-sm" : "text-text-muted hover:text-primary-navy"
            )}
          >
            <List size={14} /> List
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map(day => (
          <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest text-text-muted py-2">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({
      start: startDate,
      end: endDate
    });

    return (
      <div className="grid grid-cols-7 gap-px bg-app-border border border-app-border rounded-lg overflow-hidden shadow-sm">
        {calendarDays.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayHolidays = holidays.filter(h => h.date === dateStr && h.status === 1);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          const isOffDay = isWeekend(day);

          return (
            <div 
              key={idx}
              className={cn(
                "min-h-[100px] p-2 bg-white transition-colors relative group",
                !isCurrentMonth && "bg-slate-50 text-slate-300",
                isToday && "bg-primary-navy/5"
              )}
              onClick={() => {
                setEditingHoliday(null);
                setFormData({ date: dateStr, name: '', status: 1 });
                setIsModalOpen(true);
              }}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={cn(
                  "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                  isToday ? "bg-primary-navy text-white" : (isOffDay ? "text-primary-red" : "text-primary-navy"),
                  !isCurrentMonth && "opacity-30"
                )}>
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-1">
                {dayHolidays.map(h => (
                  <div 
                    key={h.id}
                    className="text-[10px] p-1 bg-primary-navy text-white rounded font-medium leading-tight truncate shadow-sm cursor-pointer hover:bg-primary-navy/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingHoliday(h);
                      setFormData({ date: h.date, name: h.name, status: h.status });
                      setIsModalOpen(true);
                    }}
                  >
                    {h.name}
                  </div>
                ))}
              </div>
              <button className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-primary-navy hover:bg-primary-navy/10 rounded transition-all">
                <Plus size={12} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-navy textile-header tracking-tight flex items-center gap-3">
            Holiday Master
            <span className="bg-primary-navy/10 text-primary-navy text-[10px] font-mono px-2 py-0.5 rounded-full border border-primary-navy/20">
              {holidays.length} RECORDS
            </span>
          </h1>
          <p className="text-text-muted text-sm">Manage company holidays and yearly calendar</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx,.xls" 
            onChange={handleBulkUpload} 
          />
          <div className="flex items-center gap-1 bg-white border border-app-border rounded-md p-1 shadow-sm">
            <button 
              onClick={downloadTemplate}
              className="p-2 text-text-muted hover:text-primary-navy transition-colors"
              title="Download Template"
            >
              <Download size={16} />
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-text-muted hover:text-primary-navy transition-colors border-l border-app-border"
              title="Bulk Upload"
            >
              <Upload size={16} />
            </button>
          </div>
          <button 
            onClick={() => {
              setEditingHoliday(null);
              setFormData({ date: format(new Date(), 'yyyy-MM-dd'), name: '', status: 1 });
              setIsModalOpen(true);
            }}
            className="app-btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Add Holiday
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-white p-6 rounded-xl border border-app-border shadow-sm">
          {renderHeader()}
          {renderDays()}
          {renderCells()}
        </div>
      ) : (
        <div className="textile-card bg-white border-app-border overflow-hidden shadow-sm">
          <div className="p-4 border-b border-app-border bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-sm font-bold text-primary-navy uppercase tracking-wider">Holiday List</h3>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('calendar')}
                className="p-1.5 rounded-md transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted hover:text-primary-navy"
              >
                <Grid size={14} /> Calendar
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className="p-1.5 rounded-md transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-white text-primary-navy shadow-sm"
              >
                <List size={14} /> List
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-app-border">
                  <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Date</th>
                  <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Holiday Name</th>
                  <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Status</th>
                  <th className="p-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-text-muted italic">No holidays found</td>
                  </tr>
                ) : (
                  currentItems.map(holiday => (
                    <tr key={holiday.id} className="border-b border-app-border hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <CalendarIcon size={14} className="text-primary-navy" />
                          <span className="text-sm font-medium text-primary-navy">{format(parseISO(holiday.date), 'dd MMM yyyy')}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-bold text-primary-navy uppercase tracking-tight">{holiday.name}</span>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                          holiday.status === 1 ? "bg-primary-green/10 text-primary-green" : "bg-primary-red/10 text-primary-red"
                        )}>
                          {holiday.status === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              setEditingHoliday(holiday);
                              setFormData({ date: holiday.date, name: holiday.name, status: holiday.status });
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-primary-navy hover:bg-primary-navy/10 rounded-md transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(holiday.id)}
                            className="p-2 text-primary-red hover:bg-primary-red/10 rounded-md transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={holidays.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Holiday Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-app-border bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-navy/10 flex items-center justify-center text-primary-navy">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-primary-navy uppercase tracking-wider">
                    {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
                  </h2>
                  <p className="text-text-muted text-xs">Enter holiday details below</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <XCircle size={20} className="text-text-muted" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Holiday Date</label>
                <input 
                  type="date" 
                  required
                  className="w-full p-2.5 bg-slate-50 border border-app-border rounded-lg text-sm focus:outline-none focus:border-primary-navy transition-colors"
                  value={formData.date || ''}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Holiday Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Independence Day"
                  className="w-full p-2.5 bg-slate-50 border border-app-border rounded-lg text-sm focus:outline-none focus:border-primary-navy transition-colors"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Status</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      className="hidden"
                      checked={formData.status === 1}
                      onChange={() => setFormData({ ...formData, status: 1 })}
                    />
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      formData.status === 1 ? "border-primary-navy bg-primary-navy" : "border-app-border group-hover:border-primary-navy"
                    )}>
                      {formData.status === 1 && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="text-sm font-medium text-primary-navy">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      className="hidden"
                      checked={formData.status === 0}
                      onChange={() => setFormData({ ...formData, status: 0 })}
                    />
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      formData.status === 0 ? "border-primary-red bg-primary-red" : "border-app-border group-hover:border-primary-red"
                    )}>
                      {formData.status === 0 && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="text-sm font-medium text-primary-navy">Inactive</span>
                  </label>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-app-border rounded-lg text-sm font-bold uppercase tracking-wider text-text-muted hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-primary-navy text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-primary-navy/90 transition-colors shadow-lg shadow-primary-navy/20"
                >
                  {editingHoliday ? 'Update Holiday' : 'Save Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
