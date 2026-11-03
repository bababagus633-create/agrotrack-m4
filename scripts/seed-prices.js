import { createMongoPricingRepo } from '../src/modules/pricing/repo.mongo.js';

const { MONGO_URL } = process.env;
if (!MONGO_URL) { console.error('MONGO_URL wajib diisi.'); process.exit(1); }
const region = process.argv[2] ?? 'kaarangrejo';

// Harga dasar Rp/kg: perkiraan kasar, BUKAN data resmi.
const BASE = { padi: 6500, jagung: 5500, kedelai: 10000, cabai: 45000 };
const VOL = { padi: 0.06, jagung: 0.08, kedelai: 0.08, cabai: 0.3 };
const LEVEL_MULT = { petani: 0.8, lokal: 1.0, nasional: 0.97 };

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

const end = new Date(); end.setUTCHours(0, 0, 0, 0);
const start = new Date(end); start.setUTCFullYear(end.getUTCFullYear() - 5);

const items = [];
for (const [commodity, base] of Object.entries(BASE)) {
  const phase = rand() * Math.PI * 2;
  let walk = 0;
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const years = (d - start) / 31557600000;
    const doy = (d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000;
    walk = walk * 0.97 + (rand() - 0.5) * 0.02;
    const season = 1 + VOL[commodity] * Math.sin((2 * Math.PI * doy) / 365 + phase);
    const core = base * (1 + 0.05 * years) * season * (1 + walk);
    const date = d.toISOString().slice(0, 10);
    for (const [level, mult] of Object.entries(LEVEL_MULT)) {
      const noise = 1 + (rand() - 0.5) * 0.02;
      const price = Math.round((core * mult * noise) / 50) * 50;
      const region_code = level === 'nasional' ? 'NASIONAL' : region;
      items.push({ commodity, level, date, price_idr: price, region_code, source: 'simulasi' });
    }
  }
}

const repo = await createMongoPricingRepo(MONGO_URL);
console.log(`Menyimpan ${items.length} baris harga...`);
await repo.upsertMany(items);
await repo.close();
console.log('Selesai.');