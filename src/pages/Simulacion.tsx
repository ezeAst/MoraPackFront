import { useState, useEffect } from 'react';
import { Play, Pause, FastForward, Rewind, Square, Download, Eye } from 'lucide-react';
import type { Simulation } from '../types';

const SAMPLE_SIMULATIONS: Simulation[] = [
  {
    id: '1',
    simulation_type: 'weekly',
    start_time: '2025-08-24T10:30:00',
    duration_seconds: 1816,
    status: 'completed',
    orders_processed: 12450,
    flights_completed: 58,
    packages_delivered: 11820,
    packages_pending: 630,
    success_rate: 94.9,
    max_warehouse_capacity_used: 82,
    flights_cancelled: 2,
    created_at: new Date().toISOString()
  }
];

let simulationIdCounter = 2;

export default function Simulacion() {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<'weekly' | 'stress_test'>('weekly');
  const [startDateTime, setStartDateTime] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [currentSimulation, setCurrentSimulation] = useState<Simulation | null>(null);

  useEffect(() => {
    loadSimulations();
  }, []);

  const loadSimulations = () => {
    setSimulations([...SAMPLE_SIMULATIONS].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  };

  const handleStartSimulation = () => {
    const newSimulation: Simulation = {
      id: String(simulationIdCounter++),
      simulation_type: selectedScenario,
      start_time: startDateTime || new Date().toISOString(),
      duration_seconds: 0,
      status: 'running',
      orders_processed: 0,
      flights_completed: 0,
      packages_delivered: 0,
      packages_pending: 0,
      success_rate: 0,
      max_warehouse_capacity_used: 0,
      flights_cancelled: 0,
      created_at: new Date().toISOString()
    };
    SAMPLE_SIMULATIONS.unshift(newSimulation);
    setCurrentSimulation(newSimulation);
    setIsRunning(true);
    setShowControlPanel(true);
  };

  const handlePauseSimulation = () => {
    setIsRunning(false);
  };

  const handleResumeSimulation = () => {
    setIsRunning(true);
  };

  const handleStopSimulation = () => {
    if (currentSimulation) {
      currentSimulation.status = 'completed';
      setIsRunning(false);
      setShowControlPanel(false);
      loadSimulations();
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}min ${secs}seg`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#FF6600] text-white px-8 py-6">
        <h1 className="text-3xl font-bold">Simulación del sistema</h1>
        <p className="text-lg mt-1">Pruebe el rendimiento del sistema en diferentes escenarios</p>
      </div>

      {!showControlPanel ? (
        <div className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Selección de escenario</h2>

              <div className="space-y-4 mb-6">
                <button
                  onClick={() => setSelectedScenario('weekly')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedScenario === 'weekly'
                      ? 'bg-purple-100 border-purple-500'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <h3 className="font-bold text-gray-800 mb-1">Simulación semanal</h3>
                  <p className="text-sm text-gray-600">Simulación semanal que cubre una semana completa</p>
                </button>

                <button
                  onClick={() => setSelectedScenario('stress_test')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedScenario === 'stress_test'
                      ? 'bg-purple-100 border-purple-500'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <h3 className="font-bold text-gray-800 mb-1">Prueba de colapso</h3>
                  <p className="text-sm text-gray-600">Escenario de alta estrés con carga máxima</p>
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha y hora de inicio:
                </label>
                <input
                  type="datetime-local"
                  value={startDateTime}
                  onChange={(e) => setStartDateTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6600]"
                />
              </div>

              <button
                onClick={handleStartSimulation}
                className="w-full px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Comenzar
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Últimos resultados</h2>

              {simulations[0] && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Tipo de simulación:</span>{' '}
                      {simulations[0].simulation_type === 'weekly' ? 'Semanal' : 'Prueba de colapso'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Fecha y hora de ejecución:</span>{' '}
                      {new Date(simulations[0].start_time).toLocaleString('es-ES')}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Duración:</span>{' '}
                      {formatDuration(simulations[0].duration_seconds)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Progreso de la simulación</p>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div className="bg-green-500 h-4 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                    <p className="text-sm text-right text-gray-600 mt-1">100%</p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Pedidos procesados:</span> {simulations[0].orders_processed.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Vuelos realizados:</span> {simulations[0].flights_completed}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Paquetes entregados:</span> {simulations[0].packages_delivered.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Paquetes pendientes:</span> {simulations[0].packages_pending}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Tasa de éxito:</span> {simulations[0].success_rate}%
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Capacidad máxima de almacenes usada:</span> {simulations[0].max_warehouse_capacity_used}%
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Vuelos cancelados:</span> {simulations[0].flights_cancelled}
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-green-600 pt-4 border-t border-gray-200">
                    Estado: finalizada
                  </p>

                  <div className="flex gap-3">
                    <button className="flex-1 px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium flex items-center justify-center gap-2">
                      <Download className="w-5 h-5" />
                      Exportar Resultados
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-gray-50">
          <div className="p-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Panel de control</h2>
                <p className="text-green-600 font-semibold">
                  Estado: {isRunning ? 'en ejecución' : 'pausado'}
                </p>
              </div>

              <div className="flex gap-3 mb-6">
                {!isRunning && (
                  <button
                    onClick={handleResumeSimulation}
                    className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium flex items-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Reanudar
                  </button>
                )}
                {isRunning && (
                  <button
                    onClick={handlePauseSimulation}
                    className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium flex items-center gap-2"
                  >
                    <Pause className="w-5 h-5" />
                    Pausar
                  </button>
                )}
                <button className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium flex items-center gap-2">
                  <FastForward className="w-5 h-5" />
                  Aumentar
                </button>
                <button className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium flex items-center gap-2">
                  <Rewind className="w-5 h-5" />
                  Reducir
                </button>
                <button
                  onClick={handleStopSimulation}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2"
                >
                  <Square className="w-5 h-5" />
                  Detener
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="bg-gray-200 rounded-xl h-[500px] relative overflow-hidden">
                    <svg viewBox="0 0 1000 500" className="w-full h-full">
                      <rect width="1000" height="500" fill="#e5e7eb" />

                      <line x1="200" y1="350" x2="450" y2="150" stroke="#FF6600" strokeWidth="2" strokeDasharray="5,5" />
                      <line x1="450" y1="150" x2="700" y2="280" stroke="#0066FF" strokeWidth="2" strokeDasharray="5,5" />

                      <circle cx="200" cy="350" r="10" fill="#FFC107" />
                      <circle cx="450" cy="150" r="10" fill="#28A745" />
                      <circle cx="700" cy="280" r="10" fill="#DC3545" />

                      <g transform="translate(320, 250)">
                        <path d="M 0 -10 L 10 0 L 0 10 L -8 0 Z" fill="#FF6600" />
                        <circle cx="0" cy="0" r="4" fill="white" />
                      </g>

                      <g transform="translate(580, 210)">
                        <path d="M 0 -10 L 10 0 L 0 10 L -8 0 Z" fill="#0066FF" />
                        <circle cx="0" cy="0" r="4" fill="white" />
                      </g>
                    </svg>
                  </div>

                  <div className="mt-4 text-center">
                    <p className="text-lg font-semibold text-gray-800">
                      Tiempo transcurrido: 5 días, 15 horas y 2 minutos
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Hora actual: 30/08/2025 01:32 AM
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="mb-4">
                    <p className="text-green-600 font-semibold">Estado: en ejecución</p>
                    <p className="text-sm text-gray-600">
                      Tipo de simulación: {selectedScenario === 'weekly' ? 'Semanal' : 'Prueba de colapso'}
                    </p>
                    <p className="text-sm text-gray-600">Tiempo restante: 18 minutos</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Métricas parciales en ejecución</h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-700">
                      <span className="font-semibold">% de avance de la simulación:</span> 62%
                    </p>
                    <p className="text-gray-700">
                      <span className="font-semibold">Envíos procesados:</span> 8,450
                    </p>
                    <p className="text-gray-700">
                      <span className="font-semibold">Vuelos completados:</span> 47
                    </p>
                    <p className="text-gray-700">
                      <span className="font-semibold">Vuelos en curso:</span> 7
                    </p>
                    <p className="text-gray-700">
                      <span className="font-semibold">Envíos entregados:</span> 6,820
                    </p>
                    <p className="text-gray-700">
                      <span className="font-semibold">Envíos pendientes:</span> 2,630
                    </p>
                    <p className="text-gray-700">
                      <span className="font-semibold">Capacidad de almacenes usada:</span> 62%
                    </p>
                    <p className="text-gray-700">
                      <span className="font-semibold">Vuelos cancelados:</span> 2
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Notificaciones</h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      ⚠️ El pedido ABC se distribuirá en dos vuelos: VL-220 y VL-221
                    </p>
                  </div>
                </div>

                <button className="w-full px-6 py-3 bg-[#FF6600] text-white rounded-lg hover:bg-[#e55d00] font-medium flex items-center justify-center gap-2">
                  <Download className="w-5 h-5" />
                  Exportar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
