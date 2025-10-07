import { useLayoutEffect, useState } from 'react';
import { Plane, Info, BarChart3, Bell } from 'lucide-react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Tooltip,
} from 'react-leaflet';
import L from 'leaflet';

type Status = 'normal' | 'warning' | 'critical';

type Warehouse = {
  name: string;
  lat: number;
  lng: number;
  status: Status;
};

type Route = {
  pts: [number, number][];
  color: string;
  dash: string; // "5,5" etc.
};

export default function Dashboard() {
  const [showStats, setShowStats] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  const [map, setMap] = useState<L.Map | null>(null);

  // Puntos clave
  const LIMA: [number, number] = [-12.0464, -77.0428];
  const BRUSELAS: [number, number] = [50.8503, 4.3517];
  const BAKU: [number, number] = [40.4093, 49.8671];

  const stats = [
    { label: 'Vuelos activos', value: '24' },
    { label: 'Paquetes en tránsito', value: '8' },
    { label: 'Entregas pendientes', value: '8' },
    { label: 'Clientes esperando sus pedidos', value: '24' },
  ];

  const alerts = [
    { message: 'El vuelo VL-220 despegará en 15 minutos desde Lima', color: 'bg-yellow-50 border-yellow-200' },
    { message: 'El paquete MPE-002 está a 2 horas de cumplir el plazo de entrega máximo', color: 'bg-blue-50 border-blue-200' },
    { message: 'El almacén Bruselas está a su 95% de capacidad', color: 'bg-red-50 border-red-200' },
    { message: 'Nuevo retraso reportado en aduanas de Europa', color: 'bg-yellow-50 border-yellow-200' },
    { message: 'Ruta alternativa aplicada para MPE-010', color: 'bg-blue-50 border-blue-200' },
  ];

  const warehouses: Warehouse[] = [
    { name: 'Lima',     lat: -12.0464, lng: -77.0428, status: 'warning' },
    { name: 'Bruselas', lat: 50.8503,  lng: 4.3517,   status: 'critical' },
    { name: 'Baku',     lat: 40.4093,  lng: 49.8671,  status: 'normal' },
  ];

  const rutas: Route[] = [
    { pts: [LIMA, BRUSELAS], color: '#FF6600', dash: '5,5' }, // América → Europa
    { pts: [BRUSELAS, BAKU], color: '#0066FF', dash: '5,5' }, // Europa → Asia
    { pts: [LIMA, [-6.8, -35]], color: '#FFC107', dash: '3,3' }, // ejemplo adicional
  ];

  // Bounds para ajustar el mapa a los puntos importantes
  const bounds = L.latLngBounds([LIMA, BRUSELAS, BAKU]);

  // 🔧 Invalidate + fitBounds apenas monta (useLayoutEffect evita parpadeo)
  useLayoutEffect(() => {
    if (!map) return;

    // Ajusta a bounds con padding
    map.fitBounds(bounds, { padding: [40, 40] });

    // Invalida tamaño inmediatamente (crítico para que no se “rompan” las teselas)
    map.invalidateSize();

    // Recalcula al redimensionar ventana
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#FF6600] text-white px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Panel de Operaciones Globales</h1>
          <p className="text-lg mt-1">Monitorea envíos en tiempo real desde Lima, Bruselas y Baku</p>
        </div>
        <div className="flex gap-3 mt-4 lg:mt-0">
          <button
            onClick={() => setShowStats(v => !v)}
            className="bg-white text-[#FF6600] px-4 py-2 rounded-lg font-medium shadow hover:bg-gray-100"
          >
            {showStats ? 'Ocultar estadísticas' : 'Mostrar estadísticas'}
          </button>
          <button
            onClick={() => setShowAlerts(v => !v)}
            className="bg-white text-[#FF6600] px-4 py-2 rounded-lg font-medium shadow hover:bg-gray-100"
          >
            {showAlerts ? 'Ocultar alertas' : 'Mostrar alertas'}
          </button>
        </div>
      </div>

      {/* Card principal centrada */}
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Alto grande pero no full-screen */}
          <div className="relative h-[68vh] min-h-[520px] bg-gray-200">
            {/* Botones zoom */}
            <div className="absolute top-4 left-4 z-20 flex gap-2">
              <button
                onClick={() => map?.zoomIn()}
                className="bg-white rounded-full w-10 h-10 flex items-center justify-center shadow hover:bg-gray-50"
              >
                +
              </button>
              <button
                onClick={() => map?.zoomOut()}
                className="bg-white rounded-full w-10 h-10 flex items-center justify-center shadow hover:bg-gray-50"
              >
                -
              </button>
            </div>

            {/* Mapa real (Leaflet + OSM) */}
            <MapContainer
              whenCreated={setMap}
              bounds={bounds}
              zoomControl={false}
              className="absolute inset-0 rounded-none"
              style={{ background: '#e5e7eb' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />

              {/* Rutas */}
              {rutas.map((r, i) => (
                <Polyline
                  key={i}
                  positions={r.pts}
                  pathOptions={{ color: r.color, weight: 3, dashArray: r.dash }}
                />
              ))}

              {/* Almacenes */}
              {warehouses.map((w, i) => {
                const color =
                  w.status === 'critical'
                    ? '#DC3545'
                    : w.status === 'warning'
                    ? '#FFC107'
                    : '#28A745';
                return (
                  <CircleMarker
                    key={i}
                    center={[w.lat, w.lng]}
                    radius={10}
                    pathOptions={{ color, fillColor: color, fillOpacity: 1, weight: 2 }}
                  >
                    <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                      <div className="font-semibold text-gray-800">{w.name}</div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            {/* Botón leyenda */}
            <button
              onClick={() => setShowLegend(v => !v)}
              className="absolute bottom-4 right-4 z-30 bg-[#FF6600] text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-[#e55d00]"
            >
              <Info className="w-6 h-6" />
            </button>

            {/* Leyenda overlay */}
            {showLegend && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-20 w-[92%] md:w-auto">
                <div className="px-4 py-3 rounded-xl bg-white/95 backdrop-blur border shadow">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 text-sm">
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-gray-700">Almacenes y aviones</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Plane className="w-4 h-4 text-green-600" />
                          <span className="text-gray-600">&lt; 70%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Plane className="w-4 h-4 text-yellow-600" />
                          <span className="text-gray-600">≈ 90%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Plane className="w-4 h-4 text-red-600" />
                          <span className="text-gray-600">&gt; 90%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-gray-700">Origen de ruta</span>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-0.5 border-t-2 border-dashed border-orange-500" />
                        <span className="text-gray-600">América</span>
                        <div className="w-8 h-0.5 border-t-2 border-dashed border-blue-500" />
                        <span className="text-gray-600">Europa</span>
                        <div className="w-8 h-0.5 border-t-2 border-dashed border-yellow-500" />
                        <span className="text-gray-600">Asia</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Overlays derecha: Estadísticas y Alertas */}
            <div className="pointer-events-none absolute inset-0 z-30">
              <div className="absolute right-6 top-6 flex flex-col gap-4 pointer-events-auto">
                {showStats && (
                  <div className="bg-white rounded-2xl shadow-lg p-6 w-[360px] max-w-[92vw]">
                    <div className="flex items-center gap-3 mb-4">
                      <BarChart3 className="w-6 h-6 text-[#FF6600]" />
                      <h2 className="text-xl font-bold text-gray-800">Estadísticas en tiempo real</h2>
                    </div>
                    <div className="space-y-4">
                      {stats.map((s, i) => (
                        <div key={i} className="flex items-center justify-between pb-3 border-b border-gray-100 last:border-0">
                          <span className="text-gray-600">{s.label}</span>
                          <span className="text-2xl font-bold text-[#003366]">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showAlerts && (
                  <div className="bg-white rounded-2xl shadow-lg p-6 w-[360px] max-w-[92vw]">
                    <div className="flex items-center gap-3 mb-4">
                      <Bell className="w-6 h-6 text-[#FF6600]" />
                      <h2 className="text-xl font-bold text-gray-800">Alertas y notificaciones</h2>
                    </div>
                    <div className="space-y-3 max-h-[32vh] overflow-y-auto pr-2">
                      {alerts.map((a, i) => (
                        <div key={i} className={`p-4 rounded-lg border ${a.color}`}>
                          <p className="text-sm text-gray-700">{a.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>{/* /map height */}
        </div>
      </div>
    </div>
  );
}

