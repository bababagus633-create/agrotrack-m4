import { randomUUID } from 'node:crypto';
import { AppError } from '../../errors.js';

const round = (n) => Number(n.toFixed(2));
const today = () => new Date().toISOString().slice(0, 10);

function withStatus(c) {
  let status = 'tumbuh';
  if (c.actual_harvest_date) status = 'selesai';
  else if (c.expected_harvest_date && c.expected_harvest_date <= today()) status = 'siap_panen';
  return { ...c, status };
}

export function createHarvestService({ repo, plots }) {
  async function own(id, actor) {
    const c = await repo.findById(id);
    if (!c) throw new AppError(404, 'NOT_FOUND', 'Siklus tanam tidak ditemukan.');
    if (actor.role !== 'ADMIN' && c.owner_id !== actor.sub) {
      throw new AppError(403, 'FORBIDDEN', 'Hanya pemilik atau ADMIN yang boleh mengubah siklus ini.');
    }
    return c;
  }

  return {
    async create(input, actor) {
      const existing = await repo.findByClientId(input.client_id);
      if (existing) return { cycle: withStatus(existing), replay: true };

      const plot = await plots.get(input.plot_id); // 404 kalau lahan tidak ada
      const commodity = input.commodity ?? plot.commodity ?? null;
      if (!commodity) {
        throw new AppError(422, 'VALIDATION', 'Komoditas wajib diisi karena lahan ini belum punya komoditas.');
      }
      const y = input.est_yield_ton_per_ha ?? null;
      const cycle = {
        id: randomUUID(),
        client_id: input.client_id ?? null,
        plot_id: plot.id,
        plot_name: plot.name,
        region_code: plot.region_code,
        area_ha: plot.area_ha,
        commodity,
        planting_date: input.planting_date,
        expected_harvest_date: input.expected_harvest_date ?? null,
        est_yield_ton_per_ha: y,
        est_tonnage: y ? round(y * plot.area_ha) : null,
        actual_harvest_date: null,
        actual_tonnage: null,
        actual_yield_ton_per_ha: null,
        inputs: input.inputs,
        notes: input.notes ?? null,
        owner_id: actor.sub,
        created_at: new Date().toISOString(),
      };
      return { cycle: withStatus(await repo.insert(cycle)), replay: false };
    },

    async list(filter) {
      return (await repo.list(filter)).map(withStatus);
    },

    async addInput(id, input, actor) {
      await own(id, actor);
      return withStatus(await repo.pushInput(id, input));
    },

    async recordHarvest(id, data, actor) {
      const c = await own(id, actor);
      const patch = {
        actual_harvest_date: data.actual_harvest_date,
        actual_tonnage: data.actual_tonnage,
        actual_yield_ton_per_ha: c.area_ha ? round(data.actual_tonnage / c.area_ha) : null,
      };
      return withStatus(await repo.update(id, patch));
    },

    async remove(id, actor) {
      await own(id, actor);
      await repo.remove(id);
    },
  };
}