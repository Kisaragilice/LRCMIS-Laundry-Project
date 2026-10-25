import { z } from 'zod';

export const reportQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional(),
  groupBy: z.enum(['day', 'month']).optional(),
});

export const reportExportQuery = reportQuery.extend({
  type: z.enum(['revenue', 'orders', 'services', 'customers']).default('revenue'),
});

export const auditLogQuery = z.object({
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const dashboardQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
