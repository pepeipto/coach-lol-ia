import type { ModoJuego } from '@coach/shared';
import type { TipoAviso } from './tiposApp';

/**
 * Qué partes del overlay tienen sentido en cada modo (plan 3.0, Track E). Fuera de la Grieta (ARAM, ARAM: Caos
 * y Arena) no hay objetivos épicos, ni campamentos de jungla, ni un objetivo de CS útil: se ocultan la barra de
 * objetivos, el CS y la jungla, y se mantienen la próxima compra, la flecha de habilidad y los avisos.
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
  return { objetivos: grieta, habilidad: true, cs: grieta, compra: true, jungla: grieta, avisos: true };
}

/**
 * Avisos (y voz) que se dan en cada modo: fuera de la Grieta solo la compra y la habilidad; los de objetivos,
 * visión (guardianes de control) y fase de partida (consejos por rol de la Grieta) no aplican.
 */
export function avisoEnModo(tipo: TipoAviso, modo: ModoJuego | undefined): boolean {
  return esGrieta(modo) || tipo === 'compra' || tipo === 'habilidad';
}
