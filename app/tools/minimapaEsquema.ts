/**
 * Minimapa esquemático de la Grieta para comprobar las capturas de verificación (solo herramienta de desarrollo):
 * calles, río, bases y los campamentos de `shared/jungla.ts` (los propios de los dos lados y los Escarabajos).
 * No sustituye a una imagen real del minimapa: sirve para ver que los círculos caen en su sitio dentro del marco.
 */
import { POSICIONES_CAMPAMENTOS, TAMANO_MAPA } from '../src/shared/jungla';

const L = 512;
const px = (x: number) => (x / TAMANO_MAPA) * L;
const py = (y: number) => L - (y / TAMANO_MAPA) * L;
const linea = (puntos: [number, number][], color: string, ancho: number) =>
  `<polyline points="${puntos.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${ancho}" stroke-linecap="round" stroke-linejoin="round"/>`;

export function svgMinimapaEsquema(): string {
  const campamentos = Object.entries(POSICIONES_CAMPAMENTOS).flatMap(([id, p]) => {
    const rio = id.startsWith('escarabajo');
    const lados = rio ? [p] : [p, { x: TAMANO_MAPA - p.x, y: TAMANO_MAPA - p.y }];
    return lados.map((q, i) => {
      const color = rio ? '#7fb3d5' : i === 0 ? '#4f7cff' : '#d65c48';
      return `<circle cx="${px(q.x).toFixed(1)}" cy="${py(q.y).toFixed(1)}" r="9" fill="${color}" opacity="0.55"/><circle cx="${px(q.x).toFixed(1)}" cy="${py(q.y).toFixed(1)}" r="2" fill="#fff"/>`;
    });
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${L}" width="${L}" height="${L}">`,
    `<rect width="${L}" height="${L}" fill="#16301f"/>`,
    // Río: diagonal de arriba a la izquierda a abajo a la derecha.
    linea([[0, TAMANO_MAPA], [TAMANO_MAPA, 0]], '#1f4f6b', 46),
    // Calles (centro aproximado, por las torres).
    linea([[1100, 5000], [1200, 13600], [10000, 13800]], '#8a8466', 22),
    linea([[3800, 3800], [11000, 11000]], '#8a8466', 22),
    linea([[5000, 1100], [13600, 1200], [13800, 10000]], '#8a8466', 22),
    `<circle cx="${px(800)}" cy="${py(800)}" r="40" fill="#24407a"/>`,
    `<circle cx="${px(14070)}" cy="${py(14070)}" r="40" fill="#7a2a24"/>`,
    ...campamentos,
    '</svg>',
  ].join('');
}

