// src/utils/colors.ts
// ------------------------------------------------------
// Define los colores de referencia usados en la simulación.
// Se usa tanto para pintar las rutas por continente
// como para la leyenda desplegable.
// ------------------------------------------------------

export const CONTINENT_COLORS: Record<string, string> = {
  America: '#00c6ff', // celeste
  Europa:  '#8e44ad', // morado
  Asia:    '#ff8c00', // naranja
};

/**
 * Devuelve el color según el continente.
 * Si el continente no está definido, devuelve gris por defecto.
 */
export function colorByContinent(c?: string): string {
  return CONTINENT_COLORS[c || ''] || '#9e9e9e';
}