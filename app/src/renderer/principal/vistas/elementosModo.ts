import type { EstadisticaElemento } from '@coach/shared';

/** Criterio de la lista de aumentos u objetos de Arena: los más elegidos o los de mejor posición media. */
export type CriterioElementos = 'uso' | 'posicion';

/** Partidas mínimas para que un aumento u objeto entre en «Mejor posición» (con menos, la media es ruido). */
export const MIN_PARTIDAS_POSICION = 5;

/**
 * Ordena una copia de la lista: por uso (de más a menos) o por posición media (de mejor a peor, solo los que
 * tienen posición y al menos MIN_PARTIDAS_POSICION partidas). En empate, por partidas y luego por id.
 */
export function ordenarElementos(lista: EstadisticaElemento[], criterio: CriterioElementos, max = 8): EstadisticaElemento[] {
  if (criterio === 'uso') return [...lista].sort((a, b) => b.uso - a.uso || b.partidas - a.partidas || a.id - b.id).slice(0, max);
  return lista
    .filter((e) => e.posicionMedia !== null && e.partidas >= MIN_PARTIDAS_POSICION)
    .sort((a, b) => a.posicionMedia! - b.posicionMedia! || b.partidas - a.partidas || a.id - b.id)
    .slice(0, max);
}

/** Posición media con un decimal, en español («3,4»). */
export function formatoPosicion(x: number): string {
  return x.toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
