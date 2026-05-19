export type DataSource = 
  | 'MASTERS' | 'EMPLOYEE_MASTER' | 'ATTENDANCE' | 'SALARY'
  | 'EARNINGS_TRANS' | 'DEDUCTION_TRANS' | 'ADVANCE_TRANS'
  | 'LOAN_TRANS' | 'BONUS_TRANS' | 'INCENTIVE_TRANS' | 'OT_TRANS'
  | 'ARREAR_TRANS' | 'PF' | 'ESI' | 'PT' | 'LWF' | 'GRATUITY'
  | 'BANKING' | 'MIS' | 'AUDIT_LOGS';

export type ExportFormat = 'PDF' | 'EXCEL' | 'WORD';

export type FilterType = 'MONTH' | 'YEAR' | 'DEPARTMENT' | 'EMPLOYEE' | 'CATEGORY' | 'DIVISION' | 'CONTRACTOR' | 'SHIFT' | 'STATUS' | 'DATE_RANGE';

export interface FilterDefinition {
  key: string;
  label: string;
  type: FilterType;
  required?: boolean;
  options?: { label: string; value: string }[];
}

export interface ReportContext {
  filters: Record<string, any>;
  moduleType: 'K' | 'P';
}

export interface ReportResult {
  data: any[];
  columns: { key: string; label: string; type?: string }[];
  summary?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ReportResolver {
  resolve: (context: ReportContext) => Promise<ReportResult> | ReportResult;
}

import { IBaseExporter } from '../exporters/types';

export interface ReportDefinition {
  reportKey: string;
  name: string;
  description?: string;
  dataSource: DataSource;
  group: string;
  supportedExports: ExportFormat[];
  filters: FilterDefinition[];
  resolver: () => Promise<{ default: ReportResolver }>;
  viewer?: React.ComponentType<any>;
  exporters?: Partial<Record<ExportFormat, () => Promise<{ default: IBaseExporter }>>>;
}
