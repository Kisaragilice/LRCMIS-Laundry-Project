import { z } from 'zod';

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Rating minimal 1').max(5, 'Rating maksimal 5'),
  comment: z.string().trim().max(1000).optional().nullable(),
});

export const complaintSchema = z.object({
  orderId: z.string().uuid().optional().nullable(),
  subject: z.string().trim().min(3, 'Subjek minimal 3 karakter').max(150),
  description: z.string().trim().min(10, 'Deskripsi minimal 10 karakter').max(2000),
  priority: z.enum(['low', 'normal', 'high']).optional(),
});

export const complaintUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  resolution: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
});

export const complaintFollowUpSchema = z.object({
  note: z.string().trim().min(2, 'Catatan minimal 2 karakter').max(1000),
});

export const courierTaskStatusSchema = z
  .object({
    status: z.enum(['accepted', 'in_progress', 'completed', 'failed']),
    notes: z.string().trim().max(1000).optional().nullable(),
    handoverRecipient: z.string().trim().max(100).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'completed' && !data.handoverRecipient) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['handoverRecipient'],
        message: 'Nama penerima wajib diisi saat menyelesaikan tugas',
      });
    }
  });

export const assignCourierSchema = z.object({
  courierId: z.string().uuid('Kurir tidak valid').nullable(),
});

export const createTaskSchema = z.object({
  taskType: z.enum(['pickup', 'delivery']),
  scheduledAt: z.string().datetime({ offset: true }),
  courierId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const reviewQuery = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const complaintQuery = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const notificationQuery = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
