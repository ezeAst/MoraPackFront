import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, RefreshCw, Package, X } from 'lucide-react';
import { getOperacionesStatus } from '../services/apiOperaciones';
import type { Almacen } from '../types/operaciones';
import { getPedidosPorAlmacen, type PedidoEnAlmacen } from '../services/apiPedidos';

export default function Almacenes() {
  const [searchParams] = useSearchParams();
  
  const [warehouses, setWarehouses] = useState<Almacen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [airportCodeFilterState, setAirportCodeFilterState] = useState('Todos');
  
  // Estados para el modal de pedidos
  const [showPedidosModal, setShowPedidosModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Almacen | null>(null);
  const [pedidosEnAlmacen, setPedidosEnAlmacen] = useState<PedidoEnAlmacen[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [errorPedidos, setErrorPedidos] = useState<string | null>(null);

  useEffect(() => {
    loadWarehouses();
  }, []);

  // Efecto para aplicar filtro desde URL
  useEffect(() => {
    const codigoParam = searchParams.get('codigo');
    if (codigoParam && warehouses.length > 0) {
      // Verificar que el código exista en la lista de almacenes
      const almacenExiste = warehouses.some(w => w.codigo === codigoParam);
      if (almacenExiste) {
        setAirportCodeFilterState(codigoParam);
      }
    }
  }, [searchParams, warehouses]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getOperacionesStatus();
      setWarehouses(response.almacenes);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los almacenes');
      console.error('Error cargando almacenes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerPedidos = async (warehouse: Almacen) => {
    setSelectedWarehouse(warehouse);
    setShowPedidosModal(true);
    setLoadingPedidos(true);
    setErrorPedidos(null);
    setPedidosEnAlmacen([]);

    try {
      const pedidos = await getPedidosPorAlmacen(warehouse.codigo);
      setPedidosEnAlmacen(pedidos);
    } catch (err: any) {
      setErrorPedidos(err.message || 'Error al cargar los pedidos');
      console.error('Error cargando pedidos del almacén:', err);
    } finally {
      setLoadingPedidos(false);
    }
  };

  const handleCloseModal = () => {
    setShowPedidosModal(false);
    setSelectedWarehouse(null);
    setPedidosEnAlmacen([]);
    setErrorPedidos(null);
  };

  const getCapacityColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'critical':
        return { label: 'Crítico', color: 'bg-red-500 text-white' };
      case 'warning':
        return { label: 'Alerta', color: 'bg-yellow-500 text-white' };
      case 'normal':
      default:
        return { label: 'Normal', color: 'bg-green-500 text-white' };
    }
  };

  const statusCounts = {
    critical: warehouses.filter(w => w.status === 'critical').length,
    warning: warehouses.filter(w => w.status === 'warning').length,
    normal: warehouses.filter(w => w.status === 'normal').length
  };

  // Obtener lista única de códigos de aeropuerto
  const uniqueAirportCodes = Array.from(new Set(warehouses.map(w => w.codigo)));

  // Filtrado de almacenes según los filtros seleccionados
  const filteredWarehouses = warehouses.filter((w) => {
    const warehouseStatus = w.status; // Ahora el backend ya nos da el status calculado
    
    // Filtro por estado
    const statusMatch =
      statusFilter === 'Todos' ||
      (statusFilter === 'Crítico' && warehouseStatus === 'critical') ||
      (statusFilter === 'Alerta' && warehouseStatus === 'warning') ||
      (statusFilter === 'Normal' && warehouseStatus === 'normal');

    // Filtro por código de aeropuerto
    const airportCodeFilter = airportCodeFilterState === 'Todos' || w.codigo === airportCodeFilterState;

    return statusMatch && airportCodeFilter;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF6600] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Cargando almacenes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#FF6600] text-white px-8 py-6">
        <h1 className="text-3xl font-bold">Panel de almacenes</h1>
        <p className="text-lg mt-1">Monitoreo de almacenes en tiempo real</p>
      </div>

      <div className="p-8">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-red-700">
                <span className="font-bold">Error:</span> {error}
              </p>
              <button 
                onClick={loadWarehouses}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-gray-600" />

              <div className="flex flex-col">
                <label className="text-xs text-gray-500 mb-1">Estado</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                >
                  <option>Todos</option>
                  <option>Crítico</option>
                  <option>Alerta</option>
                  <option>Normal</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-gray-500 mb-1">Código aeropuerto</label>
                <select
                  value={airportCodeFilterState}
                  onChange={(e) => setAirportCodeFilterState(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                >
                  <option>Todos</option>
                  {uniqueAirportCodes.map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={loadWarehouses}
                className="mt-5 px-4 py-2 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] flex items-center gap-2"
                title="Recargar datos"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-red-100 text-red-800 rounded-lg font-semibold">
                {statusCounts.critical} Críticos
              </div>
              <div className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-semibold">
                {statusCounts.warning} En alerta
              </div>
              <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-semibold">
                {statusCounts.normal} Normales
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {filteredWarehouses.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg">No se encontraron almacenes que coincidan con los filtros</p>
            </div>
          ) : (
            filteredWarehouses.map((warehouse) => {
              const percentage = Math.round(warehouse.ocupacion); // El backend ya calcula la ocupación
              const warehouseStatus = warehouse.status; // El backend ya nos da el status
              const statusBadge = getStatusBadge(warehouseStatus);

              return (
                <div key={warehouse.codigo} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{warehouse.nombre}</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {warehouse.codigo}
                    </p>

                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Capacidad</span>
                        <span className="font-semibold text-gray-800">
                          {warehouse.capacidadActual}/{warehouse.capacidad} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full ${getCapacityColor(percentage)} transition-all`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <span className="text-gray-700">Coordenadas: <span className="font-semibold">{warehouse.lat.toFixed(4)}, {warehouse.lon.toFixed(4)}</span></span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className={`w-full px-4 py-2 rounded-lg font-medium text-center ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                      <button
                        onClick={() => handleVerPedidos(warehouse)}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <Package className="w-4 h-4" />
                        Ver pedidos
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end">
          <button className="px-8 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium shadow-lg">
            Generar reporte
          </button>
        </div>
      </div>

      {/* Modal de pedidos */}
      {showPedidosModal && selectedWarehouse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#FF6600] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Pedidos en almacén</h2>
                <p className="text-sm opacity-90 mt-1">
                  {selectedWarehouse.nombre} ({selectedWarehouse.codigo})
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
              {loadingPedidos ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 border-4 border-[#FF6600] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600">Cargando pedidos...</p>
                </div>
              ) : errorPedidos ? (
                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                  <p className="text-red-700">
                    <span className="font-bold">Error:</span> {errorPedidos}
                  </p>
                </div>
              ) : pedidosEnAlmacen.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No hay pedidos en este almacén</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      Total de pedidos: <span className="font-semibold text-gray-800">{pedidosEnAlmacen.length}</span>
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Destino</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cantidad</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tramo</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pedidosEnAlmacen.map((pedido) => (
                          <tr key={pedido.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">#{pedido.id}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{pedido.aeropuertoDestino}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{pedido.cantidad}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {pedido.estado}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">Tramo {pedido.tramoActual}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {new Date(pedido.fecha).toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
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