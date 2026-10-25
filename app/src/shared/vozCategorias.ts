import type { AjustesVoz, TipoVoz } from './tiposApp';

/*
 * 3.1: categorías de la voz, cómo se agrupan en la vista Overlay y el «Nivel de detalle» (Básico / Normal /
 * Completo), que no es más que un conjunto de categorías encendidas. Lo que manda siempre son los interruptores de
 * cada categoría (`AjustesVoz.tipos`); el nivel se deduce de ellos y, si no coincide con ninguno, es «personalizado».
 */

/** Todas las categorías, en el orden de la vista Overlay. */
export const TIPOS_VOZ: readonly TipoVoz[] = [
  'objetivo',
  'jungla',
  'junglaEnemiga',
  'equipo',
  'habilidad',
  'nivel',
  'compra',
  'economia',
  'cs',
  'vision',
  'combate',
  'spike',
  'animo',
  'muerte',
  'fase',
  'modo',
];

export type GrupoVoz = 'mapa' | 'juego' | 'peleas' | 'partida';

/** Grupos de interruptores de la vista Overlay (overlay.config.grupoVoz.<grupo>). */
export const GRUPOS_VOZ: Record<GrupoVoz, readonly TipoVoz[]> = {
  mapa: ['objetivo', 'jungla', 'junglaEnemiga', 'equipo'],
  juego: ['habilidad', 'nivel', 'compra', 'economia', 'cs', 'vision'],
  peleas: ['combate', 'spike', 'animo', 'muerte'],
  partida: ['fase', 'modo'],
};

export type NivelDetalle = 'basico' | 'normal' | 'completo';
export const NIVELES_DETALLE: readonly NivelDetalle[] = ['basico', 'normal', 'completo'];

const BASICO: readonly TipoVoz[] = ['objetivo', 'habilidad', 'compra', 'jungla', 'junglaEnemiga'];
const NORMAL: readonly TipoVoz[] = [...BASICO, 'economia', 'nivel', 'cs', 'vision', 'combate', 'spike', 'animo', 'fase', 'modo'];

/** Categorías encendidas en cada nivel; las demás, apagadas. */
export const CATEGORIAS_NIVEL: Record<NivelDetalle, readonly TipoVoz[]> = {
  basico: BASICO,
  normal: NORMAL,
  completo: TIPOS_VOZ,
};

export const NIVEL_POR_DEFECTO: NivelDetalle = 'normal';

/** Interruptores de un nivel de detalle. */
export function tiposDeNivel(nivel: NivelDetalle): AjustesVoz['tipos'] {
  const encendidas = new Set(CATEGORIAS_NIVEL[nivel]);
  return Object.fromEntries(TIPOS_VOZ.map((t) => [t, encendidas.has(t)])) as AjustesVoz['tipos'];
}

/** El nivel que corresponde a unos interruptores, o 'personalizado' si no coinciden con ninguno. */
export function nivelDeTipos(tipos: AjustesVoz['tipos']): NivelDetalle | 'personalizado' {
  for (const nivel of NIVELES_DETALLE) {
    const esperado = tiposDeNivel(nivel);
    if (TIPOS_VOZ.every((t) => !!tipos[t] === esperado[t])) return nivel;
  }
  return 'personalizado';
}
