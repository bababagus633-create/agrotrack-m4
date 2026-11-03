import { AppError, RepoError } from '../../errors.js';

function mapDup(e, collection) {
  if (e?.code !== 11000) return e;
  const key = e.keyPattern ?? {};
  if ('client_id' in key) return new RepoError('DUP_CLIENT_ID');
  if (collection === 'batches' && 'code' in key) return new RepoError('DUP_CODE');
  if (collection === 'chain_events' && 'seq' in key) return new RepoError('DUP_SEQ');
  return e;
}

export function createMongoRepo(db) {
  const batches = db.collection('batches');
  const events = db.collection('chain_events');

  return {
    async ensureIndexes() {
      await batches.createIndex({ code: 1 }, { unique: true });
      await batches.createIndex({ client_id: 1 }, { unique: true });
      await batches.createIndex({ farmland_id: 1, harvest_date: -1 });
      await batches.createIndex({ status: 1 });
      await events.createIndex({ batch_code: 1, seq: 1 }, { unique: true });
      await events.createIndex({ client_id: 1 }, { unique: true });
    },
    async insertBatch(b) {
      try { await batches.insertOne({ ...b }); } catch (e) { throw mapDup(e, 'batches'); }
    },
    findBatch: (code) => batches.findOne({ code }),
    findBatchByClientId: (client_id) => batches.findOne({ client_id }),
    async listBatches({ farmland_id, status, commodity, page, limit }) {
      const q = {};
      if (farmland_id) q.farmland_id = farmland_id;
      if (status) q.status = status;
      if (commodity) q.commodity = commodity;
      const [items, total] = await Promise.all([
        batches.find(q).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
        batches.countDocuments(q),
      ]);
      return { items, total, page, limit };
    },
    async insertEvent(e) {
      try { await events.insertOne({ ...e }); } catch (err) { throw mapDup(err, 'chain_events'); }
    },
    findEventByClientId: (client_id) => events.findOne({ client_id }),
    lastEvent: (batch_code) => events.findOne({ batch_code }, { sort: { seq: -1 } }),
    listEvents: (batch_code) => events.find({ batch_code }).sort({ seq: 1 }).toArray(),
    async updateBatch(code, expectedVersion, patch) {
      const updated = await batches.findOneAndUpdate(
        { code, version: expectedVersion },
        { $set: { ...patch, updated_at: new Date() }, $inc: { version: 1 } },
        { returnDocument: 'after' },
      );
      if (!updated) throw new AppError(409, 'VERSION_CONFLICT', 'Batch baru saja diubah, ulangi permintaan.');
      return updated;
    },
  };
}
