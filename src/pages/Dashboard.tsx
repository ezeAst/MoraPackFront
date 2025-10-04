import { MapPin, Plane, Info, BarChart3, Bell } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [showStats, setShowStats] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  const stats = [
    { label: 'Vuelos activos', value: '24' },
    { label: 'Paquetes en tránsito', value: '8' },
    { label: 'Entregas pendientes', value: '8' },
    { label: 'Clientes esperando sus pedidos', value: '24' }
  ];

  const alerts = [
    {
      type: 'warning',
      message: 'El vuelo VL-220 despegará en 15 minutos desde Lima',
      color: 'bg-yellow-50 border-yellow-200'
    },
    {
      type: 'info',
      message: 'El paquete MPE-002 está a 2 horas de cumplir el plazo de entrega máximo',
      color: 'bg-blue-50 border-blue-200'
    },
    {
      type: 'critical',
      message: 'El almacén Bruselas está a su 95% de capacidad',
      color: 'bg-red-50 border-red-200'
    }
  ];

  const warehouses = [
    { name: 'Lima', lat: -12, lng: -77, status: 'warning', capacity: 70 },
    { name: 'Bruselas', lat: 50.8, lng: 4.3, status: 'critical', capacity: 95 },
    { name: 'Baku', lat: 40.4, lng: 49.9, status: 'normal', capacity: 45 }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#FF6600] text-white px-8 py-6">
        <h1 className="text-3xl font-bold">Panel de Operaciones Globales</h1>
        <p className="text-lg mt-1">Monitorea envíos en tiempo real desde Lima, Bruselas y Baku</p>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="relative bg-gray-200 h-[600px]">
                <div className="absolute top-4 left-4 flex gap-2">
                  <button className="bg-white rounded-full w-10 h-10 flex items-center justify-center shadow hover:bg-gray-50">
                    +
                  </button>
                  <button className="bg-white rounded-full w-10 h-10 flex items-center justify-center shadow hover:bg-gray-50">
                    -
                  </button>
                </div>

                <svg viewBox="0 0 1000 500" className="w-full h-full">
                  <rect width="1000" height="500" fill="#e5e7eb" />

                  <path
                    d="M 150 100 L 180 80 L 200 90 L 220 85 L 240 95 L 250 90 L 270 100 L 280 95 L 300 105"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="1"
                  />

                  <path
                    d="M 400 80 L 450 75 L 480 85 L 520 80 L 550 90 L 580 85 L 600 95"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="1"
                  />

                  <line x1="200" y1="350" x2="450" y2="150" stroke="#FF6600" strokeWidth="2" strokeDasharray="5,5" />
                  <line x1="450" y1="150" x2="700" y2="280" stroke="#0066FF" strokeWidth="2" strokeDasharray="5,5" />
                  <line x1="200" y1="350" x2="350" y2="200" stroke="#FFC107" strokeWidth="2" strokeDasharray="3,3" />

                  {warehouses.map((warehouse, idx) => {
                    const x = (warehouse.lng + 180) * (1000 / 360);
                    const y = (90 - warehouse.lat) * (500 / 180);
                    const color = warehouse.status === 'critical' ? '#DC3545' :
                                 warehouse.status === 'warning' ? '#FFC107' : '#28A745';

                    return (
                      <g key={idx}>
                        <circle cx={x} cy={y} r="8" fill={color} />
                        <path
                          d={`M ${x} ${y - 12} L ${x - 6} ${y - 18} L ${x + 6} ${y - 18} Z`}
                          fill={color}
                        />
                        <text x={x} y={y + 25} textAnchor="middle" fontSize="12" fill="#374151" fontWeight="bold">
                          {warehouse.name}
                        </text>
                      </g>
                    );
                  })}

                  <g transform="translate(250, 280)">
                    <path d="M 0 -8 L 8 0 L 0 8 L -6 0 Z" fill="#FF6600" />
                    <circle cx="0" cy="0" r="3" fill="white" />
                  </g>

                  <g transform="translate(550, 200)">
                    <path d="M 0 -8 L 8 0 L 0 8 L -6 0 Z" fill="#0066FF" />
                    <circle cx="0" cy="0" r="3" fill="white" />
                  </g>
                </svg>

                <button className="absolute bottom-4 right-4 bg-[#FF6600] text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-[#e55d00]">
                  <Info className="w-6 h-6" />
                </button>
              </div>

              <div className="p-4 bg-white border-t">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-6">
                    <span className="font-semibold text-gray-700">Almacenes y aviones</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Plane className="w-4 h-4 text-green-600" />
                        <span className="text-gray-600">&gt; 70% capacidad</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Plane className="w-4 h-4 text-yellow-600" />
                        <span className="text-gray-600">&lt; 90% capacidad</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Plane className="w-4 h-4 text-red-600" />
                        <span className="text-gray-600">&gt; 90% capacidad</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-gray-700">Origen de ruta</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 border-t-2 border-dashed border-orange-500"></div>
                        <span className="text-gray-600">América</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 border-t-2 border-dashed border-blue-500"></div>
                        <span className="text-gray-600">Europa</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 border-t-2 border-yellow-500"></div>
                        <span className="text-gray-600">Asia</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-6 h-6 text-[#FF6600]" />
                <h2 className="text-xl font-bold text-gray-800">Estadísticas en tiempo real</h2>
              </div>
              <div className="space-y-4">
                {stats.map((stat, idx) => (
                  <div key={idx} className="flex items-center justify-between pb-3 border-b border-gray-100 last:border-0">
                    <span className="text-gray-600">{stat.label}</span>
                    <span className="text-2xl font-bold text-[#003366]">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="w-6 h-6 text-[#FF6600]" />
                <h2 className="text-xl font-bold text-gray-800">Alertas y notificaciones</h2>
              </div>
              <div className="space-y-3">
                {alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${alert.color}`}
                  >
                    <p className="text-sm text-gray-700">{alert.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
