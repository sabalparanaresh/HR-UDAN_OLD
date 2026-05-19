import React from 'react';
import { AadharConsentData } from './types';

interface ViewerProps {
  data: AadharConsentData[];
  isLoading?: boolean;
}

export default function AadharConsentViewer({ data, isLoading }: ViewerProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading form data...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="p-8 text-center text-slate-500">No data available for the selected filters.</div>;
  }

  const record = data[0];

  return (
    <div className="flex justify-center p-8 bg-slate-200 min-h-screen overflow-auto">
      {/* A4 Paper Container */}
      <div 
        className="bg-white shadow-xl bg-white" 
        style={{ 
          width: '210mm', 
          minHeight: '297mm',
          padding: '20mm',
          fontFamily: 'serif' 
        }}
      >
        <div className="flex justify-between items-start mb-6 font-bold text-sm relative">
          <div className="flex-1 text-center font-serif flex flex-col items-center">
            <h1 className="text-[16px] uppercase underline tracking-wider mb-2 font-bold whitespace-nowrap">AADHAR HOLDER CONSENT FORM</h1>
            <h2 className="text-[14px] font-bold">Consent for Authentication</h2>
          </div>
          <div className="absolute right-0 top-0">
            {record.ref_number}
          </div>
        </div>

        <div className="text-sm leading-relaxed space-y-6 text-justify mt-12 w-[100%] max-w-[100%]">
          <p>
            I hereby consent to provide my Aadhaar Number, Biometric and/or One Time Pin (OTP) data for
            Aadhaar based authentication for the purpose of establishing my identity in the company as well as
            to EPFO or ESIC or any other organisation which is required for my employment to the {record.company_name} through my Aadhaar number information.
          </p>
          <p>
            I have no objection in authenticating myself and fully understand that information provided by me
            shall be used for authenticating my identity through Aadhaar Authentication System for the
            purpose stated above and no other purpose.
          </p>
          <p>
            I also understand that {record.company_name} shall ensure security /
            confidentiality of my personal identity data provided for the purpose of Aadhaar based
            authentication.
          </p>
        </div>

        <div className="mt-24 ml-auto w-1/2 text-sm font-semibold space-y-4">
          <div className="flex items-end">
            <div className="w-48">Signature/Thumb Impression</div>
            <div className="flex-1 border-b border-black"></div>
          </div>
          <div className="flex items-end">
            <div className="w-48">Name</div>
            <div className="flex-1 border-b border-black pb-1">{record.employee_name}</div>
          </div>
          <div className="flex items-end">
            <div className="w-48">Employee Code</div>
            <div className="flex-1 border-b border-black pb-1">{record.employee_code}</div>
          </div>
          <div className="flex items-end">
            <div className="w-48">Department</div>
            <div className="flex-1 border-b border-black pb-1">{record.department_name}</div>
          </div>
          <div className="flex items-end">
            <div className="w-48">Designation</div>
            <div className="flex-1 border-b border-black pb-1">{record.designation_name}</div>
          </div>
          <div className="flex items-end">
            <div className="w-48">Date</div>
            <div className="flex-1 border-b border-black pb-1">{record.current_date}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
