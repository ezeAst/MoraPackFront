import { useState, useEffect,useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, Bell, Globe, Play, Square, Calendar, Search, X } from 'lucide-react';
import { Marker } from 'react-map-gl';
import MapboxMap from '../components/MapboxMap';
import { getOperacionesStatus, startOperaciones, stopOperaciones } from '../services/apiOperaciones';
import type { OperacionesStatus } from '../types/operaciones';
import { cacheService } from '../services/cacheService';

type Status = 'normal' | 'warning' | 'critical';

type OutgoingFlight = {
  id: string;
  flightCode: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  packages: number;
  capacity: number;
  status: 'scheduled' | 'in_flight' | 'landed';
  occupancyPercentage: number;
};

type OutgoingOrder = {
  orderId: string;
  destination: string;
  flightCode: string;
  departureTime: string;
  weight: number;
  registeredTime: string;
};


type Warehouse = {
  name: string;
  codigo: string;
  lat: number;
  lng: number;
  status: Status;
  capacity?: number;
  current?: number;
  occupancyPercentage?: number;
  outgoingFlights?: OutgoingFlight[];
  outgoingOrders?: OutgoingOrder[];  // ✅ AGREGAR ESTA LÍNEA
};

type Route = {
  id: string;
  coordinates: [number, number][];
  color: string;
  progress?: number; // 0..1
};

// Hook para detectar colapso logístico
function useColapsoLogistico(pedidos: any[]) {
  const [showColapso, setShowColapso] = useState(false);
  const [pedidosColapso, setPedidosColapso] = useState<any[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Guardar timestamps de cuando un pedido entra en NO_ASIGNADO
  useEffect(() => {
    const now = Date.now();
    const noAsignados = pedidos.filter(p => p.estado === 'NO_ASIGNADO');
    let changed = false;

    const timestamps: Record<string, number> = JSON.parse(localStorage.getItem('noAsignadosTimestamps') || '{}');
    
    noAsignados.forEach(p => {
      if (!timestamps[p.id]) {
        timestamps[p.id] = now;
        changed = true;
      }
    });

    Object.keys(timestamps).forEach(id => {
      if (!noAsignados.find(p => String(p.id) === id)) {
        delete timestamps[id];
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem('noAsignadosTimestamps', JSON.stringify(timestamps));
    }
  }, [pedidos]);

  // Chequear colapso logístico cada 10 segundos
  useEffect(() => {
    function checkColapso() {
      const now = Date.now();
      const timestamps: Record<string, number> = JSON.parse(localStorage.getItem('noAsignadosTimestamps') || '{}');
      
      const LIMITE_MS = 5 * 60 * 1000; // 1 minuto
      
      const colapsados = pedidos.filter(p => {
        if (p.estado !== 'NO_ASIGNADO') return false;
        const timestamp = timestamps[p.id];
        if (!timestamp) return false;
        
        const tiempoTranscurrido = now - timestamp;
        return tiempoTranscurrido > LIMITE_MS;
      });

      if (colapsados.length > 0) {
        setShowColapso(true);
        setPedidosColapso(colapsados);
        
        localStorage.setItem('pedidosColapso', JSON.stringify(colapsados.map(p => ({
          id: p.id,
          destino: p.destino,
          cantidad: p.cantidad,
        }))));
        
        localStorage.setItem('colapsoLogistico', JSON.stringify({ ts: now }));
      } else {
        setShowColapso(false);
        setPedidosColapso([]);
        localStorage.removeItem('pedidosColapso');
      }
    }

    checkColapso();
    timerRef.current = setInterval(checkColapso, 10000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pedidos]);

  function cerrarColapso() {
    setShowColapso(false);
  }

  return { showColapso, pedidosColapso, cerrarColapso };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const highlightedWarehouse = new URLSearchParams(location.search).get('codigo');
  const highlightedFlight = new URLSearchParams(location.search).get('vuelo');
  
  // Estados de UI
  const [showStats, setShowStats] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);

  // Estados de búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'warehouse' | 'flight'>('warehouse');
  const [searchResult, setSearchResult] = useState<{
    type: 'warehouse' | 'flight';
    data: any | null;
  } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Estados de datos
  const [operacionesData, setOperacionesData] = useState<OperacionesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para control de operaciones
  const [fechaInicio, setFechaInicio] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [iniciando, setIniciando] = useState(false);
  const [deteniendo, setDeteniendo] = useState(false);

  // Estados de leyenda con filtros
  const [legend, setLegend] = useState({
    warehouses: true,
    planes: true,
    routes: true,
    planesGreen: true,
    planesYellow: true,
    planesRed: true,
  });

  // Estado para el reloj en tiempo real
  const [tiempoActual, setTiempoActual] = useState<string>('');
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState<string>('0d 0h 0m');
  
// Cargar pedidos para monitoreo de colapso
const [pedidosMonitoreo, setPedidosMonitoreo] = useState<any[]>([]);

useEffect(() => {
  async function cargarPedidos() {
    try {
      // Importar el servicio de API de planificación
      const { getPedidos } = await import('../services/apiPlanificacion');
      const pedidos = await getPedidos();
      setPedidosMonitoreo(pedidos || []);
    } catch (error) {
      console.error('Error cargando pedidos para monitoreo:', error);
    }
  }
  
  // Cargar inicialmente
  cargarPedidos();
  
  // Recargar cada 30 segundos
  const interval = setInterval(cargarPedidos, 30000);
  return () => clearInterval(interval);
}, []);

useColapsoLogistico(pedidosMonitoreo);

  // ==================== CARGA INICIAL ====================
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // ✅ OPTIMIZADO: Mostrar datos en caché inmediatamente (si existen) mientras carga nuevos
      const staleData = cacheService.getStale<OperacionesStatus>('operaciones-status');
      if (staleData) {
        console.log('📦 Mostrando datos en caché mientras carga...');
        setOperacionesData(staleData);
        setLoading(false); // ✅ Quitar spinner inmediatamente
      } else {
        setLoading(true);
      }
      
      // Cargar datos frescos (puede usar caché válido o hacer request)
      const status = await cacheService.getOrFetch(
        'operaciones-status',
        () => getOperacionesStatus(),
        30000 // ✅ 30 segundos de caché
      );
      
      setOperacionesData(status);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor');
      console.error('Error al cargar datos iniciales:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatearTiempoTranscurrido = (inicio: string, actual: string): string => {
    try {
      const inicioDate = new Date(inicio);
      const actualDate = new Date(actual);
      const diffMs = actualDate.getTime() - inicioDate.getTime();
      
      if (diffMs < 0) return '0d 0h 0m';
      
      const diffSeconds = Math.floor(diffMs / 1000);
      const days = Math.floor(diffSeconds / 86400);
      const hours = Math.floor((diffSeconds % 86400) / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);
      
      return `${days}d ${hours}h ${minutes}m`;
    } catch (e) {
      return '0d 0h 0m';
    }
  };

  // ==================== POLLING CADA 5 SEGUNDOS ====================
  useEffect(() => {
    // Polling solo si no hay error
    if (error) return;

    const interval = setInterval(async () => {
      try {
        // ✅ OPTIMIZADO: El polling siempre actualiza el caché
        // Esto hace que otros componentes también se beneficien de los datos frescos
        const status = await getOperacionesStatus();
        
        // Actualizar el caché con los nuevos datos
        cacheService.set('operaciones-status', status);
        
        setOperacionesData(status);
        setError(null);
      } catch (err: any) {
        console.error('Error en polling:', err);
        setError(err.message || 'Error de conexión');
      }
    }, 5000); // 5 segundos

    return () => clearInterval(interval);
  }, [error]);

  // ==================== RELOJ EN TIEMPO REAL ====================
  useEffect(() => {
    // Inicializar el tiempo actual cuando lleguen datos del backend
    if (operacionesData?.currentDateTime) {
      setTiempoActual(operacionesData.currentDateTime);
    }
  }, [operacionesData?.currentDateTime]);

  useEffect(() => {
    // Actualizar el reloj cada segundo
    const interval = setInterval(() => {
      if (operacionesData?.activo && operacionesData?.usandoTiempoSimulado && tiempoActual) {
        // Parsear la fecha actual y sumar 1 segundo
        const fecha = new Date(tiempoActual);
        fecha.setSeconds(fecha.getSeconds() + 1);
        
        // Formatear de vuelta al formato del backend
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        const hours = String(fecha.getHours()).padStart(2, '0');
        const minutes = String(fecha.getMinutes()).padStart(2, '0');
        const seconds = String(fecha.getSeconds()).padStart(2, '0');
        
        const nuevoTiempo = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        setTiempoActual(nuevoTiempo);
        if (operacionesData.inicioOperaciones) {
          setTiempoTranscurrido(formatearTiempoTranscurrido(operacionesData.inicioOperaciones, nuevoTiempo));
        }
      }
    }, 1000); // 1 segundo

    return () => clearInterval(interval);
  }, [operacionesData?.activo, operacionesData?.usandoTiempoSimulado, tiempoActual]);

  // ==================== CONTROL DE OPERACIONES ====================
  
  /**
   * Inicia las operaciones con la fecha/hora configurada
   */
  const handleIniciarOperaciones = async () => {
    if (!fechaInicio || !horaInicio) {
      return;
    }

    try {
      setIniciando(true);
      
      // Asegurar que horaInicio tiene formato HH:mm
      let horaFormateada = horaInicio;
      if (horaInicio.length === 5) {
        // Ya está en formato HH:mm
        horaFormateada = horaInicio;
      } else if (horaInicio.length === 4) {
        // Formato H:mm, agregar cero
        horaFormateada = '0' + horaInicio;
      }
      
      // Formato ISO: YYYY-MM-DDTHH:mm:ss
      const fechaHoraISO = `${fechaInicio}T${horaFormateada}:00`;
      
      console.log('📅 Fecha de inicio:', fechaInicio);
      console.log('🕐 Hora de inicio:', horaFormateada);
      console.log('📝 Fecha/Hora ISO:', fechaHoraISO);
      
      const response = await startOperaciones(fechaHoraISO);
      
      console.log('✅ Response del backend:', response);
      
      setShowStartModal(false);
      
      // ✅ OPTIMIZADO: Invalidar caché antes de recargar para obtener datos frescos
      cacheService.invalidate('operaciones-status');
      
      // Actualizar el estado inmediatamente
      await loadInitialData();
      
    } catch (error: any) {
      console.error('❌ Error completo:', error);
    } finally {
      setIniciando(false);
    }
  };

  /**
   * Abre el modal de confirmación para detener operaciones
   */
  const handleDetenerOperaciones = () => {
    setShowStopModal(true);
  };

  /**
   * Detiene las operaciones SIN descargar reporte
   */
  const confirmarDetenerSinReporte = async () => {
    try {
      setDeteniendo(true);
      setShowStopModal(false);
      
      await stopOperaciones();
      
      cacheService.invalidate('operaciones-status');
      await loadInitialData();
      
    } catch (error: any) {
      console.error('Error al detener operaciones:', error);
    } finally {
      setDeteniendo(false);
    }
  };

  /**
   * Detiene las operaciones Y descarga el reporte
   */
  const confirmarDetenerConReporte = async () => {
    try {
      setDeteniendo(true);
      setShowStopModal(false);
      
      // Primero descargar el reporte
      const { descargarReporteCierre } = await import('../services/apiOperaciones');
      await descargarReporteCierre();
      
      // Luego detener operaciones
      await stopOperaciones();
      
      cacheService.invalidate('operaciones-status');
      await loadInitialData();
      
    } catch (error: any) {
      console.error('Error al detener operaciones con reporte:', error);
      alert('Error al generar el reporte. Las operaciones se detendrán de todos modos.');
      
      try {
        await stopOperaciones();
        cacheService.invalidate('operaciones-status');
        await loadInitialData();
      } catch (e: any) {
        console.error('Error al detener operaciones:', e);
      }
    } finally {
      setDeteniendo(false);
    }
  };

  /**
   * Realiza la búsqueda de almacenes o vuelos
   */
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

    if (!operacionesData) {
      setSearchError('No hay datos cargados');
      return;
    }

    if (searchType === 'warehouse') {
      // Buscar en almacenes
      const found = operacionesData.almacenes?.find(warehouse =>
        warehouse.codigo.toUpperCase().includes(query) ||
        warehouse.nombre.toUpperCase().includes(query)
      );

      if (found) {
        setSearchResult({
          type: 'warehouse',
          data: found
        });
      } else {
        setSearchError(`No se encontró ningún almacén con código/nombre que contenga "${searchQuery}"`);
      }
    } else if (searchType === 'flight') {
      // Buscar en vuelos activos
      const found = operacionesData.vuelosActivos?.find(flight =>
        flight.id.toUpperCase().includes(query) ||
        flight.flightCode.toUpperCase().includes(query)
      );

      if (found) {
        setSearchResult({
          type: 'flight',
          data: found
        });
      } else {
        setSearchError(`No se encontró ningún vuelo activo con ID/código que contenga "${searchQuery}"`);
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

  /**
   * Abre el modal con valores por defecto (fecha actual + 1 hora)
   */
  const handleAbrirModalInicio = () => {
    const ahora = new Date();
    ahora.setHours(ahora.getHours() + 1); // Sumar 1 hora
    
    const fecha = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
    const hora = ahora.toTimeString().substring(0, 5); // HH:mm
    
    setFechaInicio(fecha);
    setHoraInicio(hora);
    setShowStartModal(true);
  };

  /**
   * Maneja el click en un almacén del mapa
   * Navega a la página de almacenes con el código como filtro
   */
  const handleWarehouseClick = (codigoAlmacen: string) => {
    navigate(`/almacenes?codigo=${codigoAlmacen}`);
  };

  /**
   * Maneja el click en un avión del mapa
   * Navega a la página de vuelos con el código de vuelo como filtro
   */
  const handlePlaneClick = (flightCode: string) => {
    navigate(`/vuelos?vuelo=${flightCode}`);
  };

  // ==================== CÁLCULO DE ROTACIÓN DE AVIONES ====================
  /**
   * Calcula el bearing (dirección geográfica) entre la posición actual del avión
   * y su destino para rotarlo correctamente
   * Copiado de Simulacion.tsx
   */
  const calculateRotation = (currentLat: number, currentLng: number, destinationLat: number, destinationLng: number): number => {
    // Fórmula: bearing = atan2(sin(Δλ)·cos(φ2), cos(φ1)·sin(φ2) − sin(φ1)·cos(φ2)·cos(Δλ))
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    const lat1 = toRad(currentLat);
    const lat2 = toRad(destinationLat);
    const dLng = toRad(destinationLng - currentLng);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - 
             Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    
    const bearingRad = Math.atan2(y, x);
    const bearingDeg = toDeg(bearingRad);
    
    // Ajustar por orientación de la imagen del avión
    // Bearing geográfico: 0° = Norte, 90° = Este
    // Compensación: restamos 45° porque la imagen está rotada
    let angle = bearingDeg - 45;
    
    // Normalizar a rango [-180, 180) para SVG
    if (angle > 180) angle -= 360;
    if (angle <= -180) angle += 360;
    
    return angle;
  };

  // ==================== PREPARACIÓN DE DATOS PARA EL MAPA ====================
  // Helpers de ocupación de aviones (misma lógica que Simulación Semanal)
  const getPlaneCapacityInfo = (v: any) => {
    const capacity = v.capacity ?? v.maxCapacity ?? 0;
    const current = v.packages ?? v.current ?? v.load ?? 0;
    return { current: Number(current) || 0, capacity: Number(capacity) || 0 };
  };

  const getCapacityColor = (pct: number) => {
    if (pct < 70) return '#22c55e'; // verde
    if (pct <= 90) return '#eab308'; // amarillo
    return '#ef4444'; // rojo
  };

  const getPlaneColorAndPct = (v: any) => {
    const { current, capacity } = getPlaneCapacityInfo(v);
    if (capacity > 0) {
      const pct = (current / capacity) * 100;
      return { color: getCapacityColor(pct), pct, current, capacity };
    }
    return { color: '#3b82f6', pct: undefined as number | undefined, current: undefined as number | undefined, capacity: undefined as number | undefined };
  };
  
  /**
   * Determina el color de la ruta según la ciudad de origen
   */
  const getRouteColorByOrigin = (originName: string): string => {
    const origin = originName.toLowerCase();
    
    // Ciudades de América (Celeste)
    const americaCities = ['lima', 'caracas', 'quito', 'brasilia', 'santiago', 'bogota', 'buenos aires', 'sao paulo'];
    if (americaCities.some(city => origin.includes(city))) {
      return '#00CFFF'; // Celeste
    }
    
    // Ciudades de Europa (Morado)
    const europeCities = ['bruselas', 'sofia', 'copenhague', 'viena', 'roma', 'madrid', 'lisboa', 'londres', 'amsterdam', 'frankfurt', 'paris', 'moscu', 'san petersburgo'];
    if (europeCities.some(city => origin.includes(city))) {
      return '#6F42C1'; // Morado
    }
    
    // Ciudades de Asia (Naranja)
    const asiaCities = ['baku', 'beijing', 'shanghai', 'kunming', 'delhi', 'tokyo'];
    if (asiaCities.some(city => origin.includes(city))) {
      return '#FF7A00'; // Naranja
    }
    
    // Fallback: morado
    return '#6F42C1';
  };
  
  // Almacenes: convertir de Almacen[] a Warehouse[]
  const warehousesForMap: Warehouse[] = operacionesData?.almacenes.map(a => ({
    name: a.nombre,
    codigo: a.codigo,
    lat: a.lat,
    lng: a.lon,
    status: a.status as Status,
    capacity: a.capacidad,
    current: a.capacidadActual,
    occupancyPercentage: a.ocupacion,
    outgoingFlights: a.outgoingFlights, // ✅ Próximos vuelos desde este almacén
    outgoingOrders: a.outgoingOrders,   // ✅ AGREGAR ESTA LÍNEA
  })) || [];

  // Rutas: crear líneas entre origen y destino de cada vuelo
  // Colores según continente de origen
  const routesForMap: Route[] = operacionesData?.vuelosActivos
    .filter(v => v.status === 'EN_VUELO') // Solo vuelos en el aire
    .map(v => {
      const color = getRouteColorByOrigin(v.origin);
      console.log(`🛩️ Vuelo ${v.flightCode}:`);
      console.log(`   - Origen: "${v.origin}" (primer char: "${v.origin[0]}")`);
      console.log(`   - Destino: "${v.destination}"`);
      console.log(`   - Color asignado: ${color}`);
      console.log(`   - Route coords:`, v.route);
      console.log(`   - Route length:`, v.route?.length);
      console.log(`   - Progress:`, v.progressPercentage);
      
      // Calcular progress y clampearlo entre 0 y 1
      let progressValue = undefined;
      if (typeof v.progressPercentage === 'number') {
        // El backend puede enviar valores en diferentes rangos:
        // - 0-1: Usar directamente
        // - 0-100: Dividir entre 100
        // - > 100: Bug del backend, clampear a 1
        let rawProgress = v.progressPercentage;
        
        // Si es mayor a 100, es definitivamente un porcentaje mal calculado
        if (rawProgress > 100) {
          console.warn(`⚠️ Progress > 100 detectado (${rawProgress}), clampeando a 100`);
          rawProgress = 100;
        }
        
        // Si está entre 1-100, asumir que es porcentaje
        if (rawProgress > 1) {
          rawProgress = rawProgress / 100;
        }
        
        // Clampear entre 0 y 1 por seguridad
        progressValue = Math.max(0, Math.min(1, rawProgress));
        console.log(`   - Progress calculado (0-1):`, progressValue);
      }
      
      return {
        id: v.id,
        coordinates: v.route,
        color: color,
        progress: progressValue,
      };
    }) || [];

  // Log de TODAS las rutas generadas
  console.log('📊 TOTAL RUTAS GENERADAS:', routesForMap.length);
  console.log('📋 RUTAS COMPLETAS:', routesForMap);

  // Log resumen de todos los orígenes únicos
  if (operacionesData?.vuelosActivos && operacionesData.vuelosActivos.length > 0) {
    const origenes = [...new Set(operacionesData.vuelosActivos.map(v => v.origin))];
    console.log('📍 TODOS LOS ORÍGENES ÚNICOS:', origenes);
  }

  // Estadísticas
  const stats = operacionesData ? [
    { label: 'Vuelos activos', value: operacionesData.vuelosActivos.filter(v => v.status === 'EN_VUELO').length.toString() },
    { label: 'Paquetes en tránsito', value: operacionesData.metricas.pedidosEnTransito.toString() },
    { label: 'Entregas pendientes', value: operacionesData.metricas.pedidosAsignados.toString() },
    { label: 'Pedidos entregados', value: operacionesData.metricas.pedidosEntregados.toString() },
  ] : [];

  // Estado de la flota (ocupación total) similar a Simulación Semanal
  const fleet = (() => {
    const active = operacionesData?.vuelosActivos?.filter(v => v.status === 'EN_VUELO') || [];
    const totalCapacity = active.reduce((sum, v) => sum + (Number(v.capacity) || 0), 0);
    const totalCurrent = active.reduce((sum, v) => sum + (Number(v.packages) || 0), 0);
    const occupancy = totalCapacity > 0 ? (totalCurrent / totalCapacity) * 100 : 0;
    let color = '#22c55e';
    let statusText = '< 70% capacidad';
    if (occupancy >= 90) { color = '#ef4444'; statusText = '> 90% capacidad'; }
    else if (occupancy >= 70) { color = '#eab308'; statusText = '70–90% capacidad'; }
    return { activeCount: active.length, totalCapacity, totalCurrent, occupancy, color, statusText };
  })();

  // Eventos recientes (últimos 5)
  const alerts = operacionesData?.eventosRecientes.slice(0, 5).map(evento => {
    // Determinar color según el tipo de evento
    let color = 'bg-blue-50 border-blue-200';
    if (evento.includes('despegará') || evento.includes('🛫')) {
      color = 'bg-yellow-50 border-yellow-200';
    } else if (evento.includes('crítico') || evento.includes('95%')) {
      color = 'bg-red-50 border-red-200';
    } else if (evento.includes('entregado') || evento.includes('✅')) {
      color = 'bg-green-50 border-green-200';
    }
    
    return { message: evento, color };
  }) || [];

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF6600] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Cargando operaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modal de Búsqueda */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header del modal */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Búsqueda en Operaciones</h3>
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
                      value="warehouse"
                      checked={searchType === 'warehouse'}
                      onChange={(e) => setSearchType(e.target.value as 'warehouse' | 'flight')}
                      className="w-4 h-4 text-[#FF6600]"
                    />
                    <span className="text-sm text-gray-700">Almacén</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="searchType"
                      value="flight"
                      checked={searchType === 'flight'}
                      onChange={(e) => setSearchType(e.target.value as 'warehouse' | 'flight')}
                      className="w-4 h-4 text-[#FF6600]"
                    />
                    <span className="text-sm text-gray-700">Vuelo Activo</span>
                  </label>
                </div>
              </div>

              {/* Campo de búsqueda */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {searchType === 'warehouse' ? 'Código/Nombre del Almacén' : 'ID/Código del Vuelo'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    autoFocus
                    placeholder="Ingrese el valor a buscar..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                  />
                  <button
                    onClick={handleSearch}
                    className="px-6 py-2 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium"
                  >
                    Buscar
                  </button>
                </div>
              </div>

              {/* Errores y Resultados */}
              {searchError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {searchError}
                </div>
              )}

              {searchResult && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  {searchType === 'warehouse' && searchResult.data && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-green-900">Almacén encontrado:</h4>
                      <p><span className="font-semibold">Código:</span> {searchResult.data.codigo}</p>
                      <p><span className="font-semibold">Nombre:</span> {searchResult.data.nombre}</p>
                      <p><span className="font-semibold">Ocupación:</span> {searchResult.data.ocupacion}%</p>
                      <p><span className="font-semibold">Estado:</span> {searchResult.data.status}</p>
                      <p><span className="font-semibold">Capacidad actual:</span> {searchResult.data.capacidadActual}/{searchResult.data.capacidad}</p>
                      <p><span className="font-semibold">Ubicación:</span> ({searchResult.data.lat}, {searchResult.data.lon})</p>
                    </div>
                  )}
                  {searchType === 'flight' && searchResult.data && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-green-900">Vuelo encontrado:</h4>
                      <p><span className="font-semibold">ID:</span> {searchResult.data.id}</p>
                      <p><span className="font-semibold">Código:</span> {searchResult.data.flightCode}</p>
                      <p><span className="font-semibold">Ruta:</span> {searchResult.data.origin} → {searchResult.data.destination}</p>
                      <p><span className="font-semibold">Salida:</span> {searchResult.data.departureTime}</p>
                      <p><span className="font-semibold">Llegada:</span> {searchResult.data.arrivalTime}</p>
                      <p><span className="font-semibold">Carga:</span> {searchResult.data.packages} kg de {searchResult.data.capacity} kg</p>
                      <p><span className="font-semibold">Progreso:</span> {searchResult.data.progressPercentage}%</p>
                      <p><span className="font-semibold">Estado:</span> {searchResult.data.statusLabel}</p>
                    </div>
                  )}
                </div>
              )}

              {!hasSearched && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                  Ingrese un criterio de búsqueda y presione Enter o haga clic en Buscar
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuración de Inicio */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="w-8 h-8 text-[#FF6600]" />
              <h2 className="text-2xl font-bold text-gray-800">Configurar Inicio de Operaciones</h2>
            </div>
            
            <p className="text-gray-600 mb-6">
              Define la fecha y hora desde la cual comenzará la simulación de operaciones.
            </p>

            <div className="space-y-5">
              {/* Fecha */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Fecha de Inicio
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent text-lg"
                  required
                />
              </div>

              {/* Hora */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Hora de Inicio
                </label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent text-lg"
                  required
                />
              </div>

              {/* Información adicional */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> El sistema utilizará esta fecha/hora como punto de partida para la simulación. 
                  El tiempo avanzará automáticamente a partir de este momento.
                </p>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowStartModal(false)}
                disabled={iniciando}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleIniciarOperaciones}
                disabled={iniciando || !fechaInicio || !horaInicio}
                className="flex-1 px-6 py-3 bg-[#FF6600] text-white rounded-lg font-semibold hover:bg-[#e55a00] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {iniciando ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Iniciar Simulación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Detener Operaciones */}
      {showStopModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
            <div className="flex items-center gap-3 mb-6">
              <Square className="w-8 h-8 text-red-600" />
              <h2 className="text-2xl font-bold text-gray-800">Detener Operaciones</h2>
            </div>
            
            <p className="text-gray-600 mb-6">
              Estás a punto de detener todas las operaciones del sistema. 
              ¿Deseas generar un reporte con los pedidos y rutas antes de detener?
            </p>

            {/* Información del reporte */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-900 mb-2">
                <strong>📊 El reporte incluirá:</strong>
              </p>
              <ul className="text-sm text-amber-800 list-disc list-inside space-y-1">
                <li>Todos los pedidos registrados</li>
                <li>Estado de cada pedido</li>
                <li>Rutas asignadas con sus tramos</li>
                <li>Vuelos programados (origen, destino, horarios)</li>
              </ul>
            </div>

            {/* Botones */}
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmarDetenerConReporte}
                disabled={deteniendo}
                className="w-full px-6 py-3 bg-[#FF6600] text-white rounded-lg font-semibold hover:bg-[#e55a00] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deteniendo ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generando reporte...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar Reporte y Detener
                  </>
                )}
              </button>
              
              <button
                onClick={confirmarDetenerSinReporte}
                disabled={deteniendo}
                className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Square className="w-5 h-5" />
                Detener Sin Reporte
              </button>

              <button
                onClick={() => setShowStopModal(false)}
                disabled={deteniendo}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#FF6600] text-white px-6 py-2 flex flex-col lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-xl font-bold">Panel de Operaciones Globales</h1>

        {(operacionesData?.usandoTiempoSimulado && tiempoActual) ? (
          <div className="flex items-center gap-3 flex-wrap mt-0.5">
            <div className="bg-white/20 rounded px-2 py-1">
              <p className="text-[10px] font-semibold opacity-90">Tiempo simulado</p>
              <p className="text-sm font-bold m-0">⏰ {tiempoActual}</p>
            </div>

            {operacionesData?.activo && operacionesData.inicioOperaciones && (
              <div className="bg-purple-500/40 rounded px-2 py-1">
                <p className="text-[10px] font-semibold opacity-90">Transcurrido</p>
                <p className="text-sm font-bold m-0">📊 {tiempoTranscurrido}</p>
              </div>
            )}

            <p className="text-sm m-0 font-bold">
              {operacionesData?.activo
                ? `🟢 Activo desde ${operacionesData.inicioOperaciones}`
                : '⚪ Esperando inicio de operaciones...'}
            </p>
          </div>
        ) : (
          <p className="text-sm mt-0.5 opacity-75">
            {operacionesData?.activo
              ? `🟢 Activo desde ${operacionesData.inicioOperaciones}`
              : '⚪ Esperando inicio de operaciones...'}
          </p>
        )}
      </div>

        <div className="flex gap-3 mt-4 lg:mt-0 flex-wrap">
          {/* Botón Iniciar/Detener Operaciones */}
          {!operacionesData?.activo ? (
            <button
              onClick={handleAbrirModalInicio}
              disabled={iniciando}
              className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium shadow hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {iniciando ? 'Iniciando...' : 'Iniciar Operaciones'}
            </button>
          ) : (
            <button
              onClick={handleDetenerOperaciones}
              disabled={deteniendo}
              className="bg-red-600 text-white px-5 py-2.5 rounded-lg font-medium shadow hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              {deteniendo ? 'Deteniendo...' : 'Detener Operaciones'}
            </button>
          )}
          
          {/* Botones de UI */}
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
          {/* Toggle Leyenda en header para hacerlo más visible */}
          <button
            onClick={() => setShowLegend(s => !s)}
            className="bg-white text-[#FF6600] px-4 py-2 rounded-lg font-medium shadow hover:bg-gray-100"
          >
            {showLegend ? 'Ocultar leyenda' : 'Mostrar leyenda'}
          </button>
          {/* Botón de Búsqueda */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="bg-[#FF6600] text-white px-4 py-2 rounded-lg font-medium shadow hover:bg-[#e55d00] flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Buscar
          </button>
        </div>
      </div>

      {/* Error de conexión */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-6 mt-4">
          <div className="flex items-center">
            <p className="text-red-700">
              <span className="font-bold">Error de conexión:</span> {error}
            </p>
            <button 
              onClick={loadInitialData}
              className="ml-auto px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Contenedor principal */}
      <div className="mx-auto p-0">
        <div className="relative bg-white shadow-lg overflow-hidden">
          {/* Mapa: ocupar todo el alto disponible menos el header */}
          <div className="relative h-[calc(100vh-97px)] bg-gray-200">
            {/* Mapa Mapbox */}
            <MapboxMap 
              warehouses={legend.warehouses ? warehousesForMap : []} 
              routes={legend.routes ? routesForMap : []}
              highlightedWarehouse={highlightedWarehouse || undefined}
              highlightedFlight={highlightedFlight || undefined}
              onWarehouseClick={handleWarehouseClick}
            >
              {/* AVIONES EN MOVIMIENTO */}
              {legend.planes && operacionesData?.vuelosActivos
                .filter(v => v.status === 'EN_VUELO')
                .map(vuelo => {
                  const pc = getPlaneColorAndPct(vuelo);
                  const color = pc.color;
                  // Filtrado por categoría de ocupación
                  let passesFilter = true;
                  if (typeof pc.pct === 'number') {
                    if (pc.pct < 70) passesFilter = legend.planesGreen;
                    else if (pc.pct <= 90) passesFilter = legend.planesYellow;
                    else passesFilter = legend.planesRed;
                  }
                  if (!passesFilter) return null;
                  // Calcular rotación usando posición actual y destino
                  const [, destCoords] = vuelo.route;
                  const rotation = calculateRotation(
                    vuelo.currentLat,
                    vuelo.currentLng,
                    destCoords[1], // destination latitude
                    destCoords[0]  // destination longitude
                  );
                  
                  return (
                    <Marker
                      key={vuelo.id}
                      longitude={vuelo.currentLng}
                      latitude={vuelo.currentLat}
                        style={{
    zIndex: 100  // ✅ Los aviones siempre por encima de almacenes normales (z:1)
  }}
                    >
                      <div 
                        className="relative group cursor-pointer"
                        onClick={() => handlePlaneClick(vuelo.flightCode)}
                      >
                        {/* ETIQUETA DESTACADA PARA VUELO SELECCIONADO */}
                        {highlightedFlight === vuelo.flightCode && (
                          <div 
                            className="absolute -top-20 left-1/2 transform -translate-x-1/2 z-50"
                            style={{ pointerEvents: 'none' }}
                          >
                            <div className="flex flex-col items-center animate-bounce">
                              <div className="bg-[#FF6600] text-white px-4 py-2 rounded-lg shadow-2xl font-bold text-base whitespace-nowrap mb-1 border-2 border-white">
                                ✈️ {vuelo.flightCode}
                              </div>
                              <div 
                                className="w-0 h-0" 
                                style={{
                                  borderLeft: '12px solid transparent',
                                  borderRight: '12px solid transparent',
                                  borderTop: '12px solid #FF6600'
                                }}
                              ></div>
                            </div>
                          </div>
                        )}
                        
                        {/* SVG del avión con rotación */}
                        <svg 
                          width={highlightedFlight === vuelo.flightCode ? "42" : "28"} 
                          height={highlightedFlight === vuelo.flightCode ? "42" : "28"} 
                          viewBox="0 0 24 24" 
                          className={highlightedFlight === vuelo.flightCode ? "drop-shadow-2xl" : "drop-shadow-lg"}
                          style={{ 
                            filter: highlightedFlight === vuelo.flightCode ? 'drop-shadow(0 0 8px rgba(255, 102, 0, 0.8))' : 'none'
                          }}
                        >
                          <path 
                            d="M12.382 5.304L10.096 7.59l.006.02L11.838 14a.908.908 0 01-.211.794l-.573.573a.339.339 0 01-.566-.08l-2.348-4.25-.745-.746-1.97 1.97a3.311 3.311 0 01-.75.504l.44 1.447a.875.875 0 01-.199.79l-.175.176a.477.477 0 01-.672 0l-1.04-1.039-.018-.02-.788-.786-.02-.02-1.038-1.039a.477.477 0 010-.672l.176-.176a.875.875 0 01.79-.197l1.447.438a3.322 3.322 0 01.504-.75l1.97-1.97-.746-.744-4.25-2.348a.339.339 0 01-.08-.566l.573-.573a.909.909 0 01.794-.211l6.39 1.736.02.006 2.286-2.286c.37-.372 1.621-1.02 1.993-.65.37.372-.279 1.622-.65 1.993z" 
                            fill={color}
                            transform={`rotate(${rotation} 12 12)`}
                          />
                        </svg>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 min-w-[200px] max-w-[280px]">
                          <div className="font-semibold text-center mb-1">{vuelo.flightCode}</div>
                          <div className="text-center text-[10px] text-gray-300">{vuelo.origin} → {vuelo.destination}</div>
                          <div className="text-center mt-1 border-t border-gray-600 pt-1">Progreso: {Math.round(vuelo.progressPercentage)}%</div>
                          <div className="text-center text-[10px]">Paquetes: {vuelo.packages}/{vuelo.capacity}{typeof pc.pct === 'number' ? ` (${pc.pct.toFixed(0)}%)` : ''}</div>
                          
                          {/* Lista de pedidos en el vuelo - máximo 5 con detalles */}
                          {vuelo.orders && vuelo.orders.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-600">
                              <div className="text-[10px] text-gray-400 mb-1 text-center">
                                Pedidos ({Math.min(vuelo.orders.length, 5)}{vuelo.orders.length > 5 ? '+' : ''})
                              </div>
                              <div className="space-y-0.5 text-[10px]">
                                {vuelo.orders.slice(0, 5).map((order: any, idx: number) => (
                                  <div key={idx} className="text-gray-300 text-left px-1">
                                    <span className="font-mono">#{order.id}</span>
                                    <span className="text-gray-400 mx-1">→</span>
                                    <span>{order.destino || 'N/A'}</span>
                                    <span className="text-gray-400 mx-1">•</span>
                                    <span className="text-yellow-300">{order.cantidad}kg</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Marker>
                  );
                })}
            </MapboxMap>

            {/* Botón de Leyenda (inferior izquierda) */}
            <div className="absolute left-3 bottom-3 z-30">
              <div className="relative">
                <button
                  onClick={() => setShowLegend(s => !s)}
                  className="flex items-center justify-center rounded-full w-10 h-10 bg-white/90 shadow border hover:bg-white"
                  aria-label="Alternar leyenda"
                  title="Leyenda"
                >
                  <Globe size={18} />
                </button>

                {/* Panel de Leyenda (aparece por encima del botón) */}
                {showLegend && (
                  <div className="absolute bottom-12 left-0 p-3 rounded-xl bg-white/95 shadow border min-w-[260px] max-h-[70vh] overflow-y-auto">
                  {/* Capacidad de almacenes */}
                  <div className="text-xs font-semibold mb-2">Capacidad de almacenes</div>
                  <ul className="text-sm space-y-1 mb-3">
                    <li className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-green-600"></span>
                      <span>{'< 70% capacidad (Normal)'}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-yellow-600"></span>
                      <span>{'70–90% capacidad (Alerta)'}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-red-600"></span>
                      <span>{'> 90% capacidad (Crítico)'}</span>
                    </li>
                  </ul>

                  {/* Estado de vuelos por ocupación */}
                  <div className="text-xs font-semibold mb-2">Aviones por ocupación</div>
                  <ul className="text-sm space-y-1 mb-3">
                    <li className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path d="M12.382 5.304L10.096 7.59l.006.02L11.838 14a.908.908 0 01-.211.794l-.573.573a.339.339 0 01-.566-.08l-2.348-4.25-.745-.746-1.97 1.97a.311 3.311 0 01-.75.504l.44 1.447a.875.875 0 01-.199.79l-.175.176a.477.477 0 01-.672 0l-1.04-1.039-.018-.02-.788-.786-.02-.02-1.038-1.039a.477.477 0 010-.672l.176-.176a.875.875 0 01.79-.197l1.447.438a.322 3.322 0 01.504-.75l1.97-1.97-.746-.744-4.25-2.348a.339.339 0 01-.08-.566l.573-.573a.909.909 0 01.794-.211l6.39 1.736.02.006 2.286-2.286c.37-.372 1.621-1.02 1.993-.65.37.372-.279 1.622-.65 1.993z" fill="#22c55e"/>
                      </svg>
                      <span>Verde: {'< 70% ocupación'}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path d="M12.382 5.304L10.096 7.59l.006.02L11.838 14a.908.908 0 01-.211.794l-.573.573a.339.339 0 01-.566-.08l-2.348-4.25-.745-.746-1.97 1.97a.311 3.311 0 01-.75.504l.44 1.447a.875.875 0 01-.199.79l-.175.176a.477.477 0 01-.672 0l-1.04-1.039-.018-.02-.788-.786-.02-.02-1.038-1.039a.477.477 0 010-.672l.176-.176a.875.875 0 01.79-.197l1.447.438a.322 3.322 0 01.504-.75l1.97-1.97-.746-.744-4.25-2.348a.339.339 0 01-.08-.566l.573-.573a.909.909 0 01.794-.211l6.39 1.736.02.006 2.286-2.286c.37-.372 1.621-1.02 1.993-.65.37.372-.279 1.622-.65 1.993z" fill="#eab308"/>
                      </svg>
                      <span>Amarillo: {'70–90% ocupación'}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path d="M12.382 5.304L10.096 7.59l.006.02L11.838 14a.908.908 0 01-.211.794l-.573.573a.339.339 0 01-.566-.08l-2.348-4.25-.745-.746-1.97 1.97a.311 3.311 0 01-.75.504l.44 1.447a.875.875 0 01-.199.79l-.175.176a.477.477 0 01-.672 0l-1.04-1.039-.018-.02-.788-.786-.02-.02-1.038-1.039a.477.477 0 010-.672l.176-.176a.875.875 0 01.79-.197l1.447.438a.322 3.322 0 01.504-.75l1.97-1.97-.746-.744-4.25-2.348a.339.339 0 01-.08-.566l.573-.573a.909.909 0 01.794-.211l6.39 1.736.02.006 2.286-2.286c.37-.372 1.621-1.02 1.993-.65.37.372-.279 1.622-.65 1.993z" fill="#ef4444"/>
                      </svg>
                      <span>Rojo: {'> 90% ocupación'}</span>
                    </li>
                  </ul>

                  {/* Rutas por continente */}
                  <div className="text-xs font-semibold mb-2">Rutas por continente</div>
                  <ul className="text-sm space-y-1 mb-3">
                    <li className="flex items-center gap-2">
                      <div className="w-8 h-0.5 border-t-2 border-dashed" style={{ borderColor: '#00CFFF' }}></div>
                      <span>América</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-8 h-0.5 border-t-2 border-dashed" style={{ borderColor: '#6F42C1' }}></div>
                      <span>Europa</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-8 h-0.5 border-t-2 border-dashed" style={{ borderColor: '#FF7A00' }}></div>
                      <span>Asia</span>
                    </li>
                  </ul>

                  {/* Filtros de visibilidad */}
                  <div className="text-xs font-semibold mb-2 border-t pt-3">Mostrar en mapa</div>
                  <div className="flex flex-col gap-2 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={legend.warehouses}
                        onChange={e => setLegend(s => ({...s, warehouses: e.target.checked}))}
                        className="w-4 h-4"
                      />
                      <span>Almacenes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={legend.planes}
                        onChange={e => setLegend(s => ({...s, planes: e.target.checked}))}
                        className="w-4 h-4"
                      />
                      <span>Aviones</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={legend.routes}
                        onChange={e => setLegend(s => ({...s, routes: e.target.checked}))}
                        className="w-4 h-4"
                      />
                      <span>Rutas</span>
                    </label>
                  </div>
                  </div>
                )}
              </div>
            </div>

            {/* Overlays derecha: Estadísticas y Alertas */}
            <div className="pointer-events-none absolute inset-0 z-30">
              <div className="absolute right-6 top-6 flex flex-col gap-4 pointer-events-auto">
                {/* Panel de Estadísticas */}
                {showStats && operacionesData && (
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
                      {/* Estado de la flota */}
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-700 font-semibold text-sm">Ocupación total de la flota</span>
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full" style={{ background: fleet.color }} />
                            <span className="text-lg font-bold text-gray-900">{fleet.occupancy.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(fleet.occupancy, 100)}%`, background: fleet.color }}
                          />
                        </div>
                        {/* Resumen detallado retirado para evitar duplicidad de información */}
                      </div>
                    </div>
                  </div>
                )}

                {/* Panel de Alertas */}
                {showAlerts && alerts.length > 0 && (
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
          </div>
        </div>
      </div>
    </div>
  );
}