const key = (p) => [p.commodity, p.level, p.region_code, p.date].join('|');

export function createMemoryPricingRepo() {
  const rows = new Map();
  const match = (p, f) =>
    (!f.commodity || p.commodity === f.commodity) &&
    (!f.level || p.level === f.level) &&
    (!f.region_codes || f.region_codes.includes(p.region_code)) &&
    (!f.from || p.date >= f.from) &&
    (!f.to || p.date <= f.to);

  return {
    async upsertMany(items) {
      for (const p of items) rows.set(key(p), p);
      return items.length;
    },
    async list(filter) {
      return [...rows.values()].filter((p) => match(p, filter)).sort((a, b) => a.date.localeCompare(b.date));
    },
    async latest({ commodity, level, region_code }) {
      const found = [...rows.values()].filter(
        (p) => p.commodity === commodity && p.level === level && p.region_code === region_code);
      return found.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    },
  };
}
