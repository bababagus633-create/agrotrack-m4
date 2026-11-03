export function createMemoryHarvestRepo() {
  const rows = new Map();
  return {
    async insert(c) { rows.set(c.id, c); return c; },
    async findById(id) { return rows.get(id) ?? null; },
    async findByClientId(cid) {
      return cid ? ([...rows.values()].find((c) => c.client_id === cid) ?? null) : null;
    },
    async list({ plot_id } = {}) {
      return [...rows.values()]
        .filter((c) => !plot_id || c.plot_id === plot_id)
        .sort((a, b) => b.planting_date.localeCompare(a.planting_date));
    },
    async update(id, patch) {
      const c = rows.get(id);
      if (!c) return null;
      Object.assign(c, patch);
      return c;
    },
    async pushInput(id, input) {
      const c = rows.get(id);
      if (!c) return null;
      c.inputs.push(input);
      return c;
    },
    async remove(id) { rows.delete(id); },
  };
}