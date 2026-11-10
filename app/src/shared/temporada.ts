/**
 * Efectos de temporada (solo estética). Se eligen por la fecha del PC, sin internet y sin leer nada del juego.
 * Las fechas son aproximadas y fijas: no siguen el calendario de Riot ni usan arte suyo.
 */
export type Temporada = 'invierno' | 'lunar' | 'verano' | 'otono';

/** mes: 0 (enero) a 11 (diciembre). Primavera y principios de verano: sin efecto. */
export function temporadaDe(fecha: Date): Temporada | null {
  const m = fecha.getMonth();
  const d = fecha.getDate();
  if (m === 11 || (m === 0 && d <= 15)) return 'invierno';
  if ((m === 0 && d > 15) || m === 1) return 'lunar';
  if (m === 6 || m === 7) return 'verano';
  if (m === 9 || m === 10) return 'otono';
  return null;
}
