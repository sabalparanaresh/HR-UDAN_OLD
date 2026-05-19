import React from 'react';
import { LayoutDashboard, BarChart, FileText, MessageSquare, PieChart } from 'lucide-react';

export interface ReportMetadata {
  code: string;
  label: string;
  description?: string;
  path: string;
  icon?: React.ReactNode;
  moduleType: 'K' | 'P' | 'ALL';
  permissions: string[]; // e.g. ['ADMIN', 'HR_MANAGER', 'AUDITOR']
  filters: {
    showDateRange?: boolean;
    showMonthYear?: boolean;
    availableCols?: string[];
  };
  exportOptions: ('CSV' | 'PDF' | 'EXCEL')[];
  drillDownPaths?: Record<string, string>;
  dynamicColumns?: boolean;
  chartCompatibility?: ('bar' | 'pie' | 'line' | 'table')[];
}

export const REPORT_REGISTRY: ReportMetadata[] = [
  {
    code: 'ATTENDANCE_ANALYTICS',
    label: 'Attendance Analytics',
    description: 'Attendance trends, absentee alerts, shift analysis.',
    path: '/reports/attendance-analytics',
    icon: <PieChart size={16} />,
    moduleType: 'K',
    permissions: ['ADMIN', 'HR_MANAGER'],
    filters: { showDateRange: true, showMonthYear: true },
    exportOptions: ['PDF'],
    chartCompatibility: ['bar', 'pie', 'line'],
    dynamicColumns: false
  },
  {
    code: 'PAYROLL_ANALYTICS',
    label: 'Payroll Analytics',
    description: 'Gross/net salary trends, wage type distributions.',
    path: '/reports/payroll-analytics',
    icon: <PieChart size={16} />,
    moduleType: 'K',
    permissions: ['ADMIN', 'HR_MANAGER'],
    filters: { showDateRange: true, showMonthYear: true },
    exportOptions: ['PDF'],
    chartCompatibility: ['bar', 'pie', 'line'],
    dynamicColumns: false
  },
  {
    code: 'COMPLIANCE_ANALYTICS',
    label: 'Compliance Analytics',
    description: 'PF, ESI, gratuity liability, bonus exposure & risk factors.',
    path: '/reports/compliance-analytics',
    icon: <PieChart size={16} />,
    moduleType: 'P',
    permissions: ['ADMIN', 'HR_MANAGER', 'AUDITOR'],
    filters: { showDateRange: true, showMonthYear: true },
    exportOptions: ['PDF'],
    chartCompatibility: ['bar', 'pie', 'line'],
    dynamicColumns: false
  },
  {
    code: 'PRE_DEFINED_REPORTS',
    label: 'PreDefined Reports',
    description: 'Explore and export standard reports.',
    path: '/reports/pre-defined',
    icon: <FileText size={16} />,
    moduleType: 'ALL',
    permissions: ['ADMIN', 'HR_MANAGER', 'AUDITOR'],
    filters: { showDateRange: false },
    exportOptions: ['CSV', 'EXCEL', 'PDF'],
    chartCompatibility: ['table']
  },
  {
    code: 'DASH_ENGINE',
    label: 'Dashboard Engine',
    description: 'High-level analytical dashboard.',
    path: '/reports/dashboard',
    icon: <LayoutDashboard size={16} />,
    moduleType: 'ALL',
    permissions: ['ADMIN', 'HR_MANAGER', 'AUDITOR'],
    filters: { showDateRange: true, showMonthYear: true },
    exportOptions: ['PDF'],
    chartCompatibility: ['bar', 'pie', 'line'],
    dynamicColumns: false
  },
  {
    code: 'REP_ENGINE',
    label: 'Reporting Engine',
    description: 'Custom report builder with advanced filtering.',
    path: '/reports/engine',
    icon: <BarChart size={16} />,
    moduleType: 'ALL',
    permissions: ['ADMIN', 'HR_MANAGER', 'AUDITOR'],
    filters: { showDateRange: true, showMonthYear: true },
    exportOptions: ['CSV', 'EXCEL', 'PDF'],
    chartCompatibility: ['table'],
    dynamicColumns: true
  },
  {
    code: 'SALARY_REPORTS',
    label: 'Salary Reports',
    description: 'Consolidated and monthly salary reports.',
    path: '/reports/salary',
    icon: <FileText size={16} />,
    moduleType: 'ALL',
    permissions: ['ADMIN', 'HR_MANAGER', 'AUDITOR'],
    filters: { showMonthYear: true },
    exportOptions: ['CSV', 'EXCEL'],
    chartCompatibility: ['table']
  },
  {
    code: 'LOAN_REPORTS',
    label: 'Loan Reports',
    description: 'Track active loans and deductions.',
    path: '/reports/loan-reports',
    icon: <FileText size={16} />,
    moduleType: 'ALL', // Or 'K' ideally, but letting ALL for now
    permissions: ['ADMIN', 'HR_MANAGER'],
    filters: { showDateRange: true },
    exportOptions: ['CSV', 'EXCEL'],
    chartCompatibility: ['table', 'pie']
  },
  {
    code: 'GRIEVANCES',
    label: 'Grievance Dashboard',
    description: 'Monitor employee grievances and resolutions.',
    path: '/reports/grievances',
    icon: <MessageSquare size={16} />,
    moduleType: 'ALL',
    permissions: ['ADMIN', 'HR_MANAGER'],
    filters: { showDateRange: true },
    exportOptions: ['CSV', 'PDF'],
    chartCompatibility: ['table', 'bar']
  },
  {
    code: 'PAYSLIP',
    label: 'Payslip',
    description: 'Generate employee payslips.',
    path: '/reports/payslip',
    icon: <FileText size={16} />,
    moduleType: 'ALL',
    permissions: ['ADMIN', 'HR_MANAGER', 'AUDITOR'],
    filters: { showMonthYear: true },
    exportOptions: ['PDF'],
    chartCompatibility: []
  },
  {
    code: 'COST_MIS',
    label: 'Cost MIS Reports',
    description: 'Detailed MIS cost tracking.',
    path: '/reports/cost-mis',
    icon: <PieChart size={16} />,
    moduleType: 'ALL',
    permissions: ['ADMIN', 'HR_MANAGER', 'AUDITOR'],
    filters: { showMonthYear: true, showDateRange: true },
    exportOptions: ['CSV', 'EXCEL', 'PDF'],
    chartCompatibility: ['table', 'bar', 'pie']
  },
  {
    code: 'AUDIT_HISTORY',
    label: 'Audit History',
    description: 'Immutable system audit logs.',
    path: '/reports/audit-history',
    icon: <FileText size={16} />,
    moduleType: 'ALL',
    permissions: ['ADMIN', 'AUDITOR'], // Restricted
    filters: { showDateRange: true },
    exportOptions: ['EXCEL', 'CSV'],
    chartCompatibility: ['table'],
    dynamicColumns: false
  },
  {
    code: 'AUDIT_ANALYTICS',
    label: 'Audit Analytics',
    description: 'Analytics on user activity, sync failures, and audit trails.',
    path: '/reports/audit-analytics',
    icon: <PieChart size={16} />,
    moduleType: 'ALL',
    permissions: ['ADMIN', 'AUDITOR'], // Restricted
    filters: { showDateRange: true },
    exportOptions: ['EXCEL', 'PDF'],
    chartCompatibility: ['line', 'pie', 'bar'],
    dynamicColumns: false
  }
];

export function getReportsForRoleAndModule(role: string, moduleType: 'K' | 'P') {
  const normalizedRole = role.toUpperCase();
  return REPORT_REGISTRY.filter(report => {
    const permissionsUpper = report.permissions.map(p => p.toUpperCase());
    const roleMatches = permissionsUpper.includes(normalizedRole) || permissionsUpper.includes('ALL') || normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN' || normalizedRole === 'SUPER ADMIN';
    const moduleMatches = report.moduleType === 'ALL' || report.moduleType === moduleType;
    return roleMatches && moduleMatches;
  });
}
