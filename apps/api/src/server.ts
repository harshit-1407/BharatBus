import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { DEMO_ROUTE } from './demoRoute';
import { projectOnLine, LngLat } from './geo';
import { computeEta } from './eta';
import { allPositions, getPosition } from './store';
import { startSimulator } from './simulator';

const DEMO_MODE = process.env.DEMO_MODE !== 'false';
const PORT = Number(process.env.PORT ?? 4000);

const app = express();
app.use(helmet());
app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json());

const clients = new Set<express.Response>();

app.get('/api/health', (_req, res) => res.json({ ok: true, demoMode: DEMO_MODE }));

app.get('/api/routes/:routeId', (req, res) => {
  if (req.params.routeId !== DEMO_ROUTE.id) return res.status(404).json({ error: 'Route not found' });
  res.json({ ...DEMO_ROUTE, demo: true });
});

const etaQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

app.get('/api/eta', (req, res) => {
  const q = etaQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: 'lat and lng required', details: q.error.flatten() });
  const passenger: LngLat = [q.data.lng, q.data.lat];
  const proj = projectOnLine(DEMO_ROUTE.line, passenger);
  const now = Date.now();
  const results = allPositions().map((b) => {
    const eta = computeEta({
      busDistAlongM: b.distAlongM,
      passengerDistAlongM: proj.distAlongM,
      passengerOffsetM: proj.offsetM,
      speedMps: b.speedMps,
      ageSec: (now - b.timestamp) / 1000,
    });
    return { busId: b.busId, routeId: b.routeId, source: b.source, lastGpsAgeSec: Math.round((now - b.timestamp) / 1000), ...eta };
  });
  results.sort((a, b) => (a.etaSeconds ?? Infinity) - (b.etaSeconds ?? Infinity));
  res.json({ demo: DEMO_MODE, passengerOffsetM: Math.round(proj.offsetM), results });
});

app.get('/api/buses/:busId/position', (req, res) => {
  const p = getPosition(req.params.busId);
  if (!p) return res.status(404).json({ error: 'No position for this bus' });
  res.json(p);
});

// SSE stream with heartbeat + cleanup
app.get('/api/stream/buses', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify(allPositions())}\n\n`);
  clients.add(res);
  const hb = setInterval(() => res.write(': heartbeat\n\n'), 15000);
  req.on('close', () => { clearInterval(hb); clients.delete(res); });
});

if (DEMO_MODE) {
  startSimulator(() => {
    const payload = `data: ${JSON.stringify(allPositions())}\n\n`;
    for (const c of clients) c.write(payload);
  });
  console.log('DEMO MODE: simulated buses only. This is NOT real tracking.');
}

app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
