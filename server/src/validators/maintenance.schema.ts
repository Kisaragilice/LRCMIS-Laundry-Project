import { z } from 'zod';

export const resetHistorySchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine((value) => value === 'HAPUS RIWAYAT', 'Ketik HAPUS RIWAYAT untuk mengonfirmasi'),
});
