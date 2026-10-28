import { describe, it, expect, beforeEach } from 'vitest';
import { computeEta, freshnessOf } from './eta';
import { projectOnLine, LngLat } from './geo';
import { upsertPosition, resetStore, BusPosition } from './store';

const line: LngLat[] = [[77.0, 28.0], [77.0, 28.1]]; // straight north
const base = { passengerOffsetM: 10, speedMps: 10, ageSec: 5 };

describe('freshness', () => {
  it('classifies age', () => {
    expect(freshnessOf(10)).toBe('live');
    expect(freshnessOf(60)).toBe('delayed');
    expect(freshnessOf(500)).toBe('stale');
  });
});

describe('computeEta', () => {
  it('approaching: gap / speed', () => {
    const r = computeEta({ ...base, busDistAlongM: 1000, passengerDistAlongM: 3000 });
    expect(r.status).toBe('approaching');
    expect(r.etaSeconds).toBe(200);
    expect(r.boarding).toBe('not-confirmed');
  });
  it('passed bus gives no ETA', () => {
    const r = computeEta({ ...base, busDistAlongM: 4000, passengerDistAlongM: 3000 });
    expect(r.status).toBe('passed');
    expect(r.etaSeconds).toBeUndefined();
  });
  it('stale GPS gives no live ETA', () => {
    const r = computeEta({ ...base, ageSec: 600, busDistAlongM: 1000, passengerDistAlongM: 3000 });
    expect(r.status).toBe('no-live-eta');
  });
  it('off-route passenger rejected', () => {
    const r = computeEta({ ...base, passengerOffsetM: 900, busDistAlongM: 1000, passengerDistAlongM: 3000 });
    expect(r.status).toBe('off-route');
  });
  it('uses assumed speed when bus is nearly stationary', () => {
    const r = computeEta({ ...base, speedMps: 0.2, busDistAlongM: 0, passengerDistAlongM: 690 });
    expect(r.basis).toBe('assumed-speed');
  });
});

describe('projectOnLine', () => {
  it('projects a nearby point and measures offset', () => {
    const p = projectOnLine(line, [77.0005, 28.05]);
    expect(p.distAlongM).toBeGreaterThan(5400);
    expect(p.distAlongM).toBeLessThan(5700);
    expect(p.offsetM).toBeLessThan(80);
  });
});

describe('store', () => {
  beforeEach(resetStore);
  const mk = (t: number, lat = 28): BusPosition => ({ busId: 'B', routeId: 'R', lng: 77, lat, distAlongM: 0, speedMps: 5, heading: 0, timestamp: t, receivedAt: t, source: 'SIMULATED' });
  it('rejects out-of-order updates', () => {
    expect(upsertPosition(mk(2000))).toBe(true);
    expect(upsertPosition(mk(1000))).toBe(false);
  });
  it('rejects invalid coordinates', () => {
    expect(upsertPosition(mk(3000, 123))).toBe(false);
  });
});
