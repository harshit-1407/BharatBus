import { describe, it, expect } from 'vitest';
import { DEMO_ROUTE } from './demoRoute';
import { assessBoarding, withDistances } from './boarding';
import { pointAtDistance, projectOnLine } from './geo';
import { demoScheduledArrivals } from './schedule';

const stops = withDistances(DEMO_ROUTE.line, DEMO_ROUTE.stops);
const assess = (p: [number, number]) => assessBoarding(p, projectOnLine(DEMO_ROUTE.line, p), stops, DEMO_ROUTE.restricted);

describe('boarding', () => {
  it('at an official stop', () => {
    const r = assess(DEMO_ROUTE.stops[1].lngLat);
    expect(r.status).toBe('official-stop-nearby');
    expect(r.stop?.name).toBe('DEMO Stop B');
  });
  it('between stops: not confirmed, suggests a stop', () => {
    const p = pointAtDistance(DEMO_ROUTE.line, 2000).point;
    const r = assess(p);
    expect(r.status).toBe('not-confirmed');
    expect(r.suggested).toBeDefined();
  });
  it('restricted segment: prohibited, suggests nearest valid stop', () => {
    const p = pointAtDistance(DEMO_ROUTE.line, 6000).point;
    const r = assess(p);
    expect(r.status).toBe('restricted');
    expect(r.suggested?.walkM).toBeGreaterThan(0);
  });
});

describe('demo schedule', () => {
  it('returns future arrivals', () => {
    const now = Date.now();
    const s = demoScheduledArrivals(3750, now);
    expect(s).toHaveLength(3);
    expect(new Date(s[0].scheduledArrival).getTime()).toBeGreaterThanOrEqual(now);
  });
});
