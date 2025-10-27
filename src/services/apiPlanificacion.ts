import type { PedidoDTO } from '../utils/pasarPedidos';

const API_BASE = import.meta.env.VITE_API_BASE;

// Si tu back responde en async: { planId, status }
// Si responde la solución directamente, tipa el return a tu modelo de solución.
export async function planificarConPedidos(pedidos: PedidoDTO[], opts?: { simulate?: boolean }) {
  const res = await fetch(`${API_BASE}/api/planificacion/ejecutar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      simulate: opts?.simulate ?? false, // opcional: si tu back soporta dry-run
      pedidos
    }),
  });
  if (!res.ok) throw new Error('No se pudo planificar');
  return res.json();
}

// (Opcional) si tu back es async:
export async function getPlanStatus(planId: string) {
  const res = await fetch(`${API_BASE}/api/planificaciones/${planId}`);
  if (!res.ok) throw new Error('Error consultando estado');
  return res.json();
}
export async function getPlanResultado(planId: string) {
  const res = await fetch(`${API_BASE}/api/planificaciones/${planId}/resultado`);
  if (!res.ok) throw new Error('Error obteniendo resultado');
  return res.json();
}
