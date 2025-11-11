// Base URL del backend
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ==================== TIPOS ====================

export type SimulationType = 'weekly' | 'stress_test';

export type FlightStatus = 'scheduled' | 'in_flight' | 'landed';

export type WarehouseStatus = 'normal' | 'warning' | 'critical' | 'full';

export type SimulationStatus = 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETED';

export interface Flight {
  id: string;
  flightCode: string;
  route: [number, number][];
  origin: string;
  destination: string;
  currentLat: number;
  currentLng: number;
  departureTime: string;
  arrivalTime: string;
  durationSeconds: number;
  elapsedSeconds: number;
  packages: number;
  capacity: number;
  status: FlightStatus;
  progressPercentage: number;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  capacity: number;
  current: number;
  available: number;
  status: WarehouseStatus;
  occupancyPercentage: number;
  productsInTransit: number;
  productsAtDestination: number;
}

export interface SimulationMetrics {
  ordersProcessed: number;
  flightsCompleted: number;
  packagesDelivered: number;
  packagesPending: number;
  warehouseViolations: number;
  flightViolations: number;
  successRate: number;
}

export interface SimulationEvent {
  message: string;
  type: 'FLIGHT_DEPARTED' | 'FLIGHT_ARRIVED' | 'WAREHOUSE_WARNING' | 'ORDER_RECEIVED' | 'ORDER_DELIVERED';
  simulatedSeconds: number;
  timestamp: string;
  orderId?: string;
}

export interface CreateSimulationRequest {
  type: SimulationType;
  startTime: string;
  alphaGrasp?: number;
  tamanoRcl?: number;
}

export interface CreateSimulationResponse {
  simulationId: string;
  status: string;
  message: string;
  flights: Flight[];
  warehouses: Warehouse[];
  totalOrders: number;
  totalFlights: number;
  totalPackages: number;
  estimatedDurationSeconds: number;
}

export interface OrderSnapshot {
  orderId: string;
  destinationAirport: string;
  status: 'pending' | 'in_transit' | 'delivered';
  clientId: string;
  day: number;
  hour: number;
  minute: number;
  arrivalTime?: string;
  deliveryTime?: string;
  progressPercentage: number;
}

export interface SimulationStatusResponse {
  elapsedSeconds: number;
  progressPercentage: number;
  status: SimulationStatus;
  currentDay: number;
  currentHour: number;
  currentMinute: number;
  activeFlights: Flight[];
  warehouses: Warehouse[];
  metrics: SimulationMetrics;
  recentEvents: SimulationEvent[];
  currentDateTime: string;
  activeOrders: OrderSnapshot[];
  recentlyDeliveredOrders: OrderSnapshot[];
}

export interface ControlSimulationRequest {
  action: 'pause' | 'resume' | 'stop';
}

export interface ControlSimulationResponse {
  simulationId: string;
  action: string;
  newStatus: SimulationStatus;
}

export interface Aeropuerto {
  id: number;
  codigo: string;
  nombre: string;
  pais: string;
  continente: string;
  capacidad: number;
  capacidadActual: number;
  husoHorario: number;
  lat: number;
  lon: number;
}

// ==================== FUNCIONES API ====================

/**
 * Crea una nueva simulación
 */
export async function createSimulation(
  request: CreateSimulationRequest
): Promise<CreateSimulationResponse> {
  const response = await fetch(`${API_BASE_URL}/simulations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Obtiene el estado actual de una simulación
 */
export async function getSimulationStatus(
  simulationId: string
): Promise<SimulationStatusResponse> {
  const response = await fetch(
    `${API_BASE_URL}/simulations/${simulationId}/status`
  );

  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Controla una simulación (pausar, reanudar, detener)
 */
export async function controlSimulation(
  simulationId: string,
  action: 'pause' | 'resume' | 'stop'
): Promise<ControlSimulationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/simulations/${simulationId}/control`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    }
  );

  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Obtiene la lista de todos los aeropuertos
 */
export async function getAeropuertos(): Promise<Aeropuerto[]> {
  const response = await fetch(`${API_BASE_URL}/aeropuertos`);

  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Obtiene un aeropuerto específico por código
 */
export async function getAeropuertoByCodigo(
  codigo: string
): Promise<Aeropuerto> {
  const response = await fetch(`${API_BASE_URL}/aeropuertos/${codigo}`);

  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}