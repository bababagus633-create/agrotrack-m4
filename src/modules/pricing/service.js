import { AppError } from '../../errors.js';
import { LEVELS, NATIONAL } from './schemas.js';

const pick = ({ date, price_idr }) => ({ date, price_idr });

export function createPricingService({ repo }) {
  return {
    async upsert(items) {
      const normalized = items.map((p) => (p.level === 'nasional' ? { ...p, region_code: NATIONAL } : p));
      return { saved: await repo.upsertMany(normalized) };
    },

    async trend({ commodity, region_code, from, to, bucket }) {
      const rows = await repo.list({ commodity, region_codes: [region_code, NATIONAL], from, to });
      const acc = new Map();
      const labels = new Set();
      for (const p of rows) {
        const k = bucket === 'month' ? p.date.slice(0, 7) : p.date;
        labels.add(k);
        const byBucket = acc.get(p.level) ?? new Map();
        const a = byBucket.get(k) ?? { sum: 0, n: 0 };
        a.sum += p.price_idr; a.n += 1;
        byBucket.set(k, a);
        acc.set(p.level, byBucket);
      }
      const sorted = [...labels].sort();
      const series = LEVELS.filter((l) => acc.has(l)).map((level) => ({
        level,
        values: sorted.map((k) => {
          const a = acc.get(level).get(k);
          return a ? Math.round(a.sum / a.n) : null;
        }),
      }));
      return { commodity, region_code, bucket, labels: sorted, series };
    },

    async margin({ commodity, region_code }) {
      const [petani, lokal, nasional] = await Promise.all([
        repo.latest({ commodity, level: 'petani', region_code }),
        repo.latest({ commodity, level: 'lokal', region_code }),
        repo.latest({ commodity, level: 'nasional', region_code: NATIONAL }),
      ]);
      if (!petani || !lokal) {
        throw new AppError(404, 'NOT_FOUND', 'Harga petani/pasar lokal belum tersedia untuk komoditas dan wilayah ini.');
      }
      return {
        commodity, region_code,
        farmer: pick(petani), market: pick(lokal), national: nasional ? pick(nasional) : null,
        margin_idr: lokal.price_idr - petani.price_idr,
        farmer_share_pct: Number(((petani.price_idr / lokal.price_idr) * 100).toFixed(1)),
      };
    },
  };
}
