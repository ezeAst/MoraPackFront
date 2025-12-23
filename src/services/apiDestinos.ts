//const API_BASE = import.meta.env.VITE_API_URL || '/api';
const API_BASE = "http://localhost:8080/api"

export interface Destino {
  nombre: string;
  codigo: string;
  husoHorario: number;
}

export async function getDestinos(): Promise<Destino[]> {
  const resp = await fetch(`${API_BASE}/aeropuertos/destinos`);
  if (!resp.ok) {
    throw new Error('No se pudo cargar destinos');
  }
  return resp.json() as Promise<Destino[]>;
}