import { useLayoutEffect, useMemo, useState } from 'react';
import {
  Play, Pause, FastForward, Rewind, Square, Download, Eye,
  ChevronDown, ChevronUp
} from 'lucide-react';
import {
  MapContainer, TileLayer, Polyline, CircleMarker, Tooltip
} from 'react-leaflet';
import L from 'leaflet';
import type { Simulation } from '../types';

// --- Datos demo / mismo que tenías ---
const SAMPLE_SIMULATIONS: Simulation[] = [
  {
    id: '1',
    simulation_type: 'weekly',
    start_time: '2025-08-24T10:30:00',
    duration_seconds: 1816,
    status: 'completed',
    orders_processed: 12450,
    flights_completed: 58,
    packages_delivered: 11820,
    packages_pending: 630,
    success_rate: 94.9,
    max_warehouse_capacity_used: 82,
    flights_cancelled: 2,
    created_at: new Date().toISOString()
  }
];
let simulationIdCounter = 2;

export default function Simulacion() {
  const [simulations, setSimulations] = useState<Simulation[]>([...SAMPLE_SIMULATIONS]);
  const [selectedScenario, setSelectedScenario] = useState<'weekly' | 'stress_test'>('weekly');
  const [startDateTime, setStartDateTime] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showControlView, setShowControlView] = useState(false);

  // overlays en modo control
  const [showTopBar, setShowTopBar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  const [map, setMap] = useState<L.Map | null>(null);

  // --- Datos del mapa ---
  const LIMA: [number, number] = [-12.0464, -77.0428];
  const BRU: [number, number] = [50.8503, 4.3517];
  const BAK: [number, number] = [40.4093, 49.8671];

  const rutas = useMemo(
    () => [
      { pts: [LIMA, BRU] as [number, number][], color: '#FF6600', dash: '5,5' },
      { pts: [BRU, BAK] as [number, number][], color: '#0066FF', dash: '5,5' },
      { pts: [[-16.5, -71.5], [-22.9, -43.2]] as [number, number][], color: '#22c55e', dash: '4,4' }
    ],
    []
  );

  const warehouses = [
    { name: 'Lima', lat: -12.0464, lng: -77.0428, status: 'warning' as const },
    { name: 'Bruselas', lat: 50.8503, lng: 4.3517, status: 'critical' as const },
    { name: 'Baku', lat: 40.4093, lng: 49.8671, status: 'normal' as const },
  ];

  const bounds = useMemo(() => L.latLngBounds([LIMA, BRU, BAK]), []);

  useLayoutEffect(() => {
    if (!map) return;
    map.fitBounds(bounds, { padding: [40, 40] });
    map.invalidateSize();
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [map, bounds]);

  // --- Simulación: acciones ---
  const handleStartSimulation = () => {
    const newSimulation: Simulation = {
      id: String(simulationIdCounter++),
      simulation_type: selectedScenario,
      start_time: startDateTime || new Date().toISOString(),
      duration_seconds: 0,
      status: 'running',
      orders_processed: 0,
      flights_completed: 0,
      packages_delivered: 0,
      packages_pending: 0,
      success_rate: 0,
      max_warehouse_capacity_used: 0,
      flights_cancelled: 0,
      created_at: new Date().toISOString()
    };
    SAMPLE_SIMULATIONS.unshift(newSimulation);
    setSimulations([...SAMPLE_SIMULATIONS]);
    setIsRunning(true);
    setShowControlView(true);
  };
  const handlePause = () => setIsRunning(false);
  const handleResume = () => setIsRunning(true);
  const handleStop = () => {
    const running = SAMPLE_SIMULATIONS.find(s => s.status === 'running');
    if (running) running.status = 'completed';
    setIsRunning(false);
    setShowControlView(false);
    setSimulations([...SAMPLE_SIMULATIONS]);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}min ${s}seg`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#FF6600] text-white px-6 py-5">
        <h1 className="text-3xl font-bold">Simulación del sistema</h1>
        <p className="text-lg mt-1">Pruebe el rendimiento del sistema en diferentes escenarios</p>
      </div>

      {/* === Vista 1: Selección === */}
      {!showControlView ? (
        <div className="p-6">
          <div className="mx-auto max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Selección */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Selección de escenario</h2>

              <div className="space-y-4 mb-6">
                <button
                  onClick={() => setSelectedScenario('weekly')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedScenario === 'weekly'
                      ? 'bg-purple-100 border-purple-500'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <h3 className="font-bold text-gray-800 mb-1">Simulación semanal</h3>
                  <p className="text-sm text-gray-600">Simulación extendida que cubre una semana completa</p>
                </button>

                <button
                  onClick={() => setSelectedScenario('stress_test')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedScenario === 'stress_test'
                      ? 'bg-purple-100 border-purple-500'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <h3 className="font-bold text-gray-800 mb-1">Prueba de colapso</h3>
                  <p className="text-sm text-gray-600">Escenario de alto estrés con carga máxima</p>
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha y hora de inicio:</label>
                <input
                  type="datetime-local"
                  value={startDateTime}
                  onChange={(e) => setStartDateTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>

              <button
                onClick={handleStartSimulation}
                className="w-full px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Comenzar
              </button>
            </div>

            {/* Últimos resultados */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Últimos resultados</h2>

              {simulations[0] && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600"><span className="font-semibold">Tipo de simulación:</span> {simulations[0].simulation_type === 'weekly' ? 'Semanal' : 'Prueba de colapso'}</p>
                    <p className="text-sm text-gray-600"><span className="font-semibold">Fecha y hora de ejecución:</span> {new Date(simulations[0].start_time).toLocaleString('es-PE')}</p>
                    <p className="text-sm text-gray-600"><span className="font-semibold">Duración:</span> {formatDuration(simulations[0].duration_seconds)}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Progreso de la simulación</p>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-green-500 h-3 rounded-full" style={{ width: '100%' }} />
                    </div>
                    <p className="text-sm text-right text-gray-600 mt-1">100%</p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-gray-200 text-sm text-gray-700">
                    <p><span className="font-semibold">Pedidos procesados:</span> {simulations[0].orders_processed.toLocaleString()}</p>
                    <p><span className="font-semibold">Vuelos realizados:</span> {simulations[0].flights_completed}</p>
                    <p><span className="font-semibold">Paquetes entregados:</span> {simulations[0].packages_delivered.toLocaleString()}</p>
                    <p><span className="font-semibold">Paquetes pendientes:</span> {simulations[0].packages_pending}</p>
                    <p><span className="font-semibold">Tasa de éxito:</span> {simulations[0].success_rate}%</p>
                    <p><span className="font-semibold">Capacidad máx. usada:</span> {simulations[0].max_warehouse_capacity_used}%</p>
                    <p><span className="font-semibold">Vuelos cancelados:</span> {simulations[0].flights_cancelled}</p>
                  </div>

                  <p className="text-sm font-semibold text-green-600 pt-4 border-t border-gray-200">Estado: finalizada</p>

                  <div className="flex gap-3">
                    <button className="flex-1 px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium flex items-center justify-center gap-2">
                      <Eye className="w-5 h-5" /> Ver detalle
                    </button>
                    <button className="flex-1 px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium flex items-center justify-center gap-2">
                      <Download className="w-5 h-5" /> Exportar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* === Vista 2: Panel de control sobre mapa === */
        <div className="p-6">
          <div className="mx-auto max-w-[1400px] bg-white rounded-2xl shadow-lg overflow-hidden relative">
            {/* ---------- BARRA SUPERIOR (con espaciador) ---------- */}
            {/* Espaciador que reserva altura para que el mapa no "salte" */}
            <div style={{ height: showTopBar ? 96 : 28 }} />

            {/* Barra flotante */}
            <div
              className={`absolute top-0 left-0 right-0 z-20 transition-transform duration-200 ${
                showTopBar ? 'translate-y-0' : '-translate-y-full'
              }`}
            >
              <div className="bg-white/95 backdrop-blur rounded-t-2xl border-b shadow-sm">
                {/* Título + estado */}
                <div className="px-6 pt-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Panel de control</h2>
                  <p className={`font-semibold ${isRunning ? 'text-green-600' : 'text-amber-600'}`}>
                    Estado: {isRunning ? 'en ejecución' : 'pausado'}
                  </p>
                </div>
                {/* Botones */}
                <div className="px-6 pb-3 pt-3 flex flex-wrap items-center gap-3">
                  {!isRunning ? (
                    <button
                      onClick={handleResume}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                    >
                      <Play className="w-5 h-5" /> Reanudar
                    </button>
                  ) : (
                    <button
                      onClick={handlePause}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
                    >
                      <Pause className="w-5 h-5" /> Pausar
                    </button>
                  )}
                  <button className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2">
                    <FastForward className="w-5 h-5" /> Aumentar
                  </button>
                  <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2">
                    <Rewind className="w-5 h-5" /> Reducir
                  </button>
                  <button
                    onClick={handleStop}
                    className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <Square className="w-5 h-5" /> Detener
                  </button>
                </div>
              </div>

              {/* Handle centrado */}
              <div className="relative">
                <button
                  onClick={() => setShowTopBar(v => !v)}
                  className="absolute left-1/2 -translate-x-1/2 translate-y-2 px-3 py-1 rounded-full bg-white shadow border text-gray-700 hover:bg-gray-50"
                  title={showTopBar ? 'Ocultar' : 'Mostrar'}
                >
                  {showTopBar ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* --------------------- MAPA --------------------- */}
            <div className="relative h-[70vh] min-h-[520px] bg-gray-200">
              <MapContainer
                whenCreated={setMap}
                bounds={bounds}
                zoomControl={false}
                className="absolute inset-0"
                style={{ background: '#eef2f7' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />

                {rutas.map((r, i) => (
                  <Polyline key={i} pathOptions={{ color: r.color, weight: 3, dashArray: r.dash }} positions={r.pts} />
                ))}

                {warehouses.map((w, i) => {
                  const color = w.status === 'critical' ? '#DC3545' : w.status === 'warning' ? '#FFC107' : '#28A745';
                  return (
                    <CircleMarker key={i} center={[w.lat, w.lng]} radius={10} pathOptions={{ color, fillColor: color, fillOpacity: 1, weight: 2 }}>
                      <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                        <div className="font-semibold text-gray-800">{w.name}</div>
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
              </MapContainer>

              {/* Leyenda y panel derecho quedan igual que antes */}
              {/* ... (tu leyenda y drawer derecho) ... */}

              {/* Footer info */}
              <div className="absolute left-0 right-0 bottom-0 text-xs md:text-sm text-gray-700 flex justify-between px-4 py-2 bg-white/80 backdrop-blur border-t">
                <span>Tiempo transcurrido: 5 días, 15 horas y 2 minutos</span>
                <span>Hora actual: 30/08/2025 01:32 AM</span>
              </div>

              {/* Panel lateral derecho (colapsable) */}
              <div className={`absolute top-6 right-0 h-[calc(100%-3rem)] transition-transform duration-200 ${showRightPanel ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="bg-white rounded-l-2xl shadow-xl w-[360px] h-full p-6 overflow-y-auto">
                  <div className="mb-4">
                    <p className={`font-semibold ${isRunning ? 'text-green-600' : 'text-amber-600'}`}>Estado: {isRunning ? 'en ejecución' : 'pausado'}</p>
                    <p className="text-sm text-gray-600">Tipo: {selectedScenario === 'weekly' ? 'Semanal' : 'Prueba de colapso'}</p>
                    <p className="text-sm text-gray-600">Tiempo restante: 18 minutos</p>
                  </div>

                  <h3 className="text-lg font-bold text-gray-800 mb-3">Métricas parciales en ejecución</h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-700"><span className="font-semibold">% avance:</span> 62%</p>
                    <p className="text-gray-700"><span className="font-semibold">Envíos procesados:</span> 8,450</p>
                    <p className="text-gray-700"><span className="font-semibold">Vuelos completados:</span> 47</p>
                    <p className="text-gray-700"><span className="font-semibold">Vuelos en curso:</span> 7</p>
                    <p className="text-gray-700"><span className="font-semibold">Envíos entregados:</span> 6,820</p>
                    <p className="text-gray-700"><span className="font-semibold">Envíos pendientes:</span> 2,630</p>
                    <p className="text-gray-700"><span className="font-semibold">Capacidad almacenes usada:</span> 62%</p>
                    <p className="text-gray-700"><span className="font-semibold">Vuelos cancelados:</span> 2</p>
                  </div>

                  <h3 className="text-lg font-bold text-gray-800 mt-6 mb-3">Notificaciones</h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-gray-700">
                    ⚠️ El pedido ABC se distribuirá en dos vuelos: VL-220 y VL-221
                  </div>

                  <button className="mt-6 w-full px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium flex items-center justify-center gap-2">
                    <Download className="w-5 h-5" /> Exportar
                  </button>
                </div>

                <button
                  onClick={() => setShowRightPanel(v => !v)}
                  className="absolute left-[-28px] top-1/2 -translate-y-1/2 bg-white border rounded-l px-2 py-6 shadow hover:bg-gray-50"
                  title={showRightPanel ? 'Ocultar panel' : 'Mostrar panel'}
                >
                  {showRightPanel ? '<' : '>'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}