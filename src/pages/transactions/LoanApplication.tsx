import React, { useState, useEffect } from 'react';
import { invokeCommand as invoke } from '../../services/apiClient';
import { 
  Plus, Search, CheckCircle2, XCircle, Calculator, Info, User, 
  Calendar, DollarSign, FileText, Clock, ShieldCheck, AlertCircle, Edit, Play
} from 'lucide-react';
import { toast } from 'sonner';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

import { useModule } from '../../contexts/ModuleContext';
import { Employee } from '../../types';
import EmployeeSearchSelect from '../../components/form/EmployeeSearchSelect';
import { cn } from '../../lib/utils';

function EligibilityBadge({ eligibility, amount, emi, activeLoanWarning, loanTypeId }: any) {
  if (!loanTypeId) return null;
  if (!eligibility) return <p className="text-sm text-slate-500">Checking parameters...</p>;

  const isClassEligible = eligibility.eligible;
  const maxAmt = eligibility.max_amount || 0;
  const maxTenure = eligibility.max_tenure || 0;

  const isAmountOk = maxAmt > 0 && Number(amount) <= maxAmt && Number(amount) > 0;
  const isEmiOk = maxTenure > 0 && Number(emi) <= maxTenure && Number(emi) > 0;
  const isNoActiveLoan = !activeLoanWarning?.has;

  const isAllEligible = isClassEligible && isAmountOk && isEmiOk && isNoActiveLoan;

  return (
    <div className="mt-4 mb-4 space-y-4">
      <div className={cn("rounded-lg p-4 flex gap-3 border text-sm", isAllEligible ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800")}>
        {isAllEligible ? <CheckCircle2 className="shrink-0" /> : <AlertCircle className="shrink-0" />}
        <div className="w-full">
          <h4 className="font-bold">{isAllEligible ? "Applicant is Eligible" : "Review Eligibility Flags"}</h4>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-medium">
            <div className={isClassEligible ? 'text-emerald-700' : 'text-rose-600'}>
              Category/Class/Tenure: {isClassEligible ? 'Passed' : eligibility.reason}
            </div>
            <div className={isNoActiveLoan ? 'text-emerald-700' : 'text-rose-600'}>
              Active Loans: {isNoActiveLoan ? 'None' : 'Found Active Loan(s)'}
            </div>
            {maxAmt > 0 && (
              <div className={(!amount || isAmountOk) ? 'text-emerald-700' : 'text-rose-600'}>
                Amount: {amount ? `₹${amount}` : '-'} / Max ₹{maxAmt.toLocaleString()}
              </div>
            )}
            {maxTenure > 0 && (
               <div className={(!emi || isEmiOk) ? 'text-emerald-700' : 'text-rose-600'}>
                 EMI Tenure: {emi ? `${emi} M` : '-'} / Max {maxTenure} M
               </div>
            )}
          </div>
          {!isAllEligible && eligibility?.flexibility_in_policy && (
            <div className="mt-3 text-amber-700 bg-amber-100/50 p-2 rounded text-xs font-bold flex items-center gap-2">
              <Info size={14} /> Policy flexibility enabled: You may override and save/approve this application.
            </div>
          )}
        </div>
      </div>

      {!isNoActiveLoan && activeLoanWarning?.details && activeLoanWarning.details.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 overflow-x-auto text-sm">
          <h4 className="font-bold text-rose-800 mb-3 flex items-center gap-2">
            <AlertCircle size={16} />
            Active Loans Details
          </h4>
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="text-rose-600 font-bold border-b border-rose-200">
                <th className="pb-2 pr-4">Applicant</th>
                <th className="pb-2 pr-4">Loan Type</th>
                <th className="pb-2 pr-4">Reason</th>
                <th className="pb-2 pr-4">App Date</th>
                <th className="pb-2 pr-4">Pending Amt</th>
                <th className="pb-2 pr-4">EMI Amt</th>
                <th className="pb-2">Closing Month</th>
              </tr>
            </thead>
            <tbody className="text-rose-800">
              {activeLoanWarning.details.map((loan: any, idx: number) => (
                <tr key={idx} className="border-b border-rose-100 last:border-0">
                  <td className="py-2 pr-4">{loan.applicant_name}</td>
                  <td className="py-2 pr-4">{loan.loan_type_name}</td>
                  <td className="py-2 pr-4 truncate max-w-[120px]" title={loan.reason}>{loan.reason || '-'}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{loan.application_date}</td>
                  <td className="py-2 pr-4 font-bold">₹{(loan.pending_amount || 0).toLocaleString()}</td>
                  <td className="py-2 pr-4">₹{(loan.emi_amount || 0).toLocaleString()}</td>
                  <td className="py-2 font-mono text-xs">{loan.closing_month || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function LoanApplication() {
  const { currentMode } = useModule();
  const [activeTab, setActiveTab] = useState<'NEW' | 'QUEUE' | 'LEDGER'>('NEW');
  const [applications, setApplications] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  
  // NEW Application State
  const [formData, setFormData] = useState({
    application_date: new Date().toISOString().split('T')[0],
    emp_id: '',
    guarantor_id: '',
    loan_type_id: '',
    loan_amount: '',
    no_of_emi: '',
    start_month_year: '',
    payment_mode: 'Bank Transfer',
    reason: '',
    remarks: ''
  });
  const [eligibility, setEligibility] = useState<any>(null);
  const [activeLoanWarning, setActiveLoanWarning] = useState<{has: boolean, details: any[]}>({has: false, details: []});

  // Amortization Modal
  const [amortModal, setAmortModal] = useState<{isOpen: boolean, app: any}>({isOpen: false, app: null});
  const [schedule, setSchedule] = useState<any[]>([]);
  
  // Fast action prepay modal
  const [prepayModal, setPrepayModal] = useState<{isOpen: boolean, emi: any}>({isOpen: false, emi: null});
  const [prepayData, setPrepayData] = useState({ amount: '', mode: 'Bank Transfer', remarks: '' });
  
  // Edit EMI Modal
  const [editEmiModal, setEditEmiModal] = useState<{isOpen: boolean, emi: any}>({isOpen: false, emi: null});
  const [editAmount, setEditAmount] = useState('');
  const [editEmiData, setEditEmiData] = useState({ remarks: '', authorisedBy: '' });

  // Skip EMI Modal
  const [skipEmiModal, setSkipEmiModal] = useState<{isOpen: boolean, emi: any}>({isOpen: false, emi: null});
  const [skipEmiData, setSkipEmiData] = useState({ remarks: '', authorisedBy: '' });

  const [approverModal, setApproverModal] = useState<{isOpen: boolean, app: any}>({isOpen: false, app: null});
  const [approverData, setApproverData] = useState({ loan_amount: '', no_of_emi: '', start_month_year: '', payment_mode: '' });
  const [approverEligibility, setApproverEligibility] = useState<any>(null);
  const [approverActiveWarning, setApproverActiveWarning] = useState<any>({ has: false, details: [] });
  const [rejectModal, setRejectModal] = useState<{isOpen: boolean, appId: number | null}>({isOpen: false, appId: null});
  const [rejectRemark, setRejectRemark] = useState('');

  useEffect(() => {
    fetchApplications();
    fetchEmployees();
    fetchLoanTypes();
  }, [currentMode]);

  useEffect(() => {
    if (formData.emp_id && formData.loan_type_id) {
      checkEligibility();
    }
    if (formData.emp_id || formData.guarantor_id) {
      checkActiveLoans();
    }
  }, [formData.emp_id, formData.loan_type_id, formData.guarantor_id]);

  const fetchApplications = async () => {
    try {
      const data = await invoke<any[]>('get_loan_applications', { moduleType: currentMode });
      setApplications(data || []);
    } catch (e) {
      toast.error('Failed to fetch applications');
    }
  };

  const fetchEmployees = async () => {
    const data = await invoke<Employee[]>('master_crud', { tableName: 'employees', operation: 'list', moduleType: currentMode });
    setEmployees(data || []);
  };

  const fetchLoanTypes = async () => {
    const data = await invoke<any[]>('master_crud', { tableName: 'loan_types', operation: 'list', moduleType: currentMode });
    setLoanTypes((data || []).filter((d: any) => d.status === 1));
  };
  
  const checkEligibility = async () => {
    const res = await invoke<any>('calculate_loan_eligibility', { 
       empId: Number(formData.emp_id), 
       loanTypeId: Number(formData.loan_type_id),
       applicationDate: formData.application_date
    });
    setEligibility(res);
  };
  
  const checkActiveLoans = async () => {
    const res = await invoke<any>('check_active_loans', { empId: Number(formData.emp_id), guarantorId: formData.guarantor_id ? Number(formData.guarantor_id) : -1 });
    setActiveLoanWarning({ has: res.hasActiveLoan, details: res.activeLoans || [] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isClassEligible = eligibility?.eligible;
    const maxAmt = eligibility?.max_amount || 0;
    const maxTenure = eligibility?.max_tenure || 0;
    const isAmountOk = maxAmt > 0 && Number(formData.loan_amount) <= maxAmt && Number(formData.loan_amount) > 0;
    const isEmiOk = maxTenure > 0 && Number(formData.no_of_emi) <= maxTenure && Number(formData.no_of_emi) > 0;
    const isNoActiveLoan = !activeLoanWarning?.has;
    const isAllEligible = isClassEligible && isAmountOk && isEmiOk && isNoActiveLoan;

    if (!eligibility?.flexibility_in_policy && !isAllEligible) {
      toast.error('Policy enforces strict eligibility. Cannot save un-met application.');
      return;
    }

    const loanTypeObj = loanTypes.find((lt: any) => lt.id === Number(formData.loan_type_id));
    let finalAmount = Number(formData.loan_amount);
    if (loanTypeObj && loanTypeObj.interest_applicability === 'Actual Earning' && loanTypeObj.interest_rate > 0) {
       const rate = loanTypeObj.interest_rate;
       const tenureInYears = Number(formData.no_of_emi) / 12;
       finalAmount += (finalAmount * (rate / 100) * tenureInYears);
    }
    const emiAmount = Math.ceil(finalAmount / Number(formData.no_of_emi));
    
    try {
      const payload = {
        ...formData,
        emp_id: Number(formData.emp_id),
        loan_type_id: Number(formData.loan_type_id),
        loan_amount: Number(formData.loan_amount),
        no_of_emi: Number(formData.no_of_emi),
        emi_amount: emiAmount,
        application_date: formData.application_date,
      };

      await invoke('create_loan_application', payload);

      const emp = employees.find(e => e.id === payload.emp_id);
      const guar = employees.find(e => e.id === Number(formData.guarantor_id));
      const loanType = loanTypes.find(lt => lt.id === payload.loan_type_id);

      (pdfMake as any).vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfFonts as any).vfs;

      const docDefinition: TDocumentDefinitions = {
        content: [
          { text: "Loan Application Details", fontSize: 20, margin: [0, 0, 0, 10] },
          { text: `Application Date: ${payload.application_date}`, fontSize: 12, margin: [0, 0, 0, 10] },
          {
            table: {
              headerRows: 1,
              body: [
                [{text: 'Field', style: 'tableHeader'}, {text: 'Details', style: 'tableHeader'}],
                ['Applicant', emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() + ` (${emp.emp_code})` : 'N/A'],
                ['Guarantor', guar ? `${guar.first_name || ''} ${guar.last_name || ''}`.trim() + ` (${guar.emp_code})` : 'None'],
                ['Loan Type', loanType?.name || 'N/A'],
                ['Requested Amount', `Rs. ${payload.loan_amount}`],
                ['No. of EMIs', payload.no_of_emi.toString()],
                ['Start Month-Year', formData.start_month_year],
                ['Payment Mode', formData.payment_mode],
                ['Reason', formData.reason],
                ['Remarks', formData.remarks || '-']
              ]
            },
            margin: [0, 0, 0, 20]
          },
          { text: "Eligibility Criteria", fontSize: 16, margin: [0, 0, 0, 5] },
          {
            table: {
              headerRows: 1,
              body: [
                [{text: 'Parameter', style: 'tableHeader'}, {text: 'Limits', style: 'tableHeader'}],
                ['Category/Class/Tenure Status', eligibility?.eligible ? 'Passed' : eligibility?.reason || 'Failed'],
                ['Max Approved Amount', `Rs. ${eligibility?.max_amount || 0}`],
                ['Max Approved Tenure', `${eligibility?.max_tenure || 0} Months`]
              ]
            },
            margin: [0, 0, 0, 20]
          }
        ],
        styles: {
          tableHeader: { bold: true }
        }
      };

      if (activeLoanWarning?.has) {
        (docDefinition.content as any[]).push(
          { text: "Prior Active Loans", fontSize: 16, margin: [0, 0, 0, 5] },
          {
            table: {
              headerRows: 1,
              body: [
                [{text: 'Applicant', style: 'tableHeader'}, {text: 'Loan Type', style: 'tableHeader'}, {text: 'App Date', style: 'tableHeader'}, {text: 'Pending Amt', style: 'tableHeader'}, {text: 'EMI Amt', style: 'tableHeader'}, {text: 'Closing Month', style: 'tableHeader'}],
                ...activeLoanWarning.details.map((l: any) => [
                  l.applicant_name, l.loan_type_name, l.application_date, `Rs. ${l.pending_amount || 0}`, `Rs. ${l.emi_amount || 0}`, l.closing_month || '-'
                ])
              ]
            }
          }
        );
      }

      pdfMake.createPdf(docDefinition).download(`Loan_Application_${emp?.emp_code || 'Unknown'}_${payload.application_date}.pdf`);

      toast.success('Loan Application Submitted & PDF Generated');
      setFormData({ application_date: new Date().toISOString().split('T')[0], emp_id: '', guarantor_id: '', loan_type_id: '', loan_amount: '', no_of_emi: '', start_month_year: '', payment_mode: 'Bank Transfer', reason: '', remarks: '' });
      setEligibility(null);
      setActiveTab('QUEUE');
      fetchApplications();
    } catch {
      toast.error('Failed to submit application');
    }
  };

  const openApproverModal = async (app: any) => {
     setApproverData({ 
       loan_amount: app.loan_amount?.toString() || '', 
       no_of_emi: app.no_of_emi?.toString() || '', 
       start_month_year: app.start_month_year || '', 
       payment_mode: app.payment_mode || 'Bank Transfer' 
     });
     setApproverModal({isOpen: true, app});
  
     const res = await invoke<any>('calculate_loan_eligibility', { 
       empId: Number(app.emp_id), 
       loanTypeId: Number(app.loan_type_id),
       applicationDate: app.application_date || new Date().toISOString().split('T')[0]
     });
     setApproverEligibility(res);
  
     const res2 = await invoke<any>('check_active_loans', { empId: Number(app.emp_id), guarantorId: app.guarantor_id ? Number(app.guarantor_id) : -1 });
     setApproverActiveWarning({ has: res2.hasActiveLoan, details: res2.activeLoans || [] });
  };

  const confirmApprove = async () => {
      const isClassEligible = approverEligibility?.eligible;
      const maxAmt = approverEligibility?.max_amount || 0;
      const maxTenure = approverEligibility?.max_tenure || 0;
      const isAmountOk = maxAmt > 0 && Number(approverData.loan_amount) <= maxAmt && Number(approverData.loan_amount) > 0;
      const isEmiOk = maxTenure > 0 && Number(approverData.no_of_emi) <= maxTenure && Number(approverData.no_of_emi) > 0;
      const isNoActiveLoan = !approverActiveWarning?.has;
      const isAllEligible = isClassEligible && isAmountOk && isEmiOk && isNoActiveLoan;

      if (!approverEligibility?.flexibility_in_policy && !isAllEligible) {
        toast.error('Policy enforces strict eligibility. Cannot approve.');
        return;
      }

      try {
        const appObj = approverModal.app;
        const loanTypeObj = loanTypes.find((lt: any) => lt.id === Number(appObj.loan_type_id));
        let finalAmount = Number(approverData.loan_amount);
        if (loanTypeObj && loanTypeObj.interest_applicability === 'Actual Earning' && loanTypeObj.interest_rate > 0) {
           const rate = loanTypeObj.interest_rate;
           const tenureInYears = Number(approverData.no_of_emi) / 12;
           finalAmount += (finalAmount * (rate / 100) * tenureInYears);
        }
        const emiAmount = Math.ceil(finalAmount / Number(approverData.no_of_emi));
        await invoke('override_and_approve_loan', {
           loanId: appObj.id,
           loan_amount: Number(approverData.loan_amount),
           no_of_emi: Number(approverData.no_of_emi),
           emi_amount: emiAmount,
           start_month_year: approverData.start_month_year,
           payment_mode: approverData.payment_mode
        });
        await invoke('update_loan_status', { loanId: appObj.id, status: 'APPROVED' });
        await invoke('generate_amortisation_schedule', { loanId: appObj.id });
        toast.success('Loan Approved and Schedule Generated');
        setApproverModal({isOpen: false, app: null});
        fetchApplications();
        setActiveTab('LEDGER');
        viewAmortization(appObj);
      } catch {
        toast.error('Failed to approve loan');
      }
  };

  const confirmReject = async () => {
    if (!rejectModal.appId || !rejectRemark.trim()) {
      toast.error('Remark is required for rejection');
      return;
    }
    try {
      await invoke('update_loan_status', { loanId: rejectModal.appId, status: 'REJECTED', remark: rejectRemark });
      toast.success('Loan rejected successfully');
      setRejectModal({ isOpen: false, appId: null });
      setRejectRemark('');
      fetchApplications();
    } catch {
      toast.error('Failed to reject loan');
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await invoke('update_loan_status', { loanId: id, status });
      if (status === 'APPROVED') {
        // Generate Schedule
        await invoke('generate_amortisation_schedule', { loanId: id });
        toast.success('Loan Approved and Schedule Generated');
      } else {
        toast.success(`Loan marked as ${status}`);
      }
      fetchApplications();
    } catch {
      toast.error('Operation failed');
    }
  };

  const viewAmortization = async (app: any) => {
    setAmortModal({ isOpen: true, app });
    await loadSchedule(app.id);
  };

  const loadSchedule = async (id: number) => {
    const data = await invoke<any[]>('get_loan_amortization', { loanId: id });
    setSchedule(data || []);
    fetchApplications();
  };

  const handleEmiAction = async (emi: any, action: string, amount: string = '', modalRemarks: string = '', authorisedBy: string = '') => {
    try {
      await invoke('update_emi_dynamic', {
        amortizationId: emi.id,
        action,
        newAmount: amount ? Number(amount) : 0,
        paymentMode: prepayData.mode,
        remarks: modalRemarks || prepayData.remarks,
        authorisedBy: authorisedBy
      });
      toast.success('EMI Updated');
      loadSchedule(amortModal.app.id);
      setPrepayModal({isOpen: false, emi: null});
      setEditEmiModal({isOpen: false, emi: null});
      setSkipEmiModal({isOpen: false, emi: null});
    } catch {
      toast.error('Failed to update EMI');
    }
  };

  const queueApps = applications.filter(a => a.status === 'PENDING');
  const ledgerApps = applications.filter(a => a.status === 'APPROVED' || a.status === 'CLOSED');

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-app-border shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-primary-navy tracking-tight">Loan Management</h2>
          <p className="text-text-muted text-sm font-bold uppercase tracking-tight flex items-center gap-2">
            Disbursements & Amortisation
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {(['NEW', 'QUEUE', 'LEDGER'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-6 py-2 text-sm font-bold rounded-md transition-all",
                activeTab === tab ? "bg-white shadow-sm text-primary-navy" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {tab === 'NEW' ? 'New Application' : tab === 'QUEUE' ? `Approval Queue (${queueApps.length})` : 'Active Ledger'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'NEW' && (
        <div className="bg-white rounded-xl shadow-sm border border-app-border p-6 max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Application Date</label>
                <input type="date" required
                  className="w-full p-2.5 border border-app-border rounded-lg font-medium text-primary-navy bg-slate-50"
                  value={formData.application_date} onChange={e => setFormData(p => ({...p, application_date: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Applicant</label>
                <div className="w-full">
                   <EmployeeSearchSelect
                     className="w-full"
                     value={formData.emp_id}
                     onChange={(val) => setFormData(p => ({...p, emp_id: val}))}
                     employees={employees}
                     placeholder="Search Applicant..."
                   />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Guarantor (Optional)</label>
                <div className="w-full">
                   <EmployeeSearchSelect
                     className="w-full"
                     value={formData.guarantor_id}
                     onChange={(val) => setFormData(p => ({...p, guarantor_id: val}))}
                     employees={employees}
                     placeholder="Search Guarantor..."
                   />
                </div>
              </div>
            </div>

            {activeLoanWarning.has && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex gap-3 text-rose-700">
                <AlertCircle className="shrink-0" />
                <div>
                  <h4 className="font-bold">Active Loan Warning</h4>
                  <p className="text-sm">The applicant or guarantor is already tied to an open loan.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Loan Type</label>
                <select className="w-full p-2.5 border border-app-border rounded-lg font-medium text-primary-navy bg-slate-50"
                  value={formData.loan_type_id} onChange={e => setFormData(p => ({...p, loan_type_id: e.target.value}))} required>
                  <option value="">Select Type...</option>
                  {loanTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Start Month-Year</label>
                <input type="month" required
                  className="w-full p-2.5 border border-app-border rounded-lg font-mono text-primary-navy bg-slate-50"
                  value={formData.start_month_year ? (() => {
                     const parts = formData.start_month_year.split('-');
                     if (parts.length === 2 && parts[0].length === 2) return `${parts[1]}-${parts[0]}`;
                     return formData.start_month_year;
                  })() : ''} 
                  onChange={e => {
                     const val = e.target.value;
                     if (val) {
                        const parts = val.split('-');
                        if (parts.length === 2) {
                           setFormData(p => ({...p, start_month_year: `${parts[1]}-${parts[0]}`}));
                           return;
                        }
                     }
                     setFormData(p => ({...p, start_month_year: val}));
                  }} />
              </div>
            </div>

            <EligibilityBadge 
              eligibility={eligibility} 
              amount={formData.loan_amount} 
              emi={formData.no_of_emi} 
              activeLoanWarning={activeLoanWarning} 
              loanTypeId={formData.loan_type_id} 
            />

            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Amount Required</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-text-muted">₹</span>
                  <input type="number" required max={(!eligibility?.flexibility_in_policy && eligibility?.max_amount) ? eligibility.max_amount : undefined}
                    className="w-full p-2.5 pl-8 border border-app-border rounded-lg font-medium text-primary-navy bg-slate-50"
                    value={formData.loan_amount} onChange={e => setFormData(p => ({...p, loan_amount: e.target.value}))} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">No. of EMIs</label>
                <input type="number" required max={(!eligibility?.flexibility_in_policy && eligibility?.max_tenure) ? eligibility.max_tenure : undefined}
                  className="w-full p-2.5 border border-app-border rounded-lg font-medium text-primary-navy bg-slate-50"
                  value={formData.no_of_emi} onChange={e => setFormData(p => ({...p, no_of_emi: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Payment Mode</label>
                <select className="w-full p-2.5 border border-app-border rounded-lg font-medium text-primary-navy bg-slate-50"
                  value={formData.payment_mode} onChange={e => setFormData(p => ({...p, payment_mode: e.target.value}))}>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Reason</label>
                <input type="text" required
                  className="w-full p-2.5 border border-app-border rounded-lg font-medium text-primary-navy bg-slate-50"
                  value={formData.reason} onChange={e => setFormData(p => ({...p, reason: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Remarks</label>
                <input type="text"
                  className="w-full p-2.5 border border-app-border rounded-lg font-medium text-primary-navy bg-slate-50"
                  value={formData.remarks} onChange={e => setFormData(p => ({...p, remarks: e.target.value}))} />
              </div>
            </div>

            <button type="submit" disabled={!formData.emp_id}
              className="w-full py-3 bg-primary-navy text-white rounded-lg font-bold shadow disabled:opacity-50">
              Submit & Print
            </button>
          </form>
        </div>
      )}

      {activeTab === 'QUEUE' && (
        <div className="bg-white rounded-xl shadow-sm border border-app-border overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-app-border">
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[200px]">Applicant</th>
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[150px]">Loan Type</th>
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">EMIs</th>
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start Month</th>
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-sm">
              {queueApps.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-text-muted">No pending applications</td></tr>
              ) : queueApps.map(a => (
                <tr key={a.id} className="bg-orange-50 hover:bg-orange-100/50 border-orange-100">
                  <td className="p-3">
                    <p className="font-bold text-primary-navy">{a.employee_name} <span className="text-orange-600 border border-orange-200 bg-orange-100 px-1.5 py-0.5 rounded text-[9px] uppercase ml-2">Pending Approval</span></p>
                    <p className="text-[10px] text-text-muted font-mono">{a.emp_code}</p>
                  </td>
                  <td className="p-3 font-semibold text-slate-700">{a.loan_type_name}</td>
                  <td className="p-3 font-bold text-primary-navy text-right">₹{a.loan_amount?.toLocaleString()}</td>
                  <td className="p-3 font-medium text-text-muted">{a.no_of_emi}</td>
                  <td className="p-3 font-mono text-slate-600">{a.start_month_year}</td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openApproverModal(a)} className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold text-xs uppercase cursor-pointer">
                        Approve
                      </button>
                      <button onClick={() => setRejectModal({ isOpen: true, appId: a.id })} className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-bold text-xs uppercase cursor-pointer">
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'LEDGER' && (
        <div className="bg-white rounded-xl shadow-sm border border-app-border overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-app-border">
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Applicant</th>
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loan Type</th>
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Principal</th>
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Recovered</th>
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Pending</th>
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Schedule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-sm">
              {ledgerApps.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-text-muted">No active loans</td></tr>
              ) : ledgerApps.map(a => (
                <React.Fragment key={a.id}>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3">
                      <p className="font-bold text-primary-navy">{a.employee_name}</p>
                      <p className="text-[10px] text-text-muted font-mono">{a.emp_code}</p>
                    </td>
                    <td className="p-3 font-semibold text-slate-700">{a.loan_type_name}</td>
                    <td className="p-3 font-bold text-primary-navy text-right">₹{a.loan_amount?.toLocaleString()}</td>
                    <td className="p-3 font-bold text-emerald-600 text-right">₹{a.paid_amount?.toLocaleString() || 0}</td>
                    <td className="p-3 font-bold text-rose-600 text-right">₹{a.pending_amount?.toLocaleString() || 0}</td>
                    <td className="p-3 text-center">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider", a.status === 'CLOSED' ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700")}>
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => {
                        if (amortModal.isOpen && amortModal.app?.id === a.id) {
                           setAmortModal({isOpen: false, app: null});
                        } else {
                           viewAmortization(a);
                        }
                      }} className={cn("px-3 py-1.5 rounded text-xs font-bold cursor-pointer inline-flex items-center gap-1 border", amortModal.isOpen && amortModal.app?.id === a.id ? "bg-slate-100 text-slate-700 border-slate-200" : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200")}>
                        <Calculator size={14} /> {amortModal.isOpen && amortModal.app?.id === a.id ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                  {amortModal.isOpen && amortModal.app?.id === a.id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={7} className="p-0 border-t border-slate-200">
                        <div className="p-4 bg-slate-50 border-x-4 border-l-primary-navy shadow-inner">
                          <h4 className="font-black text-primary-navy mb-3 text-sm flex items-center gap-2">Amortisation Schedule</h4>
                          <table className="w-full text-left border-collapse bg-white border border-app-border rounded-xl shadow-sm overflow-hidden">
                            <thead className="bg-slate-50">
                              <tr className="border-b border-app-border">
                                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">EMI No</th>
                                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Month</th>
                                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Planned (₹)</th>
                                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Paid (₹)</th>
                                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                                <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-app-border text-sm">
                              {schedule.map(emi => (
                                <tr key={emi.id} className={cn("transition-colors", emi.status === 'PAID' ? "bg-emerald-50/30" : emi.status === 'SKIPPED' ? "bg-slate-50 text-slate-400" : "")}>
                                  <td className="p-3 font-mono font-bold text-primary-navy">#{emi.emi_no}</td>
                                  <td className="p-3 font-semibold text-slate-700">{emi.month_year}</td>
                                  <td className="p-3 font-bold text-primary-navy text-right">{emi.planned_amount?.toLocaleString()}</td>
                                  <td className="p-3 font-bold text-emerald-600 text-right">{emi.actual_paid_amount > 0 ? emi.actual_paid_amount?.toLocaleString() : '-'}</td>
                                  <td className="p-3 text-center">
                                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider", 
                                      emi.status === 'PAID' ? "bg-emerald-100 text-emerald-700" : 
                                      emi.status === 'SKIPPED' ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-700")}>
                                      {emi.status}
                                    </span>
                                  </td>
                                  <td className="p-3 text-[11px] font-semibold text-slate-500 uppercase">{emi.payment_type}</td>
                                  <td className="p-3">
                                    {emi.status === 'DUE' && (
                                      <div className="flex justify-end gap-1.5">
                                        <button onClick={() => { setEditAmount(emi.planned_amount.toString()); setEditEmiData({remarks: '', authorisedBy: ''}); setEditEmiModal({isOpen: true, emi}); }} title="Edit Amount" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"><Edit size={14} /></button>
                                        <button onClick={() => { setSkipEmiData({remarks: '', authorisedBy: ''}); setSkipEmiModal({isOpen: true, emi}); }} title="Skip/Jump (Push Schedule)" className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500 cursor-pointer"><Play size={14} /></button>
                                        <button onClick={() => { setPrepayData({amount: emi.planned_amount.toString(), mode: 'Bank Transfer', remarks: ''}); setPrepayModal({isOpen: true, emi}); }} className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer">Pay</button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PREPAY MODAL */}
      {prepayModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-6">
            <h3 className="font-black text-primary-navy">Record Prepayment</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Amount</label>
                <input type="number" className="w-full border rounded-lg p-2 font-bold" value={prepayData.amount} onChange={e => setPrepayData(p=>({...p, amount: e.target.value}))} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mode</label>
                <select className="w-full border rounded-lg p-2" value={prepayData.mode} onChange={e => setPrepayData(p=>({...p, mode: e.target.value}))}>
                  <option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option><option value="Cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Transaction Ref / Remarks</label>
                <input type="text" className="w-full border rounded-lg p-2 text-sm" value={prepayData.remarks} onChange={e => setPrepayData(p=>({...p, remarks: e.target.value}))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 text-sm font-bold">
              <button className="px-4 py-2 hover:bg-slate-100 rounded-lg text-slate-600" onClick={() => setPrepayModal({isOpen: false, emi: null})}>Cancel</button>
              <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow" onClick={() => handleEmiAction(prepayModal.emi, 'PREPAYMENT', prepayData.amount)}>Record Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT EMI MODAL */}
      {editEmiModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-black text-primary-navy tracking-tight text-xl">Edit Scheduled EMI</h3>
            <div>
               <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">New Planned Amount</label>
               <input type="number" className="w-full border rounded-lg p-2 font-bold" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
            </div>
            <div>
               <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Authorised By</label>
               <input type="text" className="w-full border rounded-lg p-2 text-sm" value={editEmiData.authorisedBy} onChange={e => setEditEmiData(p=>({...p, authorisedBy: e.target.value}))} />
            </div>
            <div>
               <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks / Reason</label>
               <input type="text" className="w-full border rounded-lg p-2 text-sm" value={editEmiData.remarks} onChange={e => setEditEmiData(p=>({...p, remarks: e.target.value}))} />
            </div>
             <div className="flex justify-end gap-2 text-sm font-bold pt-2">
              <button className="px-4 py-2 hover:bg-slate-100 rounded-lg text-slate-600" onClick={() => setEditEmiModal({isOpen: false, emi: null})}>Cancel</button>
              <button className="px-4 py-2 bg-primary-navy text-white rounded-lg shadow" onClick={() => handleEmiAction(editEmiModal.emi, 'EDIT_AMOUNT', editAmount, editEmiData.remarks, editEmiData.authorisedBy)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* SKIP EMI MODAL */}
      {skipEmiModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-black text-rose-600 tracking-tight text-xl">Skip & Push EMI</h3>
            <p className="text-sm text-slate-600">This will set the current EMI to 0 for this month, shift all subsequent EMIs by one month, and append an additional EMI at the end of the schedule.</p>
            <div>
               <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Authorised By</label>
               <input type="text" className="w-full border rounded-lg p-2 text-sm" value={skipEmiData.authorisedBy} onChange={e => setSkipEmiData(p=>({...p, authorisedBy: e.target.value}))} />
            </div>
            <div>
               <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks / Reason</label>
               <input type="text" className="w-full border rounded-lg p-2 text-sm" value={skipEmiData.remarks} onChange={e => setSkipEmiData(p=>({...p, remarks: e.target.value}))} />
            </div>
             <div className="flex justify-end gap-2 text-sm font-bold pt-2">
              <button className="px-4 py-2 hover:bg-slate-100 rounded-lg text-slate-600" onClick={() => setSkipEmiModal({isOpen: false, emi: null})}>Cancel</button>
              <button className="px-4 py-2 bg-rose-600 text-white rounded-lg shadow" onClick={() => handleEmiAction(skipEmiModal.emi, 'SKIP', '', skipEmiData.remarks, skipEmiData.authorisedBy)}>Confirm Skip</button>
            </div>
          </div>
        </div>
      )}

      {approverModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl space-y-6">
            <h3 className="font-black text-primary-navy tracking-tight text-xl">Approve Loan: {approverModal.app?.employee_name}</h3>
            
            <EligibilityBadge 
              eligibility={approverEligibility} 
              amount={approverData.loan_amount} 
              emi={approverData.no_of_emi} 
              activeLoanWarning={approverActiveWarning} 
              loanTypeId={approverModal.app?.loan_type_id} 
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Approved Amount</label>
                <input type="number" className="w-full border rounded-lg p-2 font-bold" value={approverData.loan_amount} onChange={e => setApproverData(p=>({...p, loan_amount: e.target.value}))} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">No. of EMIs</label>
                <input type="number" className="w-full border rounded-lg p-2 font-bold" value={approverData.no_of_emi} onChange={e => setApproverData(p=>({...p, no_of_emi: e.target.value}))} />
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Start Month</label>
                 <input type="month" className="w-full border rounded-lg p-2 text-sm font-mono" 
                   value={approverData.start_month_year ? (() => {
                      const parts = approverData.start_month_year.split('-');
                      if (parts.length === 2 && parts[0].length === 2) return `${parts[1]}-${parts[0]}`;
                      return approverData.start_month_year;
                   })() : ''} 
                   onChange={e => {
                      const val = e.target.value;
                      if (val) {
                         const parts = val.split('-');
                         if (parts.length === 2) {
                            setApproverData(p=>({...p, start_month_year: `${parts[1]}-${parts[0]}`}));
                            return;
                         }
                      }
                      setApproverData(p=>({...p, start_month_year: val}));
                   }} />
              </div>
              <div>
                 <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Payment Mode</label>
                 <select className="w-full border rounded-lg p-2 text-sm" value={approverData.payment_mode} onChange={e => setApproverData(p=>({...p, payment_mode: e.target.value}))}>
                   <option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option><option value="Cheque">Cheque</option>
                 </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 text-sm font-bold mt-6">
               <button className="px-4 py-2 hover:bg-slate-100 rounded-lg text-slate-600" onClick={() => setApproverModal({isOpen: false, app: null})}>Cancel</button>
               <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow cursor-pointer" onClick={confirmApprove}>Confirm & Generate Schedule</button>
            </div>
          </div>
        </div>
      )}

      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-black text-rose-600 tracking-tight text-xl">Reject Loan</h3>
            <div>
               <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Reason / Remarks (Required)</label>
               <textarea className="w-full border rounded-lg p-2 text-sm min-h-[100px]" placeholder="Briefly explain the reason for rejection..." value={rejectRemark} onChange={e => setRejectRemark(e.target.value)}></textarea>
            </div>
            <div className="flex justify-end gap-2 text-sm font-bold">
               <button className="px-4 py-2 hover:bg-slate-100 rounded-lg text-slate-600" onClick={() => { setRejectModal({isOpen: false, appId: null}); setRejectRemark(''); }}>Cancel</button>
               <button className="px-4 py-2 bg-rose-600 text-white rounded-lg shadow cursor-pointer disabled:opacity-50" disabled={!rejectRemark.trim()} onClick={confirmReject}>Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
