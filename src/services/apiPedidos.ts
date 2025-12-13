import type { PedidoDTO } from '../utils/parsePedidosTxt';

//const API_BASE = import.meta.env.VITE_API_URL || '/api';
const API_BASE = "http://localhost:8080/api"

export type PedidoEvent = {
  id: string;
  message: string;
  timestamp: string;
  type: 'new' | 'delivered' | 'in_transit' | 'delayed';
};

export type PedidoEnAlmacen = {
  id: number;
  aeropuertoDestino: string;
  cantidad: number;
  estado: string;
  tramoActual: number;
  fecha: string;
};

export interface ImportResponse {
  insertados: number;
  duplicados: number;
  errores: number;
  tiempoMs?: number;
  pedidosPorSegundo?: number;
}

// ✅ NUEVA FUNCIÓN OPTIMIZADA: Importar TODO de una vez
export async function importarPedidosCompleto(
  pedidos: PedidoDTO[], 
  onProgress?: (progress: number) => void
): Promise<ImportResponse> {
  console.log(`📦 Enviando ${pedidos.length} pedidos al backend (método optimizado)...`);
  const startTime = Date.now();

  try {
    // Simular progreso inicial
    if (onProgress) onProgress(10);

    const res = await fetch(`${API_BASE}/pedidos/importarTxtCompleto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedidos),
      // Aumentar timeout para archivos grandes (5 minutos)
      signal: AbortSignal.timeout(300000),
    });

    if (onProgress) onProgress(90);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Error al importar pedidos: ${res.status} ${text}`);
    }

    const resultado = await res.json();
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    if (onProgress) onProgress(100);

    console.log('✅ Importación completada:');
    console.log(`   - Pedidos insertados: ${resultado.insertados}`);
    console.log(`   - Tiempo total: ${totalTime}ms`);
    if (resultado.pedidosPorSegundo) {
      console.log(`   - Velocidad backend: ${resultado.pedidosPorSegundo} pedidos/seg`);
    }

    return resultado;
  } catch (error) {
    console.error('❌ Error en importación:', error);
    throw error;
  }
}

// ⚠️ FUNCIÓN ANTIGUA (LENTA): Importar con batch processing de 100 en 100
// DEPRECADA - Usa importarPedidosCompleto() en su lugar
export async function importarPedidosEnLotes(
  pedidos: PedidoDTO[], 
  onProgress?: (progress: number) => void
): Promise<ImportResponse> {
  console.warn('⚠️ Usando método de lotes (LENTO). Considera usar importarPedidosCompleto()');
  
  const BATCH_SIZE = 100; // Enviar de 100 en 100
  let totalInsertados = 0;
  let totalDuplicados = 0;
  let totalErrores = 0;

  for (let i = 0; i < pedidos.length; i += BATCH_SIZE) {
    const lote = pedidos.slice(i, i + BATCH_SIZE);
    
    const res = await fetch(`${API_BASE}/pedidos/importarTxt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lote),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Error al importar pedidos: ${res.status} ${text}`);
    }

    const resultado = await res.json();
    totalInsertados += resultado.insertados || 0;
    totalDuplicados += resultado.duplicados || 0;
    totalErrores += resultado.errores || 0;

    // Reportar progreso
    if (onProgress) {
      const progreso = Math.min(100, Math.round(((i + lote.length) / pedidos.length) * 100));
      onProgress(progreso);
    }
  }

  return {
    insertados: totalInsertados,
    duplicados: totalDuplicados,
    errores: totalErrores
  };
}

// Mantener la función original para compatibilidad
export async function importarPedidos(pedidos: PedidoDTO[]) {
  const res = await fetch(`${API_BASE}/pedidos/importarTxt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pedidos),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Error al importar pedidos: ${res.status} ${text}`);
  }
  return res.json();
}

export async function getPedidosEvents(): Promise<PedidoEvent[]> {
  const res = await fetch(`${API_BASE}/pedidos/events`);
  if (!res.ok) {
    throw new Error('Error al obtener eventos de pedidos');
  }
  return res.json();
}

export async function getPedidosPorAlmacen(codigoAlmacen: string): Promise<PedidoEnAlmacen[]> {
  const res = await fetch(`${API_BASE}/pedidos/almacen/${codigoAlmacen}`);
  if (!res.ok) {
    throw new Error(`Error al obtener pedidos del almacén ${codigoAlmacen}`);
  }
  return res.json();
}


export type CreatePedidoPayload = {
  client_id: string;          // tu ID numérico escrito
  product_quantity: number;
  destination_codigo: string; // ICAO destino (ej. SKBO)
  created_at: string;         // fecha/hora ajustada (YYYY-MM-DDTHH:mm:ss)
};

export async function crearPedido(payload: {
  id_cliente: string;
  cantidad: number;
  aeropuerto_destino: string;
  created_at: string;
}) {
  const resp = await fetch(`${API_BASE}/pedidos/insertar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    throw new Error(data?.mensaje || "Error al registrar pedido");
  }

  return data; // { id, mensaje } o lo que devuelva tu backend
}


export type PedidoReciente = {
  id: number;
  aeropuerto_destino: string;
  cantidad: number;
  id_cliente: string;
};

export async function getPedidosRecientes(limit = 3): Promise<PedidoReciente[]> {
  const resp = await fetch(`${API_BASE}/pedidos/recientes?limit=${limit}`);
  const data = await resp.json().catch(() => []);
  if (!resp.ok) throw new Error(data?.mensaje || "No se pudo cargar pedidos recientes");
  return data;
}
/**
 * Resetea el cache de IDs en el backend
 * Útil después de limpiar la tabla de pedidos
 */
export async function resetearCachePedidos(): Promise<void> {
  const res = await fetch(`${API_BASE}/pedidos/resetCache`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error('Error al resetear cache de pedidos');
  }

  console.log('✅ Cache de pedidos reseteado');
}