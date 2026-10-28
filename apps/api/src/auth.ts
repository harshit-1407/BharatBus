import crypto from 'node:crypto';

export interface Device {
  id: string;
  secret: string;
  busId: string;
  allowedTrips: string[];
  isTest: boolean; // test devices are always labelled SIMULATED, never LIVE
}

export const MAX_SKEW_MS = 60_000;

export const sign = (secret: string, deviceId: string, ts: string, body: string) =>
  crypto.createHmac('sha256', secret).update(`${deviceId}.${ts}.${body}`).digest('hex');

export function verifySignature(secret: string, deviceId: string, ts: string, body: string, sig: string): boolean {
  const expected = Buffer.from(sign(secret, deviceId, ts, body), 'hex');
  const got = Buffer.from(sig, 'hex');
  return got.length === expected.length && crypto.timingSafeEqual(expected, got);
}

export const timestampOk = (ts: number, now: number) => Number.isFinite(ts) && Math.abs(now - ts) <= MAX_SKEW_MS;

/** Rejects a signature that was already used inside the validity window (replay protection). */
export class ReplayGuard {
  private seen = new Map<string, number>();
  accept(key: string, now: number): boolean {
    for (const [k, exp] of this.seen) if (exp < now) this.seen.delete(k);
    if (this.seen.has(key)) return false;
    this.seen.set(key, now + MAX_SKEW_MS * 2);
    return true;
  }
}

/**
 * Devices come from DEVICES_JSON (real, authorized devices).
 * The demo test device exists ONLY when DEMO_MODE is on.
 */
export function loadDevices(demoMode: boolean): Map<string, Device> {
  const map = new Map<string, Device>();
  if (process.env.DEVICES_JSON) {
    for (const d of JSON.parse(process.env.DEVICES_JSON) as Device[]) map.set(d.id, { ...d, isTest: !!d.isTest });
  }
  if (demoMode) {
    map.set('demo-device-1', {
      id: 'demo-device-1',
      secret: process.env.DEMO_DEVICE_SECRET ?? 'demo-secret-change-me',
      busId: 'DEMO-BUS-3',
      allowedTrips: ['DEMO-TRIP-1'],
      isTest: true,
    });
  }
  return map;
}
