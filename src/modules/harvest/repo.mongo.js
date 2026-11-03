import { MongoClient } from 'mongodb';

export async function createMongoHarvestRepo(url) {
  const client = new MongoClient(url);
  await client.connect();
  const col = client.db().collection('harvest_cycles');
  await col.createIndex(
    { client_id: 1 },
    { unique: true, partialFilterExpression: { client_id: { $type: 'string' } } },
  );
  await col.createIndex({ plot_id: 1, planting_date: -1 });
  const P = { projection: { _id: 0 } };

  return {
    async insert(c) { await col.insertOne({ ...c }); return c; },
    findById: (id) => col.findOne({ id }, P),
    findByClientId: (cid) => (cid ? col.findOne({ client_id: cid }, P) : null),
    list: ({ plot_id } = {}) =>
      col.find(plot_id ? { plot_id } : {}, P).sort({ planting_date: -1 }).toArray(),
    update: (id, patch) =>
      col.findOneAndUpdate({ id }, { $set: patch }, { returnDocument: 'after', ...P }),
    pushInput: (id, input) =>
      col.findOneAndUpdate({ id }, { $push: { inputs: input } }, { returnDocument: 'after', ...P }),
    remove: async (id) => { await col.deleteOne({ id }); },
  };
}