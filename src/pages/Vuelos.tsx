import { useState, useEffect, useRef } from 'react';
import { Plane, Download, RefreshCcw } from 'lucide-react';
import { getVuelosActivos } from '../services/apiOperaciones';

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
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function Vuelos() {
  const [flights, setFlights] = useState<VistaVuelo[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [destinationFilter, setDestinationFilter] = useState<string>('Todos');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  // Cargar vuelos activos
  const fetchFlights = async (manual = false) => {
    if (manual) {
      // en refresco manual mostrar spinner rápido
      setLoading(true);
    }
    try {
      setError(null);
      const data = await getVuelosActivos();
      const mapped: VistaVuelo[] = data.map(v => {
        // El backend entrega route: [[lng,lat],[lng,lat]] pero no nombres; derivamos nombres simples lng,lat para ahora
        const origenStr = v.route && v.route[0] ? `${v.route[0][1].toFixed(2)},${v.route[0][0].toFixed(2)}` : 'Origen';
        const destinoStr = v.route && v.route[1] ? `${v.route[1][1].toFixed(2)},${v.route[1][0].toFixed(2)}` : 'Destino';
        return {
          id: v.id,
          flightCode: v.flightCode,
          origin: origenStr,
          destination: destinoStr,
          packages: v.packages,
          capacity: v.capacity,
          status: v.status,
          statusLabel: v.status, // statusLabel ya está normalizado a valores PROGRAMADO/EN_VUELO/ATERRIZADO
          progressPercentage: Math.min(100, Math.max(0, v.progressPercentage)),
          remainingSeconds: Math.max(0, v.durationSeconds - v.elapsedSeconds)
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

  // Filtrar vuelos por estado y destino
  const filteredFlights = flights.filter(f => {
    const matchesStatus = statusFilter === 'Todos' || statusFilter === f.status ||
      (statusFilter === 'Activos' && f.status === 'EN_VUELO');
    const matchesDestination = destinationFilter === 'Todos' || f.destination === destinationFilter;
    return matchesStatus && matchesDestination;
  });

  const statusCounts = {
    activos: flights.filter(f => f.status === 'EN_VUELO').length,
    programados: flights.filter(f => f.status === 'PROGRAMADO').length,
    aterrizados: flights.filter(f => f.status === 'ATERRIZADO').length
  };

  const destinosUnicos = Array.from(new Set(flights.map(f => f.destination))).filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#FF6600] text-white px-8 py-6">
        <h1 className="text-3xl font-bold">Monitoreo en tiempo real</h1>
        <p className="text-lg mt-1">Rastrea todos los paquetes activos y su estado actual</p>
      </div>

      <div className="p-8">
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
          {loading && !flights.length && (
            <div className="mt-4 text-sm text-gray-500">Cargando vuelos...</div>
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
                        <span className="text-sm text-gray-600">{f.progressPercentage}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">{formatRemaining(f.remainingSeconds)}</td>
                  </tr>
                ))}
                {!loading && !filteredFlights.length && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No hay vuelos para los filtros seleccionados.</td>
                  </tr>
                )}
                {loading && flights.length > 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-xs text-gray-400">Actualizando...</td>
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
    </div>
  );
}
