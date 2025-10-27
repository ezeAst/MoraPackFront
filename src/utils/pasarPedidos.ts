// Devuelve PedidoDTO[] listos para el endpoint JSON
export interface PedidoDTO {
  dia: number;
  hora: number;
  minuto: number;
  aeropuertoDestino: string;
  cantidad: number;
  idCliente: number;
}

const EXCLUIR = new Set(['SPIM','EBCI','UBBB']);
const RE = /^(\d{2})-(\d{2})-(\d{2})-([A-Z]{4})-(\d{3})-(\d{7})$/;

export function pasarPedidos(text: string): PedidoDTO[] {
  const out: PedidoDTO[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(RE);
    if (!m) continue;
    const [, dd, hh, mm, icao, qty, idCli] = m;
    if (EXCLUIR.has(icao)) continue;
    out.push({
      dia: +dd, hora: +hh, minuto: +mm,
      aeropuertoDestino: icao,
      cantidad: +qty,
      idCliente: +idCli
    });
  }
  return out;
}
