import { FilterDefinition } from '../../../../types';

export const aadharConsentFilters: FilterDefinition[] = [
  { key: 'employee_id', label: 'Employee', type: 'EMPLOYEE', required: true },
  { key: 'employee_code', label: 'Employee Code', type: 'EMPLOYEE', required: false },
  { key: 'date', label: 'Date', type: 'DATE_RANGE', required: true },
];
