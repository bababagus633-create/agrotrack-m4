import { z } from 'zod';

export const LEVELS = ['petani', 'lokal', 'nasional'];
export const NATIONAL = 'NASIONAL';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');
const commodity = z.string().trim().min(1).max(50).transform((s) => s.toLowerCase());

export const priceSchema = z.object({
  commodity,
  level: z.enum(LEVELS),
  region_code: z.string().trim().min(1).max(60),
  date,
  price_idr: z.number().positive().max(10_000_000),
  source: z.string().trim().max(100).optional(),
});

export const bulkSchema = z.object({ items: z.array(priceSchema).min(1).max(500) });

export const trendQuery = z.object({
  commodity,
  region_code: z.string().trim().min(1).max(60),
  from: date.optional(),
  to: date.optional(),
  bucket: z.enum(['day', 'month']).default('month'),
});

export const marginQuery = z.object({
  commodity,
  region_code: z.string().trim().min(1).max(60),
});
