import { z } from 'zod';
import { AppError } from './errors.js';

export function parse(schema, data) {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  throw new AppError(422, 'VALIDATION', 'Data tidak valid.',
    r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
}

const pos = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const ring = z.array(pos).min(4).max(2000).refine(
  (r) => r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1],
  'Cincin poligon harus tertutup (titik awal = titik akhir).');

export const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(ring).min(1).max(10),
});

const fields = {
  name: z.string().min(1).max(120),
  region_code: z.string().min(1).max(60),
  commodity: z.string().min(1).max(40).optional(),
  group_name: z.string().min(1).max(120).optional(),
  farmland_id: z.string().min(1).max(64).optional(), // rujukan ke lahan di M3
};

export const createPlotSchema = z.object({
  client_id: z.string().uuid(),
  ...fields,
  geometry: polygonSchema,
});

export const importSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(z.object({
    type: z.literal('Feature'),
    geometry: polygonSchema,
    properties: z.object(fields).partial().passthrough().nullish().transform((v) => v ?? {}),
  })).min(1).max(200),
});

export const importQuery = z.object({ region_code: z.string().min(1).max(60).optional() });
export const plotsQuery = z.object({
  region_code: z.string().max(60).optional(),
  commodity: z.string().max(40).optional(),
});
