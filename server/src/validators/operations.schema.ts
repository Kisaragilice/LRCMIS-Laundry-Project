import { z } from 'zod';

export const createReservationSchema = z
  .object({
    timeSlotId: z.string().uuid('Slot tidak valid'),
    pickupType: z.enum(['drop_off', 'pickup']),
    addressId: z.string().uuid('Alamat tidak valid').optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    items: z
      .array(
        z.object({
          serviceId: z.string().uuid(),
          quantity: z.coerce.number().positive().max(50).default(1),
        }),
      )
      .min(1, 'Pilih minimal satu layanan')
      .max(15),
  })
  .superRefine((data, ctx) => {
    if (data.pickupType === 'pickup' && !data.addressId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['addressId'],
        message: 'Alamat wajib dipilih untuk layanan pickup',
      });
    }
    if (data.pickupType === 'drop_off' && data.addressId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['addressId'],
        message: 'Alamat tidak boleh diisi untuk drop-off',
      });
    }
  });

export const adminReservationQuery = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'expired']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const createOrderSchema = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const receiveOrderSchema = z.object({
  actualWeight: z.coerce.number().positive('Berat aktual harus lebih dari 0').max(500).optional(),
  itemQuantities: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        quantity: z.coerce.number().positive('Jumlah harus lebih dari 0').max(500),
      }),
    )
    .optional(),
  promotionCode: z.string().trim().max(50).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const orderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'received',
    'washing',
    'drying',
    'ironing',
    'packaging',
    'ready',
    'delivering',
    'completed',
    'cancelled',
    'on_hold',
  ]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const assignStaffSchema = z.object({
  staffId: z.string().uuid('Staff tidak valid').nullable(),
});

export const orderNoteSchema = z.object({
  note: z.string().trim().min(2, 'Catatan minimal 2 karakter').max(1000),
});

export const adminOrderQuery = z.object({
  orderStatus: z
    .enum(['pending', 'received', 'washing', 'drying', 'ironing', 'packaging', 'ready', 'delivering', 'completed', 'cancelled', 'on_hold'])
    .optional(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  search: z.string().trim().max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const adminCustomerQuery = z.object({
  search: z.string().trim().max(100).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const cancelReservationSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});

export const updateCustomerStatusSchema = z.object({
  isActive: z.boolean(),
});
