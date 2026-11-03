import { AppError } from '../../errors.js';
import { EVENT, generateCode, hashEvent, nextStatus, verifyChain } from './domain.js';

const strip = ({ _id, ...rest }) => rest;

export function createService(repo) {
  async function requireBatch(code) {
    const b = await repo.findBatch(code);
    if (!b) throw new AppError(404, 'BATCH_NOT_FOUND', 'Kode batch tidak ditemukan.');
    return b;
  }

  function buildEvent(batch_code, seq, prev, actor, f) {
    const now = new Date();
    const e = {
      batch_code, seq, type: f.type,
      from: f.from ?? null, to: f.to ?? null,
      weight_kg: f.weight_kg ?? null, grade: f.grade ?? null, note: f.note ?? null,
      actor_id: actor.sub,
      occurred_at: new Date(f.occurred_at ?? now),
      recorded_at: now,
      client_id: f.client_id,
      prev_hash: prev?.hash ?? null,
    };
    e.hash = hashEvent(e.prev_hash, e);
    return e;
  }

  async function createBatch(input, actor) {
    const dup = await repo.findBatchByClientId(input.client_id);
    if (dup) return { batch: strip(dup), replay: true };

    for (let attempt = 0; attempt < 5; attempt++) {
      const now = new Date();
      const batch = {
        code: generateCode(now),
        client_id: input.client_id,
        farmland_id: input.farmland_id,
        cycle_id: input.cycle_id ?? null,
        commodity: input.commodity,
        weight_kg: input.weight_kg,
        harvest_date: new Date(input.harvest_date),
        grade: null,
        status: 'CREATED',
        current_location: { type: 'FARM', ref_id: input.farmland_id, name: input.location_name ?? 'Lahan' },
        created_by: actor.sub,
        created_at: now, updated_at: now,
        version: 1,
      };
      try {
        await repo.insertBatch(batch);
      } catch (e) {
        if (e.kind === 'DUP_CODE') continue;
        if (e.kind === 'DUP_CLIENT_ID') return { batch: strip(await repo.findBatchByClientId(input.client_id)), replay: true };
        throw e;
      }
      const ev = buildEvent(batch.code, 1, null, actor, {
        type: EVENT.BATCH_CREATED, to: batch.current_location, weight_kg: batch.weight_kg,
        client_id: `${input.client_id}:created`,
      });
      await repo.insertEvent(ev);
      return { batch: strip(batch), replay: false };
    }
    throw new AppError(500, 'CODE_GENERATION_FAILED', 'Gagal membuat kode unik, coba lagi.');
  }

  async function recordEvent(code, type, input, actor) {
    const replayed = await repo.findEventByClientId(input.client_id);
    if (replayed) {
      return { event: strip(replayed), batch: strip(await requireBatch(code)), replay: true };
    }
    const batch = await requireBatch(code);
    const status_after = nextStatus(batch.status, type, batch.current_location);
    const prev = await repo.lastEvent(code);

    const fields = { ...input, type };
    if (type === EVENT.TRANSFERRED) {
      fields.from = input.from ?? batch.current_location;
    } else {
      fields.from = fields.to = batch.current_location;
    }
    const ev = buildEvent(code, (prev?.seq ?? 0) + 1, prev, actor, fields);

    try {
      await repo.insertEvent(ev);
    } catch (e) {
      if (e.kind === 'DUP_SEQ') throw new AppError(409, 'VERSION_CONFLICT', 'Batch baru saja diubah, ulangi permintaan.');
      if (e.kind === 'DUP_CLIENT_ID') {
        return { event: strip(await repo.findEventByClientId(input.client_id)), batch: strip(batch), replay: true };
      }
      throw e;
    }

    const patch = { status: status_after };
    if (type === EVENT.TRANSFERRED) patch.current_location = input.to;
    if (type === EVENT.SORTED) patch.grade = input.grade;
    const updated = await repo.updateBatch(code, batch.version, patch);
    return { event: strip(ev), batch: strip(updated), replay: false };
  }

  return {
    createBatch,
    recordEvent,
    getBatch: async (code) => strip(await requireBatch(code)),
    listBatches: async (q) => {
      const r = await repo.listBatches(q);
      return { ...r, items: r.items.map(strip) };
    },
    listEvents: async (code) => {
      await requireBatch(code);
      return (await repo.listEvents(code)).map(strip);
    },
    verify: async (code) => {
      await requireBatch(code);
      return { batch_code: code, ...verifyChain(await repo.listEvents(code)) };
    },
  };
}
