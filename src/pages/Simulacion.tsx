import { useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, FastForward, Rewind, Square, Download,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { Marker } from 'react-map-gl';
import MapboxMap from '../components/MapboxMap';
import type { Simulation } from '../types';

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

type Flight = {
  id: string;
  from: [number, number];
  to: [number, number];
  progress: number; // 0 to 1
};

export default function Simulacion() {
  const [simulations, setSimulations] = useState<Simulation[]>([...SAMPLE_SIMULATIONS]);
  const [selectedScenario, setSelectedScenario] = useState<'weekly' | 'stress_test'>('weekly');
  const [startDateTime, setStartDateTime] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showControlView, setShowControlView] = useState(false);
  const [showTopBar, setShowTopBar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Vuelos animados
  const [flights, setFlights] = useState<Flight[]>([]);

  const warehouses = [
    { name: 'Lima', lat: -12.0464, lng: -77.0428, status: 'warning' as const },
    { name: 'Bruselas', lat: 50.8503, lng: 4.3517, status: 'critical' as const },
    { name: 'Baku', lat: 40.4093, lng: 49.8671, status: 'normal' as const },
  ];

  const routes = [
    { id: 'route-1', coordinates: [[-77.0428, -12.0464], [4.3517, 50.8503]] as [number, number][], color: '#FF6600' },
    { id: 'route-2', coordinates: [[4.3517, 50.8503], [49.8671, 40.4093]] as [number, number][], color: '#0066FF' },
    { id: 'route-3', coordinates: [[-71.5, -16.5], [-43.2, -22.9]] as [number, number][], color: '#22c55e' },
  ];

  // Inicializar vuelos aleatorios
  const initFlights = useCallback(() => {
    const newFlights: Flight[] = [];
    const routePairs = [
      { from: [-77.0428, -12.0464] as [number, number], to: [4.3517, 50.8503] as [number, number] },
      { from: [4.3517, 50.8503] as [number, number], to: [49.8671, 40.4093] as [number, number] },
      { from: [-71.5, -16.5] as [number, number], to: [-43.2, -22.9] as [number, number] },
    ];

    for (let i = 0; i < 8; i++) {
      const route = routePairs[Math.floor(Math.random() * routePairs.length)];
      newFlights.push({
        id: `flight-${i}`,
        from: route.from,
        to: route.to,
        progress: Math.random()
      });
    }
    setFlights(newFlights);
  }, []);

  // Animar vuelos
  useEffect(() => {
    if (!isRunning || !showControlView) return;

    const interval = setInterval(() => {
      setFlights(prev => prev.map(flight => {
        let newProgress = flight.progress + 0.01;
        if (newProgress >= 1) {
          newProgress = 0;
        }
        return { ...flight, progress: newProgress };
      }));
    }, 50); // 50ms = animación fluida

    return () => clearInterval(interval);
  }, [isRunning, showControlView]);

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
    initFlights();
  };

  const handlePause = () => setIsRunning(false);
  const handleResume = () => setIsRunning(true);
  const handleStop = () => {
    const running = SAMPLE_SIMULATIONS.find(s => s.status === 'running');
    if (running) running.status = 'completed';
    setIsRunning(false);
    setShowControlView(false);
    setSimulations([...SAMPLE_SIMULATIONS]);
    setFlights([]);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}min ${s}seg`;
  };

  // Interpolar posición del vuelo
  const interpolatePosition = (from: [number, number], to: [number, number], progress: number): [number, number] => {
    return [
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress
    ];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#FF6600] text-white px-6 py-5">
        <h1 className="text-3xl font-bold">Simulación del sistema</h1>
        <p className="text-lg mt-1">Pruebe el rendimiento del sistema en diferentes escenarios</p>
      </div>

      {!showControlView ? (
        <div className="p-6">
          <div className="mx-auto max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha y hora de inicio de simulación:
                </label>
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
                      <Download className="w-5 h-5" />
                      Exportar Resultados
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6">
          <div className="mx-auto max-w-[1400px] bg-white rounded-2xl shadow-lg overflow-hidden relative">
            <div style={{ height: showTopBar ? 96 : 28 }} />

            <div
              className={`absolute top-0 left-0 right-0 z-20 transition-transform duration-200 ${
                showTopBar ? 'translate-y-0' : '-translate-y-full'
              }`}
            >
              <div className="bg-white/95 backdrop-blur rounded-t-2xl border-b shadow-sm">
                <div className="px-6 pt-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Panel de control</h2>
                  <p className={`font-semibold ${isRunning ? 'text-green-600' : 'text-amber-600'}`}>
                    Estado: {isRunning ? 'en ejecución' : 'pausado'}
                  </p>
                </div>
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

            <div className="relative h-[70vh] min-h-[520px] bg-gray-200">
              <MapboxMap warehouses={warehouses} routes={routes}>
                {/* Vuelos animados */}
                {flights.map(flight => {
                  const [lng, lat] = interpolatePosition(flight.from, flight.to, flight.progress);
                  return (
                    <Marker key={flight.id} longitude={lng} latitude={lat}>
                      <div className="relative">
                        <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow-lg">
                          <path
                            d="M12.382 5.304L10.096 7.59l.006.02L11.838 14a.908.908 0 01-.211.794l-.573.573a.339.339 0 01-.566-.08l-2.348-4.25-.745-.746-1.97 1.97a3.311 3.311 0 01-.75.504l.44 1.447a.875.875 0 01-.199.79l-.175.176a.477.477 0 01-.672 0l-1.04-1.039-.018-.02-.788-.786-.02-.02-1.038-1.039a.477.477 0 010-.672l.176-.176a.875.875 0 01.79-.197l1.447.438a3.322 3.322 0 01.504-.75l1.97-1.97-.746-.744-4.25-2.348a.339.339 0 01-.08-.566l.573-.573a.909.909 0 01.794-.211l6.39 1.736.02.006 2.286-2.286c.37-.372 1.621-1.02 1.993-.65.37.372-.279 1.622-.65 1.993z"
                            fill="#FF6600"
                            transform="rotate(45 12 12)"
                          />
                        </svg>
                      </div>
                    </Marker>
                  );
                })}
              </MapboxMap>

              <div className="absolute left-0 right-0 bottom-0 text-xs md:text-sm text-gray-700 flex justify-between px-4 py-2 bg-white/80 backdrop-blur border-t">
                <span>Tiempo transcurrido: 5 días, 15 horas y 2 minutos</span>
                <span>Hora actual: 30/08/2025 01:32 AM</span>
              </div>

              <div className={`absolute top-6 right-0 h-[calc(100%-3rem)] transition-transform duration-200 ${showRightPanel ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="bg-white rounded-l-2xl shadow-xl w-[360px] h-full p-6 overflow-y-auto">
                  <div className="mb-4">
                    <p className={`font-semibold ${isRunning ? 'text-green-600' : 'text-amber-600'}`}>Estado: {isRunning ? 'en ejecución' : 'pausado'}</p>
                    <p className="text-sm text-gray-600">Tipo: {selectedScenario === 'weekly' ? 'Semanal' : 'Prueba de colapso'}</p>
                    <p className="text-sm text-gray-600">Vuelos activos: {flights.length}</p>
                  </div>

                  <h3 className="text-lg font-bold text-gray-800 mb-3">Métricas parciales</h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-700"><span className="font-semibold">% avance:</span> 62%</p>
                    <p className="text-gray-700"><span className="font-semibold">Envíos procesados:</span> 8,450</p>
                    <p className="text-gray-700"><span className="font-semibold">Vuelos completados:</span> 47</p>
                    <p className="text-gray-700"><span className="font-semibold">Vuelos en curso:</span> {flights.length}</p>
                  </div>

                  <button className="mt-6 w-full px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium flex items-center justify-center gap-2">
                    <Download className="w-5 h-5" /> Exportar
                  </button>
                </div>

                <button
                  onClick={() => setShowRightPanel(v => !v)}
                  className="absolute left-[-28px] top-1/2 -translate-y-1/2 bg-white border rounded-l px-2 py-6 shadow hover:bg-gray-50"
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