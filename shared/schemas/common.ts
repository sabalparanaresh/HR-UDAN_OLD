import { z } from 'zod';

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");
export const monthString = z.string().regex(/^\d{2}-\d{4}$/, "Must be MM-YYYY format");

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(50),
  search: z.string().optional()
});

// Common fields for all workflow-enabled entities
export const WorkflowStateSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'POSTED',
  'ARCHIVED'
]);
