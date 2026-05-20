/**
 * Form Schema, Validation Rules, and Metadata for Piece Rate Configs.
 * Centralized definition to avoid hardcoded columns and ensure UI model & Excel templates stay in sync.
 */

export interface FieldConfig {
  key: string;
  label: string;
  type: 'string' | 'number' | 'select' | 'date' | 'boolean';
  required: boolean;
  options?: string[];
  defaultValue?: any;
  placeholder?: string;
  validation?: (val: any) => string | null;
}

export const PieceRateConfigSchema: FieldConfig[] = [
  {
    key: 'name',
    label: 'Config Name',
    type: 'string',
    required: true,
    placeholder: 'e.g. Stitching A',
    validation: (val) => (!val || String(val).trim() === '' ? 'Config Name is required' : null)
  },
  {
    key: 'calculation_type',
    label: 'Type',
    type: 'select',
    required: true,
    options: ['FIXED', 'SLAB'],
    defaultValue: 'FIXED',
    validation: (val) => (!['FIXED', 'SLAB'].includes(val) ? 'Type must be FIXED or SLAB' : null)
  },
  {
    key: 'applicability',
    label: 'Applicability',
    type: 'select',
    required: true,
    options: ['UNIVERSAL', 'EMPLOYEE_WISE'],
    defaultValue: 'UNIVERSAL',
    validation: (val) => (!['UNIVERSAL', 'EMPLOYEE_WISE'].includes(val) ? 'Applicability must be UNIVERSAL or EMPLOYEE_WISE' : null)
  },
  {
    key: 'unit_of_measurement',
    label: 'UOM',
    type: 'string',
    required: true,
    defaultValue: 'Pieces',
    placeholder: 'e.g. Pieces, Dozen',
    validation: (val) => (!val || String(val).trim() === '' ? 'Unit of Measurement is required' : null)
  },
  {
    key: 'fixed_rate',
    label: 'Base Rate',
    type: 'number',
    required: false,
    defaultValue: 0,
    validation: (val, row) => {
      if (row?.calculation_type === 'FIXED' && (val === undefined || val === null || isNaN(val))) {
        return 'Base Rate is required for Fixed Rate configs';
      }
      return null;
    }
  },
  {
    key: 'effective_date',
    label: 'Effective Date',
    type: 'date',
    required: true,
    defaultValue: () => new Date().toISOString().split('T')[0],
    validation: (val) => (!val ? 'Effective Date is required' : null)
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: ['ACTIVE', 'INACTIVE'],
    defaultValue: 'ACTIVE'
  }
];
