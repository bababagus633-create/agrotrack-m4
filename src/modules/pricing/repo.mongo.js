import { MongoClient } from 'mongodb';

export async function createMongoPricingRepo(url) {
  const client = new MongoClient(url);
  await client.connect();
  const col = client.db().collection('prices');
  await col.createIndex({ commodity: 1, level: 1, region_code: 1, date: 1 }, { unique: true });

  const toQuery = (f) => {
    const q = {};
    if (f.commodity) q.commodity = f.commodity;
    if (f.level) q.level = f.level;
    if (f.region_codes) q.region_code = { $in: f.region_codes };
    if (f.from || f.to) q.date = { ...(f.from && { $gte: f.from }), ...(f.to && { $lte: f.to }) };
    return q;
  };

  return {
    async upsertMany(items) {
      for (let i = 0; i < items.length; i += 1000) {
        const ops = items.slice(i, i + 1000).map((p) => ({
          updateOne: {
            filter: { commodity: p.commodity, level: p.level, region_code: p.region_code, date: p.date },
            update: { $set: p },
            upsert: true,
          },
        }));
        await col.bulkWrite(ops, { ordered: false });
      }
      return items.length;
    },
    list: (filter) => col.find(toQuery(filter), { projection: { _id: 0 } }).sort({ date: 1 }).toArray(),
    latest: ({ commodity, level, region_code }) =>
      col.findOne({ commodity, level, region_code }, { sort: { date: -1 }, projection: { _id: 0 } }),
    close: () => client.close(),
  };
}
