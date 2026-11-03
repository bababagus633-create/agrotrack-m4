import { createApp } from './app.js';
import { createMemoryRepo } from './repo.memory.js';
import { createMongoRepo } from './repo.mongo.js';
import { createMemoryPricingRepo } from './modules/pricing/repo.memory.js';
import { createMongoPricingRepo } from './modules/pricing/repo.mongo.js';
import { startScheduler } from './modules/pricing/ingest.js';
import { createMemoryHarvestRepo } from './modules/harvest/repo.memory.js';
import { createMongoHarvestRepo } from './modules/harvest/repo.mongo.js';
import { MongoClient } from 'mongodb';
import { createMemoryRepo as createMemorySupplyRepo } from './modules/supply/repo.memory.js';
import { createMongoRepo as createMongoSupplyRepo } from './modules/supply/repo.mongo.js';

const { PORT = '3003', MONGO_URL, JWT_SECRET } = process.env;
if (!JWT_SECRET) {
  console.error('JWT_SECRET wajib diisi.');
  process.exit(1);
}
if (!MONGO_URL) console.warn('MONGO_URL kosong: data hanya disimpan di memori dan hilang saat server mati.');

const repo = MONGO_URL ? await createMongoRepo(MONGO_URL) : createMemoryRepo();
const pricingRepo = MONGO_URL ? await createMongoPricingRepo(MONGO_URL) : createMemoryPricingRepo();
const harvestRepo = MONGO_URL ? await createMongoHarvestRepo(MONGO_URL) : createMemoryHarvestRepo();
let supplyRepo;
if (MONGO_URL) {
  const supplyClient = new MongoClient(MONGO_URL);
  await supplyClient.connect();
  supplyRepo = createMongoSupplyRepo(supplyClient.db());
  await supplyRepo.ensureIndexes();
} else {
  supplyRepo = createMemorySupplyRepo();
}
startScheduler(pricingRepo);
createApp({ repo, pricingRepo, harvestRepo, supplyRepo, jwtSecret: JWT_SECRET }).listen(Number(PORT), () =>
  console.log(`geo-mapping berjalan di port ${PORT} (penyimpanan: ${MONGO_URL ? 'MongoDB' : 'memori'})`));
