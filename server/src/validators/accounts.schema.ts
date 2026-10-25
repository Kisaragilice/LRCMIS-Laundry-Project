import { z } from 'zod';

export const accountQuery = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(['customer', 'admin', 'staff', 'courier', 'owner']).optional(),
  status: z.enum(['active', 'inactive', 'deleted']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const accountStatusSchema = z.object({
  isActive: z.boolean(),
});

const internalRole = z.enum(['staff', 'courier', 'owner'], {
  errorMap: () => ({ message: 'Peran harus staff, courier, atau owner' }),
});

export const createAccountSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().trim().email('Email tidak valid').max(150).transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .max(72)
    .regex(/[A-Za-z]/, 'Password harus mengandung huruf')
    .regex(/[0-9]/, 'Password harus mengandung angka'),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?62|0)[0-9]{8,14}$/, 'Nomor telepon tidak valid (contoh: 081234567890)')
    .optional(),
  role: internalRole,
});
