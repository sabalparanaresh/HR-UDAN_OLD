import React, { useState, useEffect } from 'react';
import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';
import { 
  MessageSquare, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  ShieldAlert,
  ArrowRight,
  User,
  Calendar,
  X,
  Send
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, isAfter, parseISO } from 'date-fns';
import { useModule } from '../../contexts/ModuleContext';

interface Grievance {
  id: number;
  employee_id: number | null;
  employee_name: string | null;
  emp_code: string | null;
  category_name: string;
  criticality: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  is_anonymous: number;
  expected_resolution_date: string;
  status: string;
  created_at: string;
}

export default function GrievanceDashboard() {
  const { currentMode } = useModule();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchGrievances();
  }, [currentMode]);

  const fetchGrievances = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi('/api/employee/cmd/getOpenGrievances', { method: 'POST', body: JSON.stringify({ moduleType: currentMode }) });
      setGrievances(data);
    } catch (err) {
      toast.error("Failed to fetch grievances");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      toast.error("Please provide resolution notes");
      return;
    }

    setIsSubmitting(true);
    try {
      await fetchApi('/api/employee/cmd/resolveGrievance', { method: 'POST', body: JSON.stringify({
        id: resolvingId,
        resolution_notes: resolutionNotes,
        moduleType: currentMode
      }) });
      toast.success("Grievance resolved successfully");
      setResolvingId(null);
      setResolutionNotes('');
      fetchGrievances();
    } catch (err) {
      toast.error("Failed to resolve grievance");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusInfo = (expectedDate: string) => {
    const target = parseISO(expectedDate);
    const now = new Date();
    const isOverdue = isAfter(now, target);
    const daysLeft = differenceInDays(target, now);

    return {
      isOverdue,
      daysLeft,
      text: isOverdue ? 'Overdue' : `${daysLeft} days remaining`
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">Grievance Dashboard</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">HR Management // Active Issues</p>
        </div>
        <div className="flex gap-2">
          <div className="px-4 py-2 bg-white border border-app-border rounded-md shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-primary-navy uppercase tracking-wider">Live Monitoring</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="animate-spin text-primary-navy" size={40} />
          <p className="text-text-muted font-mono text-xs uppercase tracking-widest">Fetching active grievances...</p>
        </div>
      ) : grievances.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {grievances.map((g) => {
            const status = getStatusInfo(g.expected_resolution_date);
            return (
              <div 
                key={g.id} 
                className={`textile-card bg-white border-app-border overflow-hidden flex flex-col transition-all hover:shadow-lg ${
                  status.isOverdue ? 'ring-2 ring-red-500 animate-pulse' : ''
                }`}
              >
                {/* Header */}
                <div className={`px-5 py-3 flex justify-between items-center border-b border-app-border ${
                  status.isOverdue ? 'bg-red-50' : 'bg-gray-50'
                }`}>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                    g.criticality === 'Critical' ? 'bg-red-600 text-white' :
                    g.criticality === 'High' ? 'bg-orange-500 text-white' :
                    g.criticality === 'Medium' ? 'bg-blue-600 text-white' :
                    'bg-green-600 text-white'
                  }`}>
                    {g.criticality}
                  </span>
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <Clock size={12} />
                    <span className={`text-[10px] font-mono font-bold uppercase ${status.isOverdue ? 'text-red-600' : ''}`}>
                      {status.text}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-primary-navy leading-tight">{g.category_name}</h3>
                      <p className="text-[10px] font-mono text-text-muted uppercase">ID: #GRV-{g.id}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-primary-navy/5 flex items-center justify-center text-primary-navy">
                      {g.is_anonymous ? <ShieldAlert size={20} /> : <User size={20} />}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded border border-app-border/50">
                    <p className="text-xs text-text-main line-clamp-3 italic leading-relaxed">
                      "{g.description}"
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono text-text-muted uppercase">Reported By</p>
                      <p className="text-xs font-bold text-primary-navy truncate">
                        {g.is_anonymous ? 'Anonymous' : g.employee_name}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono text-text-muted uppercase">Target Date</p>
                      <p className="text-xs font-bold text-primary-navy">
                        {format(parseISO(g.expected_resolution_date), 'dd MMM yyyy')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-app-border mt-auto">
                  <button
                    onClick={() => setResolvingId(g.id)}
                    className="w-full app-btn app-btn-primary flex items-center justify-center gap-2 text-xs py-2"
                  >
                    Quick Resolve <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="textile-card p-20 bg-white border-app-border flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-600">
            <CheckCircle2 size={40} />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-primary-navy">All Clear!</h3>
            <p className="text-text-muted max-w-sm">No open grievances found. Your workplace relations are looking great.</p>
          </div>
        </div>
      )}

      {/* Resolution Modal */}
      {resolvingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-navy/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="textile-card w-full max-w-lg bg-white shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="px-6 py-4 border-b border-app-border flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-green-600" size={20} />
                <h3 className="font-bold text-primary-navy uppercase tracking-wider">Resolve Grievance</h3>
              </div>
              <button onClick={() => setResolvingId(null)} className="text-text-muted hover:text-primary-navy transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Resolution Notes</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="app-input min-h-[150px] p-4 text-sm"
                  placeholder="Describe the steps taken to resolve this issue..."
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setResolvingId(null)}
                  className="flex-1 app-btn app-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={isSubmitting}
                  className="flex-[2] app-btn app-btn-primary flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  Confirm Resolution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
