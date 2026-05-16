import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MasterUsageWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  message: string;
}

export default function MasterUsageWarningModal({
  isOpen,
  onClose,
  onProceed,
  message
}: MasterUsageWarningModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-yellow-100"
          >
            <div className="bg-yellow-50 p-4 flex items-center justify-between border-b border-yellow-200">
              <div className="flex items-center gap-2 text-yellow-700">
                <AlertTriangle size={20} />
                <h3 className="font-bold text-lg">Warning</h3>
              </div>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-gray-700 leading-relaxed font-medium">
                {message}
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onProceed();
                    onClose();
                  }}
                  className="flex-1 px-4 py-3 text-sm font-bold text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors shadow-lg shadow-yellow-200"
                >
                  Proceed
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
