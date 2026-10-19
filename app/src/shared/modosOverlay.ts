import type { ModoJuego } from '@coach/shared';
import type { TipoAviso, TipoVoz } from './tiposApp';

/**
 * Qué partes del overlay tienen sentido en cada modo (plan 3.0, Track E). Fuera de la Grieta (ARAM, ARAM: Caos
 * y Arena) no hay objetivos épicos, ni campamentos de jungla, ni un objetivo de CS útil: se ocultan la barra de
 * objetivos y la jungla, y del widget Rendimiento (id `cs`) solo queda el KDA (sin la fila del CS). Se mantienen la
 * próxima compra, los avisos y la flecha de habilidad, salvo en Arena, que no tiene orden de habilidades.
 * Los widgets usan los ids del plan (`IdWidget` de Track A).
 */
export interface WidgetsVisibles {
  objetivos: boolean;
  habilidad: boolean;
  cs: boolean;
  compra: boolean;
  jungla: boolean;
  avisos: boolean;
}

export const esGrieta = (modo: ModoJuego | undefined): boolean => (modo ?? 'clasificatoria') === 'clasificatoria';

export function widgetsDeModo(modo: ModoJuego | undefined): WidgetsVisibles {
  const grieta = esGrieta(modo);
  return { objetivos: grieta, habilidad: modo !== 'arena', cs: true, compra: true, jungla: grieta, avisos: true };
}

/**
 * Avisos (y voz) que se dan en cada modo: fuera de la Grieta solo la compra y la habilidad; los de objetivos,
 * visión (guardianes de control) y fase de partida (consejos por rol de la Grieta) no aplican.
 */
export function avisoEnModo(tipo: TipoAviso, modo: ModoJuego | undefined): boolean {
  return esGrieta(modo) || tipo === 'compra' || tipo === 'habilidad';
}

/** 3.1: categorías de voz que también tienen sentido fuera de la Grieta (ARAM, ARAM: Caos y Arena). */
const VOZ_FUERA_DE_LA_GRIETA: ReadonlySet<TipoVoz> = new Set<TipoVoz>(['compra', 'economia', 'combate', 'animo', 'modo']);

/**
 * Frases de voz que se dicen en cada modo: en la Grieta, todas; fuera, la compra, los objetos completados, las
 * peleas, el ánimo y los consejos del modo, más la habilidad y los niveles salvo en Arena (sin flecha ni orden de
 * habilidades). Objetivos, farmeo, visión, fase, estructuras, jungla, jungla enemigo y los consejos de muerte son
 * solo de la Grieta (en ARAM y Arena la muerte tiene sus propios consejos, en la categoría del modo).
 */
export function vozEnModo(tipo: TipoVoz, modo: ModoJuego | undefined): boolean {
  if (esGrieta(modo)) return true;
  if (tipo === 'habilidad' || tipo === 'nivel') return widgetsDeModo(modo).habilidad;
  return VOZ_FUERA_DE_LA_GRIETA.has(tipo);
}
