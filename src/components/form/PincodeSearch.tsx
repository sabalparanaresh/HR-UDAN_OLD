import React, { useState } from 'react';
import { Search, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PincodeData {
  pincode: string;
  statename: string;
  districtname: string;
  officename: string;
}

interface PincodeSearchProps {
  onResult: (data: PincodeData[]) => void;
  onNotFound: () => void;
  defaultValue?: string;
  className?: string;
  moduleType?: string;
}

import { invokeCommand as invoke, fetchApi } from '../../services/apiClient';

export default function PincodeSearch({ onResult, onNotFound, defaultValue = '', className, moduleType }: PincodeSearchProps) {
  const [pincode, setPincode] = useState(String(defaultValue || ''));
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // Sync with defaultValue changes
  React.useEffect(() => {
    if (defaultValue) {
      setPincode(String(defaultValue));
    }
  }, [defaultValue]);

  const handleSearch = async () => {
    if (pincode.length !== 6) {
      toast.error("Please enter a valid 6-digit Pincode");
      return;
    }

    setIsLoading(true);
    setIsVerified(false);

    try {
      const data = await fetchApi('/api/system/cmd/fetchPincodeDetails', { method: 'POST', body: JSON.stringify({ pincode, moduleType }) });
      onResult(data);
      setIsVerified(true);
      toast.success(`${data.length} records found for Pincode`);
    } catch (error: any) {
      onNotFound();
      toast.error("Pincode not found in local database. Manual entry enabled.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-[10px] textile-header text-text-muted uppercase flex items-center justify-between">
        <span>Pincode</span>
        {isVerified && (
          <span className="flex items-center gap-1 text-primary-green font-bold normal-case animate-in fade-in slide-in-from-right-2">
            <CheckCircle2 size={10} />
            Verified
          </span>
        )}
      </label>
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary-navy transition-colors">
          <MapPin size={16} />
        </div>
        <input 
          type="text"
          value={pincode}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
            setPincode(val);
            if (isVerified) setIsVerified(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pincode.length === 6) {
              e.preventDefault();
              handleSearch();
            }
          }}
          placeholder="6-digit PIN"
          className="w-full bg-slate-50 border border-app-border pl-10 pr-12 py-2 text-sm focus:outline-none focus:border-primary-navy transition-colors rounded-md font-mono"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={isLoading || pincode.length !== 6}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-primary-navy text-white rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Verify Pincode"
        >
          {isLoading ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
        </button>
      </div>
    </div>
  );
}
