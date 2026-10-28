import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';

type LngLat = [number, number];
interface Route {
  id: string; name: string; line: LngLat[];
  stops: { id: string; name: string; lngLat: LngLat }[];
  restricted: { fromM: number; toM: number; reason: string }[];
}
interface Bus { busId: string; lat: number; lng: number; timestamp: number; source: string }
interface EtaRow {
  busId: string; status: string; freshness: string; etaSeconds?: number;
  distanceAlongRouteM?: number; lastGpsAgeSec: number; note?: string; source: string;
}
interface Boarding {
  status: 'official-stop-nearby' | 'restricted' | 'not-confirmed';
  message: string;
  stop?: { id: string; name: string; distanceM: number };
  suggested?: { stopId: string; name: string; walkM: number };
}
interface Arrivals {
  stop: { id: string; name: string };
  live: EtaRow[];
  scheduled: { scheduledArrival: string; source: string }[];
}

const ll = (p: LngLat): [number, number] => [p[1], p[0]];
const mins = (s: number) => Math.max(1, Math.round(s / 60));

function Picker({ onPick }: { onPick: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

const boardingStyle = {
  'official-stop-nearby': 'bg-green-100 text-green-900',
  restricted: 'bg-red-100 text-red-900',
  'not-confirmed': 'bg-gray-100 text-gray-800',
} as const;

function EtaCard({ r }: { r: EtaRow }) {
  return (
    <div className="rounded border p-3 text-sm space-y-1">
      <div className="flex justify-between font-semibold">
        <span>{r.busId}</span>
        <span className="text-xs rounded px-2 py-0.5 bg-gray-100">{r.freshness.toUpperCase()}</span>
      </div>
      {r.status === 'approaching' && r.etaSeconds !== undefined ? (
        <>
          <div className="text-2xl">{mins(r.etaSeconds)} min</div>
          <div>{((r.distanceAlongRouteM ?? 0) / 1000).toFixed(1)} km along route</div>
        </>
      ) : (
        <div className="capitalize">{r.status.replace('-', ' ')}</div>
      )}
      <div className="text-gray-500">Last GPS: {r.lastGpsAgeSec}s ago, {r.source}</div>
    </div>
  );
}

export default function App() {
  const [me, setMe] = useState<[number, number]>([28.634, 77.24]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [stopId, setStopId] = useState<string | null>(null);

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
      (await fetch(`/api/eta?lat=${me[0]}&lng=${me[1]}`)).json() as Promise<{ results: EtaRow[]; passengerOffsetM: number; boarding: Boarding }>,
    refetchInterval: 3000,
  });

  const arrivals = useQuery({
    queryKey: ['arrivals', stopId],
    enabled: !!stopId,
    queryFn: async () => (await fetch(`/api/stops/${stopId}/arrivals`)).json() as Promise<Arrivals>,
    refetchInterval: 3000,
  });

  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setMe([p.coords.latitude, p.coords.longitude]),
      () => alert('Location denied. Tap the map to pick your point instead.'),
    );

  const b = eta.data?.boarding;
  const suggestedStop = b?.suggested && route.data?.stops.find((s) => s.id === b.suggested!.stopId);

  return (
    <div className="h-screen flex flex-col md:flex-row">
      <div className="md:w-96 p-4 overflow-y-auto space-y-3 border-r">
        <h1 className="text-xl font-bold">BharatBus</h1>
        <div className="rounded bg-amber-100 text-amber-900 text-sm p-2">
          DEMO MODE: buses and schedule are simulated. This is not real tracking.
        </div>
        <p className="text-sm text-gray-600">When will my bus reach me? Tap the map to choose your point, or tap a stop.</p>
        <button onClick={locate} className="w-full rounded bg-blue-600 text-white py-2">Use my location</button>

        {b && (
          <div className={`rounded p-3 text-sm space-y-1 ${boardingStyle[b.status]}`}>
            <div className="font-semibold">
              {b.status === 'official-stop-nearby' && `Official stop: ${b.stop?.name}`}
              {b.status === 'restricted' && 'Boarding prohibited here'}
              {b.status === 'not-confirmed' && 'Boarding not confirmed here'}
            </div>
            <div>{b.message}</div>
            {b.suggested && (
              <button className="underline" onClick={() => suggestedStop && setMe([suggestedStop.lngLat[1], suggestedStop.lngLat[0]])}>
                Go to {b.suggested.name} ({(b.suggested.walkM / 1000).toFixed(1)} km away)
              </button>
            )}
          </div>
        )}

        {eta.data?.results.map((r) => <EtaCard key={r.busId} r={r} />)}
        {eta.data && eta.data.passengerOffsetM > 150 && (
          <div className="text-sm text-red-700">Your point is {eta.data.passengerOffsetM} m from the route.</div>
        )}

        {stopId && arrivals.data && (
          <div className="rounded border p-3 text-sm space-y-2">
            <div className="flex justify-between font-semibold">
              <span>Arrivals: {arrivals.data.stop.name}</span>
              <button onClick={() => setStopId(null)} className="text-gray-500">close</button>
            </div>
            {arrivals.data.live.map((r) => (
              <div key={r.busId} className="flex justify-between">
                <span>{r.busId}</span>
                <span>{r.status === 'approaching' && r.etaSeconds !== undefined ? `${mins(r.etaSeconds)} min (${r.freshness})` : r.status}</span>
              </div>
            ))}
            <div className="text-xs text-gray-500 pt-1">Scheduled (DEMO):</div>
            {arrivals.data.scheduled.map((s) => (
              <div key={s.scheduledArrival} className="text-xs text-gray-600">
                {new Date(s.scheduledArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-80">
        <MapContainer center={[28.6339, 77.24]} zoom={13} className="h-full w-full">
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Picker onPick={setMe} />
          {route.data && <Polyline positions={route.data.line.map(ll)} />}
          {route.data?.stops.map((s) => (
            <CircleMarker key={s.id} center={ll(s.lngLat)} radius={8} pathOptions={{ color: '#047857' }}
              eventHandlers={{ click: () => setStopId(s.id) }}>
              <Tooltip>{s.name}</Tooltip>
            </CircleMarker>
          ))}
          {buses.map((bus) => (
            <CircleMarker key={bus.busId} center={[bus.lat, bus.lng]} radius={9} pathOptions={{ color: '#b45309', fillOpacity: 0.8 }}>
              <Tooltip permanent>{bus.busId} (simulated)</Tooltip>
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
