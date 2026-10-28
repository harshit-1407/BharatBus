import { describe, it, expect, beforeEach } from 'vitest';
import { ReplayGuard, sign, timestampOk, verifySignature, Device } from './auth';
import { processLocation, resetSessions, startSession, stopSession } from './tracking';
import { resetStore } from './store';
import { DEMO_ROUTE } from './demoRoute';
import { pointAtDistance } from './geo';

const dev: Device = { id: 'd1', secret: 's3cret', busId: 'B9', allowedTrips: ['DEMO-TRIP-1'], isTest: true };
const real: Device = { ...dev, id: 'd2', busId: 'B10', isTest: false };
const now = 1_700_000_000_000;
const onRoute = (d: number) => pointAtDistance(DEMO_ROUTE.line, d).point;
const sample = (d: number, t = now, extra = {}) => {
  const [lng, lat] = onRoute(d);
  return { tripId: 'DEMO-TRIP-1', lat, lng, gpsTimestamp: t, speedMps: 8, ...extra };
};

beforeEach(() => { resetSessions(); resetStore(); });

describe('request signing', () => {
  it('accepts a valid signature and rejects a forged one', () => {
    const sig = sign('s3cret', 'd1', '123', '{"a":1}');
    expect(verifySignature('s3cret', 'd1', '123', '{"a":1}', sig)).toBe(true);
    expect(verifySignature('s3cret', 'd1', '123', '{"a":2}', sig)).toBe(false);
    expect(verifySignature('wrong', 'd1', '123', '{"a":1}', sig)).toBe(false);
    expect(verifySignature('s3cret', 'd1', '123', '{"a":1}', 'zz')).toBe(false);
  });
  it('rejects old timestamps', () => {
    expect(timestampOk(now - 5_000, now)).toBe(true);
    expect(timestampOk(now - 120_000, now)).toBe(false);
  });
  it('replay guard rejects the same signature twice', () => {
    const g = new ReplayGuard();
    expect(g.accept('k', now)).toBe(true);
    expect(g.accept('k', now + 1000)).toBe(false);
  });
});

describe('processLocation', () => {
  it('rejects location without an active session', () => {
    const r = processLocation(dev, sample(1000), now);
    expect(r.ok).toBe(false);
  });
  it('rejects a trip not assigned to the device', () => {
    expect(startSession(dev, 'OTHER-TRIP', now).ok).toBe(false);
  });
  it('accepts a valid on-route sample and labels test devices SIMULATED', () => {
    startSession(dev, 'DEMO-TRIP-1', now);
    const r = processLocation(dev, sample(1000), now);
    expect(r.ok && r.position?.source).toBe('SIMULATED');
  });
  it('labels non-test devices LIVE', () => {
    startSession(real, 'DEMO-TRIP-1', now);
    const r = processLocation(real, sample(1000), now);
    expect(r.ok && r.position?.source).toBe('LIVE');
  });
  it('rejects off-route coordinates', () => {
    startSession(dev, 'DEMO-TRIP-1', now);
    expect(processLocation(dev, sample(1000, now, { lat: 12.9, lng: 80.2 }), now).ok).toBe(false);
  });
  it('rejects out-of-order samples', () => {
    startSession(dev, 'DEMO-TRIP-1', now);
    expect(processLocation(dev, sample(1500, now), now).ok).toBe(true);
    expect(processLocation(dev, sample(1000, now - 2000), now).ok).toBe(false);
  });
  it('rejects too-old and future samples', () => {
    startSession(dev, 'DEMO-TRIP-1', now);
    expect(processLocation(dev, sample(1000, now - 10 * 60_000), now).ok).toBe(false);
    expect(processLocation(dev, sample(1000, now + 60_000), now).ok).toBe(false);
  });
  it('rejects invalid coordinates', () => {
    startSession(dev, 'DEMO-TRIP-1', now);
    expect(processLocation(dev, sample(1000, now, { lat: 123 }), now).ok).toBe(false);
  });
  it('stops collection when the trip ends', () => {
    startSession(dev, 'DEMO-TRIP-1', now);
    expect(stopSession(dev).ok).toBe(true);
    expect(processLocation(dev, sample(1000), now).ok).toBe(false);
  });
});
