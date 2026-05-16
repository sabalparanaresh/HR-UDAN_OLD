import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface PasswordResetFormProps {
  onBackToLogin: () => void;
}

export function PasswordResetForm({ onBackToLogin }: PasswordResetFormProps) {
  const [resetMobile, setResetMobile] = useState('');
  const [resetDOB, setResetDOB] = useState('');
  const [resetQ1, setResetQ1] = useState('');
  const [resetA1, setResetA1] = useState('');
  const [resetQ2, setResetQ2] = useState('');
  const [resetA2, setResetA2] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetStep, setResetStep] = useState(1);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const handleResetVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const data = await invoke<any>('verify_identity', { 
        mobile: resetMobile,
        birth_date: resetDOB,
        answer_1: resetA1,
        answer_2: resetA2
      });
      setResetToken(data.token);
      setResetStep(3);
    } catch (err: any) {
      setAuthError(String(err.error || err) || 'Verification failed');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      await invoke('reset_password_with_token', { 
        token: resetToken, 
        new_password: resetNewPassword 
      });
      setResetStep(1);
      setAuthError('Password reset successful. Please login.');
      // Keep it on step 1 with the success message, they can click "Back to Login"
    } catch (err: any) {
      setAuthError(String(err.error || err) || 'Reset failed');
    }
  };

  return (
    <form onSubmit={resetStep === 3 ? handleResetPassword : (e) => { e.preventDefault(); setResetStep(2); }} className="space-y-6">
      <h2 className="textile-header text-xl font-bold border-b border-app-border pb-2 text-primary-navy">Identity Recovery</h2>
      <div className="space-y-4">
        {resetStep === 1 && (
          <div className="space-y-2">
            <label className="text-[10px] textile-header text-text-muted uppercase">Mobile Number</label>
            <input required type="text" value={resetMobile} onChange={(e) => setResetMobile(e.target.value)} className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md" placeholder="+91 9876543210" />
          </div>
        )}
        
        {resetStep === 2 && (
          <>
            <div className="space-y-2">
              <label className="text-[10px] textile-header text-text-muted uppercase">Date of Birth</label>
              <input required type="date" value={resetDOB} onChange={(e) => setResetDOB(e.target.value)} className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] textile-header text-text-muted uppercase">Secret Answer 1</label>
              <input required type="text" value={resetA1} onChange={(e) => setResetA1(e.target.value)} className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md" placeholder="Enter answer" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] textile-header text-text-muted uppercase">Secret Answer 2</label>
              <input required type="text" value={resetA2} onChange={(e) => setResetA2(e.target.value)} className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md" placeholder="Enter answer" />
            </div>
          </>
        )}

        {resetStep === 3 && (
          <div className="space-y-2">
            <label className="text-[10px] textile-header text-text-muted uppercase">New Password</label>
            <input required type="password" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} className="w-full bg-slate-50 border border-app-border p-3 text-sm focus:outline-none focus:border-primary-navy transition-colors font-mono rounded-md" placeholder="••••••••" />
          </div>
        )}
      </div>
      {authError && <p className={`text-xs font-mono p-2 border rounded-md ${authError.includes('successful') ? 'bg-green-100 text-green-700 border-green-200' : 'bg-primary-red/10 text-primary-red border-primary-red/20'}`}>{authError}</p>}
      
      {resetStep === 1 && <button type="submit" className="app-btn app-btn-primary w-full py-3 textile-header font-bold shadow-md transition-all">Proceed</button>}
      {resetStep === 2 && <button type="button" onClick={handleResetVerify} className="app-btn app-btn-primary w-full py-3 textile-header font-bold shadow-md transition-all">Verify Answers</button>}
      {resetStep === 3 && <button type="submit" className="app-btn app-btn-primary w-full py-3 textile-header font-bold shadow-md transition-all">Update Password</button>}
      
      <button type="button" onClick={onBackToLogin} className="w-full text-xs text-text-muted hover:text-primary-navy transition-colors font-mono uppercase">Back to Login</button>
    </form>
  );
}
