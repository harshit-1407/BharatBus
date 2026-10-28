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
