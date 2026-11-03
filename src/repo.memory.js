const match = (p, f) =>
  (!f.region_code || p.region_code === f.region_code) &&
  (!f.commodity || p.commodity === f.commodity);

export function createMemoryRepo() {
  const plots = new Map();
  return {
    async insert(p) { plots.set(p.id, p); return structuredClone(p); },
    async findById(id) { const p = plots.get(id); return p ? structuredClone(p) : null; },
    async findByClientId(cid) {
      for (const p of plots.values()) if (p.client_id === cid) return structuredClone(p);
      return null;
    },
    async list(f = {}) { return [...plots.values()].filter((p) => match(p, f)).map((p) => structuredClone(p)); },
    async remove(id) { return plots.delete(id); },
  };
}
