import { z } from 'zod';
import { AppError } from '../../errors.js';

const location = z.object({
  type: z.enum(['FARM', 'WAREHOUSE', 'STORE']),
  ref_id: z.string().max(64).optional(),
  name: z.string().min(1).max(120),
});
const isoDateTime = z.string().datetime({ offset: true });

export const createBatchSchema = z.object({
  client_id: z.string().uuid(),
  farmland_id: z.string().min(1).max(64),
  cycle_id: z.string().max(64).optional(),
  commodity: z.string().min(1).max(60),
  weight_kg: z.number().positive().max(1_000_000),
  harvest_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location_name: z.string().min(1).max(120).optional(),
});

export const transferSchema = z.object({
  client_id: z.string().uuid(),
  type: z.literal('TRANSFERRED'),
  from: location.optional(),
  to: location.refine((l) => l.type !== 'FARM', 'Tujuan harus WAREHOUSE atau STORE'),
  weight_kg: z.number().positive().optional(),
  occurred_at: isoDateTime.optional(),
  note: z.string().max(500).optional(),
});

export const sortSchema = z.object({
  client_id: z.string().uuid(),
  grade: z.enum(['A', 'B', 'C']),
  weight_kg: z.number().positive(),
  occurred_at: isoDateTime.optional(),
  note: z.string().max(500).optional(),
});

export const receiveSchema = z.object({
  client_id: z.string().uuid(),
  weight_kg: z.number().positive().optional(),
  occurred_at: isoDateTime.optional(),
  note: z.string().max(500).optional(),
});

export const listQuerySchema = z.object({
  farmland_id: z.string().max(64).optional(),
  status: z.enum(['CREATED', 'IN_TRANSIT', 'SORTED', 'RECEIVED']).optional(),
  commodity: z.string().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Data tidak valid.',
      r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return r.data;
}
