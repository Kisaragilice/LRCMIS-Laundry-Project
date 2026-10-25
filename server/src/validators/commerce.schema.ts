import { z } from 'zod';

export const createPaymentSchema = z.object({
  amount: z.coerce.number().positive('Jumlah pembayaran harus lebih dari 0').max(99_999_999),
  method: z.enum(['cash', 'bank_transfer']),
  referenceCode: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const verifyPaymentSchema = z.object({
  notes: z.string().trim().max(500).optional().nullable(),
});

export const rejectPaymentSchema = z.object({
  reason: z.string().trim().min(3, 'Alasan penolakan wajib diisi').max(500),
});

export const refundPaymentSchema = z.object({
  reason: z.string().trim().min(3, 'Alasan refund wajib diisi').max(500),
});

export const adminPaymentQuery = z.object({
  status: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
  method: z.enum(['cash', 'bank_transfer', 'payment_gateway']).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const promotionSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, 'Kode minimal 3 karakter')
      .max(50)
      .regex(/^[A-Z0-9_-]+$/, 'Kode hanya boleh huruf kapital, angka, _ dan -')
      .transform((v) => v.toUpperCase()),
    discountType: z.enum(['percentage', 'fixed']),
    discountValue: z.coerce.number().positive('Nilai diskon harus lebih dari 0'),
    minPurchase: z.coerce.number().nonnegative().default(0),
    maxDiscount: z.coerce.number().positive().optional().nullable(),
    perUserLimit: z.coerce.number().int().positive().max(100).default(1),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    usageLimit: z.coerce.number().int().positive().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === 'percentage' && data.discountValue > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountValue'], message: 'Persentase maksimal 100' });
    }
    if (new Date(data.endAt) <= new Date(data.startAt)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endAt'], message: 'Tanggal selesai harus setelah tanggal mulai' });
    }
  });

export const promotionUpdateSchema = z
  .object({
    discountType: z.enum(['percentage', 'fixed']).optional(),
    discountValue: z.coerce.number().positive().optional(),
    minPurchase: z.coerce.number().nonnegative().optional(),
    maxDiscount: z.coerce.number().positive().nullable().optional(),
    perUserLimit: z.coerce.number().int().positive().max(100).optional(),
    startAt: z.string().datetime({ offset: true }).optional(),
    endAt: z.string().datetime({ offset: true }).optional(),
    usageLimit: z.coerce.number().int().positive().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Tidak ada perubahan yang dikirim');

export const validateVoucherSchema = z.object({
  code: z.string().trim().min(1, 'Kode voucher wajib diisi').max(50),
  subtotal: z.coerce.number().nonnegative(),
});

export const publicPromotionQuery = z.object({
  subtotal: z.coerce.number().nonnegative().optional(),
});
