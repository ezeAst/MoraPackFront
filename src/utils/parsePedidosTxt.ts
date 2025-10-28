// utils/parsePedidosTxt.ts
export interface PedidoDTO {
  dia: number;
  mes: number;
  hora: number;
  minuto: number;
  aeropuertoDestino: string;
  cantidad: number;
  idCliente: string; // VARCHAR(7) en BD
}

// normaliza guiones raros/espacios por si acaso
const norm = (s: string) =>
  s.replace(/^\uFEFF/, '').replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, ' ').trim();

export function parsePedidosTxt(texto: string, mes: number): PedidoDTO[] {
  const out: PedidoDTO[] = [];

  for (const raw of texto.split(/\r?\n/)) {
    const line = norm(raw);
    if (!line) continue;

    // DD-HH-MM-ICAO-QTY-ID7
    const parts = line.split('-');
    if (parts.length !== 6) {
      console.warn('[parsePedidosTxt] Formato inválido:', line);
      continue;
    }

    const [dd, hh, mm, icaoRaw, qty, idCli] = parts;
    const dia = +dd, hora = +hh, minuto = +mm, cantidad = +qty;
    const icao = icaoRaw.toUpperCase();

    // validaciones mínimas para evitar basura accidental
    if (dia < 1 || dia > 31 || hora < 0 || hora > 23 || minuto < 0 || minuto > 59) {
      console.warn('[parsePedidosTxt] fecha/hora inválida:', line); continue;
    }
    if (!/^[A-Z]{4}$/.test(icao))   { console.warn('[parsePedidosTxt] ICAO inválido:', icao); continue; }
    if (!(cantidad >= 1 && cantidad <= 999)) { console.warn('[parsePedidosTxt] cantidad inválida:', cantidad); continue; }
    if (!/^[0-9A-Za-z]{7}$/.test(idCli)) { console.warn('[parsePedidosTxt] idCliente inválido:', idCli); continue; }

    out.push({ dia, mes, hora, minuto, aeropuertoDestino: icao, cantidad, idCliente: idCli });
  }

  if (!out.length) console.error('[parsePedidosTxt] Resultado vacío.');
  return out;
}

