const API_BASE = import.meta.env.VITE_API_BASE;


export async function getDestinos(): Promise<string[]> {
  const resp = await fetch(`${API_BASE}/aeropuertos/aeropuertos/destinos`);
  if (!resp.ok) {
    throw new Error('No se pudo cargar destinos');
  }
  return resp.json(); // string[]
}
