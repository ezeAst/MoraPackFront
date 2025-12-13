import { useState, useEffect, useRef, ChangeEvent  } from 'react';
import { Plane, Download, RefreshCcw, Package, X, Upload } from 'lucide-react';
import { getOperacionesStatus } from '../services/apiOperaciones';
import { uploadVuelosFile } from '../services/apiVuelos';
import { useSearchParams } from 'react-router-dom';
import { cacheService } from '../services/cacheService';

// Intervalo de polling (ms)
const POLLING_INTERVAL = 5000;

interface VistaVuelo {
  id: string;
  flightCode: string;
  origin: string;
  destination: string;
  packages: number;
  capacity: number;
  status: string;
  statusLabel: string;
  progressPercentage: number;
  remainingSeconds: number;
  departureTime: string;
  arrivalTime: string;
  durationSeconds: number;
  elapsedSeconds: number;
  currentLat: number;
  currentLng: number;
  orderIds?: string[];
  orders?: Array<{
    id: string;
    packages: number;
  }>;
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function Vuelos() {
  const [searchParams] = useSearchParams();
  
  const [flights, setFlights] = useState<VistaVuelo[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [destinationFilter, setDestinationFilter] = useState<string>('Todos');
  const [flightCodeFilter, setFlightCodeFilter] = useState<string>(''); // Nuevo filtro por código de vuelo
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  // Estados para el modal de pedidos
  const [showPedidosModal, setShowPedidosModal] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<VistaVuelo | null>(null);
  const [pedidosEnVuelo, setPedidosEnVuelo] = useState<Array<{ id: string; packages: number }>>([]);
  const [errorPedidos, setErrorPedidos] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    setIsUploading(true);   // botón “Cargando vuelos…”
    setLoading(true);       // si quieres usar tu spinner general
    setError(null);

    const result = await uploadVuelosFile(file);

    const registros = result.registrosCargados ?? 0;

    // Mensaje emergente simple
    window.alert(
      `${result.mensaje ?? 'Carga de vuelos completada'}.\nVuelos cargados: ${registros}.`
    );

    // Recargar la tabla de vuelos
    await fetchFlights(true);
  } catch (err: any) {
    console.error('Error subiendo archivo de vuelos:', err);
    setError(err.message || 'Error al subir archivo de vuelos');
    window.alert('Ocurrió un error al subir el archivo de vuelos.');
  } finally {
    setIsUploading(false);
    setLoading(false);
    // Permitir volver a seleccionar el mismo archivo
    e.target.value = '';
  }
};





  // Cargar vuelos activos desde operaciones
  const fetchFlights = async (manual = false) => {
    if (manual) {
      // en refresco manual mostrar spinner rápido
      setLoading(true);
      cacheService.invalidate('operaciones-status');
    }
    try {
      setError(null);
      
      // Usar caché con TTL de 30 segundos
      const status = await cacheService.getOrFetch(
        'operaciones-status',
        () => getOperacionesStatus(),
        30000
      );
      
      const mapped: VistaVuelo[] = (status.vuelosActivos || []).map(v => {
        const statusLabel = v.status === 'EN_VUELO' ? 'EN_VUELO' : v.status === 'LANDED' ? 'ATERRIZADO' : 'PROGRAMADO';
        
        return {
          id: v.id,
          flightCode: v.flightCode,
          origin: v.origin,
          destination: v.destination,
          packages: v.packages,
          capacity: v.capacity,
          status: v.status,
          statusLabel,
          progressPercentage: Math.round(Math.min(100, Math.max(0, v.progressPercentage)) * 10000) / 10000,
          remainingSeconds: Math.max(0, v.durationSeconds - v.elapsedSeconds),
          departureTime: v.departureTime,
          arrivalTime: v.arrivalTime,
          durationSeconds: v.durationSeconds,
          elapsedSeconds: v.elapsedSeconds,
          currentLat: v.currentLat,
          currentLng: v.currentLng,
          orderIds: v.orderIds,
          orders: v.orders
        };
      });
      
      // Orden: activos primero por menor tiempo restante, luego el resto
      mapped.sort((a,b) => {
        const activeA = a.status === 'EN_VUELO';
        const activeB = b.status === 'EN_VUELO';
        if (activeA && !activeB) return -1;
        if (!activeA && activeB) return 1;
        return a.remainingSeconds - b.remainingSeconds;
      });
      
      setFlights(mapped);
    } catch (e:any) {
      setError(e.message || 'Error al cargar vuelos activos');
    } finally {
      setLoading(false);
    }
  };

  // Manejar apertura del modal de pedidos
  const handleVerPedidos = async (flight: VistaVuelo) => {
    setSelectedFlight(flight);
    setShowPedidosModal(true);
    setErrorPedidos(null);
    
    // Preferir usar orders si están disponibles, sino orderIds
    if (flight.orders && flight.orders.length > 0) {
      setPedidosEnVuelo(flight.orders);
    } else if (flight.orderIds && flight.orderIds.length > 0) {
      setPedidosEnVuelo(flight.orderIds.map(id => ({ id, packages: 0 })));
    } else {
      setPedidosEnVuelo([]);
      setErrorPedidos('Este vuelo no tiene pedidos asignados');
    }
  };

  const handleCloseModal = () => {
    setShowPedidosModal(false);
    setSelectedFlight(null);
    setPedidosEnVuelo([]);
    setErrorPedidos(null);
  };

  // Iniciar polling
  useEffect(() => {
    fetchFlights();
    pollingRef.current = window.setInterval(() => {
      fetchFlights();
    }, POLLING_INTERVAL);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Efecto para aplicar filtro desde URL
  useEffect(() => {
    const vueloParam = searchParams.get('vuelo');
    if (vueloParam && flights.length > 0) {
      // Verificar que el vuelo exista en la lista
      const vueloExiste = flights.some(f => f.flightCode === vueloParam);
      if (vueloExiste) {
        setFlightCodeFilter(vueloParam);
        // También establecer el filtro de estado en "Activos" para mostrar el vuelo
        setStatusFilter('Activos');
      }
    }
  }, [searchParams, flights]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROGRAMADO': return 'bg-yellow-100 text-yellow-800';
      case 'EN_VUELO': return 'bg-blue-100 text-blue-800';
      case 'ATERRIZADO': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'EN_VUELO': return 'bg-blue-500';
      case 'ATERRIZADO': return 'bg-green-500';
      case 'PROGRAMADO': return 'bg-yellow-400';
      default: return 'bg-gray-300';
    }
  };

  // Filtrar vuelos por estado, destino y código de vuelo
  const filteredFlights = flights.filter(f => {
    const matchesStatus = statusFilter === 'Todos' || statusFilter === f.status ||
      (statusFilter === 'Activos' && f.status === 'EN_VUELO');
    const matchesDestination = destinationFilter === 'Todos' || f.destination === destinationFilter;
    const matchesFlightCode = !flightCodeFilter || f.flightCode.includes(flightCodeFilter);
    return matchesStatus && matchesDestination && matchesFlightCode;
  });

  const statusCounts = {
    activos: flights.filter(f => f.status === 'EN_VUELO').length,
    programados: flights.filter(f => f.status === 'PROGRAMADO').length,
    aterrizados: flights.filter(f => f.status === 'ATERRIZADO').length
  };

  const destinosUnicos = Array.from(new Set(flights.map(f => f.destination))).filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#FF6600] text-white px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoreo en tiempo real</h1>
          <p className="text-lg mt-1">Rastrea todos los paquetes activos y su estado actual</p>
        </div>
        <div>
          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow 
              ${isUploading 
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                : 'bg-white text-[#FF6600] hover:bg-gray-100'}`}
          >
            {!isUploading && <Upload className="w-4 h-4" />}
            {isUploading ? 'Cargando vuelos…' : 'Cargar vuelos'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt "
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Estado</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                >
                  <option>Todos</option>
                  <option>Activos</option>
                  <option>PROGRAMADO</option>
                  <option>EN_VUELO</option>
                  <option>ATERRIZADO</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Destino</label>
                <select
                  value={destinationFilter}
                  onChange={(e) => setDestinationFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                >
                  <option>Todos</option>
                  {destinosUnicos.map(dest => (
                    <option key={dest}>{dest}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Código de vuelo</label>
                <input
                  type="text"
                  value={flightCodeFilter}
                  onChange={(e) => setFlightCodeFilter(e.target.value)}
                  placeholder="Buscar por código..."
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-semibold">
                {statusCounts.activos} En Vuelo
              </div>
              <div className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-semibold">
                {statusCounts.programados} Programados
              </div>
              <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-semibold">
                {statusCounts.aterrizados} Aterrizados
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchFlights(true)}
                className="px-4 py-2 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium flex items-center gap-2"
                title="Refrescar ahora"
              >
                <RefreshCcw className="w-4 h-4" />
                Refrescar
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => fetchFlights(true)} className="text-sm underline">Reintentar</button>
            </div>
          )}

        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Origen → Destino</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Paquetes</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Progreso</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tiempo restante</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredFlights.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-800">{f.flightCode}</td>
                    <td className="px-6 py-4 text-gray-700">{f.origin} → {f.destination}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Plane className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">{f.packages} / {f.capacity}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(f.status)}`}>{f.statusLabel}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-32">
                          <div className={`h-full rounded-full ${getProgressColor(f.status)}`} style={{ width: `${f.progressPercentage}%` }} />
                        </div>
                        <span className="text-sm text-gray-600">{f.progressPercentage.toFixed(4)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">{formatRemaining(f.remainingSeconds)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleVerPedidos(f)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                      >
                        <Package className="w-4 h-4" />
                        Ver pedidos
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && !filteredFlights.length && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No hay vuelos para los filtros seleccionados.</td>
                  </tr>
                )}
                {loading && flights.length > 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-xs text-gray-400">Actualizando...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button className="px-8 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium shadow-lg flex items-center gap-2">
            <Download className="w-5 h-5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Modal de pedidos */}
      {showPedidosModal && selectedFlight && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#FF6600] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Pedidos en vuelo</h2>
                <p className="text-sm opacity-90 mt-1">
                  {selectedFlight.flightCode} | {selectedFlight.origin} → {selectedFlight.destination}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {errorPedidos ? (
                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                  <p className="text-red-700">
                    <span className="font-bold">Info:</span> {errorPedidos}
                  </p>
                </div>
              ) : pedidosEnVuelo.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No hay pedidos en este vuelo</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">
                        Total de pedidos: <span className="font-semibold text-gray-800">{pedidosEnVuelo.length}</span>
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Carga: <span className="font-semibold text-gray-800">{selectedFlight.packages}/{selectedFlight.capacity}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        Progreso: <span className="font-semibold text-gray-800">{selectedFlight.progressPercentage.toFixed(4)}%</span>
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Salida: <span className="font-semibold text-gray-800">{selectedFlight.departureTime}</span>
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b-2 border-gray-300">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Código de Pedido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pedidosEnVuelo.map((pedido) => (
                          <tr key={pedido.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-mono font-semibold text-gray-800">{pedido.id}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t">
              <button
                onClick={handleCloseModal}
                className="w-full px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
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