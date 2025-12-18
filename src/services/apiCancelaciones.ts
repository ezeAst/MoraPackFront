// src/services/apiCancelaciones.ts
const API_BASE_URL = "http://localhost:8080/api";

export type VueloCancelacionRequest = {
  fecha: string; // formato: "YYYY-MM-DD"
  vuelosCancelados: string[]; // array de strings con formato "ORIGEN-DESTINO-HH:mm-HH:mm-NNNN"
};

export type VueloCancelacionResponse = {
  exito: boolean;
  mensaje: string;
  vuelosRegistrados: number;
  vuelosDuplicados: number;
  pedidosAfectados: number;
  rutasEliminadas: number;
  pedidosReasignados: number[];
  errores: string[];
};

export type VueloCancelado = {
  id: number;
  origen: string;
  destino: string;
  horaSalidaLocal: string;
  horaLlegadaLocal: string;
  capacidadMaxima: number;
  fecha: string;
  canceladoEn: string;
  activo: boolean;
};

export type CancelacionesActivasResponse = {
  total: number;
  cancelaciones: VueloCancelado[];
};

/**
 * Procesa un archivo TXT de cancelaciones de vuelos
 * 
 * El archivo debe tener formato:
 * ORIGEN-DESTINO-HH:mm-HH:mm-NNNN
 * 
 * Ejemplo:
 * SPIM-SKBO-04:35-08:51-0340
 * SPIM-SKBO-08:02-12:18-0300
 */
export async function uploadCancelacionesFile(
  file: File, 
  fecha: string
): Promise<VueloCancelacionResponse> {
  try {
    // Leer contenido del archivo
    const content = await file.text();
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      throw new Error('El archivo está vacío');
    }

    // Validar formato básico de cada línea
    const formatoValido = /^[A-Z]{4}-[A-Z]{4}-\d{2}:\d{2}-\d{2}:\d{2}-\d{4}$/;
    const lineasInvalidas = lines.filter(line => !formatoValido.test(line));
    
    if (lineasInvalidas.length > 0) {
      throw new Error(
        `Formato inválido en ${lineasInvalidas.length} línea(s). ` +
        `Formato esperado: ORIGEN-DESTINO-HH:mm-HH:mm-NNNN\n` +
        `Primera línea inválida: ${lineasInvalidas[0]}`
      );
    }

    // Crear request
    const request: VueloCancelacionRequest = {
      fecha: fecha,
      vuelosCancelados: lines
    };

    console.log('📤 Enviando cancelaciones:', request);

    // Enviar al backend
    const response = await fetch(`${API_BASE_URL}/vuelos/cancelaciones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const responseText = await response.text();
    console.log('📡 Respuesta del servidor:', response.status, responseText);

    if (!response.ok) {
      throw new Error(
        responseText || `Error HTTP ${response.status} al procesar cancelaciones`
      );
    }

    // Parsear respuesta
    const result: VueloCancelacionResponse = JSON.parse(responseText);
    return result;

  } catch (err: any) {
    console.error('❌ Error en uploadCancelacionesFile:', err);
    throw err;
  }
}

/**
 * Obtiene todas las cancelaciones activas
 */
export async function obtenerCancelacionesActivas(): Promise<CancelacionesActivasResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/vuelos/cancelaciones/activas`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error HTTP ${response.status}`);
    }

    const data: CancelacionesActivasResponse = await response.json();
    return data;

  } catch (err: any) {
    console.error('❌ Error obteniendo cancelaciones activas:', err);
    throw err;
  }
}

/**
 * Obtiene cancelaciones por fecha específica
 */
export async function obtenerCancelacionesPorFecha(
  fecha: string
): Promise<CancelacionesActivasResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/vuelos/cancelaciones/fecha/${fecha}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error HTTP ${response.status}`);
    }

    const data: CancelacionesActivasResponse = await response.json();
    return data;

  } catch (err: any) {
    console.error('❌ Error obteniendo cancelaciones por fecha:', err);
    throw err;
  }
}

/**
 * Verifica si un vuelo específico está cancelado
 */
export async function verificarVueloCancelado(
  origen: string,
  destino: string,
  fecha: string,
  horaSalida: string
): Promise<{ cancelado: boolean; vuelo: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/vuelos/cancelaciones/verificar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ origen, destino, fecha, horaSalida }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;

  } catch (err: any) {
    console.error('❌ Error verificando vuelo cancelado:', err);
    throw err;
  }
}

/**
 * Limpia cancelaciones antiguas (más de X días)
 */
export async function limpiarCancelacionesAntiguas(
  dias: number
): Promise<{ mensaje: string; eliminadas: number; diasAtras: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/vuelos/cancelaciones/antiguas/${dias}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Error HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;

  } catch (err: any) {
    console.error('❌ Error limpiando cancelaciones antiguas:', err);
    throw err;
  }
}