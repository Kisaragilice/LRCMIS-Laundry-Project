import { z } from 'zod';

export const pricingUnitSchema = z.enum(['kg', 'piece', 'pair']);

export const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Nama layanan minimal 2 karakter').max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  price: z.coerce.number().nonnegative('Harga tidak boleh negatif').max(99_999_999, 'Harga terlalu besar'),
  pricingUnit: pricingUnitSchema,
  estimatedHours: z.coerce.number().int().nonnegative().max(720).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const serviceUpdateSchema = serviceSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'Tidak ada perubahan yang dikirim',
);

export const adminServiceQuery = z.object({
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().trim().max(100).optional(),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format waktu harus HH:mm');

export const slotSchema = z
  .object({
    slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    startTime: time,
    endTime: time,
    capacity: z.coerce.number().int().min(0, 'Kapasitas tidak boleh negatif').max(1000),
    isAvailable: z.boolean().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'Waktu selesai harus setelah waktu mulai',
    path: ['endTime'],
  });

export const slotUpdateSchema = z
  .object({
    capacity: z.coerce.number().int().min(0).max(1000).optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Tidak ada perubahan yang dikirim');

export const slotQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
