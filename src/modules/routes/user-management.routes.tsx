import React from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../../components/auth';
import { useAuthStore } from '../../store/authStore';
import { User } from '../../types';

import UserManagementTabs from '../../pages/user-management/UserManagementTabs';
import SystemConnection from '../../pages/user-management/SystemConnection';

export const UserManagementRoutes = (currentUser: User | null) => {
  return (
    <Route path="user-management">
      <Route path="access-control" element={<ProtectedRoute moduleCode="K" pageKey="userManagementK"><UserManagementTabs /></ProtectedRoute>} />
      <Route path="system-connection" element={<ProtectedRoute moduleCode="*" pageKey="systemConnection"><SystemConnection currentUser={currentUser!} /></ProtectedRoute>} />
    </Route>
  );
};
