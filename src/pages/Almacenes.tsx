import { useState, useEffect } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import { getAeropuertos, type Aeropuerto } from '../services/api';

// Función helper para determinar el estado del almacén según su ocupación
const getWarehouseStatus = (current: number, max: number): 'normal' | 'warning' | 'critical' => {
  // Validación: si hay valores inválidos, retornar 'normal' por defecto
  if (!max || max <= 0 || !current || current < 0 || isNaN(current) || isNaN(max)) {
    return 'normal';
  }
  
  const percentage = (current / max) * 100;
  if (percentage >= 90) return 'critical';
  if (percentage >= 70) return 'warning';
  return 'normal';
};

export default function Almacenes() {
  const [warehouses, setWarehouses] = useState<Aeropuerto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [countryFilter, setCountryFilter] = useState('Todos');
  const [airportCodeFilterState, setAirportCodeFilterState] = useState('Todos');
  
  // (Eliminado) Estado para modal de detalles

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAeropuertos();
      setWarehouses(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los almacenes');
      console.error('Error cargando almacenes:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCapacityPercentage = (current: number, max: number) => {
    if (!max || max <= 0) return 0;
    return Math.round((current / max) * 100);
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
    critical: warehouses.filter(w => getWarehouseStatus(w.capacidadActual, w.capacidad) === 'critical').length,
    warning: warehouses.filter(w => getWarehouseStatus(w.capacidadActual, w.capacidad) === 'warning').length,
    normal: warehouses.filter(w => getWarehouseStatus(w.capacidadActual, w.capacidad) === 'normal').length
  };

  // Obtener lista única de países
  const uniqueCountries = Array.from(new Set(warehouses.map(w => w.pais)));
  // Obtener lista única de códigos de aeropuerto
  const uniqueAirportCodes = Array.from(new Set(warehouses.map(w => w.codigo)));

  // Filtrado de almacenes según los filtros seleccionados
  const filteredWarehouses = warehouses.filter((w) => {
    const warehouseStatus = getWarehouseStatus(w.capacidadActual, w.capacidad);
    
    // Filtro por estado
    const statusMatch =
      statusFilter === 'Todos' ||
      (statusFilter === 'Crítico' && warehouseStatus === 'critical') ||
      (statusFilter === 'Alerta' && warehouseStatus === 'warning') ||
      (statusFilter === 'Normal' && warehouseStatus === 'normal');

    // Filtro por país
    const countryMatch = countryFilter === 'Todos' || w.pais === countryFilter;

    // Filtro por código de aeropuerto
    const airportCodeFilter = airportCodeFilterState === 'Todos' || w.codigo === airportCodeFilterState;

    return statusMatch && countryMatch && airportCodeFilter;
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

              <div className="flex flex-col">
                <label className="text-xs text-gray-500 mb-1">País</label>
                <select
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                >
                  <option>Todos</option>
                  {uniqueCountries.map(country => (
                    <option key={country} value={country}>{country}</option>
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
              const percentage = getCapacityPercentage(warehouse.capacidadActual, warehouse.capacidad);
              const warehouseStatus = getWarehouseStatus(warehouse.capacidadActual, warehouse.capacidad);
              const statusBadge = getStatusBadge(warehouseStatus);

              return (
                <div key={warehouse.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{warehouse.nombre}</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {warehouse.codigo} | {warehouse.pais}
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
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <span className="text-gray-700">Continente: <span className="font-semibold">{warehouse.continente}</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-4 h-4 bg-orange-500 rounded"></div>
                        <span className="text-gray-700">Huso horario: <span className="font-semibold">UTC{warehouse.husoHorario > 0 ? '+' : ''}{warehouse.husoHorario}</span></span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <span className={`w-full px-4 py-2 rounded-lg font-medium text-center ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
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

      {/* (Eliminado) Modal de detalles */}
    </div>
  );
}
