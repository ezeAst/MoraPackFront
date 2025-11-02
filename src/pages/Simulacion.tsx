import { useState, useEffect } from 'react';
import {
  Play, Pause, Square, Download,
  ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { Marker } from 'react-map-gl';
import MapboxMap from '../components/MapboxMap';
import * as api from '../services/api';
import { CONTINENT_COLORS } from '../utils/colors';

export default function Simulacion() {
  const [selectedScenario, setSelectedScenario] = useState<'weekly' | 'stress_test'>('weekly');
  const [startDateTime, setStartDateTime] = useState('');
  const [showControlView, setShowControlView] = useState(false);
  const [showTopBar, setShowTopBar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Estados de la simulación
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [flights, setFlights] = useState<api.Flight[]>([]);
  const [warehouses, setWarehouses] = useState<api.Warehouse[]>([]);
  const [metrics, setMetrics] = useState<api.SimulationMetrics | null>(null);
  const [events, setEvents] = useState<api.SimulationEvent[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mapeo de aeropuertos -> continente (por código y por nombre)
  const [airportsByCode, setAirportsByCode] = useState<Record<string, string>>({});
  const [airportsByName, setAirportsByName] = useState<Record<string, string>>({});

  // === Leyenda (mostrar/ocultar) y filtros de visibilidad ===
  const [showLegend, setShowLegend] = useState(false);
  const [legend, setLegend] = useState({
    warehouses: true,
    planes: true,
    routes: true,
    // Filtros por origen
    america: true,
    europa: true,
    asia: true,
  });

  // Polling para actualizar estado
  useEffect(() => {
    if (!simulationId || !isRunning) return;

    const interval = setInterval(async () => {
      try {
        const status = await api.getSimulationStatus(simulationId);

        setFlights(status.activeFlights);
        setWarehouses(status.warehouses);
        setMetrics(status.metrics);
        setEvents(status.recentEvents.slice(0, 10));
        setProgress(status.progressPercentage);
        setCurrentTime(status.currentDateTime);

        if (status.progressPercentage >= 100) setIsRunning(false);
      } catch (err) {
        console.error('Error al obtener estado:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [simulationId, isRunning]);

  // Carga inicial de aeropuertos -> continente
  useEffect(() => {
    (async () => {
      try {
        const aeropuertos = await api.getAeropuertos();
        const map: Record<string, string> = {};
        const mapByName: Record<string, string> = {};
        aeropuertos.forEach(a => {
          map[a.codigo] = a.continente;
          mapByName[a.nombre] = a.continente;
        });
        setAirportsByCode(map);
        setAirportsByName(mapByName);
      } catch (e) {
        console.warn('No se pudieron cargar aeropuertos para colorear rutas:', e);
      }
    })();
  }, []);

  // Color de ruta según continente de origen
  const getRouteColor = (flight: api.Flight): string => {
    const continentRaw =
      airportsByCode[flight.origin] ||
      airportsByName[flight.origin] ||
      '';
    const continent = continentRaw
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

    if (continent.includes('america')) return '#00CFFF';                 // celeste
    if (continent.includes('europa') || continent.includes('europe')) return '#6F42C1'; // morado
    if (continent.includes('asia')) return '#FF7A00';                    // naranja
    return '#6B7280';                                                    // gris
  };

  // === Helpers de ocupación (aviones) ===
  // Devuelve carga actual y capacidad, tolerando distintos nombres que pueda traer el backend.
  const getFlightCapacityInfo = (f: any) => {
    // intenta varias convenciones comunes
    const capacity =
      f.capacity ?? f.maxCapacity ?? f.capacityKg ?? f.maxPackages ?? f.planeCapacity ?? 0;
    const current =
      f.current ?? f.load ?? f.currentLoad ?? f.occupied ?? f.packages ?? f.packagesWeight ?? 0;

    return { current: Number(current) || 0, capacity: Number(capacity) || 0 };
  };

  const getCapacityColor = (pct: number) => {
    if (pct < 70) return '#22c55e';     // verde
    if (pct <= 90) return '#eab308';    // amarillo
    return '#ef4444';                   // rojo
  };

  // devuelve el color para el avión y su % (si se pudo calcular)
  const getPlaneColorAndPct = (f: api.Flight) => {
    const { current, capacity } = getFlightCapacityInfo(f);
    if (capacity > 0) {
      const pct = (current / capacity) * 100;
      return { color: getCapacityColor(pct), pct, current, capacity };
    }
    // fallback si no hay datos
    return {
      color: f.status === 'in_flight' ? '#FF6600' : '#94a3b8',
      pct: undefined as number | undefined,
      current: undefined as number | undefined,
      capacity: undefined as number | undefined,
    };
  };

  // Coincidencia de vuelo con filtros de origen (para rutas y aviones)
  const flightMatchesOriginFilter = (f: api.Flight) => {
    const raw =
      airportsByCode[f.origin] ||
      airportsByName[f.origin] ||
      '';
    const origin = raw
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

    if (origin.includes('america')) return legend.america;
    if (origin.includes('europa') || origin.includes('europe')) return legend.europa;
    if (origin.includes('asia')) return legend.asia;
    return true; // otros/indefinidos
  };

  const handleStartSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.createSimulation({
        type: selectedScenario,
        startTime: startDateTime || new Date().toISOString(),
        alphaGrasp: 0.3,
        tamanoRcl: 3
      });

        setSimulationId(response.simulationId);
        setWarehouses(response.warehouses);
        setIsRunning(true);
        setShowControlView(true);
        setProgress(0);
    } catch (err: any) {
      setError(err.message || 'Error al crear la simulación');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    if (!simulationId) return;
    try {
      await api.controlSimulation(simulationId, 'pause');
      setIsRunning(false);
    } catch (err) {
      console.error('Error al pausar:', err);
    }
  };

  const handleResume = async () => {
    if (!simulationId) return;
    try {
      await api.controlSimulation(simulationId, 'resume');
      setIsRunning(true);
    } catch (err) {
      console.error('Error al reanudar:', err);
    }
  };

  const handleStop = async () => {
    if (!simulationId) return;
    try {
      await api.controlSimulation(simulationId, 'stop');
      setIsRunning(false);
      setShowControlView(false);
      setSimulationId(null);
      setFlights([]);
    } catch (err) {
      console.error('Error al detener:', err);
    }
  };

  // Warehouses para el mapa
  const warehousesForMap = warehouses.map(w => ({
    name: w.name,
    lat: w.lat,
    lng: w.lng,
    status: w.status as 'normal' | 'warning' | 'critical',
    capacity: w.capacity,
    current: w.current,
  }));

  // Vuelos filtrados por origen (afecta rutas y aviones)
  const filteredFlights = flights.filter(flightMatchesOriginFilter);

  // Rutas para el mapa (solo de vuelos filtrados)
  const routesForMap = filteredFlights.map(f => ({
    id: f.id,
    coordinates: f.route,
    color: getRouteColor(f)
  }));

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

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

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
                disabled={loading}
                className="w-full px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creando simulación...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Comenzar
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 mt-3">
                ⏱️ Nota: La simulación tarda 5-10 segundos en crearse (ejecuta algoritmo GRASP)
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Información</h2>
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <p className="font-semibold mb-2">Escala de tiempo:</p>
                  <p>• 1 segundo real = 112 segundos simulados</p>
                  <p>• 1 semana simulada = 90 minutos reales</p>
                </div>
                <div>
                  <p className="font-semibold mb-2">Durante la simulación:</p>
                  <p>• Los aviones se moverán en tiempo real</p>
                  <p>• Los almacenes cambiarán de estado</p>
                  <p>• Se generarán eventos y métricas</p>
                </div>
                <div>
                  <p className="font-semibold mb-2">Controles:</p>
                  <p>• Pausar: Congela la simulación</p>
                  <p>• Reanudar: Continúa desde donde pausó</p>
                  <p>• Detener: Termina la simulación</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-0">
          <div className="mx-auto bg-white shadow-lg overflow-hidden relative">
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

            <div className="relative h-[calc(100vh-73px)] bg-gray-200">
              <MapboxMap
                warehouses={legend.warehouses ? warehousesForMap : []}
                routes={legend.routes ? routesForMap : []}
              >
                {/* Vuelos en tiempo real (filtrados por origen) */}
                {legend.planes && filteredFlights.map(flight => {
                  const pc = getPlaneColorAndPct(flight);
                  const fillColor = pc.color;

                  return (
                    <Marker
                      key={flight.id}
                      longitude={flight.currentLng}
                      latitude={flight.currentLat}
                    >
                      <div className="relative group">
                        <svg width="28" height="28" viewBox="0 0 24 24" className="drop-shadow-lg">
                          <path
                            d="M12.382 5.304L10.096 7.59l.006.02L11.838 14a.908.908 0 01-.211.794l-.573.573a.339.339 0 01-.566-.08l-2.348-4.25-.745-.746-1.97 1.97a3.311 3.311 0 01-.75.504l.44 1.447a.875.875 0 01-.199.79l-.175.176a.477.477 0 01-.672 0l-1.04-1.039-.018-.02-.788-.786-.02-.02-1.038-1.039a.477.477 0 010-.672l.176-.176a.875.875 0 01.79-.197l1.447.438a3.322 3.322 0 01.504-.75l1.97-1.97-.746-.744-4.25-2.348a.339.339 0 01-.08-.566l.573-.573a.909.909 0 01.794-.211l6.39 1.736.02.006 2.286-2.286c.37-.372 1.621-1.02 1.993-.65.37.372-.279 1.622-.65 1.993z"
                            fill={fillColor}
                            transform="rotate(45 12 12)"
                          />
                        </svg>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                          <div className="font-semibold">{flight.flightCode}</div>
                          <div>{flight.origin} → {flight.destination}</div>
                          <div>{Math.round(flight.progressPercentage)}% completado</div>
                          <div>{flight.packages} paquetes</div>
                          {typeof pc.pct === 'number' && (
                            <div>Carga: {Math.round(pc.pct)}%{(pc.current ?? undefined) !== undefined && (pc.capacity ?? undefined) !== undefined ? ` (${pc.current}/${pc.capacity})` : ''}</div>
                          )}
                        </div>
                      </div>
                    </Marker>
                  );
                })}
              </MapboxMap>

              {/* Botón de Leyenda: solo ícono */}
              <div className="fixed left-3 bottom-3 z-30">
                <button
                  onClick={() => setShowLegend(s => !s)}
                  className="flex items-center justify-center rounded-full w-10 h-10 bg-white/90 shadow border hover:bg-white"
                  aria-label="Alternar leyenda"
                  title="Leyenda"
                >
                  <Info size={18} />
                </button>

                {showLegend && (
                  <div className="mt-2 p-3 rounded-xl bg-white/95 shadow border min-w-[260px]">
                    {/* Capacidad */}
                    <div className="text-xs font-semibold mb-2">Capacidad</div>
                    <ul className="text-sm space-y-1">
                      <li>
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{background:'#22c55e'}} />
                        {'< 70% capacidad'}
                      </li>
                      <li>
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{background:'#eab308'}} />
                        {'70–90% capacidad'}
                      </li>
                      <li>
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{background:'#ef4444'}} />
                        {'> 90% capacidad'}
                      </li>
                    </ul>

                    {/* Origen de rutas (colores) */}
                    <div className="text-xs font-semibold mt-3 mb-2">Rutas (origen)</div>
                    <ul className="text-sm space-y-1">
                      <li>
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{background: CONTINENT_COLORS.America}} />
                        América
                      </li>
                      <li>
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{background: CONTINENT_COLORS.Europa}} />
                        Europa
                      </li>
                      <li>
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{background: CONTINENT_COLORS.Asia}} />
                        Asia
                      </li>
                    </ul>

                    {/* Filtros por origen */}
                    <div className="text-xs font-semibold mt-3 mb-2">Filtrar rutas por origen</div>
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={legend.america}
                          onChange={e => setLegend(s => ({ ...s, america: e.target.checked }))}
                        />
                        América
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={legend.europa}
                          onChange={e => setLegend(s => ({ ...s, europa: e.target.checked }))}
                        />
                        Europa
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={legend.asia}
                          onChange={e => setLegend(s => ({ ...s, asia: e.target.checked }))}
                        />
                        Asia
                      </label>
                    </div>

                    {/* Toggles de visibilidad */}
                    <div className="text-xs font-semibold mt-3 mb-2">Mostrar</div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={legend.warehouses}
                          onChange={e => setLegend(s => ({...s, warehouses: e.target.checked}))}
                        />
                        Almacenes
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={legend.planes}
                          onChange={e => setLegend(s => ({...s, planes: e.target.checked}))}
                        />
                        Aviones
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={legend.routes}
                          onChange={e => setLegend(s => ({...s, routes: e.target.checked}))}
                        />
                        Rutas
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Barra inferior: padding-left para que no la tape el botón */}
              <div className="absolute left-0 right-0 bottom-0 text-xs md:text-sm text-gray-700 flex justify-between px-4 pl-12 py-2 bg-white/80 backdrop-blur border-t">
                <span>Progreso: {progress.toFixed(1)}%</span>
                <span>Hora simulada: {currentTime}</span>
              </div>

              <div className={`absolute top-0 right-0 h-full transition-transform duration-200 ${showRightPanel ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="bg-white shadow-xl w-[360px] h-full p-6 overflow-y-auto">
                  <div className="mb-4">
                    <p className={`font-semibold ${isRunning ? 'text-green-600' : 'text-amber-600'}`}>
                      Estado: {isRunning ? 'en ejecución' : 'pausado'}
                    </p>
                    <p className="text-sm text-gray-600">Tipo: {selectedScenario === 'weekly' ? 'Semanal' : 'Prueba de colapso'}</p>
                    <p className="text-sm text-gray-600">Vuelos activos: {flights.length}</p>
                  </div>

                  {metrics && (
                    <>
                      <h3 className="text-lg font-bold text-gray-800 mb-3">Métricas</h3>
                      <div className="space-y-2 text-sm mb-6">
                        <p className="text-gray-700"><span className="font-semibold">Pedidos procesados:</span> {metrics.ordersProcessed}</p>
                        <p className="text-gray-700"><span className="font-semibold">Vuelos completados:</span> {metrics.flightsCompleted}</p>
                        <p className="text-gray-700"><span className="font-semibold">Paquetes entregados:</span> {metrics.packagesDelivered}</p>
                        <p className="text-gray-700"><span className="font-semibold">Paquetes pendientes:</span> {metrics.packagesPending}</p>
                        <p className="text-gray-700"><span className="font-semibold">Tasa de éxito:</span> {metrics.successRate.toFixed(1)}%</p>
                        <p className="text-gray-700"><span className="font-semibold">Violaciones:</span> {metrics.warehouseViolations + metrics.flightViolations}</p>
                      </div>
                    </>
                  )}

                  {events.length > 0 && (
                    <>
                      <h3 className="text-lg font-bold text-gray-800 mb-3">Eventos recientes</h3>
                      <div className="space-y-2 mb-6">
                        {events.map((event, i) => {
                        // Determinar el color del fondo según el tipo de evento
                        let bgColorClass = '';
                        switch (event.type) {
                          case 'ORDER_RECEIVED':
                            bgColorClass = 'bg-green-50 border-green-200';
                            break;
                          case 'ORDER_DELIVERED':
                            bgColorClass = 'bg-purple-50 border-purple-200';
                            break;
                          case 'WAREHOUSE_WARNING':
                            bgColorClass = 'bg-red-50 border-red-200';
                            break;
                          default:
                            bgColorClass = 'bg-blue-50 border-blue-200';
                        }

                        return (
                          <div key={i} className={`p-3 ${bgColorClass} border rounded-lg text-xs text-gray-700`}>
                            {event.message}
                          </div>
                        );
                      })}
                      </div>
                    </>
                  )}

                  <button className="w-full px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium flex items-center justify-center gap-2">
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