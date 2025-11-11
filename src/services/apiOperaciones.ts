// src/services/apiOperaciones.ts
import type { OperacionesStatus } from '../types/operaciones';

// Base URL del backend - usa variable de entorno o fallback a localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
 * Obtiene la lista completa de aeropuertos
 * Se usa para inicializar el mapa con todos los aeropuertos disponibles
 * 
 * @returns Lista de aeropuertos con coordenadas y capacidades
 * @throws Error si la petición falla
 */
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