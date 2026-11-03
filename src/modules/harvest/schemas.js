import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

export const inputSchema = z.object({
  type: z.enum(['pupuk', 'pestisida']),
  name: z.string().trim().min(1).max(100),
  amount: z.number().positive().max(100000),
  unit: z.enum(['kg', 'liter']),
  date,
});

export const cycleSchema = z.object({
  client_id: z.string().trim().min(8).max(100).optional(),
  plot_id: z.string().trim().min(1).max(100),
  commodity: z.string().trim().min(1).max(50).transform((s) => s.toLowerCase()).optional(),
  planting_date: date,
  expected_harvest_date: date.optional(),
  est_yield_ton_per_ha: z.number().positive().max(100).optional(),
  inputs: z.array(inputSchema).max(100).default([]),
  notes: z.string().trim().max(500).optional(),
}).refine(
  (c) => !c.expected_harvest_date || c.expected_harvest_date >= c.planting_date,
  { message: 'Target panen tidak boleh sebelum tanggal tanam.', path: ['expected_harvest_date'] },
);

export const harvestSchema = z.object({
  actual_harvest_date: date,
  actual_tonnage: z.number().nonnegative().max(1000000),
});

export const listQuery = z.object({
  plot_id: z.string().trim().min(1).max(100).optional(),
});