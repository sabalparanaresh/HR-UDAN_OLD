import React, { useState } from 'react';
import { fetchApi } from '../../services/apiClient';
import { User } from '../../types';

interface LoginFormProps {
  onLoginSuccess: (user: User) => void;
  onForgotPassword: () => void;
}

export function LoginForm({ onLoginSuccess, onForgotPassword }: LoginFormProps) {
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const data = await fetchApi<User>('/api/auth/login', { 
        method: 'POST',
        body: JSON.stringify({
          username: loginUsername, 
          password: loginPassword
        })
      });
      onLoginSuccess(data);
    } catch (err: any) {
      setAuthError(String(err) || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-6">
      <h2 className="textile-header text-xl font-bold border-b border-app-border pb-2 text-primary-navy">System Login</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] textile-header text-text-muted uppercase">Username</label>
          <input 
            required
            type="text" 
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
            placeholder="admin / clerk"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] textile-header text-text-muted uppercase">Password</label>
          <input 
            required
            type="password" 
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md"
            placeholder="••••••••"
          />
        </div>
      </div>
      {authError && <p className="text-primary-red text-xs font-mono bg-primary-red/10 p-2 border border-primary-red/20 rounded-md">{authError}</p>}
      <button type="submit" className="app-btn app-btn-primary w-full py-3 textile-header font-bold shadow-md hover:shadow-lg transition-all">
        Authorize Access
      </button>
      <button 
        type="button" 
        onClick={onForgotPassword}
        className="w-full text-xs text-text-muted hover:text-primary-navy transition-colors font-mono uppercase"
      >
        Forgot Password?
      </button>
    </form>
  );
}
