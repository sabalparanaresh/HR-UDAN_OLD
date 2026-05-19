import { create } from 'zustand';

export type TaskStatus = 'idle' | 'running' | 'completed' | 'error' | 'cancelled';

export interface AttendanceProgressData {
  processed: number;
  total: number;
  percentage: number;
}

interface AttendanceTaskState {
  status: TaskStatus;
  progress: AttendanceProgressData | null;
  summary: any | null;
  error: string | null;
  startTime: number | null;
  rowsPerSec: number;
  etaSeconds: number | null;
  
  startTask: () => void;
  updateProgress: (data: AttendanceProgressData) => void;
  completeTask: (summary: any) => void;
  setError: (error: string) => void;
  cancelTask: () => void;
  resetTask: () => void;
}

export const useAttendanceTaskStore = create<AttendanceTaskState>((set, get) => ({
  status: 'idle',
  progress: null,
  summary: null,
  error: null,
  startTime: null,
  rowsPerSec: 0,
  etaSeconds: null,

  startTask: () => set({ 
    status: 'running', 
    progress: { processed: 0, total: 0, percentage: 0 },
    summary: null,
    error: null,
    startTime: Date.now(),
    rowsPerSec: 0,
    etaSeconds: null
  }),

  updateProgress: (data) => {
    const state = get();
    if (state.status !== 'running') return;

    let rowsPerSec = 0;
    let etaSeconds = null;

    if (state.startTime && data.processed > 0) {
      const elapsedMs = Date.now() - state.startTime;
      if (elapsedMs > 0) {
        rowsPerSec = Math.round((data.processed / elapsedMs) * 1000);
        
        if (rowsPerSec > 0) {
          const remainingRows = Math.max(0, data.total - data.processed);
          etaSeconds = Math.round(remainingRows / rowsPerSec);
        }
      }
    }

    set({ 
      progress: data,
      rowsPerSec,
      etaSeconds
    });
  },

  completeTask: (summary) => set({ 
    status: 'completed', 
    summary,
    rowsPerSec: 0,
    etaSeconds: null
  }),

  setError: (error) => set({ 
    status: 'error', 
    error,
    rowsPerSec: 0,
    etaSeconds: null
  }),

  cancelTask: () => set({ 
    status: 'cancelled',
    rowsPerSec: 0,
    etaSeconds: null
  }),

  resetTask: () => set({
    status: 'idle',
    progress: null,
    summary: null,
    error: null,
    startTime: null,
    rowsPerSec: 0,
    etaSeconds: null
  })
}));
