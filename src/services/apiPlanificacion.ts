// src/services/apiPlanificacion.ts

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Respuesta no-JSON desde ${url}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export interface ResumenEstado {
  [key: string]: number; // estado: cantidad
}

export interface PedidoResumen {
  id: string;
  destino: string;
  cantidad: number;
  fecha?: string;
  hora?: string;
  cliente?: string;
  estado?: string;
}

export interface Tramo {
  id?: string;
  origen: string;
  destino: string;
  fecha: string;
  hora: string;
  vuelo?: {
    id: string;
    flightCode: string;
  };
}

export interface AsignacionPedido {
  id: string;
  estado: string;
  tramoActual: number;
  cantidad: number;
  destino: string;
  tramos: Tramo[];
}

export interface DetallePedido {
  id: string;
  estado: string;
  destino: string;
  cantidad: number;
  fecha?: string;
  hora?: string;
  cliente?: string;
  tramoActual?: number;
  horaEntrega?: string;
}

// Obtener resumen de pedidos por estado
export async function getResumenEstado(): Promise<ResumenEstado> {
  try {
    return await fetchJson<ResumenEstado>(`${API_BASE_URL}/operaciones/resumen-estado`);
  } catch (error) {
    console.error('Error al obtener resumen de estado:', error);
    throw error;
  }
}

// Obtener lista de todos los pedidos
export async function getPedidos(estado?: string): Promise<PedidoResumen[]> {
  try {
    const url = estado 
      ? `${API_BASE_URL}/operaciones/pedidos?estado=${estado}` 
      : `${API_BASE_URL}/operaciones/pedidos`;
    return await fetchJson<PedidoResumen[]>(url);
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    throw error;
  }
}

// Obtener pedidos sin asignar
export async function getPedidosSinAsignar(): Promise<PedidoResumen[]> {
  try {
    return await fetchJson<PedidoResumen[]>(`${API_BASE_URL}/operaciones/pedidos-sin-asignar`);
  } catch (error) {
    console.error('Error al obtener pedidos sin asignar:', error);
    throw error;
  }
}

// Obtener pedidos en tránsito
export async function getPedidosEnTransito(): Promise<PedidoResumen[]> {
  try {
    return await fetchJson<PedidoResumen[]>(`${API_BASE_URL}/operaciones/pedidos-en-transito`);
  } catch (error) {
    console.error('Error al obtener pedidos en tránsito:', error);
    throw error;
  }
}

// Obtener pedidos entregados
export async function getPedidosEntregados(): Promise<PedidoResumen[]> {
  try {
    return await fetchJson<PedidoResumen[]>(`${API_BASE_URL}/operaciones/pedidos-entregados`);
  } catch (error) {
    console.error('Error al obtener pedidos entregados:', error);
    throw error;
  }
}

// Obtener asignación de un pedido específico
export async function getAsignacionPedido(pedidoId: string): Promise<AsignacionPedido> {
  try {
    return await fetchJson<AsignacionPedido>(`${API_BASE_URL}/operaciones/pedidos/${pedidoId}/asignacion`);
  } catch (error) {
    console.error('Error al obtener asignación del pedido:', error);
    throw error;
  }
}

// Obtener detalle de un pedido
export async function getDetallePedido(pedidoId: string): Promise<DetallePedido> {
  try {
    return await fetchJson<DetallePedido>(`${API_BASE_URL}/pedidos/${pedidoId}/detalle`);
  } catch (error) {
    console.error('Error al obtener detalle del pedido:', error);
    throw error;
  }
}

// Obtener ruta de un pedido
export async function getRutaPedido(pedidoId: string): Promise<{ id: string; totalTramos: number; tramos: Tramo[] }> {
  try {
    return await fetchJson<{ id: string; totalTramos: number; tramos: Tramo[] }>(`${API_BASE_URL}/pedidos/${pedidoId}/ruta`);
  } catch (error) {
    console.error('Error al obtener ruta del pedido:', error);
    throw error;
  }
}
