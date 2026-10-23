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
  /** 3.4: panel de aumentos, solo en ARAM: Caos. */
  aumentos: boolean;
}

export const esGrieta = (modo: ModoJuego | undefined): boolean => (modo ?? 'clasificatoria') === 'clasificatoria';

export function widgetsDeModo(modo: ModoJuego | undefined): WidgetsVisibles {
  const grieta = esGrieta(modo);
  return { objetivos: grieta, habilidad: modo !== 'arena', cs: true, compra: true, jungla: grieta, avisos: true, aumentos: modo === 'caos' };
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

/*
 * 3.8 «Todo LoL»: modos rotativos. La partida usa el modo de su mapa (`modoDeMapa`): en la Grieta, todo lo de la
 * Grieta; en el Abismo, lo de ARAM. Encima se quita lo que no tiene sentido en el modo concreto:
 * - en los modos rápidos (URF, ARURF) el ritmo de CS por rol y los consejos de fase de partida (por rol y minuto);
 * - fuera de la Grieta, los consejos propios de ARAM, ARAM: Caos y Arena (categoría `modo`: «Bienvenido al Abismo»,
 *   «en ARAM solo compras al morir»…), que no valen para otro modo del mismo mapa.
 * Sin `rotativo` (clasificatoria, normales, ARAM, ARAM: Caos y Arena) no cambia nada.
 */
const MODOS_RAPIDOS: ReadonlySet<string> = new Set(['URF', 'ARURF']);

/** `gameMode` de un modo rápido (URF y similares): el CS y el ritmo de la partida no siguen las referencias por rol. */
export const esModoRapido = (rotativo: string | undefined): boolean => !!rotativo && MODOS_RAPIDOS.has(rotativo.toUpperCase());

/** Frases de voz que se dicen en una partida: las del modo (`vozEnModo`) menos las que no aplican al rotativo. */
export function vozEnPartida(tipo: TipoVoz, modo: ModoJuego | undefined, rotativo?: string): boolean {
  if (!vozEnModo(tipo, modo)) return false;
  if (!rotativo) return true;
  if (esModoRapido(rotativo) && (tipo === 'cs' || tipo === 'fase')) return false;
  if (!esGrieta(modo) && tipo === 'modo') return false;
  return true;
}

/** Avisos de texto de una partida: los del modo (`avisoEnModo`) sin la fase de partida en los modos rápidos. */
export function avisoEnPartida(tipo: TipoAviso, modo: ModoJuego | undefined, rotativo?: string): boolean {
  if (!avisoEnModo(tipo, modo)) return false;
  return !(esModoRapido(rotativo) && tipo === 'fase');
}
