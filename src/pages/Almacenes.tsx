import { useState, useEffect } from 'react';
import {Filter } from 'lucide-react';
import type { Warehouse } from '../types';

const SAMPLE_WAREHOUSES: Warehouse[] = [
  {
    id: '1',
    name: 'Aeropuerto de Lima',
    airport_code: 'LIM',
    city: 'Lima',
    country: 'Perú',
    current_capacity: 500,
    max_capacity: 700,
    packages_incoming: 31,
    packages_assigned_percentage: 25,
    status: 'warning',
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Aeropuerto de Buenos Aires',
    airport_code: 'EZE',
    city: 'Buenos Aires',
    country: 'Argentina',
    current_capacity: 650,
    max_capacity: 700,
    packages_incoming: 31,
    packages_assigned_percentage: 38,
    status: 'critical',
    created_at: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Aeropuerto de Chicago',
    airport_code: 'ORD',
    city: 'Chicago',
    country: 'USA',
    current_capacity: 350,
    max_capacity: 800,
    packages_incoming: 35,
    packages_assigned_percentage: 20,
    status: 'normal',
    created_at: new Date().toISOString()
  },
  {
    id: '4',
    name: 'Aeropuerto de Tumbes',
    airport_code: 'TBP',
    city: 'Tumbes',
    country: 'Perú',
    current_capacity: 420,
    max_capacity: 600,
    packages_incoming: 21,
    packages_assigned_percentage: 15,
    status: 'warning',
    created_at: new Date().toISOString()
  },
  {
    id: '5',
    name: 'Aeropuerto de Bogotá',
    airport_code: 'BOG',
    city: 'Bogotá',
    country: 'Colombia',
    current_capacity: 580,
    max_capacity: 650,
    packages_incoming: 31,
    packages_assigned_percentage: 42,
    status: 'critical',
    created_at: new Date().toISOString()
  },
  {
    id: '6',
    name: 'Aeropuerto de Barcelona',
    airport_code: 'BCN',
    city: 'Barcelona',
    country: 'España',
    current_capacity: 630,
    max_capacity: 700,
    packages_incoming: 18,
    packages_assigned_percentage: 55,
    status: 'critical',
    created_at: new Date().toISOString()
  }
];

export default function Almacenes() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [countryFilter, setCountryFilter] = useState('Todos');
  const [airportCodeFilterState, setAirportCodeFilterState] = useState('Todos');

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = () => {
    setWarehouses(SAMPLE_WAREHOUSES);
  };

  const getCapacityPercentage = (current: number, max: number) => {
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
        return { label: 'Normal', color: 'bg-green-500 text-white' };
      default:
        return { label: 'Normal', color: 'bg-gray-500 text-white' };
    }
  };

  const statusCounts = {
    critical: warehouses.filter(w => w.status === 'critical').length,
    warning: warehouses.filter(w => w.status === 'warning').length,
    normal: warehouses.filter(w => w.status === 'normal').length
  };

  // Filtrado de almacenes según los filtros seleccionados
  const filteredWarehouses = warehouses.filter((w) => {
    // Filtro por estado
    const statusMatch =
      statusFilter === 'Todos' ||
      (statusFilter === 'Crítico' && w.status === 'critical') ||
      (statusFilter === 'Alerta' && w.status === 'warning') ||
      (statusFilter === 'Normal' && w.status === 'normal');

    // Filtro por país
    const countryMatch = countryFilter === 'Todos' || w.country === countryFilter;

    // Filtro por código de aeropuerto
    const airportCodeFilter = airportCodeFilterState === 'Todos' || w.airport_code === airportCodeFilterState;

    return statusMatch && countryMatch && airportCodeFilter;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#FF6600] text-white px-8 py-6">
        <h1 className="text-3xl font-bold">Panel de almacenes</h1>
        <p className="text-lg mt-1">Monitoreo de almacenes en tiempo real de almacenes</p>
      </div>

      <div className="p-8">
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
                  <option>LIM</option>
                  <option>EZE</option>
                  <option>ORD</option>
                  <option>TBP</option>
                  <option>BOG</option>
                  <option>BCN</option>
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
                  <option>Perú</option>
                  <option>Argentina</option>
                  <option>USA</option>
                  <option>Colombia</option>
                  <option>España</option>
                </select>
              </div>
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
          {filteredWarehouses.map((warehouse) => {
            const percentage = getCapacityPercentage(warehouse.current_capacity, warehouse.max_capacity);
            const statusBadge = getStatusBadge(warehouse.status);

            return (
              <div key={warehouse.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-1">{warehouse.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {warehouse.airport_code} | {warehouse.city}, {warehouse.country}
                  </p>

                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Capacidad</span>
                      <span className="font-semibold text-gray-800">
                        {warehouse.current_capacity}/{warehouse.max_capacity} ({percentage}%)
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
                      <span className="text-gray-700">Paquetes por llegar: <span className="font-semibold">{warehouse.packages_incoming}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 bg-orange-500 rounded"></div>
                      <span className="text-gray-700">Paquetes asignados a vuelo de ida: <span className="font-semibold">{warehouse.packages_assigned_percentage}%</span></span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                      Entrar
                    </button>
                    <span className={`flex-1 px-4 py-2 rounded-lg font-medium text-center ${statusBadge.color}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button className="px-8 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium shadow-lg">
            Generar reporte
          </button>
        </div>
      </div>
    </div>
  );
}
