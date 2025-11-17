// utils/parsePedidosTxt.ts
export interface PedidoDTO {
  id: number;                // 👈 id_pedido del archivo
  anho: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  aeropuertoDestino: string;
  cantidad: number;
  idCliente: string;
}

const norm = (s: string) =>
  s
    .replace(/^\uFEFF/, '')
    .replace(/[\u2010-\u2015]/g, '-')   // distintos tipos de guion → '-'
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Formato:
 *   id_pedido-yyyymmdd-hh-mm-DEST-###-IdClien
 *
 * Ej:
 *   000003031-20251110-13-41-OPKC-134-5099558
 */
export function parsePedidosTxt(texto: string, _mes: number): PedidoDTO[] {
  const out: PedidoDTO[] = [];
  if (!texto) return out;

  const SEDES_PRINCIPALES = new Set(['SPIM', 'UBBB', 'EBCI']);

  const lineas = texto.split(/\r?\n/);

  for (const raw of lineas) {
    const line = norm(raw);
    if (!line) continue;

    const parts = line.split('-');
    if (parts.length !== 7) {
      console.warn('[parsePedidosTxt] formato inválido (7 partes esperadas):', line);
      continue;
    }

    const [
      idPedidoStr, // 000003031
      fechaStr,    // 20251110
      horaStr,     // 13
      minutoStr,   // 41
      icaoRaw,     // OPKC
      cantidadStr, // 134
      idCliStr,    // 5099558
    ] = parts;

    // --- id_pedido ---
    if (!/^\d{1,12}$/.test(idPedidoStr)) {
      console.warn('[parsePedidosTxt] id_pedido inválido:', idPedidoStr, 'en línea:', line);
      continue;
    }
    const id = Number(idPedidoStr); // ej. 3031

    // --- fecha yyyymmdd ---
    if (!/^\d{8}$/.test(fechaStr)) {
      console.warn('[parsePedidosTxt] fecha yyyymmdd inválida:', fechaStr, 'en línea:', line);
      continue;
    }

    const anho = Number(fechaStr.slice(0, 4));
    const mes = Number(fechaStr.slice(4, 6));
    const dia = Number(fechaStr.slice(6, 8));

    const hora = Number(horaStr);
    const minuto = Number(minutoStr);
    const icao = icaoRaw.trim().toUpperCase();
    const cantidad = Number(cantidadStr);
    const idCli = idCliStr.trim();

    // --- validaciones básicas ---
    if (Number.isNaN(anho) || anho < 2000 || anho > 2100) continue;
    if (Number.isNaN(mes) || mes < 1 || mes > 12) continue;
    if (Number.isNaN(dia) || dia < 1 || dia > 31) continue;

    if (Number.isNaN(hora) || hora < 0 || hora > 23) continue;
    if (Number.isNaN(minuto) || minuto < 0 || minuto > 59) continue;

    if (!/^[A-Z]{4}$/.test(icao)) continue;

    if (Number.isNaN(cantidad) || cantidad < 1 || cantidad > 999) continue;

    if (!/^\d{7}$/.test(idCli)) continue;

        // ✅ FILTRAR SEDES PRINCIPALES
    if (SEDES_PRINCIPALES.has(icao)) {
      console.log(`[parsePedidosTxt] Pedido a sede principal ${icao} excluido`);
      continue;
    }

    out.push({
      id,
      anho,
      mes,
      dia,
      hora,
      minuto,
      aeropuertoDestino: icao,
      cantidad,
      idCliente: idCli,
    });
  }

  if (!out.length) console.error('[parsePedidosTxt] Resultado vacío.');
  return out;
}
