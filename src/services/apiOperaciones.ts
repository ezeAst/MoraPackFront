// src/services/apiOperaciones.ts
import type { OperacionesStatus } from '../types/operaciones';

// Base URL del backend - usa variable de entorno o fallback a localhost
//const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const API_BASE_URL = "http://localhost:8080/api"

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

export interface StartOperacionesRequest {
  fechaHoraInicio: string; // Formato: "YYYY-MM-DDTHH:mm:ss"
}

export interface StartOperacionesResponse {
  status: string;
  startTime: string;
  tiempoSimulado: string;
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
  origin: string;  // ✅ Nombre del aeropuerto de origen
  destination: string;  // ✅ Nombre del aeropuerto de destino
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
  orderIds?: string[]; // ✅ IDs de pedidos en el vuelo
}

export interface PedidoEnVuelo {
  id: number;
  aeropuertoDestino: string;
  cantidad: number;
  estado: string;
  tramoActual: number;
  fecha: string;
  idCliente: string;
}

// ==================== FUNCIONES API ====================

/**
 * Inicia el ciclo operativo con una fecha/hora específica (tiempo simulado)
 * 
 * @param fechaHoraInicio - Fecha y hora de inicio en formato ISO (YYYY-MM-DDTHH:mm:ss)
 * @returns Estado de inicio con timestamp y tiempo simulado
 * @throws Error si la petición falla
 */
export async function startOperaciones(fechaHoraInicio: string): Promise<StartOperacionesResponse> {
  const response = await fetch(`${API_BASE_URL}/operaciones/start`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fechaHoraInicio }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error al iniciar operaciones: ${response.status} ${response.statusText}`);
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

/**
 * Obtiene los pedidos que van en un vuelo específico
 * 
 * @param origen - Código del aeropuerto de origen
 * @param destino - Código del aeropuerto de destino
 * @param fecha - Fecha del vuelo en formato YYYY-MM-DD
 * @param hora - Hora del vuelo en formato HH:mm
 * @returns Lista de pedidos en tránsito en ese vuelo
 * @throws Error si la petición falla
 */
export async function getPedidosEnVuelo(
  origen: string,
  destino: string,
  fecha: string,
  hora: string
): Promise<PedidoEnVuelo[]> {
  const response = await fetch(
    `${API_BASE_URL}/operaciones/vuelos/${origen}/${destino}/${fecha}/${hora}/pedidos`,
    {
      headers: {
        'Accept': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Error al obtener pedidos del vuelo: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * ✅ NUEVO: Obtiene solo la lista de almacenes (optimizado)
 * Mucho más rápido que getOperacionesStatus() porque no carga vuelos, eventos, etc.
 * 
 * @returns Lista de almacenes
 * @throws Error si la petición falla
 */
export async function getAlmacenesOnly(): Promise<Aeropuerto[]> {
  const response = await fetch(`${API_BASE_URL}/aeropuertos`, {
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Error al obtener almacenes: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}
/**
 * ✅ NUEVO: Descarga el reporte de cierre de operaciones
 * Genera un CSV con todos los pedidos y sus rutas asignadas
 * 
 * @returns void - Descarga automáticamente el archivo
 * @throws Error si la petición falla
 */
export async function descargarReporteCierre(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/operaciones/reporte-cierre`, {
    headers: {
      'Accept': 'text/csv',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Error al generar reporte: ${response.status} ${response.statusText}`);
  }
  
  // Obtener el blob del CSV
  const blob = await response.blob();
  
  // Crear un enlace temporal para descargar
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  // Generar nombre del archivo con timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  link.download = `reporte_cierre_${timestamp}.csv`;
  
  // Trigger descarga
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}