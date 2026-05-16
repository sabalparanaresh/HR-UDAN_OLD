import React from 'react';
import { Database } from 'lucide-react';

interface AuthScreenProps {
  children: React.ReactNode;
}

export function AuthScreen({ children }: AuthScreenProps) {
  return (
    <div className="min-h-screen bg-app-bg text-text-main flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary-navy mx-auto flex items-center justify-center rounded-md shadow-lg">
            <Database className="text-white w-10 h-10" />
          </div>
          <h1 className="textile-header text-4xl font-black tracking-tighter text-primary-navy">HR-UDAN</h1>
          <p className="text-primary-navy/70 font-mono text-xs uppercase tracking-widest">Textile ERP // Secure Access</p>
        </div>

        <div className="textile-card p-8 bg-card-bg backdrop-blur-xl border-app-border shadow-2xl">
          {children}
        </div>
        <p className="text-center text-[10px] text-text-muted font-mono uppercase tracking-widest">
          Authorized Personnel Only // Session Monitored
        </p>
      </div>
    </div>
  );
}
