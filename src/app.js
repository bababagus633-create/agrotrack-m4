import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from './errors.js';
import { authenticate, requireRole } from './auth.js';
import { createService, toFeature, toFeatureCollection } from './service.js';
import { parse, createPlotSchema, importSchema, importQuery, plotsQuery } from './schemas.js';
import { createPricingRouter } from './modules/pricing/router.js';
import { createHarvestRouter } from './modules/harvest/router.js';
import { createWeatherRouter } from './modules/weather/router.js';
import { createSupplyRouter } from './modules/supply/router.js';
import pricingStream from './modules/pricing/stream.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApp({ repo, pricingRepo, harvestRepo, supplyRepo, jwtSecret, svc = createService({ repo }) }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(express.static(publicDir));

  const api = express.Router();
  api.use(authenticate(jwtSecret));
  api.use(requireRole('PETANI', 'OPERATOR', 'ADMIN')); // MITRA tidak punya akses
  const write = requireRole('PETANI', 'ADMIN');

  api.get('/plots', wrap(async (req, res) => {
    res.json(toFeatureCollection(await svc.list(parse(plotsQuery, req.query))));
  }));

  api.post('/plots', write, wrap(async (req, res) => {
    const r = await svc.create(parse(createPlotSchema, req.body), req.user);
    if (r.replay) res.set('Idempotent-Replay', 'true');
    res.status(r.replay ? 200 : 201).json(toFeature(r.plot));
  }));

  api.post('/plots/import', write, wrap(async (req, res) => {
    const { region_code } = parse(importQuery, req.query);
    const { features } = parse(importSchema, req.body);
    const saved = await svc.importMany(features, region_code, req.user);
    res.status(201).json({ imported: saved.length, plots: toFeatureCollection(saved) });
  }));

  api.get('/plots/:id', wrap(async (req, res) => res.json(toFeature(await svc.get(req.params.id)))));

  api.delete('/plots/:id', write, wrap(async (req, res) => {
    await svc.remove(req.params.id, req.user);
    res.status(204).end();
  }));

  api.get('/regions/leading-commodities', wrap(async (req, res) => {
    res.json({ items: await svc.leadingCommodities(parse(plotsQuery, req.query)) });
  }));

  app.use(pricingStream);
  if (pricingRepo) app.use('/api/v1/prices', createPricingRouter({ repo: pricingRepo, jwtSecret }));
  if (harvestRepo) app.use('/api/v1/harvest', createHarvestRouter({ repo: harvestRepo, jwtSecret, plots: svc }));
  app.use('/api/v1/weather', createWeatherRouter({ jwtSecret }));
  if (supplyRepo) app.use('/api/v1/batches', createSupplyRouter({ repo: supplyRepo, jwtSecret }));
  app.use('/api/v1', api);
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint tidak ditemukan.')));
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Isi permintaan bukan JSON yang valid.' } });
    }
    if (err.status === 413) {
      return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Isi permintaan terlalu besar.' } });
    }
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Terjadi kesalahan pada server.' } });
  });
  return app;
}
