import React from 'react';
import { registerReport } from './registry/reportRegistry';
import { aadharConsentFilters } from './reports/employee-master/joining-docket/aadhar-consent/filters';

// Register placeholder reports for initial scaffold
registerReport({
  reportKey: 'salary_register',
  name: 'Salary Register',
  description: 'Detailed monthly salary register',
  dataSource: 'SALARY',
  group: 'sal_registers',
  supportedExports: ['PDF', 'EXCEL'],
  filters: [
    { key: 'month', label: 'Month', type: 'MONTH', required: true },
    { key: 'year', label: 'Year', type: 'YEAR', required: true }
  ],
  resolver: () => import('./resolvers/salary-register')
});

registerReport({
  reportKey: 'employee-master.joining-docket.aadhar-consent',
  name: 'Aadhar Consent',
  description: 'Aadhar Holder Consent Form for Authentication',
  dataSource: 'EMPLOYEE_MASTER',
  group: 'Joining Docket',
  supportedExports: ['PDF', 'WORD'], // Disables EXCEL
  filters: aadharConsentFilters,
  resolver: () => import('./reports/employee-master/joining-docket/aadhar-consent'),
  viewer: React.lazy(() => import('./reports/employee-master/joining-docket/aadhar-consent/viewer')),
  exporters: {
    PDF: () => import('./reports/employee-master/joining-docket/aadhar-consent/pdf').then(m => ({ default: new m.AadharConsentPDFExporter() })),
    WORD: () => import('./reports/employee-master/joining-docket/aadhar-consent/word').then(m => ({ default: new m.AadharConsentWordExporter() }))
  }
});

export * from './types';
export * from './registry/reportRegistry';
