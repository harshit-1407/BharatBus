# BharatBus (demo pilot)

"When will my bus reach me?" Simulated buses only. NOT real tracking.

## Run (Windows PowerShell, 2 terminals)
    npm install
    npm run dev:api      # http://localhost:4000
    npm run dev:web      # http://localhost:5173
    npm test             # ETA, projection, out-of-order GPS tests

## What is real vs demo
- ETA engine, route projection, freshness, out-of-order rejection: real logic, tested.
- Buses and route: SYNTHETIC (DEMO_MODE). No real operator feed is connected.
- Next: real GPS adapter from one authorized operator.

## Phase 4: protected GPS ingestion
Endpoints (all need x-device-id, x-timestamp, x-signature = HMAC-SHA256(secret, `${id}.${ts}.${rawBody}`)):
- POST /api/tracking/start    { tripId }
- POST /api/tracking/location { tripId, lat, lng, gpsTimestamp, speedMps?, heading? }
- POST /api/tracking/stop
Protections: HMAC signing, 60s clock window, replay guard, rate limit, trip assignment,
active-session requirement, on-route check, out-of-order rejection.
Test devices are always labelled SIMULATED. Real devices: set DEVICES_JSON (never commit secrets).
Try it (from apps/api):  npx tsx scripts/driver-sim.ts   |   npx tsx scripts/attack-test.ts
