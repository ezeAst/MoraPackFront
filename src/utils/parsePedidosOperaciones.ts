// src/utils/parsePedidosOperaciones.ts

/**
 * Parser para archivos de pedidos con formato para Operaciones Día a Día
 * 
 * Formato esperado:
 * id_pedido-aaaammDD-hh-mm-dest-###-IdClien
 * 
 * Ejemplo:
 * 100000021-202512##-##-##-SVMI-990-0007729
 * 100000022-202512##-hh-mm-SVMI-990-0029194
 * 
 * Donde ## (o hh/mm) significa que el valor se obtiene del tiempo actual de la simulación
 * Acepta tanto ## como hh para hora y mm para minuto
 */

export interface PedidoOperacionDTO {
  idPedido: string;        // ID original del archivo
  anho: number;            // Del archivo (aaaa)
  mes: number;             // Del archivo (mm)
  dia?: number;            // Del archivo o de simulación (DD o ##)
  hora?: number;           // De simulación (##)
  minuto?: number;         // De simulación (##)
  destino: string;         // Código ICAO destino
  cantidad: number;        // Cantidad de paquetes (###)
  idCliente: string;       // ID del cliente
  usarTiempoSimulado: boolean; // true si usa ## para día/hora/minuto
}

/**
 * Parsea una línea del archivo de pedidos para operaciones
 */
export function parsearLineaPedidoOperacion(linea: string): PedidoOperacionDTO | null {
  const trimmed = linea.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
    return null; // Línea vacía o comentario
  }

  // Formato: id_pedido-aaaammDD-hh-mm-dest-###-IdClien
  // Ejemplo: 100000021-202512##-##-##-SVMI-990-0007729
  const partes = trimmed.split('-');
  
  if (partes.length !== 7) {
    console.warn(`⚠️ Formato inválido (se esperaban 7 partes): ${trimmed}`);
    return null;
  }

  const [idPedido, fecha, horaStr, minutoStr, destino, cantidadStr, idCliente] = partes;

  // Validar ID pedido
  if (!idPedido || idPedido.length === 0) {
    console.warn(`⚠️ ID pedido vacío: ${trimmed}`);
    return null;
  }

  // Parsear fecha: aaaammDD o aaaammDD o aaaamm##
  if (fecha.length !== 8) {
    console.warn(`⚠️ Fecha debe tener 8 caracteres (aaaammDD): ${fecha}`);
    return null;
  }

  const anhoStr = fecha.substring(0, 4);
  const mesStr = fecha.substring(4, 6);
  const diaStr = fecha.substring(6, 8);

  const anho = parseInt(anhoStr);
  const mes = parseInt(mesStr);
  
  // Verificar si el día es ##
  const usarDiaSimulado = diaStr === '##';
  const dia = usarDiaSimulado ? undefined : parseInt(diaStr);

  // Verificar si hora y minuto son ## o hh/mm
  const usarHoraSimulada = horaStr === '##' || horaStr.toLowerCase() === 'hh';
  const usarMinutoSimulado = minutoStr === '##' || minutoStr.toLowerCase() === 'mm';
  
  const hora = usarHoraSimulada ? undefined : parseInt(horaStr);
  const minuto = usarMinutoSimulado ? undefined : parseInt(minutoStr);

  // Validar año y mes
  if (isNaN(anho) || anho < 2020 || anho > 2100) {
    console.warn(`⚠️ Año inválido: ${anhoStr}`);
    return null;
  }

  if (isNaN(mes) || mes < 1 || mes > 12) {
    console.warn(`⚠️ Mes inválido: ${mesStr}`);
    return null;
  }

  // Validar día si no es ##
  if (!usarDiaSimulado && (isNaN(dia!) || dia! < 1 || dia! > 31)) {
    console.warn(`⚠️ Día inválido: ${diaStr}`);
    return null;
  }

  // Validar hora si no es ## ni hh
  if (!usarHoraSimulada && (isNaN(hora!) || hora! < 0 || hora! > 23)) {
    console.warn(`⚠️ Hora inválida: ${horaStr}`);
    return null;
  }

  // Validar minuto si no es ## ni mm
  if (!usarMinutoSimulado && (isNaN(minuto!) || minuto! < 0 || minuto! > 59)) {
    console.warn(`⚠️ Minuto inválido: ${minutoStr}`);
    return null;
  }

  // Validar destino (4 caracteres ICAO)
  if (!destino || destino.length !== 4) {
    console.warn(`⚠️ Destino debe ser código ICAO de 4 letras: ${destino}`);
    return null;
  }

  // Parsear cantidad
  const cantidad = parseInt(cantidadStr);
  if (isNaN(cantidad) || cantidad <= 0) {
    console.warn(`⚠️ Cantidad inválida: ${cantidadStr}`);
    return null;
  }

  // Validar ID cliente
  if (!idCliente || idCliente.length === 0) {
    console.warn(`⚠️ ID cliente vacío: ${trimmed}`);
    return null;
  }

  const usarTiempoSimulado = usarDiaSimulado || usarHoraSimulada || usarMinutoSimulado;

  return {
    idPedido,
    anho,
    mes,
    dia,
    hora,
    minuto,
    destino,
    cantidad,
    idCliente,
    usarTiempoSimulado
  };
}

/**
 * Parsea un archivo completo de pedidos para operaciones
 */
export function parsearArchivoPedidosOperaciones(contenido: string): {
  pedidos: PedidoOperacionDTO[];
  errores: number;
  lineasProcesadas: number;
} {
  console.log('📄 Contenido del archivo (primeras 500 chars):');
  console.log(contenido.substring(0, 500));
  console.log('📏 Longitud total:', contenido.length);
  
  const lineas = contenido.split('\n');
  console.log('📊 Total de líneas:', lineas.length);
  console.log('📋 Primeras 3 líneas:', lineas.slice(0, 3));
  
  const pedidos: PedidoOperacionDTO[] = [];
  let errores = 0;
  let lineasProcesadas = 0;

  for (const linea of lineas) {
    lineasProcesadas++;
    
    const trimmed = linea.trim();
    
    // Debug para las primeras 5 líneas
    if (lineasProcesadas <= 5) {
      console.log(`📝 Línea ${lineasProcesadas}:`, {
        original: linea,
        trimmed: trimmed,
        length: trimmed.length,
        partes: trimmed.split('-').length
      });
    }
    
    const pedido = parsearLineaPedidoOperacion(linea);
    
    if (pedido) {
      pedidos.push(pedido);
    } else if (linea.trim() && !linea.trim().startsWith('#') && !linea.trim().startsWith('//')) {
      // Solo contar como error si no es línea vacía ni comentario
      errores++;
    }
  }

  console.log(`📊 Archivo parseado:
    - Líneas procesadas: ${lineasProcesadas}
    - Pedidos válidos: ${pedidos.length}
    - Errores: ${errores}
    - Con tiempo simulado: ${pedidos.filter(p => p.usarTiempoSimulado).length}
  `);

  return {
    pedidos,
    errores,
    lineasProcesadas
  };
}