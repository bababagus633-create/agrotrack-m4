import express from 'express';
import { priceEvents } from './ingest.js';
const router = express.Router();

router.get('/api/prices/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('retry: 5000\n\n');

  const send = (p) => res.write('data: ' + JSON.stringify(p) + '\n\n');
  priceEvents.on('prices:updated', send);
  const hb = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => { clearInterval(hb); priceEvents.off('prices:updated', send); });
});

export default router;
