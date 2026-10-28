// DEMO schedule: a bus every 20 minutes from the first stop. Clearly labelled as demo.
const HEADWAY_MIN = 20;
const SCHED_SPEED_MPS = 6.9; // ~25 km/h scheduled average

export function demoScheduledArrivals(stopDistAlongM: number, now = Date.now(), count = 3) {
  const headway = HEADWAY_MIN * 60_000;
  const travelMs = (stopDistAlongM / SCHED_SPEED_MPS) * 1000;
  const firstDeparture = Math.ceil((now - travelMs) / headway) * headway;
  return Array.from({ length: count }, (_, i) => ({
    scheduledArrival: new Date(firstDeparture + i * headway + travelMs).toISOString(),
    source: 'DEMO-SCHEDULE' as const,
  }));
}
