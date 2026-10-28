import { haversine, LngLat, projectOnLine, Projection } from './geo';

export interface Stop { id: string; name: string; lngLat: LngLat; boardingAllowed: boolean; distAlongM: number }
export interface Restricted { fromM: number; toM: number; reason: string }

export type BoardingStatus = 'official-stop-nearby' | 'restricted' | 'not-confirmed';
export interface Suggestion { stopId: string; name: string; walkM: number; routeDistAlongM: number }
export interface BoardingInfo {
  status: BoardingStatus;
  message: string;
  stop?: { id: string; name: string; distanceM: number };
  suggested?: Suggestion;
}

export const OFFICIAL_STOP_RADIUS_M = 100;

export function withDistances(line: LngLat[], stops: Omit<Stop, 'distAlongM' | 'boardingAllowed'>[]): Stop[] {
  return stops.map((s) => ({ ...s, boardingAllowed: true, distAlongM: projectOnLine(line, s.lngLat).distAlongM }));
}

const inRestricted = (d: number, r: Restricted[]) => r.find((x) => d >= x.fromM && d <= x.toM);

function nearestValidStop(passenger: LngLat, stops: Stop[], restricted: Restricted[]): Suggestion | undefined {
  const valid = stops.filter((s) => s.boardingAllowed && !inRestricted(s.distAlongM, restricted));
  let best: Suggestion | undefined;
  for (const s of valid) {
    const walk = haversine(passenger, s.lngLat);
    if (!best || walk < best.walkM) best = { stopId: s.id, name: s.name, walkM: Math.round(walk), routeDistAlongM: Math.round(s.distAlongM) };
  }
  return best;
}

export function assessBoarding(passenger: LngLat, proj: Projection, stops: Stop[], restricted: Restricted[]): BoardingInfo {
  const zone = inRestricted(proj.distAlongM, restricted);
  const suggested = nearestValidStop(passenger, stops, restricted);
  if (zone) {
    return { status: 'restricted', message: `${zone.reason}. Please use the nearest valid boarding point.`, suggested };
  }
  let nearest: Stop | undefined;
  let nd = Infinity;
  for (const s of stops) {
    const d = haversine(passenger, s.lngLat);
    if (d < nd) { nd = d; nearest = s; }
  }
  if (nearest && nearest.boardingAllowed && nd <= OFFICIAL_STOP_RADIUS_M) {
    return {
      status: 'official-stop-nearby',
      message: 'You are at an official stop.',
      stop: { id: nearest.id, name: nearest.name, distanceM: Math.round(nd) },
    };
  }
  return {
    status: 'not-confirmed',
    message: 'Boarding at this exact point is not confirmed by the operator. An official stop is suggested.',
    suggested,
  };
}
