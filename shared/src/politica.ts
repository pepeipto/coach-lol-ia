import type { Build, ElementoPopular } from './tipos';

/**
 * Política de juego de LoL de Riot (https://developer.riotgames.com/docs/lol, «Game Policy»):
 * «Products cannot display win rates for Augments or Arena Mode items. This applies to all websites, applications
 * and overlays.»
 *
 * Hasta la 3.1 las builds de ARAM: Caos y Arena traían estos campos, con % de victorias, posición media y una lista
 * de «mejores». Desde la 3.2 el servidor no los calcula ni los sirve, y la app los descarta si le llegan (de un
 * servidor antiguo o de su caché en disco).
 */
export const CAMPOS_RETIRADOS_POLITICA = ['aumentos', 'aumentosMejores', 'objetosArena', 'objetosArenaMejores'] as const;

/** Solo el id, las partidas y el % de uso: nunca victorias, posición media ni ninguna otra cifra de rendimiento. */
function soloUso(lista: unknown): ElementoPopular[] | undefined {
  if (!Array.isArray(lista)) return undefined;
  const limpia: ElementoPopular[] = [];
  for (const x of lista) {
    if (typeof x !== 'object' || x === null) continue;
    const { id, partidas, uso } = x as Record<string, unknown>;
    if (typeof id !== 'number' || typeof partidas !== 'number' || typeof uso !== 'number') continue;
    limpia.push({ id, partidas, uso });
  }
  return limpia;
}

function sanearUna(b: Record<string, unknown>): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...b };
  // Un servidor 3.1 manda «aumentos»/«objetosArena» (de más a menos elegidos): se conserva solo el uso.
  const aumentos = soloUso(copia.aumentosPopulares ?? copia.aumentos);
  const objetos = soloUso(copia.objetosArenaPopulares ?? copia.objetosArena);
  for (const campo of CAMPOS_RETIRADOS_POLITICA) delete copia[campo];
  delete copia.aumentosPopulares;
  delete copia.objetosArenaPopulares;
  if (aumentos?.length) copia.aumentosPopulares = aumentos;
  if (objetos?.length) copia.objetosArenaPopulares = objetos;
  // 3.10 (mejora 13): el rendimiento por objeto (% de victorias al completarlo) es solo de la Grieta y ARAM. En Arena
  // sería justo lo prohibido («win rates for… Arena Mode items»): una build de Arena nunca lo lleva.
  if (esDeArena(copia)) delete copia.rendimientoObjetos;
  return copia;
}

/** La build es de Arena: por su modo o, en una build antigua sin modo, por sus cifras de Arena. */
function esDeArena(b: Record<string, unknown>): boolean {
  return b.modo === 'arena' || 'arena' in b || 'objetosArenaPopulares' in b;
}

/**
 * Copia de la build sin ninguna cifra de rendimiento de aumentos ni de objetos de Arena (en ella y en sus opciones):
 * quita los campos retirados y deja en `aumentosPopulares`/`objetosArenaPopulares` solo id, partidas y uso.
 * Lo usan el servidor al servir una build guardada y la app al recibirla o leerla de su caché.
 */
export function sanearBuildPolitica(build: Build): Build {
  const b = sanearUna(build as unknown as Record<string, unknown>);
  if (Array.isArray(b.opciones)) {
    b.opciones = b.opciones.map((o) => (typeof o === 'object' && o !== null ? sanearUna(o as Record<string, unknown>) : o));
  }
  return b as unknown as Build;
}
