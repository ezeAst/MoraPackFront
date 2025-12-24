// src/services/apiVuelos.ts
const API_BASE_URL = "http://localhost:8080/api"
//const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export type UploadVuelosResponse = {
  mensaje: string;
  registrosCargados?: number;
};

export async function uploadVuelosFile(file: File): Promise<UploadVuelosResponse> {
  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/vuelos/upload`, {
      method: 'POST',
      body: formData,
    });
  } catch (err) {
    console.error('❌ Error de red en fetch /api/vuelos/upload:', err);
    throw new Error('No se pudo contactar al servidor (network error).');
  }

  const rawText = await response.text();
  console.log('📡 /api/vuelos/upload status:', response.status);
  console.log('📡 /api/vuelos/upload body:', rawText);

  // Si la respuesta no es 2xx, lo tratamos como error
  if (!response.ok) {
    throw new Error(rawText || `Error HTTP ${response.status} al subir el archivo de vuelos`);
  }

  // Intentar parsear JSON. Si no es JSON, igual lo tratamos como éxito.
  try {
    const json = JSON.parse(rawText) as UploadVuelosResponse;
    return json;
  } catch {
    console.warn('⚠️ Respuesta no es JSON válido, usando mensaje genérico');
    return {
      mensaje: rawText || 'Vuelos cargados correctamente (sin detalle)',
      registrosCargados: undefined,
    };
  }
}
