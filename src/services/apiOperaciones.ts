// src/services/apiOperaciones.ts
import type { OperacionesStatus } from '../types/operaciones';

// Base URL del backend - usa variable de entorno o fallback a localhost
const API_BASE_URL = 'http://localhost:8080/api';

// ==================== TIPOS ADICIONALES ====================

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

export interface StartOperacionesResponse {
  status: string;
  startTime: string;
  message: string;
}

export interface StopOperacionesResponse {
  status: string;
  message: string;
}

export type EstadoPedido = 'NO_ASIGNADO' | 'ASIGNADO' | 'EN_TRANSITO' | 'EN_ALMACEN_INTERMEDIO' | 'ENTREGADO';

export interface Pedido {
  id: number;
  dia: number;
  mes: number;
  hora: number;
  minuto: number;
  destino: string;
  cantidad: number;
  estado: EstadoPedido;
  tramoActual?: string;
}

export interface VueloActivo {
  id: string;
  flightCode: string;
  route: [[number, number], [number, number]]; // [[lonOrigen, latOrigen], [lonDestino, latDestino]]
  currentLat: number;
  currentLng: number;
  departureTime: string;
  arrivalTime: string;
  durationSeconds: number;
  elapsedSeconds: number;
  packages: number;
  capacity: number;
  status: string;
  statusLabel: string;
  progressPercentage: number;
}

// ==================== FUNCIONES API ====================

/**
 * Inicia el ciclo operativo en tiempo real (planificador día a día)
 * 
 * @returns Estado de inicio con timestamp
 * @throws Error si la petición falla
 */
export async function startOperaciones(): Promise<StartOperacionesResponse> {
  const response = await fetch(`${API_BASE_URL}/operaciones/start`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Error al iniciar operaciones: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Detiene el ciclo operativo
 * 
 * @returns Confirmación de detención
 * @throws Error si la petición falla
 */
export async function stopOperaciones(): Promise<StopOperacionesResponse> {
  const response = await fetch(`${API_BASE_URL}/operaciones/stop`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Error al detener operaciones: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Obtiene el estado completo de las operaciones en tiempo real
 * Este es el endpoint principal para el dashboard que se consulta cada 5 segundos
 * 
 * @returns Estado completo: vuelos activos, almacenes, métricas, eventos
 * @throws Error si la petición falla
 */
export async function getOperacionesStatus(): Promise<OperacionesStatus> {
  const response = await fetch(`${API_BASE_URL}/operaciones/status`, {
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Error al obtener estado de operaciones: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Obtiene la lista de pedidos filtrados por estado (opcional)
 * 
 * @param estado - Estado opcional del pedido (NO_ASIGNADO, ASIGNADO, EN_TRANSITO, EN_ALMACEN_INTERMEDIO, ENTREGADO)
 * @returns Lista de pedidos
 * @throws Error si la petición falla
 */
export async function getPedidos(estado?: EstadoPedido): Promise<Pedido[]> {
  const url = estado 
    ? `${API_BASE_URL}/operaciones/pedidos?estado=${estado}`
    : `${API_BASE_URL}/operaciones/pedidos`;
    
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Error al obtener pedidos: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Obtiene únicamente vuelos en tránsito con interpolación de posición actual
 * 
 * @returns Lista de vuelos activos con posición interpolada
 * @throws Error si la petición falla
 */
export async function getVuelosActivos(): Promise<VueloActivo[]> {
  const response = await fetch(`${API_BASE_URL}/operaciones/vuelos-activos`, {
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Error al obtener vuelos activos: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Obtiene la lista completa de aeropuertos
 * Se usa para inicializar el mapa con todos los aeropuertos disponibles
 * 
 * @returns Lista de aeropuertos con coordenadas y capacidades
 * @throws Error si la petición falla
 */
export async function getAeropuertos(): Promise<Aeropuerto[]> {
  const response = await fetch(`${API_BASE_URL}/aeropuertos`, {
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Error al obtener aeropuertos: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}