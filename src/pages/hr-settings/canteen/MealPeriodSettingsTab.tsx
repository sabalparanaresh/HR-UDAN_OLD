import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { invokeCommand } from '../../../services/apiClient';
import { useModule } from '../../../contexts/ModuleContext';
import { motion, AnimatePresence } from 'motion/react';

interface TimeWindow {
  id?: number;
  name: string;
  start_time: string;
  end_time: string;
}

export default function MealPeriodSettingsTab() {
  const { currentMode } = useModule();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [windows, setWindows] = useState<TimeWindow[]>([]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data: any = await invokeCommand('get_canteen_master_data', { moduleType: currentMode });
        if (data.windows) setWindows(data.windows);
      } catch (err) {
        toast.error('Failed to load meal periods');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [currentMode]);

  const handleAddWindow = () => {
    setWindows([...windows, { name: '', start_time: '00:00', end_time: '00:00' }]);
  };

  const handleRemoveWindow = async (index: number, id?: number) => {
    if (id) {
      try {
        await invokeCommand('master_crud', {
          tableName: 'canteen_time_windows',
          operation: 'delete',
          id,
          moduleType: currentMode
        });
      } catch (error) {
        toast.error('Failed to delete period');
        return;
      }
    }
    const newWindows = [...windows];
    newWindows.splice(index, 1);
    setWindows(newWindows);
  };

  const handleSaveWindows = async () => {
    setIsSaving(true);
    try {
      for (const window of windows) {
        await invokeCommand('master_crud', {
          tableName: 'canteen_time_windows',
          operation: window.id ? 'update' : 'create',
          id: window.id,
          data: window,
          moduleType: currentMode
        });
      }
      toast.success('Meal periods saved successfully');
    } catch (error) {
      toast.error('Failed to save periods');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline-block text-primary-navy" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="textile-card p-6 bg-white border-app-border shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-app-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-navy/10 rounded-lg text-primary-navy">
            <Clock size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary-navy uppercase tracking-tight">Daily Meal Periods</h2>
            <p className="text-[10px] uppercase text-text-muted font-bold font-mono tracking-wider">Multiple punches within the same period count as a single meal.</p>
          </div>
        </div>
        <button 
          onClick={handleAddWindow}
          className="p-2 text-white bg-primary-navy hover:bg-primary-navy/90 rounded-lg transition-all"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AnimatePresence>
          {windows.map((window, idx) => (
            <motion.div 
              key={window.id || idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-4 bg-slate-50 rounded-2xl border border-app-border space-y-3 relative group hover:border-primary-navy/40 transition-colors"
            >
              <button 
                onClick={() => handleRemoveWindow(idx, window.id)}
                className="absolute top-2 right-2 p-1 text-primary-red opacity-0 group-hover:opacity-100 transition-all bg-red-50 rounded-md"
              >
                <Trash2 size={14} />
              </button>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Period Name</label>
                <input 
                  type="text" 
                  value={window.name || ''}
                  onChange={(e) => {
                    const newWindows = [...windows];
                    newWindows[idx].name = e.target.value;
                    setWindows(newWindows);
                  }}
                  placeholder="e.g. Lunch, Dinner, Snacks"
                  className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-lg font-bold text-primary-navy"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Start Time</label>
                  <input 
                    type="time" 
                    value={window.start_time || ''}
                    onChange={(e) => {
                      const newWindows = [...windows];
                      newWindows[idx].start_time = e.target.value;
                      setWindows(newWindows);
                    }}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">End Time</label>
                  <input 
                    type="time" 
                    value={window.end_time || ''}
                    onChange={(e) => {
                      const newWindows = [...windows];
                      newWindows[idx].end_time = e.target.value;
                      setWindows(newWindows);
                    }}
                    className="w-full bg-white border border-app-border p-2 text-sm focus:outline-none focus:border-primary-navy rounded-lg font-mono"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {windows.length > 0 && (
        <div className="flex justify-end pt-4">
          <button 
            onClick={handleSaveWindows}
            disabled={isSaving}
            className="px-6 py-3 bg-primary-green text-white rounded-xl font-bold hover:bg-primary-green/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-green/20"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Confirm & Save All Periods
          </button>
        </div>
      )}
    </motion.div>
  );
}
