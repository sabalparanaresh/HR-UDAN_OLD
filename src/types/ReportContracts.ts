import { z } from 'zod';

export const FilterOperatorSchema = z.enum([
  'equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'in', 'between', 'is_null', 'is_not_null'
]);

export interface ReportFilter {
  field: string;
  operator: z.infer<typeof FilterOperatorSchema>;
  value?: any;
}

export interface ReportPagination {
  limit: number;
  offset: number;
}

export interface ReportSort {
  field: string;
  direction?: 'asc' | 'desc';
}

export interface ReportColumn {
  field: string;
  headerName?: string;
  type?: 'string' | 'number' | 'date' | 'boolean';
  width?: number;
  hidden?: boolean;
}

export interface ReportGrouping {
  by: string[];           // fields to group by
  aggregations: Array<{   // aggregation functions per field
    field: string;
    func: 'sum' | 'avg' | 'min' | 'max' | 'count';
  }>;
}

export interface ChartDatasetRequest {
  type: 'bar' | 'line' | 'pie';
  xAxis: string;          // Field for X axis or labels
  yAxis: string[];        // Field(s) for Y axis or values
  aggregation?: 'sum' | 'avg' | 'count';
  limit?: number;         // Top N
}

export interface ChartDatasetResponse {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
  }>;
}

export interface DrillDownContext {
  sourceReport: string;
  sourceField: string;
  sourceValue: any;
  targetReport: string;
  appliedFilters: ReportFilter[];
}

export interface ExportPayload {
  reportName?: string;
  base_table: string;
  module_type: 'K' | 'P';
  columns: ReportColumn[];
  header_groups?: Array<{ title: string; start_col: number; end_col: number }>;
  filters?: ReportFilter[];
  sorts?: ReportSort[];
  grouping?: ReportGrouping;
  password?: string;
  author?: string;
  format: 'EXCEL' | 'CSV' | 'PDF';
}

export interface ReportRequest {
  reportName?: string;
  base_table: string;
  module_type: 'K' | 'P';
  columns: ReportColumn[];
  filters?: ReportFilter[];
  pagination?: ReportPagination;
  sorts?: ReportSort[];
  grouping?: ReportGrouping;
  chart_request?: ChartDatasetRequest;
  drill_down?: DrillDownContext;
  author?: string;
}

export interface ReportResult {
  data: any[];
  total: number;
  chart_data?: ChartDatasetResponse;
  summary?: Record<string, any>; // For footer summaries if any
}
