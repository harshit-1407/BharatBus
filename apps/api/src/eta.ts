export type Freshness = 'live' | 'delayed' | 'stale';

export const FRESHNESS = { liveSec: 30, staleSec: 120 };
export const MAX_BOARDING_OFFSET_M = 150; // passenger must be near the road line
const MIN_RELIABLE_SPEED_MPS = 2; // below this, speed is not trusted
const ASSUMED_SPEED_MPS = 6.9; // ~25 km/h, used only when speed unknown

export function freshnessOf(ageSec: number, t = FRESHNESS): Freshness {
  if (ageSec <= t.liveSec) return 'live';
  if (ageSec <= t.staleSec) return 'delayed';
  return 'stale';
}

export interface EtaInput {
  busDistAlongM: number;
  passengerDistAlongM: number;
  passengerOffsetM: number;
  speedMps: number;
  ageSec: number;
}

export type EtaStatus = 'approaching' | 'passed' | 'off-route' | 'no-live-eta';

export interface EtaResult {
  status: EtaStatus;
  freshness: Freshness;
  distanceAlongRouteM?: number;
  etaSeconds?: number;
  basis?: 'observed-speed' | 'assumed-speed';
  boarding: 'not-confirmed';
  note?: string;
}

export function computeEta(i: EtaInput): EtaResult {
  const freshness = freshnessOf(i.ageSec);
  const base = { freshness, boarding: 'not-confirmed' as const };

  if (i.passengerOffsetM > MAX_BOARDING_OFFSET_M) {
    return { ...base, status: 'off-route', note: 'Selected point is not on this route.' };
  }
  if (freshness === 'stale') {
    return { ...base, status: 'no-live-eta', note: 'GPS is stale. Showing no live prediction.' };
  }
  const gap = i.passengerDistAlongM - i.busDistAlongM;
  if (gap < 0) {
    return { ...base, status: 'passed', note: 'Bus has already passed this point.' };
  }
  const observed = i.speedMps >= MIN_RELIABLE_SPEED_MPS;
  const speed = observed ? i.speedMps : ASSUMED_SPEED_MPS;
  return {
    ...base,
    status: 'approaching',
    distanceAlongRouteM: Math.round(gap),
    etaSeconds: Math.round(gap / speed),
    basis: observed ? 'observed-speed' : 'assumed-speed',
    note: 'Passing-time estimate. Boarding at this point is not confirmed by the operator.',
  };
}
