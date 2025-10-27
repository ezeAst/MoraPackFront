const API_BASE = import.meta.env.VITE_API_BASE;

export interface PedidoDTO {
  orderCode: string;
  clientId: string;
  quantity: number;
  destIcao: string;
  minuteSlot: string; // dd-hh-mm o lo que definas
}

export async function importarPedidos(pedidos: PedidoDTO[]) {
  const res = await fetch(`${API_BASE}/api/pedidos/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedidos }),
  });
  if (!res.ok) throw new Error('Error al importar pedidos');
  return res.json(); // { inserted: n, ... }
}
