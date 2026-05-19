import { useEffect } from 'react';

import { useAttendanceTaskStore } from '../store/attendanceTaskStore';
import { AttendanceProgressData } from '../store/attendanceTaskStore';

export const useAttendanceTaskListener = () => {
  const { updateProgress, completeTask, setError } = useAttendanceTaskStore();

  useEffect(() => {
    let eventSource: EventSource | null = null;
    
    const setupListeners = async () => {
      try {
        eventSource = new EventSource('/api/events');
        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.event === 'bulk-attendance-progress') updateProgress(data.payload);
            else if (data.event === 'bulk-attendance-complete') completeTask(data.payload);
            else if (data.event === 'bulk-attendance-error') setError(data.payload.error);
          } catch(err) {}
        };
      } catch (err) {
        console.error("Failed to setup attendance task listeners", err);
      }
    };

    setupListeners();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);
};
