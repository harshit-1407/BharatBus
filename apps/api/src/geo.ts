export type LngLat = [number, number]; // GeoJSON order: lng, lat
const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function cumulative(line: LngLat[]): number[] {
  const c = [0];
  for (let i = 1; i < line.length; i++) c.push(c[i - 1] + haversine(line[i - 1], line[i]));
  return c;
}

export interface Projection {
  distAlongM: number; // distance from route start along the road line
  offsetM: number; // perpendicular distance from the line
  segment: number;
}

/** Project a point onto a polyline (local planar approximation per segment). */
export function projectOnLine(line: LngLat[], p: LngLat): Projection {
  const cum = cumulative(line);
  let best: Projection = { distAlongM: 0, offsetM: Infinity, segment: 0 };
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const kx = R * Math.cos(rad((a[1] + b[1]) / 2)) * (Math.PI / 180);
    const ky = R * (Math.PI / 180);
    const bx = (b[0] - a[0]) * kx;
    const by = (b[1] - a[1]) * ky;
    const px = (p[0] - a[0]) * kx;
    const py = (p[1] - a[1]) * ky;
    const len2 = bx * bx + by * by;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
    const off = Math.hypot(px - t * bx, py - t * by);
    if (off < best.offsetM) {
      const segLen = cum[i + 1] - cum[i];
      best = { distAlongM: cum[i] + t * segLen, offsetM: off, segment: i };
    }
  }
  return best;
}

export function pointAtDistance(line: LngLat[], d: number): { point: LngLat; heading: number } {
  const cum = cumulative(line);
  const total = cum[cum.length - 1];
  const dist = Math.max(0, Math.min(total, d));
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < dist) i++;
  const segLen = cum[i + 1] - cum[i] || 1;
  const t = (dist - cum[i]) / segLen;
  const a = line[i];
  const b = line[i + 1];
  const point: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const heading = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
  return { point, heading: (heading + 360) % 360 };
}
