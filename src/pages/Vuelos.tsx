import { useState, useEffect } from 'react';
import { Plane, Download } from 'lucide-react';
import type { Flight } from '../types';

const SAMPLE_FLIGHTS: Flight[] = [
  {
    id: '1',
    flight_code: 'VUELO-001',
    origin: 'Lima',
    origin_code: 'PER',
    destination: 'Bruselas',
    destination_code: 'BEL',
    current_packages: 120,
    max_capacity: 250,
    departure_time: '2025-08-26T08:00:00',
    arrival_time: '2025-08-26T16:00:00',
    status: 'in_transit',
    progress_percentage: 65,
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    flight_code: 'VUELO-002',
    origin: 'Bruselas',
    origin_code: 'BEL',
    destination: 'Madrid',
    destination_code: 'ESP',
    current_packages: 180,
    max_capacity: 300,
    departure_time: '2025-08-26T08:00:00',
    arrival_time: '2025-08-26T10:00:00',
    status: 'ready',
    progress_percentage: 100,
    created_at: new Date().toISOString()
  },
  {
    id: '3',
    flight_code: 'VUELO-003',
    origin: 'Santiago',
    origin_code: 'CHI',
    destination: 'Lima',
    destination_code: 'PER',
    current_packages: 260,
    max_capacity: 400,
    departure_time: '2025-08-26T08:00:00',
    arrival_time: '2025-08-26T12:00:00',
    status: 'in_transit',
    progress_percentage: 40,
    created_at: new Date().toISOString()
  },
  {
    id: '4',
    flight_code: 'VUELO-004',
    origin: 'Nueva York',
    origin_code: 'USA',
    destination: 'Lima',
    destination_code: 'PER',
    current_packages: 200,
    max_capacity: 280,
    departure_time: '2025-08-27T09:00:00',
    arrival_time: '2025-08-27T18:00:00',
    status: 'in_progress',
    progress_percentage: 0,
    created_at: new Date().toISOString()
  }
];

let flightIdCounter = 5;

export default function Vuelos() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [showNewFlightModal, setShowNewFlightModal] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);

  const [newFlight, setNewFlight] = useState({
    origin: '',
    destination: '',
    maxCapacity: '',
    packageQuantity: '',
    departureTime: '',
    arrivalTime: ''
  });

  useEffect(() => {
    loadFlights();
  }, []);

  const loadFlights = () => {
    setFlights([...SAMPLE_FLIGHTS].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  };

  const handleRegisterFlight = () => {
    const flightCode = `VUELO-${String(flightIdCounter++).padStart(3, '0')}`;
    const flight: Flight = {
      id: String(flightIdCounter),
      flight_code: flightCode,
      origin: newFlight.origin,
      origin_code: 'XXX',
      destination: newFlight.destination,
      destination_code: 'YYY',
      current_packages: parseInt(newFlight.packageQuantity),
      max_capacity: parseInt(newFlight.maxCapacity),
      departure_time: newFlight.departureTime,
      arrival_time: newFlight.arrivalTime,
      status: 'in_progress',
      progress_percentage: 0,
      created_at: new Date().toISOString()
    };
    SAMPLE_FLIGHTS.unshift(flight);
    loadFlights();
    setShowNewFlightModal(false);
    setNewFlight({
      origin: '',
      destination: '',
      maxCapacity: '',
      packageQuantity: '',
      departureTime: '',
      arrivalTime: ''
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-100 text-green-800';
      case 'in_transit': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'delayed': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready': return 'Listo';
      case 'in_transit': return 'En Tránsito';
      case 'in_progress': return 'En Proceso';
      case 'delayed': return 'Retrasado';
      default: return status;
    }
  };

  const getProgressColor = (status: string) => {
    if (status === 'ready') return 'bg-green-500';
    if (status === 'in_transit' || status === 'delayed') return 'bg-blue-500';
    return 'bg-gray-300';
  };

  const calculateTimeRemaining = (arrivalTime: string) => {
    const now = new Date();
    const arrival = new Date(arrivalTime);
    const diff = arrival.getTime() - now.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return `${days}d ${hours.toString().padStart(2, '0')}h`;
  };

  const statusCounts = {
    active: flights.filter(f => f.status === 'in_transit' || f.status === 'in_progress').length,
    in_transit: flights.filter(f => f.status === 'in_transit').length,
    ready: flights.filter(f => f.status === 'ready').length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#FF6600] text-white px-8 py-6">
        <h1 className="text-3xl font-bold">Monitoreo en tiempo real</h1>
        <p className="text-lg mt-1">Rastrea todos los paquetes activos y su estado actual</p>
      </div>

      <div className="p-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]">
                <option>Todos</option>
                <option>En Tránsito</option>
                <option>Listo</option>
                <option>En Proceso</option>
              </select>

              <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]">
                <option>Todos</option>
                <option>Lima</option>
                <option>Bruselas</option>
                <option>Madrid</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-semibold">
                {statusCounts.active} Total Activo
              </div>
              <div className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-semibold">
                {statusCounts.in_transit} En Tránsito
              </div>
              <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-semibold">
                {statusCounts.ready} Retraso o Lista
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">ID de Vuelo</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Origen → Destino</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Paquetes</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Progreso</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tiempo restante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {flights.map((flight) => (
                  <tr
                    key={flight.id}
                    onClick={() => setSelectedFlight(flight)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-800">{flight.flight_code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-700">
                        {flight.origin} ({flight.origin_code}) → {flight.destination} ({flight.destination_code})
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Plane className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">{flight.current_packages} / {flight.max_capacity}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(flight.status)}`}>
                        {getStatusLabel(flight.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-32">
                          <div
                            className={`h-full rounded-full ${getProgressColor(flight.status)}`}
                            style={{ width: `${flight.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{flight.progress_percentage}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-700 font-medium">{calculateTimeRemaining(flight.arrival_time)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowNewFlightModal(true)}
            className="px-8 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium shadow-lg"
          >
            Crear Vuelo
          </button>
          <button className="px-8 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium shadow-lg flex items-center gap-2">
            <Download className="w-5 h-5" />
            Exportar
          </button>
        </div>
      </div>

      {selectedFlight && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-3xl mx-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">ID: {selectedFlight.flight_code}</h2>
                <p className="text-lg text-gray-600 flex items-center gap-2 mt-1">
                  <Plane className="w-5 h-5" />
                  {selectedFlight.origin} ({selectedFlight.origin_code}) → {selectedFlight.destination} ({selectedFlight.destination_code})
                </p>
              </div>
              <button
                onClick={() => setSelectedFlight(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Plane className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-700">{selectedFlight.current_packages} / {selectedFlight.max_capacity}</span>
                  <span className={`ml-2 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedFlight.status)}`}>
                    {getStatusLabel(selectedFlight.status)}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Salida:</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(selectedFlight.departure_time).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Llegada estimada:</p>
                    <p className="font-semibold text-gray-800">
                      {new Date(selectedFlight.arrival_time).toLocaleString('es-ES')}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-200 rounded-full h-3 mb-2">
                  <div
                    className={`h-full rounded-full ${getProgressColor(selectedFlight.status)}`}
                    style={{ width: `${selectedFlight.progress_percentage}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{selectedFlight.progress_percentage}%</p>
              </div>

              <div className="bg-gray-100 rounded-xl p-4 relative">
                <svg viewBox="0 0 300 200" className="w-full h-full">
                  <rect width="300" height="200" fill="#e5e7eb" />

                  <circle cx="50" cy="150" r="8" fill="#003366" />
                  <path d="M 50 150 L 44 144 L 50 138 L 56 144 Z" fill="#003366" />

                  <circle cx="250" cy="50" r="8" fill="#003366" />
                  <path d="M 250 50 L 244 44 L 250 38 L 256 44 Z" fill="#003366" />

                  <line x1="50" y1="150" x2="250" y2="50" stroke="#0066FF" strokeWidth="2" strokeDasharray="5,5" />

                  <g transform={`translate(${50 + (250-50) * selectedFlight.progress_percentage / 100}, ${150 + (50-150) * selectedFlight.progress_percentage / 100})`}>
                    <path d="M 0 -8 L 8 0 L 0 8 L -6 0 Z" fill="#FF6600" />
                    <circle cx="0" cy="0" r="3" fill="white" />
                  </g>
                </svg>
                <p className="text-xs text-gray-600 mt-2 text-center">
                  {new Date().toLocaleString('es-ES')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewFlightModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center gap-2 mb-6">
              <Plane className="w-6 h-6 text-[#FF6600]" />
              <h2 className="text-2xl font-bold text-gray-800">Nuevo Registro de Vuelo</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Origen</label>
                <input
                  type="text"
                  value={newFlight.origin}
                  onChange={(e) => setNewFlight({ ...newFlight, origin: e.target.value })}
                  placeholder="Ingrese Origen"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destino</label>
                <input
                  type="text"
                  value={newFlight.destination}
                  onChange={(e) => setNewFlight({ ...newFlight, destination: e.target.value })}
                  placeholder="Ingrese Destino"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Capacidad Máxima</label>
                <input
                  type="number"
                  value={newFlight.maxCapacity}
                  onChange={(e) => setNewFlight({ ...newFlight, maxCapacity: e.target.value })}
                  placeholder="Ingrese Capacidad Máx."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad de Paquetes</label>
                <input
                  type="number"
                  value={newFlight.packageQuantity}
                  onChange={(e) => setNewFlight({ ...newFlight, packageQuantity: e.target.value })}
                  placeholder="Ingrese Cantidad de Paq."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Horario de salida</label>
                <input
                  type="datetime-local"
                  value={newFlight.departureTime}
                  onChange={(e) => setNewFlight({ ...newFlight, departureTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Horario de llegada</label>
                <input
                  type="datetime-local"
                  value={newFlight.arrivalTime}
                  onChange={(e) => setNewFlight({ ...newFlight, arrivalTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRegisterFlight}
                className="flex-1 px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium"
              >
                Registrar vuelo
              </button>
              <button className="flex-1 px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium">
                Importar vuelos
              </button>
            </div>

            <button
              onClick={() => setShowNewFlightModal(false)}
              className="w-full mt-3 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
