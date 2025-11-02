import { useState } from 'react';
import { BarChart3, Bell } from 'lucide-react';
import MapboxMap from '../components/MapboxMap';

type Status = 'normal' | 'warning' | 'critical';

type Warehouse = {
  name: string;
  lat: number;
  lng: number;
  status: Status;
};

type Route = {
  id: string;
  coordinates: [number, number][];
  color: string;
};

export default function Dashboard() {
  const [showStats, setShowStats] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showLegend, setShowLegend] = useState(false);

  const stats = [
    { label: 'Vuelos activos', value: '24' },
    { label: 'Paquetes en tránsito', value: '8' },
    { label: 'Entregas pendientes', value: '8' },
    { label: 'Clientes esperando sus pedidos', value: '24' },
  ];

  const alerts = [
    { message: 'El vuelo VL-220 despegará en 15 minutos desde Lima', color: 'bg-yellow-50 border-yellow-200' },
    { message: 'El paquete MPE-002 está a 2 horas de cumplir el plazo de entrega máximo', color: 'bg-blue-50 border-blue-200' },
    { message: 'El almacén Bruselas está a su 95% de capacidad', color: 'bg-red-50 border-red-200' },
    { message: 'Nuevo retraso reportado en aduanas de Europa', color: 'bg-yellow-50 border-yellow-200' },
    { message: 'Ruta alternativa aplicada para MPE-010', color: 'bg-blue-50 border-blue-200' },
  ];

  const warehouses: Warehouse[] = [
    { name: 'Lima', lat: -12.0464, lng: -77.0428, status: 'warning' },
    { name: 'Bruselas', lat: 50.8503, lng: 4.3517, status: 'critical' },
    { name: 'Baku', lat: 40.4093, lng: 49.8671, status: 'normal' },
  ];

  const routes: Route[] = [
    { 
      id: 'route-1',
      coordinates: [[-77.0428, -12.0464], [4.3517, 50.8503]], 
      color: '#FF6600' 
    },
    { 
      id: 'route-2',
      coordinates: [[4.3517, 50.8503], [49.8671, 40.4093]], 
      color: '#0066FF' 
    },
    { 
      id: 'route-3',
      coordinates: [[-71.5, -16.5], [-43.2, -22.9]], 
      color: '#FFC107' 
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#FF6600] text-white px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Panel de Operaciones Globales</h1>
          <p className="text-lg mt-1">Monitorea envíos en tiempo real desde Lima, Bruselas y Baku</p>
        </div>
        <div className="flex gap-3 mt-4 lg:mt-0">
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
          <button
            onClick={() => setShowLegend(v => !v)}
            className="bg-white text-[#FF6600] px-4 py-2 rounded-lg font-medium shadow hover:bg-gray-100"
          >
            {showLegend ? 'Ocultar leyenda' : 'Mostrar leyenda'}
          </button>
        </div>
      </div>

      {/* Contenedor principal: usar todo el ancho */}
      <div className="mx-auto p-0">
        <div className="relative bg-white shadow-lg overflow-hidden">
          {/* Mapa: ocupar todo el alto disponible menos el header */}
          <div className="relative h-[calc(100vh-97px)] bg-gray-200">
            {/* Mapa Mapbox */}
            <MapboxMap warehouses={warehouses} routes={routes} />

            {/* Leyenda overlay */}
            {showLegend && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-20 w-[92%] md:w-auto">
                <div className="px-4 py-3 rounded-xl bg-white/95 backdrop-blur border shadow">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 text-sm">
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-gray-700">Almacenes</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full bg-green-600"></div>
                          <span className="text-gray-600">&lt; 70%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full bg-yellow-600"></div>
                          <span className="text-gray-600">≈ 90%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full bg-red-600"></div>
                          <span className="text-gray-600">&gt; 90%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-gray-700">Rutas</span>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-0.5 border-t-2 border-dashed border-orange-500" />
                        <span className="text-gray-600">América</span>
                        <div className="w-8 h-0.5 border-t-2 border-dashed border-blue-500" />
                        <span className="text-gray-600">Europa</span>
                        <div className="w-8 h-0.5 border-t-2 border-dashed border-yellow-500" />
                        <span className="text-gray-600">Asia</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Overlays derecha: Estadísticas y Alertas */}
            <div className="pointer-events-none absolute inset-0 z-30">
              <div className="absolute right-6 top-6 flex flex-col gap-4 pointer-events-auto">
                {showStats && (
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

                {showAlerts && (
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