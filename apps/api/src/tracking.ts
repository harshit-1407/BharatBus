import express from 'express';
import { z } from 'zod';
import { Device, ReplayGuard, timestampOk, verifySignature } from './auth';
import { DEMO_ROUTE } from './demoRoute';
import { projectOnLine } from './geo';
import { BusPosition, upsertPosition } from './store';

const locationSchema = z.object({
  tripId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  gpsTimestamp: z.number().int(),
  speedMps: z.number().min(0).max(60).optional(),
  heading: z.number().min(0).max(360).optional(),
});
const tripSchema = z.object({ tripId: z.string().min(1) });

// Trips known to the system. Real trips come from timetable imports in a later phase.
export const TRIPS: Record<string, { routeId: string }> = { 'DEMO-TRIP-1': { routeId: DEMO_ROUTE.id } };

const MAX_OFF_ROUTE_M = 300;
const MAX_SAMPLE_AGE_MS = 5 * 60_000;
const MAX_FUTURE_MS = 10_000;

interface Session { tripId: string; routeId: string; startedAt: number }
const sessions = new Map<string, Session>();
export const resetSessions = () => sessions.clear();

type Result = { ok: true; position?: BusPosition } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): Result => ({ ok: false, status, error });

export function startSession(device: Device, tripId: string, now: number): Result {
  if (!device.allowedTrips.includes(tripId)) return fail(403, 'Trip is not assigned to this device');
  const trip = TRIPS[tripId];
  if (!trip) return fail(404, 'Unknown trip');
  sessions.set(device.id, { tripId, routeId: trip.routeId, startedAt: now });
  return { ok: true };
}

export const stopSession = (device: Device): Result =>
  sessions.delete(device.id) ? { ok: true } : fail(409, 'No active tracking session');

export function processLocation(device: Device, raw: unknown, now: number): Result {
  const parsed = locationSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'Invalid location payload');
  const b = parsed.data;
  const s = sessions.get(device.id);
  if (!s) return fail(409, 'No active tracking session. Start a trip first.');
  if (s.tripId !== b.tripId) return fail(403, 'Trip does not match the active session');
  if (now - b.gpsTimestamp > MAX_SAMPLE_AGE_MS) return fail(422, 'GPS sample too old');
  if (b.gpsTimestamp - now > MAX_FUTURE_MS) return fail(422, 'GPS timestamp is in the future');

  const proj = projectOnLine(DEMO_ROUTE.line, [b.lng, b.lat]);
  if (proj.offsetM > MAX_OFF_ROUTE_M) return fail(422, 'Position is not on the assigned route');

  const position: BusPosition = {
    busId: device.busId,
    routeId: s.routeId,
    lng: b.lng,
    lat: b.lat,
    distAlongM: proj.distAlongM,
    speedMps: b.speedMps ?? 0,
    heading: b.heading ?? 0,
    timestamp: b.gpsTimestamp,
    receivedAt: now,
    source: device.isTest ? 'SIMULATED' : 'LIVE',
  };
  if (!upsertPosition(position)) return fail(409, 'Out-of-order or duplicate sample');
  return { ok: true, position };
}

export function createTrackingRouter(devices: Map<string, Device>, onPosition: (p: BusPosition) => void) {
  const router = express.Router();
  const guard = new ReplayGuard();
  const rate = new Map<string, { n: number; windowStart: number }>();

  router.use((req, res, next) => {
    const id = String(req.header('x-device-id') ?? '');
    const ts = String(req.header('x-timestamp') ?? '');
    const sig = String(req.header('x-signature') ?? '');
    const now = Date.now();
    const device = devices.get(id);
    const raw: string = (req as any).rawBody ?? '';
    // Same generic answer for unknown device and bad signature (no device enumeration)
    if (!device || !timestampOk(Number(ts), now) || !verifySignature(device.secret, id, ts, raw, sig)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!guard.accept(`${id}:${sig}`, now)) return res.status(401).json({ error: 'Replayed request' });
    const r = rate.get(id);
    if (!r || now - r.windowStart > 60_000) rate.set(id, { n: 1, windowStart: now });
    else if (++r.n > 120) return res.status(429).json({ error: 'Rate limit exceeded' });
    res.locals.device = device;
    next();
  });

  const send = (res: express.Response, r: Result) =>
    r.ok ? res.json({ ok: true }) : res.status(r.status).json({ error: r.error });

  router.post('/start', (req, res) => {
    const b = tripSchema.safeParse(req.body);
    if (!b.success) return res.status(400).json({ error: 'tripId required' });
    send(res, startSession(res.locals.device, b.data.tripId, Date.now()));
  });
  router.post('/stop', (_req, res) => send(res, stopSession(res.locals.device)));
  router.post('/location', (req, res) => {
    const r = processLocation(res.locals.device, req.body, Date.now());
    if (r.ok && r.position) onPosition(r.position);
    send(res, r);
  });
  return router;
}
