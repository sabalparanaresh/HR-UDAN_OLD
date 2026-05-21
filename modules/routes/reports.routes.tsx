import React from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../../components/auth';
import { useAuthStore } from '../../store/authStore';
import { User } from '../../types';
import { Database } from 'lucide-react';

import ReportsEngine from '../../pages/reports/ReportsEngine';
import DashboardEngine from '../../pages/reports/DashboardEngine';
import AttendanceAnalytics from '../../pages/reports/AttendanceAnalytics';
import PayrollAnalytics from '../../pages/reports/PayrollAnalytics';
import ComplianceAnalytics from '../../pages/reports/ComplianceAnalytics';
import SalaryReports from '../../pages/reports/SalaryReports';
import LoanReports from '../../pages/reports/LoanReports';
import GrievanceDashboard from '../../pages/reports/GrievanceDashboard';
import AuditHistory from '../../pages/reports/AuditHistory';
import AuditAnalytics from '../../pages/reports/AuditAnalytics';

import PreDefinedReportsPage from '../../pages/reports/PreDefinedReportsPage';

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl textile-header font-black text-primary-navy">{title}</h2>
          <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Module // Under Development</p>
        </div>
      </div>
      <div className="textile-card p-12 bg-white border-app-border flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-primary-navy/20">
          <Database size={40} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-primary-navy">{title} Module</h3>
          <p className="text-text-muted max-w-md mx-auto">This section is currently being structured. Functional components will be integrated soon.</p>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1 bg-primary-navy/5 text-primary-navy text-[10px] font-mono rounded-full border border-primary-navy/10">
            STATUS: DRAFT
          </div>
          <div className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-mono rounded-full border border-slate-200">
            VERSION: 0.1.0
          </div>
        </div>
      </div>
    </div>
  );
}

export const ReportsRoutes = (currentUser: User | null) => {
  return (
    <Route path="reports">
      <Route path="engine" element={<ProtectedRoute moduleCode="*" pageKey="reportsEngine"><ReportsEngine currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="dashboard" element={<ProtectedRoute moduleCode="*" pageKey="dashboard"><DashboardEngine currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="attendance-analytics" element={<ProtectedRoute moduleCode="*" pageKey="attendanceAnalytics"><AttendanceAnalytics currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="payroll-analytics" element={<ProtectedRoute moduleCode="*" pageKey="payrollAnalytics"><PayrollAnalytics currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="compliance-analytics" element={<ProtectedRoute moduleCode="*" pageKey="complianceAnalytics"><ComplianceAnalytics currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="salary" element={<ProtectedRoute moduleCode="*" pageKey="salaryReports"><SalaryReports currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="loan-reports" element={<ProtectedRoute moduleCode="*" pageKey="loanReports"><LoanReports /></ProtectedRoute>} />
      <Route path="grievances" element={<ProtectedRoute moduleCode="*" pageKey="grievances"><GrievanceDashboard /></ProtectedRoute>} />
      <Route path="audit-history" element={<ProtectedRoute moduleCode="*" pageKey="auditHistory"><AuditHistory /></ProtectedRoute>} />
      <Route path="audit-analytics" element={<ProtectedRoute moduleCode="*" pageKey="auditAnalytics"><AuditAnalytics currentUser={currentUser!} /></ProtectedRoute>} />
      <Route path="pre-defined" element={<ProtectedRoute moduleCode="*" pageKey="preDefinedReports"><PreDefinedReportsPage /></ProtectedRoute>} />
      <Route path="payslip" element={<PlaceholderPage title="Payslip" />} />
      <Route path="cost-mis" element={<PlaceholderPage title="Cost MIS Reports" />} />
    </Route>
  );
};
