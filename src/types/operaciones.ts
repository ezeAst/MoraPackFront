// src/types/operaciones.ts

/**
 * Vuelo activo en operaciones día a día
 */
export interface VueloActivo {
  id: string;
  flightCode: string;
  route: [[number, number], [number, number]]; // [[lonOrigen, latOrigen], [lonDestino, latDestino]]
  origin: string;  // Nombre del aeropuerto de origen
  destination: string;  // Nombre del aeropuerto de destino
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
  orderIds?: string[]; // ✅ IDs de pedidos en el vuelo (para mostrar en tooltip)
  orders?: Array<{
    id: string;
    packages: number;
  }>; // ✅ Detalle de pedidos con cantidad de paquetes
}

/**
 * Vuelo saliente programado
 */
export interface OutgoingFlight {
  id: string;
  flightCode: string;
  destination: string;
  departureTime: string;
  arrivalTime: string; // ✅ Agregado
  packages: number;
  capacity: number;
  status: 'scheduled' | 'in_flight' | 'landed';
  occupancyPercentage: number;
}

/**
 * Almacén con información de ocupación
 */
export interface Almacen {
  codigo: string;
  nombre: string;
  capacidad: number;
  capacidadActual: number;
  ocupacion: number;
  status: 'normal' | 'warning' | 'critical';
  lat: number;
  lon: number;
  outgoingFlights?: OutgoingFlight[]; // ✅ Vuelos programados desde este almacén
}

/**
 * Métricas del sistema
 */
export interface Metricas {
  pedidosNoAsignados: number;
  pedidosAsignados: number;
  pedidosEnTransito: number;
  pedidosEnAlmacen: number;
  pedidosEntregados: number;
  total: number;
}

/**
 * Estado completo de las operaciones
 */
export interface OperacionesStatus {
  currentDateTime: string;
  usandoTiempoSimulado: boolean;
  activo: boolean;
  inicioOperaciones: string | null;
  vuelosActivos: VueloActivo[];
  almacenes: Almacen[];
  eventosRecientes: string[];
  metricas: Metricas;
}