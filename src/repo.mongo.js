import { MongoClient } from 'mongodb';

export async function createMongoRepo(url) {
  const client = new MongoClient(url);
  await client.connect();
  const col = client.db().collection('plots');
  await col.createIndex({ geometry: '2dsphere' });
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ client_id: 1 }, { unique: true });
  const noId = { projection: { _id: 0 } };
  return {
    async insert(p) { await col.insertOne({ ...p }); return p; },
    findById: (id) => col.findOne({ id }, noId),
    findByClientId: (client_id) => col.findOne({ client_id }, noId),
    list(f = {}) {
      const q = {};
      if (f.region_code) q.region_code = f.region_code;
      if (f.commodity) q.commodity = f.commodity;
      return col.find(q, noId).sort({ created_at: 1 }).toArray();
    },
    async remove(id) { return (await col.deleteOne({ id })).deletedCount > 0; },
    close: () => client.close(),
  };
}
