import { randomUUID } from 'node:crypto';
import { AppError } from './errors.js';
import { areaHa, centroid } from './geo.js';
import { createPlotSchema, parse } from './schemas.js';

const round = (n) => Number(n.toFixed(4));
const UNKNOWN = 'tidak_diketahui';

function build(input, actor) {
  return {
    id: randomUUID(),
    ...input,
    area_ha: round(areaHa(input.geometry)),
    centroid: centroid(input.geometry),
    owner_id: actor.sub,
    created_at: new Date().toISOString(),
  };
}

export const toFeature = ({ geometry, ...props }) =>
  ({ type: 'Feature', id: props.id, geometry, properties: props });
export const toFeatureCollection = (plots) =>
  ({ type: 'FeatureCollection', features: plots.map(toFeature) });

export function createService({ repo }) {
  async function insert(plot) {
    try {
      return await repo.insert(plot);
    } catch (e) {
      if (/geo keys|Loop|Edges|self-intersect/i.test(e.message ?? '')) {
        throw new AppError(422, 'INVALID_GEOMETRY', 'Poligon tidak valid, kemungkinan garisnya berpotongan sendiri.');
      }
      throw e;
    }
  }

  return {
    async create(input, actor) {
      const existing = await repo.findByClientId(input.client_id);
      if (existing) return { plot: existing, replay: true };
      return { plot: await insert(build(input, actor)), replay: false };
    },

    // Validasi semua fitur dulu; kalau ada yang salah, tidak ada yang disimpan.
    async importMany(features, defaultRegion, actor) {
      const inputs = [];
      const errors = [];
      features.forEach((f, i) => {
        try {
          const p = f.properties;
          inputs.push(parse(createPlotSchema, {
            client_id: randomUUID(),
            name: p.name ?? `Lahan impor ${i + 1}`,
            region_code: p.region_code ?? defaultRegion,
            commodity: p.commodity,
            group_name: p.group_name,
            farmland_id: p.farmland_id,
            geometry: f.geometry,
          }));
        } catch (e) {
          errors.push({ feature: i, details: e.details ?? e.message });
        }
      });
      if (errors.length) throw new AppError(422, 'VALIDATION', 'Ada fitur yang tidak valid; tidak ada yang diimpor.', errors);
      const saved = [];
      for (const input of inputs) saved.push(await insert(build(input, actor)));
      return saved;
    },

    list: (filter) => repo.list(filter),

    async get(id) {
      const p = await repo.findById(id);
      if (!p) throw new AppError(404, 'NOT_FOUND', 'Lahan tidak ditemukan.');
      return p;
    },

    async remove(id, actor) {
      const p = await this.get(id);
      if (actor.role !== 'ADMIN' && p.owner_id !== actor.sub) {
        throw new AppError(403, 'FORBIDDEN', 'Hanya pemilik atau ADMIN yang boleh menghapus lahan ini.');
      }
      await repo.remove(id);
    },

    // Komoditas unggulan per wilayah = komoditas dengan total luas terbesar.
    async leadingCommodities(filter) {
      const regions = new Map();
      for (const p of await repo.list(filter)) {
        const r = regions.get(p.region_code) ?? { total: 0, plots: 0, by: new Map() };
        const c = p.commodity ?? UNKNOWN;
        const b = r.by.get(c) ?? { area: 0, plots: 0 };
        b.area += p.area_ha; b.plots += 1;
        r.by.set(c, b); r.total += p.area_ha; r.plots += 1;
        regions.set(p.region_code, r);
      }
      return [...regions].map(([region_code, r]) => {
        const breakdown = [...r.by].map(([commodity, b]) => ({
          commodity, area_ha: round(b.area), plots: b.plots,
          share: r.total ? round(b.area / r.total) : 0,
        })).sort((a, b) => b.area_ha - a.area_ha);
        return {
          region_code, total_ha: round(r.total), plot_count: r.plots,
          leading: breakdown.find((b) => b.commodity !== UNKNOWN) ?? null,
          breakdown,
        };
      }).sort((a, b) => b.total_ha - a.total_ha);
    },
  };
}
