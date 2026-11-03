import express from 'express';
import { authenticate, requireRole } from '../../auth.js';
import { parse } from '../../schemas.js';
import { createHarvestService } from './service.js';
import { cycleSchema, inputSchema, harvestSchema, listQuery } from './schemas.js';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createHarvestRouter({ repo, jwtSecret, plots, svc = createHarvestService({ repo, plots }) }) {
  const r = express.Router();
  r.use(authenticate(jwtSecret));
  r.use(requireRole('PETANI', 'OPERATOR', 'ADMIN'));
  const write = requireRole('PETANI', 'ADMIN');

  r.get('/', wrap(async (req, res) => {
    res.json({ items: await svc.list(parse(listQuery, req.query)) });
  }));

  r.post('/', write, wrap(async (req, res) => {
    const out = await svc.create(parse(cycleSchema, req.body), req.user);
    if (out.replay) res.set('Idempotent-Replay', 'true');
    res.status(out.replay ? 200 : 201).json(out.cycle);
  }));

  r.post('/:id/inputs', write, wrap(async (req, res) => {
    res.status(201).json(await svc.addInput(req.params.id, parse(inputSchema, req.body), req.user));
  }));

  r.post('/:id/harvest', write, wrap(async (req, res) => {
    res.json(await svc.recordHarvest(req.params.id, parse(harvestSchema, req.body), req.user));
  }));

  r.delete('/:id', write, wrap(async (req, res) => {
    await svc.remove(req.params.id, req.user);
    res.status(204).end();
  }));

  return r;
}