import { AppError, RepoError } from '../../errors.js';

// Repositori dalam memori: untuk pengujian dan demo tanpa database
export function createMemoryRepo() {
  const batches = new Map();
  const events = [];
  const clone = (x) => (x ? structuredClone(x) : null);

  return {
    async insertBatch(b) {
      if (batches.has(b.code)) throw new RepoError('DUP_CODE');
      if ([...batches.values()].some((x) => x.client_id === b.client_id)) throw new RepoError('DUP_CLIENT_ID');
      batches.set(b.code, clone(b));
    },
    async findBatch(code) { return clone(batches.get(code)); },
    async findBatchByClientId(id) {
      return clone([...batches.values()].find((b) => b.client_id === id));
    },
    async listBatches({ farmland_id, status, commodity, page, limit }) {
      let items = [...batches.values()];
      if (farmland_id) items = items.filter((b) => b.farmland_id === farmland_id);
      if (status) items = items.filter((b) => b.status === status);
      if (commodity) items = items.filter((b) => b.commodity === commodity);
      items.sort((a, b) => b.created_at - a.created_at);
      return { items: items.slice((page - 1) * limit, page * limit).map(clone), total: items.length, page, limit };
    },
    async insertEvent(e) {
      if (events.some((x) => x.batch_code === e.batch_code && x.seq === e.seq)) throw new RepoError('DUP_SEQ');
      if (events.some((x) => x.client_id === e.client_id)) throw new RepoError('DUP_CLIENT_ID');
      events.push(clone(e));
    },
    async findEventByClientId(id) { return clone(events.find((e) => e.client_id === id)); },
    async lastEvent(code) {
      const list = events.filter((e) => e.batch_code === code);
      return clone(list.sort((a, b) => b.seq - a.seq)[0]);
    },
    async listEvents(code) {
      return events.filter((e) => e.batch_code === code).sort((a, b) => a.seq - b.seq).map(clone);
    },
    async updateBatch(code, expectedVersion, patch) {
      const b = batches.get(code);
      if (!b || b.version !== expectedVersion) throw new AppError(409, 'VERSION_CONFLICT', 'Batch baru saja diubah, ulangi permintaan.');
      Object.assign(b, patch, { updated_at: new Date(), version: b.version + 1 });
      return clone(b);
    },
  };
}
