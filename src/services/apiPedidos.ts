import type { PedidoDTO } from '../utils/parsePedidosTxt';

const API_BASE = 'http://localhost:8080/api';

export type PedidoEvent = {
  id: string;
  message: string;
  timestamp: string;
  type: 'new' | 'delivered' | 'in_transit' | 'delayed';
};

export async function importarPedidos(pedidos: PedidoDTO[]) {
  const res = await fetch(`${API_BASE}/pedidos/importarTxt`, { // <-- importar (con ar)
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pedidos), // <-- enviar el ARRAY directo, no { pedidos }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Error al importar pedidos: ${res.status} ${text}`);
  }
  return res.json(); // el backend devuelve la lista guardada
}

export async function getPedidosEvents(): Promise<PedidoEvent[]> {
  const res = await fetch(`${API_BASE}/pedidos/events`);
  if (!res.ok) {
    throw new Error('Error al obtener eventos de pedidos');
  }
  return res.json();
}
