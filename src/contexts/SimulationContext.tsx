import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as api from '../services/api';

interface SimulationContextType {
  // Estados de la simulación
  simulationId: string | null;
  isRunning: boolean;
  flights: api.Flight[];
  warehouses: api.Warehouse[];
  metrics: api.SimulationMetrics | null;
  events: api.SimulationEvent[];
  progress: number;
  currentTime: string;
  selectedScenario: 'weekly' | 'stress_test';
  startDateTime: string;
  planningStatus: string;
  
  // Acciones
  setSimulationId: (id: string | null) => void;
  setIsRunning: (running: boolean) => void;
  setSelectedScenario: (scenario: 'weekly' | 'stress_test') => void;
  setStartDateTime: (dateTime: string) => void;
  startSimulation: (config: api.CreateSimulationRequest) => Promise<api.CreateSimulationResponse>;
  pauseSimulation: () => Promise<void>;
  resumeSimulation: () => Promise<void>;
  stopSimulation: () => Promise<void>;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export function SimulationProvider({ children }: { children: ReactNode }) {
  // Estados de la simulación
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [flights, setFlights] = useState<api.Flight[]>([]);
  const [warehouses, setWarehouses] = useState<api.Warehouse[]>([]);
  const [metrics, setMetrics] = useState<api.SimulationMetrics | null>(null);
  const [events, setEvents] = useState<api.SimulationEvent[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<'weekly' | 'stress_test'>('weekly');
  const [startDateTime, setStartDateTime] = useState('');
  const [planningStatus, setPlanningStatus] = useState<string>('');

  // Polling para actualizar estado - Continúa mientras haya una simulación activa
  useEffect(() => {
    if (!simulationId) return;

    const interval = setInterval(async () => {
      try {
        const status = await api.getSimulationStatus(simulationId);

        // Detectar si está en planificación
        if (status.status === 'PLANNING_IN_PROGRESS') {
          setPlanningStatus(`Generando rutas... ${status.activeFlights.length} vuelos disponibles`);
          setIsRunning(true); // Asegurar que isRunning está activo durante planificación
        } else {
          setPlanningStatus('');
        }

        setFlights(status.activeFlights);
        setWarehouses(status.warehouses);
        setMetrics(status.metrics);
        setEvents(status.recentEvents.slice(0, 10));
        
        // Log para depuración si el backend envía valores inválidos
        if (status.progressPercentage < 0 || status.progressPercentage > 100) {
          console.warn(`⚠️ Progreso fuera de rango del backend: ${status.progressPercentage}%. Normalizando...`);
        }
        
        // Validar y normalizar el progreso entre 0 y 100
        const normalizedProgress = Math.max(0, Math.min(100, status.progressPercentage || 0));
        setProgress(normalizedProgress);
        
        setCurrentTime(status.currentDateTime);

        // Actualizar isRunning basado en el estado del backend
        if (status.status === 'RUNNING' || status.status === 'PLANNING_IN_PROGRESS') {
          setIsRunning(true);
        } else if (status.status === 'PAUSED') {
          setIsRunning(false);
        } else if (status.status === 'COMPLETED') {
          setIsRunning(false);
        }
      } catch (err) {
        console.error('Error al obtener estado de simulación:', err);
      }
    }, 1500); // Actualiza cada 1.5 segundos

    return () => clearInterval(interval);
  }, [simulationId]); // Solo depende de simulationId para mantener polling continuo

  // Acciones
  const startSimulation = async (config: api.CreateSimulationRequest): Promise<api.CreateSimulationResponse> => {
    const response = await api.createSimulation(config);
    setSimulationId(response.simulationId);
    setWarehouses(response.warehouses);
    setIsRunning(true);
    setProgress(0);
    setPlanningStatus('Iniciando planificación...');
    return response;
  };

  const pauseSimulation = async () => {
    if (!simulationId) return;
    await api.controlSimulation(simulationId, 'pause');
    setIsRunning(false);
  };

  const resumeSimulation = async () => {
    if (!simulationId) return;
    await api.controlSimulation(simulationId, 'resume');
    setIsRunning(true);
  };

  const stopSimulation = async () => {
    if (!simulationId) return;
    await api.controlSimulation(simulationId, 'stop');
    setIsRunning(false);
    setSimulationId(null);
    setFlights([]);
    setWarehouses([]);
    setMetrics(null);
    setEvents([]);
    setProgress(0);
    setCurrentTime('');
    setPlanningStatus('');
  };

  return (
    <SimulationContext.Provider
      value={{
        simulationId,
        isRunning,
        flights,
        warehouses,
        metrics,
        events,
        progress,
        currentTime,
        selectedScenario,
        startDateTime,
        planningStatus,
        setSimulationId,
        setIsRunning,
        setSelectedScenario,
        setStartDateTime,
        startSimulation,
        pauseSimulation,
        resumeSimulation,
        stopSimulation,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (context === undefined) {
    throw new Error('useSimulation debe usarse dentro de un SimulationProvider');
  }
  return context;
}