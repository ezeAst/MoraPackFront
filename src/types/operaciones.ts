// src/types/operaciones.ts
// Tipos que coinciden con la respuesta del backend /api/operaciones/status

export type WarehouseStatus = 'normal' | 'warning' | 'critical' | 'full';

export type FlightStatus = 'PROGRAMADO' | 'EN_VUELO' | 'ATERRIZADO';

export interface VueloActivo {
  id: string;
  flightCode: string;
  route: [number, number][]; // [[lng, lat], [lng, lat]]
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

export interface Almacen {
  codigo: string;
  nombre: string;
  capacidad: number;
  capacidadActual: number;
  ocupacion: number;
  status: WarehouseStatus;
  lat: number;
  lon: number;
}

export interface Metricas {
  pedidosNoAsignados: number;
  pedidosAsignados: number;
  pedidosEnTransito: number;
  pedidosEnAlmacen: number;
  pedidosEntregados: number;
  total: number;
}

export interface OperacionesStatus {
  currentDateTime: string;
  activo: boolean;
  inicioOperaciones: string;
  vuelosActivos: VueloActivo[];
  almacenes: Almacen[];
  eventosRecientes: string[];
  metricas: Metricas;
}