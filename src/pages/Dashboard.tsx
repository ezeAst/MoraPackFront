import { useState, useEffect, useRef } from 'react';
import { BarChart3, Bell, Info, Play, Square, Calendar } from 'lucide-react';
import { Marker } from 'react-map-gl';
import MapboxMap from '../components/MapboxMap';
import { getOperacionesStatus, getAeropuertos, startOperaciones, stopOperaciones, type Aeropuerto } from '../services/apiOperaciones';
import type { OperacionesStatus, VueloActivo } from '../types/operaciones';
import toast, { Toaster } from 'react-hot-toast';

type Status = 'normal' | 'warning' | 'critical';

type Warehouse = {
  name: string;
  lat: number;
  lng: number;
  status: Status;
  capacity?: number;
  current?: number;
};

type Route = {
  id: string;
  coordinates: [number, number][];
  color: string;
};

export default function Dashboard() {
  // Estados de UI
  const [showStats, setShowStats] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);

  // Estados de datos
  const [operacionesData, setOperacionesData] = useState<OperacionesStatus | null>(null);
  const [aeropuertos, setAeropuertos] = useState<Aeropuerto[]>([]);
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
  });

  // Referencias para controlar notificaciones duplicadas
  const notifiedEvents = useRef<Set<string>>(new Set());
  const lastEventCount = useRef(0);

  // ==================== CARGA INICIAL ====================
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // Cargar aeropuertos para inicializar el mapa
      const aeros = await getAeropuertos();
      setAeropuertos(aeros);
      
      // Cargar estado inicial
      const status = await getOperacionesStatus();
      setOperacionesData(status);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor');
      console.error('Error al cargar datos iniciales:', err);
      toast.error('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // ==================== POLLING CADA 5 SEGUNDOS ====================
  useEffect(() => {
    // Polling solo si no hay error
    if (error) return;

    const interval = setInterval(async () => {
      try {
        const status = await getOperacionesStatus();
        setOperacionesData(status);
        setError(null);

        // Detectar nuevos eventos para notificaciones
        checkForNewEvents(status);
      } catch (err: any) {
        console.error('Error en polling:', err);
        setError(err.message || 'Error de conexión');
      }
    }, 5000); // 5 segundos

    return () => clearInterval(interval);
  }, [error]);

  // ==================== SISTEMA DE NOTIFICACIONES ====================
  const checkForNewEvents = (status: OperacionesStatus) => {
    const eventos = status.eventosRecientes;
    
    // Si hay más eventos que la última vez, hay eventos nuevos
    if (eventos.length > lastEventCount.current) {
      const newEvents = eventos.slice(0, eventos.length - lastEventCount.current);
      
      newEvents.forEach((evento) => {
        // Evitar notificar el mismo evento dos veces
        if (notifiedEvents.current.has(evento)) return;
        notifiedEvents.current.add(evento);

        // Determinar el tipo de notificación según el contenido
        if (evento.includes('despegó') || evento.includes('🛫')) {
          toast.success(evento, {
            icon: '🛫',
            duration: 4000,
            position: 'top-right',
          });
        } else if (evento.includes('aterrizó') || evento.includes('🛬')) {
          toast.success(evento, {
            icon: '🛬',
            duration: 4000,
            position: 'top-right',
          });
        } else if (evento.includes('entregado') || evento.includes('✅')) {
          toast.success(evento, {
            icon: '✅',
            duration: 4000,
            position: 'top-right',
          });
        } else if (evento.includes('crítico') || evento.includes('90%') || evento.includes('95%')) {
          toast.error(evento, {
            icon: '⚠️',
            duration: 5000,
            position: 'top-right',
          });
        } else {
          toast(evento, {
            icon: 'ℹ️',
            duration: 4000,
            position: 'top-right',
          });
        }
      });

      // Limpiar notificaciones antiguas (mantener solo últimas 20)
      if (notifiedEvents.current.size > 20) {
        const arr = Array.from(notifiedEvents.current);
        notifiedEvents.current = new Set(arr.slice(-20));
      }
    }

    lastEventCount.current = eventos.length;
  };

  // ==================== CONTROL DE OPERACIONES ====================
  
  /**
   * Inicia las operaciones con la fecha/hora configurada
   */
  const handleIniciarOperaciones = async () => {
    if (!fechaInicio || !horaInicio) {
      toast.error('Por favor, ingresa fecha y hora de inicio');
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
      
      toast.success(`Operaciones iniciadas desde ${fechaInicio} ${horaFormateada}`, {
        icon: '🚀',
        duration: 5000,
      });
      
      setShowStartModal(false);
      
      // Actualizar el estado inmediatamente
      await loadInitialData();
      
    } catch (error: any) {
      console.error('❌ Error completo:', error);
      toast.error(error.message || 'Error al iniciar operaciones');
    } finally {
      setIniciando(false);
    }
  };

  /**
   * Detiene las operaciones
   */
  const handleDetenerOperaciones = async () => {
    try {
      setDeteniendo(true);
      
      await stopOperaciones();
      
      toast.success('Operaciones detenidas', {
        icon: '⏸️',
        duration: 3000,
      });
      
      // Actualizar el estado
      await loadInitialData();
      
    } catch (error: any) {
      toast.error(error.message || 'Error al detener operaciones');
      console.error('Error al detener operaciones:', error);
    } finally {
      setDeteniendo(false);
    }
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

  // ==================== CÁLCULO DE ROTACIÓN DE AVIONES ====================
  const calculateRotation = (route: [number, number][]): number => {
    if (route.length < 2) return 0;
    
    const [origin, destination] = route;
    // Math.atan2 devuelve el ángulo en radianes
    const angle = Math.atan2(
      destination[1] - origin[1], // delta lat
      destination[0] - origin[0]  // delta lng
    ) * (180 / Math.PI); // convertir a grados
    
    return angle;
  };

  // ==================== PREPARACIÓN DE DATOS PARA EL MAPA ====================
  
  // Almacenes: convertir de Almacen[] a Warehouse[]
  const warehousesForMap: Warehouse[] = operacionesData?.almacenes.map(a => ({
    name: a.nombre,
    lat: a.lat,
    lng: a.lon,
    status: a.status as Status,
    capacity: a.capacidad,
    current: a.capacidadActual,
  })) || [];

  // Rutas: crear líneas entre origen y destino de cada vuelo
  const routesForMap: Route[] = operacionesData?.vuelosActivos
    .filter(v => v.status === 'EN_VUELO') // Solo vuelos en el aire
    .map(v => ({
      id: v.id,
      coordinates: v.route,
      color: '#3b82f6', // Azul para vuelos en vuelo
    })) || [];

  // Estadísticas
  const stats = operacionesData ? [
    { label: 'Vuelos activos', value: operacionesData.vuelosActivos.filter(v => v.status === 'EN_VUELO').length.toString() },
    { label: 'Paquetes en tránsito', value: operacionesData.metricas.pedidosEnTransito.toString() },
    { label: 'Entregas pendientes', value: operacionesData.metricas.pedidosAsignados.toString() },
    { label: 'Pedidos entregados', value: operacionesData.metricas.pedidosEntregados.toString() },
  ] : [];

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
      {/* Toaster para notificaciones */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            maxWidth: '500px',
          },
        }}
      />

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

      {/* Header */}
      <div className="bg-[#FF6600] text-white px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Panel de Operaciones Globales</h1>
          <p className="text-lg mt-1">
            {operacionesData?.activo 
              ? `🟢 Operaciones activas desde ${operacionesData.inicioOperaciones}` 
              : '⚪ Esperando inicio de operaciones...'}
          </p>
          {operacionesData?.usandoTiempoSimulado && (
            <p className="text-sm mt-1 opacity-90">
              ⏰ Tiempo simulado: {operacionesData.currentDateTime}
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
            >
              {/* AVIONES EN MOVIMIENTO */}
              {legend.planes && operacionesData?.vuelosActivos
                .filter(v => v.status === 'EN_VUELO')
                .map(vuelo => {
                  const rotation = calculateRotation(vuelo.route);
                  
                  return (
                    <Marker
                      key={vuelo.id}
                      longitude={vuelo.currentLng}
                      latitude={vuelo.currentLat}
                    >
                      <div className="relative group">
                        {/* SVG del avión con rotación */}
                        <svg 
                          width="28" 
                          height="28" 
                          viewBox="0 0 24 24" 
                          className="drop-shadow-lg"
                          style={{ 
                            transform: `rotate(${rotation}deg)`,
                            transformOrigin: 'center',
                          }}
                        >
                          <path 
                            d="M12.382 5.304L10.096 7.59l.006.02L11.838 14a.908.908 0 01-.211.794l-.573.573a.339.339 0 01-.566-.08l-2.348-4.25-.745-.746-1.97 1.97a3.311 3.311 0 01-.75.504l.44 1.447a.875.875 0 01-.199.79l-.175.176a.477.477 0 01-.672 0l-1.04-1.039-.018-.02-.788-.786-.02-.02-1.038-1.039a.477.477 0 010-.672l.176-.176a.875.875 0 01.79-.197l1.447.438a3.322 3.322 0 01.504-.75l1.97-1.97-.746-.744-4.25-2.348a.339.339 0 01-.08-.566l.573-.573a.909.909 0 01.794-.211l6.39 1.736.02.006 2.286-2.286c.37-.372 1.621-1.02 1.993-.65.37.372-.279 1.622-.65 1.993z" 
                            fill="#3b82f6"
                          />
                        </svg>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                          <div className="font-semibold">{vuelo.flightCode}</div>
                          <div>{vuelo.origin} → {vuelo.destination}</div>
                          <div>Progreso: {Math.round(vuelo.progressPercentage)}%</div>
                          <div>Paquetes: {vuelo.packages}/{vuelo.capacity}</div>
                        </div>
                      </div>
                    </Marker>
                  );
                })}
            </MapboxMap>

            {/* Botón de Leyenda (inferior izquierda) */}
            <div className="absolute left-3 bottom-3 z-30">
              <button
                onClick={() => setShowLegend(s => !s)}
                className="flex items-center justify-center rounded-full w-10 h-10 bg-white/90 shadow border hover:bg-white"
                aria-label="Alternar leyenda"
                title="Leyenda"
              >
                <Info size={18} />
              </button>

              {/* Panel de Leyenda */}
              {showLegend && (
                <div className="mt-2 p-3 rounded-xl bg-white/95 shadow border min-w-[260px]">
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

                  {/* Estado de vuelos */}
                  <div className="text-xs font-semibold mb-2">Estado de vuelos</div>
                  <ul className="text-sm space-y-1 mb-3">
                    <li className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path d="M12.382 5.304L10.096 7.59l.006.02L11.838 14a.908.908 0 01-.211.794l-.573.573a.339.339 0 01-.566-.08l-2.348-4.25-.745-.746-1.97 1.97a3.311 3.311 0 01-.75.504l.44 1.447a.875.875 0 01-.199.79l-.175.176a.477.477 0 01-.672 0l-1.04-1.039-.018-.02-.788-.786-.02-.02-1.038-1.039a.477.477 0 010-.672l.176-.176a.875.875 0 01.79-.197l1.447.438a3.322 3.322 0 01.504-.75l1.97-1.97-.746-.744-4.25-2.348a.339.339 0 01-.08-.566l.573-.573a.909.909 0 01.794-.211l6.39 1.736.02.006 2.286-2.286c.37-.372 1.621-1.02 1.993-.65.37.372-.279 1.622-.65 1.993z" fill="#3b82f6"/>
                      </svg>
                      <span>En vuelo</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-8 h-0.5 border-t-2 border-dashed border-blue-500"></div>
                      <span>Ruta de vuelo</span>
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