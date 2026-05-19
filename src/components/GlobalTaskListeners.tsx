import React from 'react';
import { useAttendanceTaskListener } from '../hooks/useAttendanceTaskListener';
import { BulkAttendanceProgressModal } from './BulkAttendanceProgressModal';

export const GlobalTaskListeners: React.FC = () => {
  useAttendanceTaskListener();

  return (
    <>
      <BulkAttendanceProgressModal />
    </>
  );
};
