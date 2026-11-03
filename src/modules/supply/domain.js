import { createHash, randomInt } from 'node:crypto';
import { AppError } from '../../errors.js';

export const EVENT = Object.freeze({
  BATCH_CREATED: 'BATCH_CREATED',
  TRANSFERRED: 'TRANSFERRED',
  SORTED: 'SORTED',
  RECEIVED: 'RECEIVED',
});

// status sekarang -> { jenis event: status berikutnya }
const TRANSITIONS = {
  CREATED: { TRANSFERRED: 'IN_TRANSIT' },
  IN_TRANSIT: { SORTED: 'SORTED', RECEIVED: 'RECEIVED' },
  SORTED: { TRANSFERRED: 'IN_TRANSIT' },
  RECEIVED: {},
};

export function nextStatus(status, type, location) {
  const next = TRANSITIONS[status]?.[type];
  if (!next) {
    throw new AppError(409, 'INVALID_TRANSITION',
      `Batch berstatus ${status} tidak dapat menerima aksi ${type}.`,
      { status, action: type });
  }
  // Sortir hanya di gudang, penerimaan hanya di supermarket
  const need = { SORTED: 'WAREHOUSE', RECEIVED: 'STORE' }[type];
  if (need && location?.type !== need) {
    throw new AppError(409, 'INVALID_TRANSITION',
      `Aksi ${type} hanya dapat dilakukan di lokasi bertipe ${need}.`,
      { status, action: type, location_type: location?.type ?? null });
  }
  return next;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa I, O, 0, 1
export function generateCode(now = new Date()) {
  const ymd = now.toISOString().slice(0, 10).replaceAll('-', '');
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `AGT-${ymd}-${suffix}`;
}

const loc = (l) => (l ? [l.type ?? null, l.ref_id ?? null, l.name ?? null] : null);

export function hashEvent(prevHash, e) {
  const canonical = JSON.stringify([
    prevHash ?? '', e.batch_code, e.seq, e.type, loc(e.from), loc(e.to),
    e.weight_kg ?? null, e.grade ?? null, e.note ?? null, e.actor_id,
    new Date(e.occurred_at).toISOString(),
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

// Memeriksa rantai hash; events harus terurut menurut seq
export function verifyChain(events) {
  let prev = null;
  for (const e of events) {
    if ((e.prev_hash ?? null) !== prev || e.hash !== hashEvent(prev, e)) {
      return { valid: false, broken_at_seq: e.seq };
    }
    prev = e.hash;
  }
  return { valid: true, broken_at_seq: null };
}
