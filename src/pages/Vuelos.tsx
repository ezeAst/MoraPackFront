import { useState, useEffect, useRef, ChangeEvent  } from 'react';
import { Plane, Download, RefreshCcw, Package, X, Upload, AlertTriangle, MapPin } from 'lucide-react';
import { getOperacionesStatus } from '../services/apiOperaciones';
import { uploadVuelosFile } from '../services/apiVuelos';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { cacheService } from '../services/cacheService';
import Cancelaciones from './Cancelaciones'; // ✅ NUEVO

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
    packages?: number;
    cantidad?: number;
    destino?: string;
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
  const navigate = useNavigate();
  
  // ✅ NUEVO - Estado para pestañas
  const [activeTab, setActiveTab] = useState<'vuelos' | 'cancelaciones'>('vuelos');
  
  const [flights, setFlights] = useState<VistaVuelo[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [destinationFilter, setDestinationFilter] = useState<string>('Todos');
  const [flightCodeFilter, setFlightCodeFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  const [showPedidosModal, setShowPedidosModal] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<VistaVuelo | null>(null);
  const [pedidosEnVuelo, setPedidosEnVuelo] = useState<Array<{ id: string; packages?: number; cantidad?: number; destino?: string }>>([]);
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
      setIsUploading(true);
      setLoading(true);
      setError(null);

      const result = await uploadVuelosFile(file);
      const registros = result.registrosCargados ?? 0;

      window.alert(
        `${result.mensaje ?? 'Carga de vuelos completada'}.\nVuelos cargados: ${registros}.`
      );

      await fetchFlights(true);
    } catch (err: any) {
      console.error('Error subiendo archivo de vuelos:', err);
      setError(err.message || 'Error al subir archivo de vuelos');
      window.alert('Ocurrió un error al subir el archivo de vuelos.');
    } finally {
      setIsUploading(false);
      setLoading(false);
      e.target.value = '';
    }
  };

  const fetchFlights = async (manual = false) => {
    if (manual) {
      setLoading(true);
      cacheService.invalidate('operaciones-status');
    }
    try {
      setError(null);
      
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


  const handleVerEnMapa = (flight: VistaVuelo) => {
    // Navegar al dashboard con el código de vuelo como parámetro
    navigate(`/?vuelo=${flight.flightCode}`);
  };

  const handleVerPedidos = async (flight: VistaVuelo) => {
    setSelectedFlight(flight);
    setShowPedidosModal(true);
    setErrorPedidos(null);
    
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

  useEffect(() => {
    // Solo hacer polling si estamos en la pestaña de vuelos
    if (activeTab === 'vuelos') {
      fetchFlights();
      pollingRef.current = window.setInterval(() => {
        fetchFlights();
      }, POLLING_INTERVAL);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeTab]); // ✅ Agregado activeTab como dependencia

  const allDestinations = ['Todos', ...new Set(flights.map(f => f.destination))];
  const allStatuses = ['Todos', ...new Set(flights.map(f => f.statusLabel))];

  const filteredFlights = flights.filter(f => {
    const matchStatus = statusFilter === 'Todos' || f.statusLabel === statusFilter;
    const matchDest = destinationFilter === 'Todos' || f.destination === destinationFilter;
    const matchCode = !flightCodeFilter || f.flightCode.toLowerCase().includes(flightCodeFilter.toLowerCase());
    return matchStatus && matchDest && matchCode;
  });

  const statusCounts = {
    activos: flights.filter(f => f.status === 'EN_VUELO').length,
    programados: flights.filter(f => f.status === 'PROGRAMADO').length,
    aterrizados: flights.filter(f => f.status === 'LANDED').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EN_VUELO':
        return 'bg-blue-100 text-blue-800';
      case 'PROGRAMADO':
        return 'bg-yellow-100 text-yellow-800';
      case 'LANDED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'EN_VUELO':
        return 'bg-gradient-to-r from-blue-500 to-blue-600';
      case 'PROGRAMADO':
        return 'bg-yellow-500';
      case 'LANDED':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
            <Plane className="w-10 h-10 text-[#FF6600]" />
            Gestión de Vuelos
          </h1>
          <p className="text-gray-600">Monitorea vuelos activos y gestiona cancelaciones</p>
        </div>

        {/* ✅ NUEVO - Pestañas */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex gap-4">
              <button
                onClick={() => setActiveTab('vuelos')}
                className={`px-6 py-3 font-semibold border-b-2 transition-all ${
                  activeTab === 'vuelos'
                    ? 'border-[#FF6600] text-[#FF6600]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Plane className="w-5 h-5" />
                  Vuelos Activos
                </div>
              </button>
              <button
                onClick={() => setActiveTab('cancelaciones')}
                className={`px-6 py-3 font-semibold border-b-2 transition-all ${
                  activeTab === 'cancelaciones'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Cancelaciones
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* ✅ NUEVO - Renderizado condicional según pestaña */}
        {activeTab === 'cancelaciones' ? (
          <Cancelaciones />
        ) : (
          <>
            {/* Contenido original de vuelos */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-2">Cargar Vuelos</h2>
                  <p className="text-sm text-gray-600">Sube un archivo con el formato de vuelos</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className="px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] disabled:bg-gray-400 font-medium flex items-center gap-2 shadow-lg transition-all"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCcw className="w-5 h-5 animate-spin" />
                        Cargando vuelos...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Subir archivo de vuelos
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Filtros</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                    >
                      {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Destino</label>
                    <select
                      value={destinationFilter}
                      onChange={e => setDestinationFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                    >
                      {allDestinations.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Código de vuelo</label>
                    <input
                      type="text"
                      value={flightCodeFilter}
                      onChange={e => setFlightCodeFilter(e.target.value)}
                      placeholder="Ej: FL123"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
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
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleVerPedidos(f)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                            >
                              <Package className="w-4 h-4" />
                              Ver pedidos
                            </button>
                            <button
                              onClick={() => handleVerEnMapa(f)}
                              className="px-3 py-1.5 bg-[#FF6600] hover:bg-[#e55a00] text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                            >
                              <MapPin className="w-4 h-4" />
                              Ver en mapa
                            </button>
                          </div>
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
          </>
        )}
      </div>

      {/* Modal de pedidos */}
      {showPedidosModal && selectedFlight && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[80vh] overflow-hidden flex flex-col">
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
                <>
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
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Destino Final</th>
                            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Cantidad (kg)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {pedidosEnVuelo.map((pedido) => (
                            <tr key={pedido.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-mono font-semibold text-gray-800">{pedido.id}</td>
                              <td className="px-6 py-4 text-gray-700">
                                {pedido.destino || '-'}
                              </td>
                              <td className="px-6 py-4 text-right font-medium text-gray-800">
                                {pedido.cantidad || pedido.packages || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

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