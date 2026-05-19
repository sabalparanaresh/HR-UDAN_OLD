import React, { useState } from 'react';
import { X, Usb, FolderDown, Download, Printer, HardDriveDownload, ShieldCheck, Mail } from 'lucide-react';
import { useModule } from '../../contexts/ModuleContext';
import { invokeCommand as invoke } from '../../services/apiClient';
import { toast } from 'sonner';

interface DistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportName: string;
  baseTable: string;
  columns: any[];
  calculatedCols?: any[];
  filters: any[];
  sorts: any[];
  currentUser: any;
}

export function DistributionModal({ 
  isOpen, 
  onClose, 
  reportName,
  baseTable,
  columns,
  calculatedCols,
  filters,
  sorts,
  currentUser
}: DistributionModalProps) {
  const { currentMode } = useModule();
  const [selectedTarget, setSelectedTarget] = useState<'BUNDLE' | 'LOCAL_FOLDER' | 'USB_COPY' | 'PRINT_PACKET'>('BUNDLE');
  const [targetPath, setTargetPath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleDistribute = async () => {
    if ((selectedTarget === 'LOCAL_FOLDER' || selectedTarget === 'USB_COPY') && !targetPath) {
       toast.error(`Please provide a path for ${selectedTarget === 'USB_COPY' ? 'USB drive' : 'Local Folder'}`);
       return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        target: selectedTarget,
        targetPath: targetPath,
        reportName: reportName || 'Custom Report',
        base_table: baseTable,
        module_type: currentMode,
        columns,
        calculatedCols,
        filters,
        sorts,
        author: currentUser?.name || 'Unknown',
        user_id: currentUser?.id || 'system'
      };

      const res = await invoke('distribute_report', payload) as any;
      
      if (res && res.status === 'success') {
         // Immutable Log created on backend.
         if (res.message) {
            toast.success(res.message);
         } else {
            toast.success(`Distrubution via ${selectedTarget} successful!`);
         }

         // If bundle or print, handle the base64 output for download
         if ((selectedTarget === 'BUNDLE' || selectedTarget === 'PRINT_PACKET') && res.base64) {
            const byteCharacters = atob(res.base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = res.filename || 'bundle.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (selectedTarget === 'PRINT_PACKET') {
                // In a real web app, we might open a PDF generator, here we downloaded Excel.
                toast.success('Printable Packet ready for printing.');
            }
         }
         onClose();
      } else {
         throw new Error(res.error || "Failed to distribute");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Distribution failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-app-border bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-black text-primary-navy tracking-tight flex items-center gap-2">
               <HardDriveDownload size={20} className="text-indigo-600" />
               Report Distribution
            </h3>
            <p className="text-xs font-mono text-slate-500 mt-1 flex items-center gap-1">
               <ShieldCheck size={12} className="text-emerald-600" />
               Immutable distribution logs are generated for all actions.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 rounded-lg p-1.5 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
           <div className="grid grid-cols-2 gap-4 mb-6">
              
              <button 
                onClick={() => setSelectedTarget('BUNDLE')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedTarget === 'BUNDLE' 
                  ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' 
                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                }`}
              >
                 <Download size={24} className={`mb-3 ${selectedTarget === 'BUNDLE' ? 'text-indigo-600' : 'text-slate-500'}`} />
                 <h4 className="font-bold text-slate-800 text-sm">Export Bundle</h4>
                 <p className="text-xs text-slate-500 mt-1 leading-relaxed">Download a packaged data bundle directly to your machine.</p>
              </button>

              <button 
                onClick={() => setSelectedTarget('LOCAL_FOLDER')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedTarget === 'LOCAL_FOLDER' 
                  ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' 
                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                }`}
              >
                 <FolderDown size={24} className={`mb-3 ${selectedTarget === 'LOCAL_FOLDER' ? 'text-indigo-600' : 'text-slate-500'}`} />
                 <h4 className="font-bold text-slate-800 text-sm">Local Delivery</h4>
                 <p className="text-xs text-slate-500 mt-1 leading-relaxed">Deliver directly to a connected local intranet folder or mapped drive.</p>
              </button>

              <button 
                onClick={() => setSelectedTarget('USB_COPY')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedTarget === 'USB_COPY' 
                  ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' 
                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                }`}
              >
                 <Usb size={24} className={`mb-3 ${selectedTarget === 'USB_COPY' ? 'text-indigo-600' : 'text-slate-500'}`} />
                 <h4 className="font-bold text-slate-800 text-sm">USB Copy Workflow</h4>
                 <p className="text-xs text-slate-500 mt-1 leading-relaxed">Securely transfer to an authorized offline USB drive.</p>
              </button>

              <button 
                onClick={() => setSelectedTarget('PRINT_PACKET')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedTarget === 'PRINT_PACKET' 
                  ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' 
                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                }`}
              >
                 <Printer size={24} className={`mb-3 ${selectedTarget === 'PRINT_PACKET' ? 'text-indigo-600' : 'text-slate-500'}`} />
                 <h4 className="font-bold text-slate-800 text-sm">Printable Packet</h4>
                 <p className="text-xs text-slate-500 mt-1 leading-relaxed">Generate a specifically formatted packet optimized for standard printing.</p>
              </button>

           </div>

           {(selectedTarget === 'LOCAL_FOLDER' || selectedTarget === 'USB_COPY') && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-top-2">
                 <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">
                   {selectedTarget === 'USB_COPY' ? 'USB Drive Root Path' : 'Target Folder Path'}
                 </label>
                 <input 
                   type="text" 
                   value={targetPath}
                   onChange={e => setTargetPath(e.target.value)}
                   className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono focus:border-indigo-500 outline-none"
                   placeholder={selectedTarget === 'USB_COPY' ? 'e.g., E:\\' : 'e.g., C:\\Reports\\May2026'}
                 />
                 <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                    <ShieldCheck size={12}/> The exact delivery path is recorded in the permanent audit trail.
                 </p>
              </div>
           )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-app-border bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button 
            onClick={handleDistribute}
            disabled={isProcessing}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 hover:shadow transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing ? 'Processing...' : `Execute ${selectedTarget.replace('_', ' ')}`}
          </button>
        </div>

      </div>
    </div>
  );
}
