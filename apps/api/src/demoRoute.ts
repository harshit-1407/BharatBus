import { LngLat } from './geo';

// SYNTHETIC DEMO ROUTE. Not a real operator route.
export const DEMO_ROUTE = {
  id: 'DEMO-R1',
  name: 'DEMO Route 1 (simulated)',
  operator: 'DEMO Roadways (simulated)',
  line: [
    [77.209, 28.6139],
    [77.2185, 28.6215],
    [77.2290, 28.6290],
    [77.2400, 28.6340],
    [77.2520, 28.6405],
    [77.2640, 28.6470],
    [77.2760, 28.6520],
    [77.2890, 28.6585],
  ] as LngLat[],
  stops: [
    { id: 'S1', name: 'DEMO Stop A', lngLat: [77.209, 28.6139] as LngLat },
    { id: 'S2', name: 'DEMO Stop B', lngLat: [77.2400, 28.6340] as LngLat },
    { id: 'S3', name: 'DEMO Stop C', lngLat: [77.2890, 28.6585] as LngLat },
  ],
};
