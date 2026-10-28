// Simulated driver phone. Signs requests like a real authorized device would.
import { sign } from '../src/auth';
import { DEMO_ROUTE } from '../src/demoRoute';
import { pointAtDistance } from '../src/geo';

const BASE = process.env.API ?? 'http://localhost:4000';
const ID = process.env.DEVICE_ID ?? 'demo-device-1';
const SECRET = process.env.DEVICE_SECRET ?? 'demo-secret-change-me';
const SECONDS = Number(process.env.DURATION_S ?? 120);

export async function post(path: string, body: object, opts: { sig?: string; ts?: string } = {}) {
  const raw = JSON.stringify(body);
  const ts = opts.ts ?? String(Date.now());
  const res = await fetch(`${BASE}/api/tracking${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-id': ID, 'x-timestamp': ts, 'x-signature': opts.sig ?? sign(SECRET, ID, ts, raw) },
    body: raw,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  console.log('start:', await post('/start', { tripId: 'DEMO-TRIP-1' }));
  let dist = 1500;
  const end = Date.now() + SECONDS * 1000;
  while (Date.now() < end) {
    dist += 16; // 8 m/s over 2 s
    const { point, heading } = pointAtDistance(DEMO_ROUTE.line, dist);
    const r = await post('/location', { tripId: 'DEMO-TRIP-1', lat: point[1], lng: point[0], gpsTimestamp: Date.now(), speedMps: 8, heading });
    console.log(`dist=${Math.round(dist)}m ->`, r.status);
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log('stop:', await post('/stop', {}));
}
if (process.argv[1]?.includes('driver-sim')) main();
