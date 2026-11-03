import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createMemoryRepo } from '../src/repo.memory.js';

const SECRET = 'rahasia-uji-yang-cukup-panjang';
const sq = (lon, lat, d = 0.001) => ({
  type: 'Polygon',
  coordinates: [[[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]],
});
let server, base;

test.before(async () => {
  server = createApp({ repo: createMemoryRepo(), jwtSecret: SECRET }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});
test.after(() => server.close());

const call = (path, { role = 'PETANI', sub = 'p1', method = 'GET', body } = {}) =>
  fetch(base + path, {
    method,
    headers: { Authorization: 'Bearer ' + jwt.sign({ sub, role }, SECRET), 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
const plot = (extra = {}) => ({
  client_id: randomUUID(), name: 'Lahan A', region_code: 'wil-a', geometry: sq(110.9, -7.0), ...extra,
});

test('tanpa token ditolak 401', async () => {
  assert.equal((await fetch(base + '/plots')).status, 401);
});

test('MITRA ditolak 403', async () => {
  assert.equal((await call('/plots', { role: 'MITRA' })).status, 403);
});

test('membuat poligon: luas dihitung otomatis dan idempoten', async () => {
  const body = plot();
  const r1 = await call('/plots', { method: 'POST', body });
  assert.equal(r1.status, 201);
  const f = await r1.json();
  assert.equal(f.type, 'Feature');
  assert.ok(f.properties.area_ha > 1.1 && f.properties.area_ha < 1.4, `luas ${f.properties.area_ha}`);
  const r2 = await call('/plots', { method: 'POST', body });
  assert.equal(r2.status, 200);
  assert.equal(r2.headers.get('idempotent-replay'), 'true');
});

test('poligon tidak tertutup ditolak 422', async () => {
  const g = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] };
  assert.equal((await call('/plots', { method: 'POST', body: plot({ geometry: g }) })).status, 422);
});

test('komoditas unggulan = luas terbesar per wilayah', async () => {
  await call('/plots', { method: 'POST', body: plot({ region_code: 'wil-b', commodity: 'jagung' }) });
  await call('/plots', { method: 'POST', body: plot({ region_code: 'wil-b', commodity: 'padi', geometry: sq(110.9, -7.0, 0.003) }) });
  const { items } = await (await call('/regions/leading-commodities?region_code=wil-b')).json();
  assert.equal(items.length, 1);
  assert.equal(items[0].leading.commodity, 'padi');
  assert.equal(items[0].plot_count, 2);
});

test('impor GeoJSON: semua sah tersimpan, ada yang salah tidak ada yang tersimpan', async () => {
  const feat = (props) => ({ type: 'Feature', properties: props, geometry: sq(111, -7) });
  const ok = await call('/plots/import?region_code=wil-c', {
    method: 'POST', body: { type: 'FeatureCollection', features: [feat({ commodity: 'padi' }), feat(null)] },
  });
  assert.equal(ok.status, 201);
  assert.equal((await ok.json()).imported, 2);
  const bad = await call('/plots/import', {
    method: 'POST', body: { type: 'FeatureCollection', features: [feat({ region_code: 'wil-d' }), feat({})] },
  });
  assert.equal(bad.status, 422);
  const { features } = await (await call('/plots?region_code=wil-d')).json();
  assert.equal(features.length, 0);
});

test('hapus: bukan pemilik 403, pemilik 204', async () => {
  const f = await (await call('/plots', { method: 'POST', body: plot({ name: 'Milik p1' }) })).json();
  assert.equal((await call('/plots/' + f.id, { method: 'DELETE', sub: 'p2' })).status, 403);
  assert.equal((await call('/plots/' + f.id, { method: 'DELETE' })).status, 204);
  assert.equal((await call('/plots/' + f.id)).status, 404);
});
