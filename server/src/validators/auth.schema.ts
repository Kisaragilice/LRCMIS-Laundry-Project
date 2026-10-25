import { z } from 'zod';

export const idParam = z.object({ id: z.string().uuid('ID tidak valid') });

const phone = z
  .string()
  .trim()
  .regex(/^(\+?62|0)[0-9]{8,14}$/, 'Nomor telepon tidak valid (contoh: 081234567890)');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().trim().email('Email tidak valid').max(150).transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .max(72)
    .regex(/[A-Za-z]/, 'Password harus mengandung huruf')
    .regex(/[0-9]/, 'Password harus mengandung angka'),
  phone: phone.optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Email tidak valid').transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Email tidak valid').transform((v) => v.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Token reset tidak valid'),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .max(72)
    .regex(/[A-Za-z]/, 'Password harus mengandung huruf')
    .regex(/[0-9]/, 'Password harus mengandung angka'),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: phone.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Tidak ada perubahan yang dikirim');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newPassword: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .max(72)
    .regex(/[A-Za-z]/, 'Password harus mengandung huruf')
    .regex(/[0-9]/, 'Password harus mengandung angka'),
});

export const addressSchema = z.object({
  label: z.string().trim().max(50).optional(),
  recipientName: z.string().trim().max(100).optional(),
  phone: phone.optional(),
  addressText: z.string().trim().min(10, 'Alamat minimal 10 karakter').max(1000),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  isDefault: z.boolean().optional(),
});

export const addressUpdateSchema = addressSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'Tidak ada perubahan yang dikirim',
);
