import { useState, useEffect } from 'react';
import { Package, X, MapPin, Calendar, User, AlertCircle, RefreshCw, Truck, Plane, Clock, ArrowRight, Navigation } from 'lucide-react';
import {
  getResumenEstado,
  getPedidos,
  getPedidosSinAsignar,
  getPedidosEnTransito,
  getPedidosEntregados,
  getAsignacionPedido,
  ResumenEstado,
  PedidoResumen,
  AsignacionPedido,
} from '../services/apiPlanificacion';
import { cacheService } from '../services/cacheService';

interface PedidoConDetalle extends PedidoResumen {
  asignacion?: AsignacionPedido;
}

export default function Planificacion() {
  const [pedidos, setPedidos] = useState<PedidoConDetalle[]>([]);
  const [resumen, setResumen] = useState<ResumenEstado>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTimer, setRefreshTimer] = useState<number | null>(null);

  // Filtros
  const [filtroCodiGo, setFiltroCodiGo] = useState('');
  const [filtroOrigen, setFiltroOrigen] = useState('Todos');
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  // Modal de detalle
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<PedidoConDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
    // Auto-refresh cada 30s
    const timer = window.setInterval(() => loadData(), 30000);
    setRefreshTimer(timer);
    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
      clearInterval(timer);
    };
  }, []);

  const loadData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      if (forceRefresh) {
        cacheService.invalidate('planificacion-resumen');
        cacheService.invalidate('planificacion-pedidos');
      }

      // Obtener resumen
      const staleResumen = cacheService.getStale<ResumenEstado>('planificacion-resumen');
      const resumendatos = staleResumen || (await cacheService.getOrFetch(
        'planificacion-resumen',
        () => getResumenEstado(),
        30000
      ));
      const safeResumen: ResumenEstado = Object.fromEntries(
        Object.entries(resumendatos || {}).map(([k, v]) => [k, typeof v === 'number' ? v : Number(v) || 0])
      );
      setResumen(safeResumen);

      // Obtener pedidos
      const stalePedidos = cacheService.getStale<PedidoConDetalle[]>('planificacion-pedidos');
      let pedidosDatos: PedidoConDetalle[] | null = stalePedidos || null;
      if (!pedidosDatos || forceRefresh) {
        try {
          const all = await getPedidos();
          pedidosDatos = (all || []).map(p => ({ ...p }));
        } catch (e) {
          console.warn('Fallo getPedidos(), combinando por estado...', e);
          const [sinAsignar, enTransitoList, entregadosList] = await Promise.all([
            getPedidosSinAsignar().catch(() => []),
            getPedidosEnTransito().catch(() => []),
            getPedidosEntregados().catch(() => []),
          ]);
          pedidosDatos = [
            ...sinAsignar.map(p => ({ ...p, estado: p.estado || 'NO_ASIGNADO' })),
            ...enTransitoList.map(p => ({ ...p, estado: p.estado || 'EN_TRANSITO' })),
            ...entregadosList.map(p => ({ ...p, estado: p.estado || 'ENTREGADO' })),
          ];
        }
        cacheService.set('planificacion-pedidos', pedidosDatos);
      }
      const normalized = (pedidosDatos || []).map(p => ({
        id: String(p.id),
        destino: p.destino || '-',
        cantidad: Number(p.cantidad) || 0,
        fecha: p.fecha,
        hora: p.hora,
        cliente: p.cliente,
        clientId: (p as any).clientId || undefined,
        estado: p.estado || 'ASIGNADO',
      }));
      setPedidos(normalized);
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos de planificación');
      console.error('Error loading planning data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async (pedido: PedidoConDetalle) => {
    setSelectedPedido(pedido);
    setShowDetalleModal(true);
    setLoadingDetalle(true);
    setErrorDetalle(null);

    try {
      const asignacion = await getAsignacionPedido(pedido.id);
      setSelectedPedido(prev => prev ? { ...prev, asignacion } : null);
    } catch (err: any) {
      setErrorDetalle(err.message || 'Error al cargar los detalles de asignación');
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleCloseModal = () => {
    setShowDetalleModal(false);
    setSelectedPedido(null);
    setErrorDetalle(null);
  };

  // Filtrar pedidos
  const pedidosFiltrados = pedidos.filter(p => {
    const matchesCodigo = !filtroCodiGo || (p.id || '').toUpperCase().includes(filtroCodiGo.toUpperCase());
    const matchesDestino = filtroOrigen === 'Todos' || p.destino === filtroOrigen;
    const matchesEstado = filtroEstado === 'Todos' || p.estado === filtroEstado;
    return matchesCodigo && matchesDestino && matchesEstado;
  });

  // Obtener valores únicos para filtros
  const origenesUnicos = Array.from(new Set(pedidos.map(p => p.destino))).filter(Boolean);
  const estadosUnicos = Array.from(new Set(pedidos.map(p => p.estado))).filter(Boolean);

  // Contar pedidos por estado
  const asignados = Number(resumen['ASIGNADO']) || 0;
  const entregados = Number(resumen['ENTREGADO']) || 0;
  const enTransito = Number(resumen['EN_TRANSITO']) || 0;
  const noAsignados = Number(resumen['NO_ASIGNADO']) || 0;
  const totalPedidos = pedidos.length || Object.values(resumen)
    .map((v) => (typeof v === 'number' ? v : Number(v) || 0))
    .reduce((a, b) => a + b, 0);
  const faltanEntregar = Math.max(0, (asignados + enTransito + noAsignados) || (totalPedidos - entregados));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF6600] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Cargando planificación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">📋 Planificación de Rutas</h1>
              <p className="text-gray-600 mt-2">Gestiona y visualiza las rutas de todos los pedidos</p>
            </div>
            <button
              onClick={() => loadData(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF6600] hover:bg-[#e65c00] text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>

          {/* Cards de Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Pedidos</p>
                  <p className="text-3xl font-bold text-gray-900">{totalPedidos}</p>
                </div>
                <Package className="w-12 h-12 text-blue-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Entregados</p>
                  <p className="text-3xl font-bold text-gray-900">{entregados}</p>
                </div>
                <Truck className="w-12 h-12 text-green-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">En Tránsito</p>
                  <p className="text-3xl font-bold text-gray-900">{enTransito}</p>
                </div>
                <Plane className="w-12 h-12 text-yellow-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Faltan Entregar</p>
                  <p className="text-3xl font-bold text-gray-900">{faltanEntregar}</p>
                </div>
                <AlertCircle className="w-12 h-12 text-red-500 opacity-20" />
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Código de Pedido</label>
                <input
                  type="text"
                  value={filtroCodiGo}
                  onChange={(e) => setFiltroCodiGo(e.target.value)}
                  placeholder="Buscar por código..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destino</label>
                <select
                  value={filtroOrigen}
                  onChange={(e) => setFiltroOrigen(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                >
                  <option value="Todos">Todos los destinos</option>
                  {origenesUnicos.map(origen => (
                    <option key={origen} value={origen}>{origen}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600] focus:border-transparent"
                >
                  <option value="Todos">Todos los estados</option>
                  {estadosUnicos.map(estado => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de Pedidos */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pedidosFiltrados.length > 0 ? pedidosFiltrados.map((pedido) => (
                  <tr key={pedido.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">#{pedido.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{pedido.destino}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{pedido.cantidad}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        pedido.estado === 'ENTREGADO' ? 'bg-green-100 text-green-800' :
                        pedido.estado === 'EN_TRANSITO' ? 'bg-yellow-100 text-yellow-800' :
                        pedido.estado === 'ASIGNADO' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {pedido.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleVerDetalle(pedido)}
                        className="text-[#FF6600] hover:text-[#e65c00] font-medium text-sm flex items-center gap-1"
                      >
                        <Navigation className="w-4 h-4" />
                        Ver Ruta
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="text-gray-400">
                        <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No se encontraron pedidos</p>
                        <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Detalle */}
      {showDetalleModal && selectedPedido && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header del modal */}
            <div className="bg-gradient-to-r from-[#FF6600] to-[#ff8533] text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Plane className="w-6 h-6" />
                    Ruta Completa del Pedido
                  </h2>
                  <p className="text-white/90 mt-1">
                    ID: #{selectedPedido.id} • Destino final: {selectedPedido.destino}
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Contenido del modal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {errorDetalle && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{errorDetalle}</span>
                </div>
              )}

              {loadingDetalle ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-12 h-12 border-3 border-[#FF6600] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-600">Cargando detalles de la ruta...</p>
                  </div>
                </div>
              ) : selectedPedido.asignacion ? (
                <>
                  {/* Información básica */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                      <p className="text-sm text-blue-700 mb-1 flex items-center gap-1">
                        <User className="w-4 h-4" />
                        Cliente
                      </p>
                      <p className="font-bold text-blue-900">{selectedPedido.cliente || 'N/A'}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                      <p className="text-sm text-purple-700 mb-1 flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        Paquetes
                      </p>
                      <p className="font-bold text-purple-900">{selectedPedido.cantidad}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                      <p className="text-sm text-green-700 mb-1 flex items-center gap-1">
                        <Plane className="w-4 h-4" />
                        Total Rutas
                      </p>
                      <p className="font-bold text-green-900">
                        {selectedPedido.asignacion.totalRutas || 0}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                      <p className="text-sm text-orange-700 mb-1 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        Estado
                      </p>
                      <p className="font-bold text-orange-900">{selectedPedido.asignacion.estado}</p>
                    </div>
                  </div>

                  {/* Rutas Múltiples */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Plane className="w-5 h-5 text-[#FF6600]" />
                      Itinerario Completo ({selectedPedido.asignacion.totalRutas || 0} rutas)
                    </h3>
                    
                    {selectedPedido.asignacion.rutas && selectedPedido.asignacion.rutas.length > 0 ? (
                      <div className="space-y-6">
                        {selectedPedido.asignacion.rutas.map((ruta: any, rutaIndex: number) => (
                          <div key={ruta.rutaId} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                              <span className="bg-[#FF6600] text-white px-3 py-1 rounded-full text-sm">
                                Ruta {rutaIndex + 1}
                              </span>
                              <span className="text-gray-600 text-sm">
                                ({ruta.cantidad} paquetes)
                              </span>
                            </h4>
                            
                            <div className="space-y-3">
                              {ruta.tramos.map((tramo: any, index: number) => {
                                const tramoActualIndex = selectedPedido.asignacion?.tramoActual ?? 0;
                                const esActual = index === tramoActualIndex;
                                const esCompletado = index < tramoActualIndex;
                                
                                return (
                                  <div
                                    key={index}
                                    className={`p-4 rounded-lg border-2 transition-all ${
                                      esActual
                                        ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-400 shadow-lg'
                                        : esCompletado
                                        ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-300'
                                        : 'bg-white border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                        esActual
                                          ? 'bg-blue-500 text-white'
                                          : esCompletado
                                          ? 'bg-green-500 text-white'
                                          : 'bg-gray-300 text-gray-600'
                                      }`}>
                                        {esCompletado ? '✓' : index + 1}
                                      </div>

                                      <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-800">{tramo.origen}</span>
                                            <ArrowRight className="w-4 h-4 text-gray-400" />
                                            <span className="font-bold text-gray-800">{tramo.destino}</span>
                                          </div>
                                          {esActual && (
                                            <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                                              EN CURSO
                                            </span>
                                          )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                          <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            <span>{tramo.fecha}</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>{tramo.horaSalida} - {tramo.horaLlegada}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-600">
                        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p>No hay rutas disponibles para este pedido</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No hay asignación disponible para este pedido</p>
                  <p className="text-gray-400 text-sm mt-2">Este pedido aún no ha sido planificado</p>
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div className="bg-gray-50 px-6 py-4 border-t flex gap-3">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
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