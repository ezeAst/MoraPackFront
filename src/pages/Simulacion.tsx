import { useState, useEffect, useMemo } from 'react';
import {
  Play, Pause, Square, Download,
  ChevronDown, ChevronUp, Info, Search, X
} from 'lucide-react';
import { Marker, Source, Layer } from 'react-map-gl';
import MapboxMap from '../components/MapboxMap';
import * as api from '../services/api';
import { CONTINENT_COLORS } from '../utils/colors';
import { useSimulation } from '../contexts/SimulationContext';
import nuevoAvion from '../Images/nuevoAvion.png'; // o la ruta que uses




export default function Simulacion() {
  // Usar el contexto en lugar de estados locales
  const {
    simulationId,
    isRunning,
    flights,
    warehouses,
    metrics,
    events,
    currentTime,
    selectedScenario,
    startDateTime,
    planningStatus,
    realTime,
    simulatedElapsedTime,
    realElapsedTime,
    activeOrders,
    recentlyDeliveredOrders,
    setSelectedScenario,
    setStartDateTime,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    stopSimulation,
  } = useSimulation();
  
  const [showControlView, setShowControlView] = useState(false);
  const [showTopBar, setShowTopBar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para la búsqueda
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'order' | 'flight'>('order');
  const [orderStatus, setOrderStatus] = useState<'planned' | 'delivered' | 'all'>('all');
  const [searchResult, setSearchResult] = useState<{
    type: 'order' | 'flight';
    data: api.OrderSnapshot | api.Flight | null;
  } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

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

  // Mostrar vista de control si hay una simulación activa
  useEffect(() => {
    if (simulationId) {
      setShowControlView(true);
    }
  }, [simulationId]);

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

  useEffect(() => {
  if (!simulationId || !isRunning) return;
  
  // Cada 30 segundos, forzar re-render limpiando el array de flights
  const cleanupInterval = setInterval(() => {
    console.log('🧹 Limpieza preventiva de duplicados');
    // El context ya tiene la lógica, solo necesitamos que React detecte cambio
  }, 30000);
  
  return () => clearInterval(cleanupInterval);
}, [simulationId, isRunning]);

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

  // Interpolar puntos en gran círculo (geodésica) para rutas curvas naturales
  const interpolateGreatCircle = (start: [number, number], end: [number, number], numPoints: number = 50): [number, number][] => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    const [lon1, lat1] = start;
    const [lon2, lat2] = end;

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);

    const points: [number, number][] = [];

    for (let i = 0; i <= numPoints; i++) {
      const f = i / numPoints;

      // Fórmula de interpolación esférica (slerp)
      const a = Math.sin((1 - f) * Δλ) / Math.sin(Δλ);
      const b = Math.sin(f * Δλ) / Math.sin(Δλ);

      const x = a * Math.cos(φ1) * Math.cos(toRad(lon1)) + b * Math.cos(φ2) * Math.cos(toRad(lon2));
      const y = a * Math.cos(φ1) * Math.sin(toRad(lon1)) + b * Math.cos(φ2) * Math.sin(toRad(lon2));
      const z = a * Math.sin(φ1) + b * Math.sin(φ2);

      const φi = Math.atan2(z, Math.sqrt(x * x + y * y));
      const λi = Math.atan2(y, x);

      points.push([toDeg(λi), toDeg(φi)]);
    }

    return points;
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
    return '#ef4444';                   // rojo (incluye cuando pct > 100)
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
      await startSimulation({
        type: selectedScenario,
        startTime: startDateTime || new Date().toISOString(),
        alphaGrasp: 0.3,
        tamanoRcl: 3
      });
      setShowControlView(true);
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
      await pauseSimulation();
    } catch (err) {
      console.error('Error al pausar:', err);
    }
  };

  const handleResume = async () => {
    if (!simulationId) return;
    try {
      await resumeSimulation();
    } catch (err) {
      console.error('Error al reanudar:', err);
    }
  };

  const handleStop = async () => {
    if (!simulationId) return;
    try {
      await stopSimulation();
      setShowControlView(false);
    } catch (err) {
      console.error('Error al detener:', err);
    }
  };

  // Función de búsqueda en memoria
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchError('Por favor ingrese un código o ID para buscar');
      setSearchResult(null);
      setHasSearched(true);
      return;
    }

    setSearchError(null);
    setSearchResult(null);
    setHasSearched(true);
    const query = searchQuery.trim().toUpperCase();

    if (searchType === 'order') {
      // Buscar en órdenes activas y entregadas
      const allOrders = [...activeOrders, ...recentlyDeliveredOrders];
      const found = allOrders.find(order => order.orderId.toUpperCase().includes(query));

      if (found) {
        // Filtrar por estado si no es 'all'
        if (orderStatus === 'planned' && found.status !== 'pending' && found.status !== 'in_transit') {
          setSearchError(`No se encontró un pedido planificado con ID que contenga "${searchQuery}"`);
          setSearchResult(null);
        } else if (orderStatus === 'delivered' && found.status !== 'delivered') {
          setSearchError(`No se encontró un pedido entregado con ID que contenga "${searchQuery}"`);
          setSearchResult(null);
        } else {
          setSearchResult({
            type: 'order',
            data: found
          });
        }
      } else {
        setSearchError(`No se encontró ningún pedido con ID que contenga "${searchQuery}"`);
      }
    } else {
      // Buscar en vuelos
      const found = flights.find(flight => 
        flight.id.toUpperCase().includes(query) || 
        flight.flightCode.toUpperCase().includes(query)
      );

      if (found) {
        setSearchResult({
          type: 'flight',
          data: found
        });
      } else {
        setSearchError(`No se encontró ninguna unidad de transporte con ID/código que contenga "${searchQuery}"`);
      }
    }
  };

  const closeSearchModal = () => {
    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResult(null);
    setSearchError(null);
    setHasSearched(false);
  };

  console.log('🔍 Vuelos totales:', flights.length);
  console.log('🔍 Vuelos in_flight:', flights.filter(f => f.status === 'in_flight').length);
  console.log('🔍 Sample vuelo:', flights[0]);

  // Warehouses para el mapa
  const warehousesForMap = warehouses.map(w => ({
    name: w.name,
    lat: w.lat,
    lng: w.lng,
    status: w.status as 'normal' | 'warning' | 'critical',
    capacity: w.capacity,
    current: w.current,
  }));

  // Vuelos filtrados: solo en vuelo (in_flight) y que coincidan con filtro de origen
  // Usamos useMemo para evitar duplicaciones de markers en el mapa
// Vuelos filtrados: solo en vuelo (in_flight) y que coincidan con filtro de origen
// Usamos useMemo para evitar duplicaciones de markers en el mapa
const filteredFlights = useMemo(() => {
  const seen = new Set<string>();
  return flights.filter(f => {
    if (f.status !== 'in_flight') return false;
    if (!flightMatchesOriginFilter(f)) return false;
    if (typeof f.currentLng !== 'number' || typeof f.currentLat !== 'number') return false;
    if (isNaN(f.currentLng) || isNaN(f.currentLat)) return false;
    
    // ✅ Deduplicar por ID
    if (seen.has(f.id)) {
      console.warn('⚠️ Vuelo duplicado detectado:', f.id);
      return false;
    }
    seen.add(f.id);
    return true;
  });
}, [flights, legend.america, legend.europa, legend.asia]);

// Proyección Web Mercator (misma que usa Mapbox)
const toRadians = (deg: number) => (deg * Math.PI) / 180;

const projectToMercator = (lng: number, lat: number) => {
  const λ = toRadians(lng);
  const φ = toRadians(lat);
  const x = λ;
  const y = Math.log(Math.tan(Math.PI / 4 + φ / 2));
  return { x, y };
};

const getPlaneAngle = (flight: api.Flight): number => {
  const route = flight.route;
  if (!route || route.length < 2) return 0;

  const currentLng = flight.currentLng;
  const currentLat = flight.currentLat;

  // 1) Buscar el punto de la ruta más cercano a la posición actual del avión
  let closestIndex = 0;
  let minDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < route.length; i++) {
    const [lng, lat] = route[i];
    const dLng = lng - currentLng;
    const dLat = lat - currentLat;
    const dist = dLng * dLng + dLat * dLat;
    if (dist < minDist) {
      minDist = dist;
      closestIndex = i;
    }
  }

  // 2) Elegir el tramo (segmento) de la ruta más cercano
  let idx1: number;
  let idx2: number;

  if (closestIndex === route.length - 1) {
    idx1 = route.length - 2;
    idx2 = route.length - 1;
  } else {
    idx1 = closestIndex;
    idx2 = closestIndex + 1;
  }

  const [lng1, lat1] = route[idx1];
  const [lng2, lat2] = route[idx2];

  // 3) Proyectar a coordenadas Web Mercator
  const p1 = projectToMercator(lng1, lat1);
  const p2 = projectToMercator(lng2, lat2);

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // 4) Calcular ángulo en pantalla (eje Y hacia abajo → invertimos dy)
  const angleRad = Math.atan2(-dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;

  // El SVG del avión está apuntando "a la derecha" (este) cuando angleDeg = 0,
  // por eso devolvemos el ángulo tal cual. Si lo vieras 90° girado, aquí se ajusta.
  return angleDeg;
};





  return (
    <div className="h-full bg-gray-50 overflow-hidden flex flex-col">
      <div className="bg-[#FF6600] text-white px-6 py-5 flex-shrink-0">
        <h1 className="text-3xl font-bold">Simulación del sistema</h1>
        <p className="text-lg mt-1">Pruebe el rendimiento del sistema en diferentes escenarios</p>
      </div>

      {!showControlView ? (
        <div className="p-6 flex-1 overflow-y-auto">
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
        <div className="flex-1 relative overflow-hidden">
          <div className="h-full bg-white shadow-lg relative">
            <div style={{ height: showTopBar ? 96 : 28 }} />

            <div
              className={`absolute top-0 left-0 right-0 z-20 transition-transform duration-200 ${
                showTopBar ? 'translate-y-0' : '-translate-y-full'
              }`}
            >
              <div className="bg-white/95 backdrop-blur rounded-t-2xl border-b shadow-sm">
                {/* Header con título, estado y botones */}
                <div className="px-6 pt-4 pb-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Panel de control</h2>
                  
                  <div className="flex items-center gap-4">
                    <p className={`font-semibold ${isRunning ? 'text-green-600' : 'text-amber-600'}`}>
                      Estado: {isRunning ? 'en ejecución' : 'pausado'}
                    </p>
                    
                    <div className="flex items-center gap-2">
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
                          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2"
                        >
                          <Pause className="w-5 h-5" /> Pausar
                        </button>
                      )}
                      <button
                        onClick={handleStop}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                      >
                        <Square className="w-5 h-5" /> Detener
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Información de tiempos - ahora más grande */}
                <div className="px-6 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Tiempo simulado</p>
                    <p className="text-sm font-mono text-gray-900">{currentTime || '---'}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg px-4 py-3 border border-green-200">
                    <p className="text-xs font-semibold text-green-700 mb-1">Tiempo real</p>
                    <p className="text-sm font-mono text-gray-900">{realTime || '---'}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg px-4 py-3 border border-purple-200">
                    <p className="text-xs font-semibold text-purple-700 mb-1">Transcurrido (sim)</p>
                    <p className="text-sm font-mono text-gray-900">{simulatedElapsedTime}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg px-4 py-3 border border-amber-200">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Transcurrido (real)</p>
                    <p className="text-sm font-mono text-gray-900">{realElapsedTime}</p>
                  </div>
                </div>

                {/* Barra de búsqueda */}
                <div className="px-6 pb-4 border-t pt-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowSearchModal(true)}
                      className="px-4 py-2 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] flex items-center gap-2 font-medium whitespace-nowrap"
                    >
                      <Search className="w-4 h-4" /> Buscar
                    </button>
                    <p className="text-xs text-gray-500">
                      Busque pedidos, envíos o unidades de transporte por ID
                    </p>
                  </div>
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

            <div className="absolute inset-0 bg-gray-200" style={{ top: showTopBar ? 96 : 28 }}>
                  <MapboxMap
                    warehouses={warehouses as any}
                    routes={[]}
                  >
                  
              {/* Rutas de vuelos */}
              {/* Rutas de vuelos */}
              {legend.routes && Object.keys(airportsByCode).length > 0 && filteredFlights.map((flight) => (
                <Source
                  key={`route-${flight.id}`}
                  id={`route-${flight.id}`}
                  type="geojson"
                  data={{
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'LineString',
                      coordinates: flight.route
                    }
                  }}
                >
                  <Layer
                    id={`route-layer-${flight.id}`}
                    type="line"
                    paint={{
                      'line-width': 2,
                      'line-color': getRouteColor(flight),
                      'line-dasharray': [2, 2],
                      'line-opacity': 0.6
                    }}
                  />
                </Source>
              ))
              }
                              {/* Vuelos en tiempo real (filtrados por origen) */}
                {legend.planes && filteredFlights.map((flight) => {
                const pc = getPlaneColorAndPct(flight);
                const fillColor = pc.color;

                // 1) posición del avión: SIEMPRE la que viene de la simulación
                const markerLng = flight.currentLng;
                const markerLat = flight.currentLat;

                // 2) Calcular ángulo de dirección del avión basado en su ruta
                let angle = 0;
                const coords = flight.route || [];

                if (
                  typeof markerLng === 'number' &&
                  typeof markerLat === 'number' &&
                  coords.length >= 2
                ) {
                  // Buscar el punto de la ruta más cercano a la posición actual
                  let nearestIndex = 0;
                  let minDist = Number.POSITIVE_INFINITY;

                  for (let i = 0; i < coords.length; i++) {
                    const [lng, lat] = coords[i];
                    const dx = lng - markerLng;
                    const dy = lat - markerLat;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < minDist) {
                      minDist = d2;
                      nearestIndex = i;
                    }
                  }

                  // Tomar el siguiente punto en la ruta como dirección
                  const nextIndex = Math.min(nearestIndex + 1, coords.length - 1);
                  const [targetLng, targetLat] = coords[nextIndex];

                  // Calcular bearing (dirección geográfica) entre posición actual y siguiente punto
                  // Fórmula: bearing = atan2(sin(Δλ)·cos(φ2), cos(φ1)·sin(φ2) − sin(φ1)·cos(φ2)·cos(Δλ))
                  const toRad = (deg: number) => (deg * Math.PI) / 180;
                  const toDeg = (rad: number) => (rad * 180) / Math.PI;

                  const lat1 = toRad(markerLat);
                  const lat2 = toRad(targetLat);
                  const dLng = toRad(targetLng - markerLng);

                  const y = Math.sin(dLng) * Math.cos(lat2);
                  const x = Math.cos(lat1) * Math.sin(lat2) - 
                           Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
                  
                  const bearingRad = Math.atan2(y, x);
                  const bearingDeg = toDeg(bearingRad);
                  
                  // Ajustar por orientación de la imagen del avión
                  // Bearing geográfico: 0° = Norte, 90° = Este
                  // Compensación: restamos 45° porque la imagen está rotada
                  angle = bearingDeg - 45;
                  
                  // Normalizar a rango [-180, 180) para SVG
                  if (angle > 180) angle -= 360;
                  if (angle <= -180) angle += 360;
                }

                return (
                  <Marker
                    key={flight.id}
                    longitude={markerLng}
                    latitude={markerLat}
                    anchor="center"
                  >
                    <div className="relative group">
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        className="drop-shadow-lg"
                      >
                        <path
                          d="M12.382 5.304L10.096 7.59l.006.02L11.838 14a.908.908 0 01-.211.794l-.573.573a.339.339 0 01-.566-.08l-2.348-4.25-.745-.746-1.97 1.97a3.311 3.311 0 01-.75.504l.44 1.447a.875.875 0 01-.199.79l-.175.176a.477.477 0 01-.672 0l-1.04-1.039-.018-.02-.788-.786-.02-.02-1.038-1.039a.477.477 0 010-.672l.176-.176a.875.875 0 01.79-.197l1.447.438a3.322 3.322 0 01.504-.75l1.97-1.97-.746-.744-4.25-2.348a.339.339 0 01-.08-.566l.573-.573a.909.909 0 01.794-.211l6.39 1.736.02.006 2.286-2.286c.37-.372 1.621-1.02 1.993-.65.37.372-.279 1.622-.65 1.993z"
                          fill={fillColor}
                          transform={`rotate(${angle} 12 12)`}
                        />
                      </svg>

                      {typeof pc.pct === 'number' && (
                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-12 bg-black/80 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap shadow-lg">
                          <div className="font-semibold text-center mb-1">{flight.flightCode || flight.id}</div>
                          <div className="text-[10px] text-gray-300">{flight.origin} → {flight.destination}</div>
                          <div className="text-[10px] mt-1 text-center border-t border-gray-600 pt-1">
                            {pc.current}/{pc.capacity} kg ({pc.pct.toFixed(0)}%)
                          </div>
                        </div>
                      )}
                    </div>
                  </Marker>
                );
              })}

              </MapboxMap>



              {/* Banner de planificación en progreso */}
                {planningStatus && (
                  <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="font-medium">{planningStatus}</span>
                  </div>
                )}

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

      {/* Modal de búsqueda */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header del modal */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Búsqueda en Simulación</h3>
              <button
                onClick={closeSearchModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 space-y-4">
              {/* Selector de tipo de búsqueda */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ¿Qué desea buscar?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="searchType"
                      value="order"
                      checked={searchType === 'order'}
                      onChange={(e) => setSearchType(e.target.value as 'order' | 'flight')}
                      className="w-4 h-4 text-[#FF6600]"
                    />
                    <span className="text-sm text-gray-700">Pedido / Envío / Producto</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="searchType"
                      value="flight"
                      checked={searchType === 'flight'}
                      onChange={(e) => setSearchType(e.target.value as 'order' | 'flight')}
                      className="w-4 h-4 text-[#FF6600]"
                    />
                    <span className="text-sm text-gray-700">Unidad de transporte / Vuelo</span>
                  </label>
                </div>
              </div>

              {/* Filtro de estado (solo para pedidos) */}
              {searchType === 'order' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estado del pedido
                  </label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value as 'planned' | 'delivered' | 'all')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                  >
                    <option value="all">Todos</option>
                    <option value="planned">Planificado</option>
                    <option value="delivered">Entregado</option>
                  </select>
                </div>
              )}

              {/* Campo de búsqueda */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Código / ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={searchType === 'order' ? 'Ej: ORD-12345' : 'Ej: FLT-001'}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                    autoFocus
                  />
                  <button
                    onClick={handleSearch}
                    disabled={!searchQuery.trim()}
                    className="px-6 py-2 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                  >
                    <Search className="w-4 h-4" />
                    Buscar
                  </button>
                </div>
              </div>

              {/* Resultados */}
              {hasSearched && (
                <div className="mt-6 p-4 border rounded-lg">
                  {searchError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      <p className="font-semibold">No se encontraron resultados</p>
                      <p className="text-sm mt-1">{searchError}</p>
                    </div>
                  )}

                  {searchResult && !searchError && (
                    <div className="space-y-4">
                      {searchResult.type === 'order' ? (
                        // Resultado de pedido
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
                            📦 Detalles del Pedido
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="font-semibold text-gray-700">ID del Pedido:</p>
                              <p className="text-gray-900 font-mono">{(searchResult.data as api.OrderSnapshot).orderId}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Estado:</p>
                              <p className={`font-semibold ${
                                (searchResult.data as api.OrderSnapshot).status === 'delivered' ? 'text-green-600' :
                                (searchResult.data as api.OrderSnapshot).status === 'in_transit' ? 'text-blue-600' :
                                'text-amber-600'
                              }`}>
                                {(searchResult.data as api.OrderSnapshot).status === 'delivered' ? 'Entregado' :
                                 (searchResult.data as api.OrderSnapshot).status === 'in_transit' ? 'En tránsito' :
                                 'Planificado'}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Cliente:</p>
                              <p className="text-gray-900">{(searchResult.data as api.OrderSnapshot).clientId}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Progreso:</p>
                              <p className="text-gray-900">{((searchResult.data as api.OrderSnapshot).progressPercentage).toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Destino:</p>
                              <p className="text-gray-900">{(searchResult.data as api.OrderSnapshot).destinationAirport}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Día / Hora simulado:</p>
                              <p className="text-gray-900">Día {(searchResult.data as api.OrderSnapshot).day}, {String((searchResult.data as api.OrderSnapshot).hour).padStart(2, '0')}:{String((searchResult.data as api.OrderSnapshot).minute).padStart(2, '0')}</p>
                            </div>
                            {(searchResult.data as api.OrderSnapshot).deliveryTime && (
                              <div className="col-span-2">
                                <p className="font-semibold text-gray-700">Hora de entrega:</p>
                                <p className="text-gray-900">{(searchResult.data as api.OrderSnapshot).deliveryTime}</p>
                              </div>
                            )}
                          </div>

                          {/* Buscar vuelo asignado */}
                          {(() => {
                            const assignedFlight = flights.find(f => 
                              f.packages && (searchResult.data as api.OrderSnapshot).destinationAirport === f.destination
                            );
                            return assignedFlight && (
                              <div className="mt-4 pt-4 border-t border-blue-300">
                                <h5 className="font-semibold text-blue-900 mb-2">✈️ Unidad de transporte asociada</h5>
                                <div className="bg-white rounded p-3 text-sm">
                                  <p><span className="font-semibold">ID de vuelo:</span> <span className="font-mono">{assignedFlight.id}</span></p>
                                  <p><span className="font-semibold">Código:</span> <span className="font-mono">{assignedFlight.flightCode}</span></p>
                                  <p><span className="font-semibold">Estado:</span> {assignedFlight.status}</p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        // Resultado de vuelo
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h4 className="text-lg font-bold text-green-900 mb-3 flex items-center gap-2">
                            ✈️ Detalles de la Unidad de Transporte
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="font-semibold text-gray-700">ID de vuelo:</p>
                              <p className="text-gray-900 font-mono">{(searchResult.data as api.Flight).id}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Código:</p>
                              <p className="text-gray-900 font-mono">{(searchResult.data as api.Flight).flightCode}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Origen:</p>
                              <p className="text-gray-900">{(searchResult.data as api.Flight).origin}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Destino:</p>
                              <p className="text-gray-900">{(searchResult.data as api.Flight).destination}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Estado:</p>
                              <p className={`font-semibold ${
                                (searchResult.data as api.Flight).status === 'landed' ? 'text-green-600' :
                                (searchResult.data as api.Flight).status === 'in_flight' ? 'text-blue-600' :
                                'text-gray-600'
                              }`}>
                                {(searchResult.data as api.Flight).status === 'landed' ? 'Aterrizado' :
                                 (searchResult.data as api.Flight).status === 'in_flight' ? 'En vuelo' :
                                 'Programado'}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Progreso:</p>
                              <p className="text-gray-900">{((searchResult.data as api.Flight).progressPercentage).toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Salida:</p>
                              <p className="text-gray-900">{(searchResult.data as api.Flight).departureTime}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Llegada:</p>
                              <p className="text-gray-900">{(searchResult.data as api.Flight).arrivalTime}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Capacidad:</p>
                              <p className="text-gray-900">{(searchResult.data as api.Flight).capacity} kg</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700">Paquetes:</p>
                              <p className="text-gray-900">{(searchResult.data as api.Flight).packages}</p>
                            </div>
                          </div>

                          {/* Pedidos asignados a este vuelo */}
                          {(() => {
                            const assignedOrders = [
                              ...activeOrders.filter(o => o.destinationAirport === (searchResult.data as api.Flight).destination),
                              ...recentlyDeliveredOrders.filter(o => o.destinationAirport === (searchResult.data as api.Flight).destination)
                            ];
                            return assignedOrders.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-green-300">
                                <h5 className="font-semibold text-green-900 mb-2">
                                  📦 Pedidos para este destino ({assignedOrders.length})
                                </h5>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {assignedOrders.map((order, idx) => (
                                    <div key={idx} className="bg-white rounded p-3 text-sm">
                                      <div className="grid grid-cols-2 gap-2">
                                        <p><span className="font-semibold">ID:</span> <span className="font-mono">{order.orderId}</span></p>
                                        <p><span className="font-semibold">Cliente:</span> {order.clientId}</p>
                                        <p className="col-span-2"><span className="font-semibold">Estado:</span> {
                                          order.status === 'delivered' ? '✓ Entregado' :
                                          order.status === 'in_transit' ? '→ En tránsito' :
                                          '⏳ Planificado'
                                        }</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end">
              <button
                onClick={closeSearchModal}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}