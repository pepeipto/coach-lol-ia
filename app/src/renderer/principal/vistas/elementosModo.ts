import { localeActual } from '../../../shared/i18n';
import type { ElementoPopular } from '@coach/shared';

/**
 * Los más elegidos primero (en empate, por partidas y luego por id). Es el único orden de los aumentos y de los
 * objetos de Arena: la política de Riot no permite enseñar su % de victorias ni ordenarlos por rendimiento.
 */
export function ordenarPorUso(lista: ElementoPopular[], max = 8): ElementoPopular[] {
  return [...lista].sort((a, b) => b.uso - a.uso || b.partidas - a.partidas || a.id - b.id).slice(0, max);
}

/** Posición media con un decimal, en el idioma de la app («3,4»). Solo para las cifras del campeón en Arena. */
export function formatoPosicion(x: number): string {
  return x.toLocaleString(localeActual(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
