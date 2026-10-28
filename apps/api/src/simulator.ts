import { cumulative, pointAtDistance } from './geo';
import { DEMO_ROUTE } from './demoRoute';
import { upsertPosition, BusPosition } from './store';

const total = cumulative(DEMO_ROUTE.line).at(-1)!;

interface SimBus { id: string; dist: number; speed: number }
const buses: SimBus[] = [
  { id: 'DEMO-BUS-1', dist: 0, speed: 8 },
  { id: 'DEMO-BUS-2', dist: total * 0.45, speed: 6 },
];

export function startSimulator(onTick: (p: BusPosition) => void, intervalMs = 2000) {
  return setInterval(() => {
    for (const b of buses) {
      const jitter = 1 + (Math.random() - 0.5) * 0.3;
      const v = b.speed * jitter;
      b.dist += v * (intervalMs / 1000);
      if (b.dist >= total) b.dist = 0; // loop for demo
      const { point, heading } = pointAtDistance(DEMO_ROUTE.line, b.dist);
      const pos: BusPosition = {
        busId: b.id,
        routeId: DEMO_ROUTE.id,
        lng: point[0],
        lat: point[1],
        distAlongM: b.dist,
        speedMps: v,
        heading,
        timestamp: Date.now(),
        receivedAt: Date.now(),
        source: 'SIMULATED',
      };
      if (upsertPosition(pos)) onTick(pos);
    }
  }, intervalMs);
}
