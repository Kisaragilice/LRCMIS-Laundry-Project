import { z } from 'zod';

const phone = z
  .string()
  .trim()
  .regex(/^(\+?62|0)[0-9]{8,14}$/, 'Nomor telepon tidak valid (contoh: 081234567890)');

export const loginSchema = z.object({
  email: z.string().trim().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
    email: z.string().trim().email('Email tidak valid').max(150),
    phone: phone.optional().or(z.literal('')),
    password: z
      .string()
      .min(8, 'Password minimal 8 karakter')
      .max(72)
      .regex(/[A-Za-z]/, 'Password harus mengandung huruf')
      .regex(/[0-9]/, 'Password harus mengandung angka'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Konfirmasi password tidak sama',
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Email tidak valid'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, 'Token reset tidak valid'),
    password: z
      .string()
      .min(8, 'Password minimal 8 karakter')
      .regex(/[A-Za-z]/, 'Password harus mengandung huruf')
      .regex(/[0-9]/, 'Password harus mengandung angka'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Konfirmasi password tidak sama',
  });

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const output: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!output[key]) output[key] = issue.message;
  }
  return output;
}
