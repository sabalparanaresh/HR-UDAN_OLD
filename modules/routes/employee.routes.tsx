import React from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../../components/auth';
import { useAuthStore } from '../../store/authStore';
import { User } from '../../types';

import EmployeeMaster from '../../pages/employee/EmployeeMaster';

export const EmployeeRoutes = (currentUser: User | null) => {
  return (
    <Route path="employee">
      <Route path="master" element={<ProtectedRoute moduleCode="K" pageKey="employeeMaster"><EmployeeMaster currentUser={currentUser!} /></ProtectedRoute>} />
    </Route>
  );
};
