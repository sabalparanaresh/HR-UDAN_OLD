import { ProtectedRoute } from './components/auth';
import { AuthScreen, LoginForm, PasswordResetForm } from './modules/auth';
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { invokeCommand as invoke, fetchApi } from './services/apiClient';
import { User } from './types';
import Layout from './components/layout/Layout';

import { 
  HrSettingsRoutes,
  EmployeeRoutes,
  TransactionsRoutes,
  ReportsRoutes,
  UserManagementRoutes
} from './modules/routes';

import { ShortcutProvider } from './components/common/ShortcutProvider';
import { ModuleProvider } from './contexts/ModuleContext';
import { Toaster } from 'sonner';

import { useAuthStore } from './store/authStore';

import { ErrorBoundary } from './components';
import { GlobalTaskListeners } from './components/GlobalTaskListeners';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const setUser = useAuthStore(state => state.setUser);
  const [isResetMode, setIsResetMode] = useState(false);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setUser(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setUser(null);
  };

  useEffect(() => {
    if (isLoggedIn) {
      // Process K -> P Sync Queue every 30 seconds
      const processSyncQueue = async () => {
        try {
          const res = await fetchApi('/api/master-data/crud-command', { method: 'POST', body: JSON.stringify({
            operation: 'process_sync_queue',
            tableName: 'employee_sync_queue',
            moduleType: 'K'
          }) });
          if (res?.processed && res.processed > 0) {
            console.log(`Processed ${res.processed} pending K -> P sync items`);
          }
        } catch(e) {
          console.error("Queue sync error:", e);
        }
      };

      // Initial check on login
      processSyncQueue();

      const interval = setInterval(processSyncQueue, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  return (
    <ModuleProvider>
      <ShortcutProvider>
        <GlobalTaskListeners />
        <Toaster position="top-right" richColors closeButton />
        {!isLoggedIn ? (
          <AuthScreen>
            {isResetMode ? (
              <PasswordResetForm onBackToLogin={() => setIsResetMode(false)} />
            ) : (
              <LoginForm 
                onLoginSuccess={handleLoginSuccess} 
                onForgotPassword={() => setIsResetMode(true)} 
              />
            )}
          </AuthScreen>
        ) : (
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout currentUser={currentUser} onLogout={handleLogout} />}>
                <Route index element={<Navigate to="/reports/dashboard" replace />} />
                
                {HrSettingsRoutes(currentUser)}
                {EmployeeRoutes(currentUser)}
                {TransactionsRoutes(currentUser)}
                {ReportsRoutes(currentUser)}
                {UserManagementRoutes(currentUser)}
              </Route>
            </Routes>
          </BrowserRouter>
        )}
      </ShortcutProvider>
    </ModuleProvider>
  );
}
