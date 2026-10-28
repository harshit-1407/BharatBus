import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';

type LngLat = [number, number];
interface Route { id: string; name: string; line: LngLat[]; stops: { id: string; name: string; lngLat: LngLat }[] }
interface Bus { busId: string; lat: number; lng: number; timestamp: number; source: string }
interface EtaRow {
  busId: string; status: string; freshness: string; etaSeconds?: number;
  distanceAlongRouteM?: number; lastGpsAgeSec: number; note?: string; basis?: string; source: string;
}

const ll = (p: LngLat): [number, number] => [p[1], p[0]];

function Picker({ onPick }: { onPick: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

export default function App() {
  const [me, setMe] = useState<[number, number]>([28.634, 77.24]);
  const [buses, setBuses] = useState<Bus[]>([]);

  const route = useQuery({
    queryKey: ['route'],
    queryFn: async () => (await fetch('/api/routes/DEMO-R1')).json() as Promise<Route>,
  });

  useEffect(() => {
    const es = new EventSource('/api/stream/buses');
    es.onmessage = (e) => setBuses(JSON.parse(e.data));
    return () => es.close();
  }, []);

  const eta = useQuery({
    queryKey: ['eta', me],
    queryFn: async () =>
      (await fetch(`/api/eta?lat=${me[0]}&lng=${me[1]}`)).json() as Promise<{ results: EtaRow[]; passengerOffsetM: number }>,
    refetchInterval: 3000,
  });

  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setMe([p.coords.latitude, p.coords.longitude]),
      () => alert('Location denied. Tap the map to pick your point instead.'),
    );

  return (
    <div className="h-screen flex flex-col md:flex-row">
      <div className="md:w-96 p-4 overflow-y-auto space-y-3 border-r">
        <h1 className="text-xl font-bold">BharatBus</h1>
        <div className="rounded bg-amber-100 text-amber-900 text-sm p-2">
          DEMO MODE: buses are simulated. This is not real tracking.
        </div>
        <p className="text-sm text-gray-600">When will my bus reach me? Tap the map to choose your point.</p>
        <button onClick={locate} className="w-full rounded bg-blue-600 text-white py-2">Use my location</button>

        {eta.data?.results.map((r) => (
          <div key={r.busId} className="rounded border p-3 text-sm space-y-1">
            <div className="flex justify-between font-semibold">
              <span>{r.busId}</span>
              <span className="text-xs rounded px-2 py-0.5 bg-gray-100">{r.freshness.toUpperCase()}</span>
            </div>
            {r.status === 'approaching' && r.etaSeconds !== undefined ? (
              <>
                <div className="text-2xl">{Math.max(1, Math.round(r.etaSeconds / 60))} min</div>
                <div>{((r.distanceAlongRouteM ?? 0) / 1000).toFixed(1)} km along route</div>
              </>
            ) : (
              <div className="capitalize">{r.status.replace('-', ' ')}</div>
            )}
            <div className="text-gray-500">Last GPS: {r.lastGpsAgeSec}s ago, {r.source}</div>
            <div className="text-gray-500">Boarding: not confirmed</div>
            {r.note && <div className="text-xs text-gray-500">{r.note}</div>}
          </div>
        ))}
        {eta.data && eta.data.passengerOffsetM > 150 && (
          <div className="text-sm text-red-700">
            Your point is {eta.data.passengerOffsetM} m from the route. Move closer to the road.
          </div>
        )}
      </div>

      <div className="flex-1 min-h-80">
        <MapContainer center={[28.6339, 77.24]} zoom={13} className="h-full w-full">
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Picker onPick={setMe} />
          {route.data && <Polyline positions={route.data.line.map(ll)} />}
          {route.data?.stops.map((s) => (
            <CircleMarker key={s.id} center={ll(s.lngLat)} radius={6} pathOptions={{ color: '#047857' }}>
              <Tooltip>{s.name}</Tooltip>
            </CircleMarker>
          ))}
          {buses.map((b) => (
            <CircleMarker key={b.busId} center={[b.lat, b.lng]} radius={9} pathOptions={{ color: '#b45309', fillOpacity: 0.8 }}>
              <Tooltip permanent>{b.busId} (simulated)</Tooltip>
            </CircleMarker>
          ))}
          <CircleMarker center={me} radius={8} pathOptions={{ color: '#2563eb' }}>
            <Tooltip>You</Tooltip>
          </CircleMarker>
        </MapContainer>
      </div>
    </div>
  );
}
