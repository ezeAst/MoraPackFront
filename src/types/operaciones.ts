// src/types/operaciones.ts

export type EstadoPedido = 'NO_ASIGNADO' | 'ASIGNADO' | 'EN_TRANSITO' | 'EN_ALMACEN_INTERMEDIO' | 'ENTREGADO' | 'RECOGIDO';

export type AlmacenStatus = 'normal' | 'warning' | 'critical';

export interface VueloActivo {
  id: string;
  flightCode: string;
  route: [[number, number], [number, number]]; // [[lonOrigen, latOrigen], [lonDestino, latDestino]]
  origin: string;
  destination: string;
  currentLat: number;
  currentLng: number;
  departureTime: string;
  arrivalTime: string;
  durationSeconds: number;
  elapsedSeconds: number;
  packages: number;
  pedidoCount: number;
  capacity: number;
  status: string;
  statusLabel: string;
  progressPercentage: number;
}

export interface Almacen {
  codigo: string;
  nombre: string;
  capacidad: number;
  capacidadActual: number;
  ocupacion: number;
  status: AlmacenStatus;
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
  usandoTiempoSimulado: boolean;
  activo: boolean;
  inicioOperaciones: string;
  vuelosActivos: VueloActivo[];
  almacenes: Almacen[];
  eventosRecientes: string[];
  metricas: Metricas;
}