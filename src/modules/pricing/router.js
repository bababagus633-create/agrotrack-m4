import express from 'express';
import { authenticate, requireRole } from '../../auth.js';
import { parse } from '../../schemas.js';
import { createPricingService } from './service.js';
import { bulkSchema, trendQuery, marginQuery } from './schemas.js';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createPricingRouter({ repo, jwtSecret, svc = createPricingService({ repo }) }) {
  const r = express.Router();
  r.use(authenticate(jwtSecret));
  r.use(requireRole('PETANI', 'OPERATOR', 'ADMIN', 'MITRA'));

  r.get('/trend', wrap(async (req, res) => res.json(await svc.trend(parse(trendQuery, req.query)))));
  r.get('/margin', wrap(async (req, res) => res.json(await svc.margin(parse(marginQuery, req.query)))));
  r.post('/', requireRole('OPERATOR', 'ADMIN'), wrap(async (req, res) => {
    res.status(201).json(await svc.upsert(parse(bulkSchema, req.body).items));
  }));
  return r;
}
