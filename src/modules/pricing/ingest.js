import cron from 'node-cron';
import { EventEmitter } from 'node:events';

export const priceEvents = new EventEmitter();

const COMMODITIES = (process.env.COMMODITIES || 'padi').split(',');
const REGIONS = (process.env.PRICE_REGIONS || 'kaarangrejo').split(',');
const LEVELS = ['petani', 'lokal', 'nasional'];
const PRICE_FIELD = 'price_idr';
const NATIONAL_CODE = 'NASIONAL';

const today = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD

const round50 = (v) => Math.round(v / 50) * 50;
const codeFor = (level, region) => (level === 'nasional' ? NATIONAL_CODE : region);

// Sumber asli: isi PRICE_SOURCE_URL dan sesuaikan mapping field.
// Level 'nasional' harus memakai region_code 'NASIONAL'.
async function fetchFromSource() {
  const res = await fetch(process.env.PRICE_SOURCE_URL);
  if (!res.ok) throw new Error('Sumber harga gagal: ' + res.status);
  const rows = await res.json();
  return rows.map((r) => ({
    commodity: r.commodity,
    level: r.level,
    region_code: r.region_code,
    date: r.date || today(),
    [PRICE_FIELD]: Number(r.price),
    source: 'api',
  }));
}

// Tanpa sumber asli: simulasi random walk dari harga terakhir (untuk demo).
async function simulate(pricingRepo) {
  const items = [];
  for (const commodity of COMMODITIES) {
    for (const region of REGIONS) {
      const prev = {};
      let sudahAda = false;
      for (const level of LEVELS) {
        const last = await pricingRepo.latest({
          commodity, level, region_code: codeFor(level, region),
        });
        if (!process.env.DEMO_LIVE && last?.date === today()) { sudahAda = true; break; }
        prev[level] = last?.[PRICE_FIELD];
      }
      if (sudahAda) continue;

      const walk = (v, dflt) => round50((v ?? dflt) * (1 + (Math.random() - 0.5) * 0.02));
      const petani = walk(prev.petani, 6950);
      const lokal = Math.max(petani + 500, walk(prev.lokal, 8600));
      const nasional = Math.max(petani + 300, walk(prev.nasional, 8250));

      for (const [level, price] of Object.entries({ petani, lokal, nasional })) {
        items.push({
          commodity, level, region_code: codeFor(level, region),
          date: today(), [PRICE_FIELD]: price, source: 'simulasi',
        });
      }
    }
  }
  return items;
}

export async function runIngest(pricingRepo) {
  const items = process.env.PRICE_SOURCE_URL
    ? await fetchFromSource()
    : await simulate(pricingRepo);
  if (!items.length) {
    console.log('[ingest] harga hari ini sudah ada, dilewati');
    return 0;
  }
  const n = await pricingRepo.upsertMany(items);
  console.log(`[ingest] ${n} data harga diperbarui (${today()})`);
  priceEvents.emit('prices:updated', { count: n, date: today(), at: new Date().toISOString() });
  return n;
}

export function startScheduler(pricingRepo) {
  cron.schedule(process.env.INGEST_CRON || '0 6 * * *', () => {
    runIngest(pricingRepo).catch((e) => console.error('[ingest] error', e));
  }, { timezone: 'Asia/Jakarta' });

  // sekali saat server start, supaya data hari ini langsung ada
  runIngest(pricingRepo).catch((e) => console.error('[ingest] error awal', e));
}