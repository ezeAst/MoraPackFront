import { useState, useEffect } from 'react';
import { Package, X, MapPin, Calendar, User, AlertCircle, RefreshCw, Truck } from 'lucide-react';
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
      // Asegurar tipos del resumen y evitar NaN
      const safeResumen: ResumenEstado = Object.fromEntries(
        Object.entries(resumendatos || {}).map(([k, v]) => [k, typeof v === 'number' ? v : Number(v) || 0])
      );
      setResumen(safeResumen);

      // Obtener pedidos: combinar por estado para asegurar lista
      const stalePedidos = cacheService.getStale<PedidoConDetalle[]>('planificacion-pedidos');
      let pedidosDatos: PedidoConDetalle[] | null = stalePedidos || null;
      if (!pedidosDatos || forceRefresh) {
        // Intentar endpoint general primero
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
        cacheService.set('planificacion-pedidos', pedidosDatos, 30000);
      }
      // Normalizar pedidos (tipos y claves mínimas)
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
    return matchesCodigo && matchesDestino;
  });

  // Obtener orígenes únicos para filtro
  const origenesUnicos = Array.from(new Set(pedidos.map(p => p.destino))).filter(Boolean);

  // Contar pedidos por estado
  const asignados = Number(resumen['ASIGNADO']) || 0;
  const entregados = Number(resumen['ENTREGADO']) || 0;
  const enTransito = Number(resumen['EN_TRANSITO']) || 0;
  const noAsignados = Number(resumen['NO_ASIGNADO']) || 0;
  // Recalcular totales desde pedidos para mayor precisión
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#FF6600] text-white px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Planificación de Entregas</h1>
            <p className="text-lg mt-1">Estado en tiempo real de asignación y rutas de pedidos</p>
          </div>
          <button
            onClick={() => loadData(true)}
            className="px-4 py-2 bg-white text-[#FF6600] rounded-lg hover:bg-gray-100 font-medium flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Resumen de estado */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Resumen de Operaciones</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Asignados */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-blue-700 font-medium mb-1">Asignados</p>
              <p className="text-3xl font-bold text-blue-900">{asignados}</p>
              <p className="text-xs text-blue-600 mt-2">Con ruta definida</p>
            </div>

            {/* En Tránsito */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
              <p className="text-sm text-orange-700 font-medium mb-1">En Tránsito</p>
              <p className="text-3xl font-bold text-orange-900">{enTransito}</p>
              <p className="text-xs text-orange-600 mt-2">En vuelo actualmente</p>
            </div>

            {/* Entregados */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <p className="text-sm text-green-700 font-medium mb-1">Entregados</p>
              <p className="text-3xl font-bold text-green-900">{entregados}</p>
              <p className="text-xs text-green-600 mt-2">Completados</p>
            </div>

            {/* Falta Entregar */}
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
              <p className="text-sm text-yellow-700 font-medium mb-1">Falta Entregar</p>
              <p className="text-3xl font-bold text-yellow-900">{faltanEntregar}</p>
              <p className="text-xs text-yellow-600 mt-2">En espera o tránsito</p>
            </div>

            {/* No Asignados */}
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
              <p className="text-sm text-red-700 font-medium mb-1">No Asignados</p>
              <p className="text-3xl font-bold text-red-900">{noAsignados}</p>
              <p className="text-xs text-red-600 mt-2">Pendiente asignación</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Buscar por código de pedido
              </label>
              <input
                type="text"
                value={filtroCodiGo}
                onChange={(e) => setFiltroCodiGo(e.target.value)}
                placeholder="Ej: PED-001"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
              />
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Filtrar por destino
              </label>
              <select
                value={filtroOrigen}
                onChange={(e) => setFiltroOrigen(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
              >
                <option value="Todos">Todos los destinos</option>
                {origenesUnicos.map(origen => (
                  <option key={origen} value={origen}>{origen}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabla de pedidos */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Código</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Cliente</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Destino</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Paquetes</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pedidosFiltrados.map(pedido => (
                  <tr key={pedido.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-gray-800">{pedido.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-700">{(pedido as any).clientId || pedido.cliente || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        {pedido.destino}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold">{pedido.cantidad}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        pedido.estado === 'ENTREGADO' ? 'bg-green-100 text-green-800' :
                        pedido.estado === 'EN_TRANSITO' ? 'bg-blue-100 text-blue-800' :
                        pedido.estado === 'ASIGNADO' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {pedido.estado || 'Desconocido'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleVerDetalle(pedido)}
                        className="px-4 py-2 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium flex items-center gap-2 transition-colors"
                      >
                        <Truck className="w-4 h-4" />
                        Detalle
                      </button>
                    </td>
                  </tr>
                ))}

                {pedidosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      {totalPedidos > 0
                        ? 'No hay pedidos que coincidan con los filtros seleccionados'
                        : 'No hay pedidos disponibles en este momento'}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header del modal */}
            <div className="bg-[#FF6600] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Detalles de Asignación</h2>
                <p className="text-sm opacity-90 mt-1">Pedido: {selectedPedido.id}</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
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
                    <p className="text-gray-600">Cargando detalles...</p>
                  </div>
                </div>
              ) : selectedPedido.asignacion ? (
                <>
                  {/* Información básica */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Cliente</p>
                      <p className="font-semibold text-gray-800">{selectedPedido.cliente || '-'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Cantidad de Paquetes</p>
                      <p className="font-semibold text-gray-800">{selectedPedido.cantidad}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Estado Actual</p>
                      <p className="font-semibold text-gray-800">{selectedPedido.asignacion.estado}</p>
                    </div>
                  </div>

                  {/* Ruta y Tramos */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Ruta Asignada</h3>
                    <div className="space-y-3">
                      {Array.isArray(selectedPedido.asignacion.tramos) && selectedPedido.asignacion.tramos.length > 0 ? selectedPedido.asignacion.tramos.map((tramo, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border-2 ${
                            index === selectedPedido.asignacion!.tramoActual
                              ? 'bg-blue-50 border-blue-300'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                                index === selectedPedido.asignacion!.tramoActual
                                  ? 'bg-blue-500 text-white'
                                  : index < selectedPedido.asignacion!.tramoActual
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-300 text-white'
                              }`}>
                                {index + 1}
                              </div>
                              {index < selectedPedido.asignacion!.tramos.length - 1 && (
                                <div className="h-8 w-1 bg-gray-300 mt-2"></div>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800">
                                {tramo.origen} → {tramo.destino}
                              </p>
                              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {tramo.fecha}
                                </div>
                                <div>
                                  Hora: {tramo.hora}
                                </div>
                                {tramo.vuelo && (
                                  <div className="flex items-center gap-1">
                                    <Package className="w-4 h-4" />
                                    Vuelo: {tramo.vuelo.flightCode}
                                  </div>
                                )}
                              </div>
                              {index === selectedPedido.asignacion!.tramoActual && (
                                <div className="mt-2 inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                                  Tramo Actual
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-600">
                          No hay tramos disponibles para este pedido.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No hay asignación disponible para este pedido</p>
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div className="bg-gray-50 px-6 py-4 border-t">
              <button
                onClick={handleCloseModal}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
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
