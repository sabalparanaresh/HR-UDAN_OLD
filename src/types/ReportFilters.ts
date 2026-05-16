import { z } from 'zod';

export const FilterDTOSchema = z.object({
  // Global / Date range
  date_range: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
  month_year: z.string().optional(), // YYYY-MM
  
  // Organization Hierarchy
  department_ids: z.array(z.number()).optional(),
  designation_ids: z.array(z.number()).optional(),
  division_ids: z.array(z.number()).optional(),
  category_ids: z.array(z.number()).optional(),

  // Employee specifics
  employee_ids: z.array(z.number()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional(),
  wage_type: z.enum(['PIECE_RATE', 'DAILY_WAGE', 'ALL']).optional(),

  // Module context
  module_type: z.enum(['K', 'P', 'ALL']).optional(),

  // Attendance specific
  attendance_types: z.array(z.string()).optional(), // e.g. ['P', 'A', 'HD', 'OT']
  
  // Payroll specific
  salary_head_ids: z.array(z.number()).optional(),
  
  // Advanced generic filters for backwards compatibility
  custom_filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'in']),
    value: z.any()
  })).optional()
});

export type FilterDTO = z.infer<typeof FilterDTOSchema>;

export const TemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  base_table: z.string(),
  columns: z.array(z.string()),
  filters: FilterDTOSchema,
  module_type: z.string(),
  created_by: z.string().optional()
});

export type ReportTemplateDTO = z.infer<typeof TemplateSchema>;

/**
 * Utility to serialize the FilterDTO into an array of backend-safe filters 
 * using the existing { field, operator, value } structure expected by execute_report_query
 */
export function serializeToBackendFilters(dto: FilterDTO): any[] {
  const filters: any[] = [];

  // Re-append any user-defined custom filters
  if (dto.custom_filters) {
    filters.push(...dto.custom_filters);
  }

  // Map concrete fields
  if (dto.status && dto.status !== 'ALL') {
    filters.push({
      field: 'status',
      operator: 'equals',
      value: dto.status
    });
  }

  if (dto.wage_type && dto.wage_type !== 'ALL') {
    filters.push({
      field: 'wage_type',
      operator: 'equals',
      value: dto.wage_type
    });
  }

  if (dto.department_ids && dto.department_ids.length > 0) {
    filters.push({
      field: 'department_id',
      operator: 'in',
      value: dto.department_ids
    });
  }

  if (dto.designation_ids && dto.designation_ids.length > 0) {
    filters.push({
      field: 'designation_id',
      operator: 'in',
      value: dto.designation_ids
    });
  }

  if (dto.division_ids && dto.division_ids.length > 0) {
    filters.push({
      field: 'division_id',
      operator: 'in',
      value: dto.division_ids
    });
  }

  if (dto.date_range?.from) {
    filters.push({
      field: 'created_at', // Defaulting to created_at or general date criteria
      operator: 'gte',
      value: dto.date_range.from
    });
  }

  if (dto.date_range?.to) {
    filters.push({
      field: 'created_at',
      operator: 'lte',
      value: dto.date_range.to
    });
  }

  if (dto.month_year) {
    filters.push({
      field: 'month_year',
      operator: 'equals',
      value: dto.month_year
    });
  }

  return filters;
}

