import type { PedidoDTO } from '../utils/parsePedidosTxt';

const API_BASE = 'http://localhost:8080/api';

export type PedidoEvent = {
  id: string;
  message: string;
  timestamp: string;
  type: 'new' | 'delivered' | 'in_transit' | 'delayed';
};

// ✅ NUEVA FUNCIÓN: Importar con batch processing
export async function importarPedidosEnLotes(pedidos: PedidoDTO[], onProgress?: (progress: number) => void) {
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