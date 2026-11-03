import express from 'express';
import { authenticate, requireRole } from '../../auth.js';
import { AppError } from '../../errors.js';

const CACHE_MS = 30 * 60 * 1000;
const ADM4 = /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/;
const cache = new Map();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);

function summarize(json) {
  const loc = json?.lokasi ?? {};
  const rows = (json?.data ?? []).flatMap((d) => (d.cuaca ?? []).flat());
  const byDay = new Map();
  for (const r of rows) {
    const day = String(r.local_datetime ?? '').slice(0, 10);
    if (!day) continue;
    const d = byDay.get(day) ?? { t: [], hu: [], rain: 0, desc: new Map() };
    if (num(r.t) !== null) d.t.push(num(r.t));
    if (num(r.hu) !== null) d.hu.push(num(r.hu));
    if (num(r.tp) !== null) d.rain += num(r.tp);
    if (r.weather_desc) d.desc.set(r.weather_desc, (d.desc.get(r.weather_desc) ?? 0) + 1);
    byDay.set(day, d);
  }
  const days = [...byDay]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      t_min: d.t.length ? Math.min(...d.t) : null,
      t_max: d.t.length ? Math.max(...d.t) : null,
      hu_avg: avg(d.hu),
      rain_mm: Math.round(d.rain * 10) / 10,
      desc: [...d.desc].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }));
  if (!days.length) {
    throw new AppError(502, 'WEATHER_UNAVAILABLE', 'Data prakiraan BMKG kosong atau formatnya berubah.');
  }
  return { source: 'BMKG', location: [loc.desa, loc.kecamatan, loc.kotkab].filter(Boolean).join(', '), days };
}

async function fetchForecast(adm4) {
  const hit = cache.get(adm4);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  let res;
  try {
    res = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${adm4}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError(502, 'WEATHER_UNAVAILABLE', 'Server BMKG tidak dapat dihubungi.');
  }
  if (!res.ok) {
    throw new AppError(502, 'WEATHER_UNAVAILABLE', `BMKG membalas status ${res.status}. Periksa kode wilayah.`);
  }
  const data = summarize(await res.json().catch(() => null));
  cache.set(adm4, { at: Date.now(), data });
  return data;
}

export function createWeatherRouter({ jwtSecret }) {
  const r = express.Router();
  r.use(authenticate(jwtSecret));
  r.use(requireRole('PETANI', 'OPERATOR', 'ADMIN', 'MITRA'));
  r.get('/', wrap(async (req, res) => {
    const adm4 = String(req.query.adm4 ?? process.env.BMKG_ADM4 ?? '');
    if (!ADM4.test(adm4)) {
      throw new AppError(422, 'VALIDATION', 'Kode wilayah (adm4) harus berformat angka NN.NN.NN.NNNN.');
    }
    res.json(await fetchForecast(adm4));
  }));
  return r;
}