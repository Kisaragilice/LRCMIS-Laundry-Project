import { z } from 'zod';

export const conversationIdParam = z.object({ id: z.string().uuid('ID percakapan tidak valid') });
export const orderIdParam = z.object({ orderId: z.string().uuid('ID pesanan tidak valid') });

export const startConversationSchema = z.object({
  userId: z.string().uuid('Pilih pengguna yang valid'),
});

export const sendMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Pesan wajib diisi')
    .max(2000, 'Pesan maksimal 2000 karakter'),
});
