import { z } from 'zod';

export const geocodeSearchQuery = z.object({
  q: z.string().trim().min(3, 'Kata kunci alamat minimal 3 karakter').max(200),
  limit: z.coerce.number().int().min(1).max(8).default(5),
});

export const geocodeReverseQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
