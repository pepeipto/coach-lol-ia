/**
 * Efectos de temporada (solo estética). Se eligen por la fecha del PC, sin internet y sin leer nada del juego.
 * Las fechas siguen el patrón de los eventos de Riot de 2025-2026 (mapa de invierno desde el 18 de noviembre de 2025,
 * Año Nuevo Lunar desde finales de enero de 2026, verano en julio y agosto, otoño en octubre y principios de
 * noviembre). Son fijas y aproximadas: la app no consulta el calendario de Riot ni usa arte suyo.
 */
export type Temporada = 'invierno' | 'lunar' | 'verano' | 'otono';

/** Pares [desde, hasta] como mes*100 + día (mes 1 a 12); el invierno cruza el cambio de año. */
const TRAMOS: { temporada: Temporada; desde: number; hasta: number }[] = [
  { temporada: 'invierno', desde: 1118, hasta: 1231 },
  { temporada: 'invierno', desde: 101, hasta: 119 },
  { temporada: 'lunar', desde: 120, hasta: 228 },
  { temporada: 'verano', desde: 701, hasta: 831 },
  { temporada: 'otono', desde: 1001, hasta: 1117 },
];

/** null fuera de temporada (primavera, principios de verano y septiembre). */
export function temporadaDe(fecha: Date): Temporada | null {
  const clave = (fecha.getMonth() + 1) * 100 + fecha.getDate();
  return TRAMOS.find((t) => clave >= t.desde && clave <= t.hasta)?.temporada ?? null;
}
