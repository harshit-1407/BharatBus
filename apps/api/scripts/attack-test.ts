// Tries to abuse the ingestion API. Every line should show the expected status.
import { sign } from '../src/auth';
import { post } from './driver-sim';

const ok = { tripId: 'DEMO-TRIP-1', lat: 28.6215, lng: 77.2185, gpsTimestamp: Date.now(), speedMps: 5 };
const show = (name: string, got: number, want: number) => console.log(`${got === want ? 'PASS' : 'FAIL'}  ${name} (got ${got}, want ${want})`);

(async () => {
  show('forged signature', (await post('/location', ok, { sig: 'deadbeef' })).status, 401);
  show('old timestamp (replayed message)', (await post('/location', ok, { ts: String(Date.now() - 600_000) })).status, 401);
  // exact replay: reuse one signed request twice
  const raw = JSON.stringify(ok); const ts = String(Date.now());
  const sig = sign('demo-secret-change-me', 'demo-device-1', ts, raw);
  await post('/stop', {}).catch(() => {});
  await post('/start', { tripId: 'DEMO-TRIP-1' });
  const first = await post('/location', ok, { ts, sig });
  const second = await post('/location', ok, { ts, sig });
  show('first signed request accepted', first.status, 200);
  show('exact replay of same request', second.status, 401);
  show('trip not assigned to device', (await post('/start', { tripId: 'OTHER-TRIP' })).status, 403);
  show('off-route coordinates', (await post('/location', { ...ok, lat: 12.9, lng: 80.2, gpsTimestamp: Date.now() })).status, 422);
  await post('/stop', {});
  show('location after trip ended', (await post('/location', { ...ok, gpsTimestamp: Date.now() })).status, 409);
})();
