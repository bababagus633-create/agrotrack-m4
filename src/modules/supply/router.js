import express from 'express';
import QRCode from 'qrcode';
import { EVENT } from './domain.js';
import { authenticate, requireRole } from '../../auth.js';
import { createService } from './service.js';
import {
  parse, createBatchSchema, transferSchema, sortSchema, receiveSchema, listQuerySchema,
} from './schemas.js';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createSupplyRouter({ repo, jwtSecret }) {
  const svc = createService(repo);
  const api = express.Router();
  api.use(authenticate(jwtSecret));

  api.post('/', requireRole('PETANI', 'OPERATOR', 'ADMIN'), wrap(async (req, res) => {
    const r = await svc.createBatch(parse(createBatchSchema, req.body), req.user);
    if (r.replay) res.set('Idempotent-Replay', 'true');
    res.status(r.replay ? 200 : 201).json(r.batch);
  }));

  api.get('/', wrap(async (req, res) => {
    res.json(await svc.listBatches(parse(listQuerySchema, req.query)));
  }));

  api.get('/:code', wrap(async (req, res) => {
    res.json(await svc.getBatch(req.params.code));
  }));

  api.get('/:code/events', wrap(async (req, res) => {
    res.json({ batch_code: req.params.code, events: await svc.listEvents(req.params.code) });
  }));

  api.get('/:code/verify', wrap(async (req, res) => {
    res.json(await svc.verify(req.params.code));
  }));

  const eventRoute = (path, roles, schema, type) =>
    api.post(path, requireRole(...roles), wrap(async (req, res) => {
      const input = parse(schema, req.body);
      const r = await svc.recordEvent(req.params.code, type, input, req.user);
      if (r.replay) res.set('Idempotent-Replay', 'true');
      res.status(r.replay ? 200 : 201).json({
        batch_code: r.event.batch_code, seq: r.event.seq, type: r.event.type,
        status_after: r.batch.status, recorded_at: r.event.recorded_at,
      });
    }));

  eventRoute('/:code/events', ['OPERATOR', 'ADMIN'], transferSchema, EVENT.TRANSFERRED);
  eventRoute('/:code/sort', ['OPERATOR', 'ADMIN'], sortSchema, EVENT.SORTED);
  eventRoute('/:code/receive', ['MITRA', 'ADMIN'], receiveSchema, EVENT.RECEIVED);

  api.get('/:code/qr', wrap(async (req, res) => {
    const batch = await svc.getBatch(req.params.code);
    if (req.query.format === 'svg') {
      res.type('image/svg+xml').send(await QRCode.toString(batch.code, { type: 'svg', margin: 1 }));
    } else {
      res.type('image/png').send(await QRCode.toBuffer(batch.code, { margin: 1, width: 300 }));
    }
  }));

  return api;
}
