export interface BusPosition {
  busId: string;
  routeId: string;
  lng: number;
  lat: number;
  distAlongM: number;
  speedMps: number;
  heading: number;
  timestamp: number; // GPS timestamp (ms)
  receivedAt: number;
  source: 'SIMULATED' | 'LIVE';
}

const latest = new Map<string, BusPosition>();

/** Validates and stores a position. Returns false if rejected. */
export function upsertPosition(p: BusPosition): boolean {
  if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) return false;
  if (!Number.isFinite(p.timestamp)) return false;
  const prev = latest.get(p.busId);
  if (prev && p.timestamp <= prev.timestamp) return false; // out-of-order / duplicate
  latest.set(p.busId, p);
  return true;
}

export const allPositions = () => [...latest.values()];
export const getPosition = (id: string) => latest.get(id);
export const resetStore = () => latest.clear();
