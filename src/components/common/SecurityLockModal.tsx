import React, { useState } from 'react';
import { ShieldAlert, X, Lock, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { invoke } from '@tauri-apps/api/tauri';

interface SecurityLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

export default function SecurityLockModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Security Verification Required",
  description = "Please enter the security key to proceed with this sensitive action."
}: SecurityLockModalProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError('');

    try {
      const response = await invoke('verify_security_key', { key }) as { verified: boolean };
      if (response.verified) {
        onConfirm();
        setKey('');
        onClose();
      } else {
        setError('Invalid security key. Access denied.');
      }
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-red-100"
          >
            <div className="bg-red-50 p-4 flex items-center justify-between border-b border-red-100">
              <div className="flex items-center gap-2 text-red-600">
                <ShieldAlert size={20} />
                <h3 className="font-bold">{title}</h3>
              </div>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                {description}
              </p>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Security Key
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="password"
                    autoFocus
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all font-mono"
                  />
                </div>
                {error && (
                  <motion.p 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs text-red-600 font-medium"
                  >
                    {error}
                  </motion.p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || !key}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    "Verify & Proceed"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
