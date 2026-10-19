import { randomUUID } from 'node:crypto';
import type { Build } from '@coach/shared';
import { t } from '../../shared/i18n';
import { registrar } from '../log';
import type { ClienteLcu } from './cliente';

/** Página del jugador que se podría sustituir cuando no quedan huecos (3.1). */
export interface PaginaSustituible {
  id: number;
  nombre: string;
}

export type ResultadoImportacion =
  | { ok: true }
  | { ok: false; motivo: 'sin_paginas'; sustituible?: PaginaSustituible }
  | { ok: false; motivo: 'error' };

/**
 * 3.1: qué hacer si todas las páginas de runas están ocupadas. Sin valor (la importación automática), nunca se
 * borra nada. Con el id que el jugador confirmó, se sustituye esa página si sigue siendo la elegida; con
 * 'cualquiera' («No volver a preguntar»), la que toque según `paginaSustituible`.
 */
export interface OpcionesRunas {
  sustituir?: number | 'cualquiera';
}

const PREFIJO = 'Coach:';
const DESTELLO = 4;

/**
 * Opciones de una importación manual a partir de lo que manda la ventana principal (validado): el id de la página
 * que el jugador confirmó sustituir, o «cualquiera» si marcó «No volver a preguntar».
 */
export function opcionesImportarManual(crudo: unknown, sinPreguntar: boolean): OpcionesRunas {
  const id = crudo && typeof crudo === 'object' ? (crudo as { sustituirPagina?: unknown }).sustituirPagina : undefined;
  if (typeof id === 'number' && Number.isSafeInteger(id) && id >= 0) return { sustituir: id };
  return sinPreguntar ? { sustituir: 'cualquiera' } : {};
}

export interface PaginaLcu {
  id: number;
  name: string;
  isEditable: boolean;
  isDeletable?: boolean;
  isActive?: boolean;
  current?: boolean;
  /** Milisegundos desde 1970 (LCU). */
  lastModified?: number;
  isTemporary?: boolean;
  isRecommendationOverride?: boolean;
}

/**
 * 3.1: página que se sustituiría si no quedan huecos. Nunca una predefinida, ni una que el cliente no deje
 * borrar o editar, ni una temporal o recomendada, ni la de Coach. Primero la seleccionada; si no vale, la que
 * lleva más tiempo sin modificarse. Null si no hay ninguna.
 */
export function paginaSustituible(paginas: readonly PaginaLcu[]): PaginaLcu | null {
  const candidatas = paginas.filter(
    (p) => p.isDeletable === true && p.isEditable === true && !p.isTemporary && !p.isRecommendationOverride && !p.name.startsWith(PREFIJO),
  );
  const actual = candidatas.find((p) => p.current === true || p.isActive === true);
  if (actual) return actual;
  return [...candidatas].sort((a, b) => (a.lastModified ?? 0) - (b.lastModified ?? 0))[0] ?? null;
}

function fallo(contexto: string, e: unknown): ResultadoImportacion {
  registrar('error', `Importación de ${contexto} fallida: ${e instanceof Error ? e.message : String(e)}`);
  return { ok: false, motivo: 'error' };
}

export async function importarRunas(lcu: ClienteLcu, build: Build, titulo: string, o: OpcionesRunas = {}): Promise<ResultadoImportacion> {
  try {
    const paginas = await lcu.peticion<PaginaLcu[]>('GET', '/lol-perks/v1/pages');
    const inventario = await lcu.peticion<{ ownedPageCount: number }>('GET', '/lol-perks/v1/inventory');
    const previa = paginas.find((p) => p.isEditable && p.name.startsWith(PREFIJO));
    const restantes = paginas.filter((p) => p.isEditable && p !== previa).length;
    if (restantes >= inventario.ownedPageCount) {
      const candidata = paginaSustituible(paginas);
      const sustituible = candidata ? { id: candidata.id, nombre: candidata.name } : undefined;
      const confirmada = o.sustituir === 'cualquiera' || (o.sustituir !== undefined && o.sustituir === candidata?.id);
      // Sin confirmación (o si la página elegida cambió desde que se preguntó), no se borra nada.
      if (!candidata || !confirmada) return { ok: false, motivo: 'sin_paginas', ...(sustituible ? { sustituible } : {}) };
      await lcu.peticion('DELETE', `/lol-perks/v1/pages/${candidata.id}`);
      registrar('info', `Runas: sin páginas libres, se sustituye la página «${candidata.name}» (confirmado por el jugador)`);
    } else if (previa) await lcu.peticion('DELETE', `/lol-perks/v1/pages/${previa.id}`);
    await lcu.peticion('POST', '/lol-perks/v1/pages', {
      name: titulo,
      primaryStyleId: build.runas.estiloPrincipal,
      subStyleId: build.runas.estiloSecundario,
      selectedPerkIds: build.runas.runas,
      current: true,
    });
    return { ok: true };
  } catch (e) {
    return fallo('runas', e);
  }
}

export async function importarHechizos(lcu: ClienteLcu, hechizos: [number, number]): Promise<ResultadoImportacion> {
  try {
    const sesion = await lcu.peticion<{
      localPlayerCellId: number;
      myTeam: Array<{ cellId: number; spell1Id: number; spell2Id: number }>;
    }>('GET', '/lol-champ-select/v1/session');
    const yo = sesion.myTeam.find((j) => j.cellId === sesion.localPlayerCellId);
    let [spell1Id, spell2Id] = hechizos;
    if (hechizos.includes(DESTELLO)) {
      const otro = hechizos[0] === DESTELLO ? hechizos[1] : hechizos[0];
      if (yo?.spell2Id === DESTELLO) [spell1Id, spell2Id] = [otro, DESTELLO];
      else [spell1Id, spell2Id] = [DESTELLO, otro];
    }
    await lcu.peticion('PATCH', '/lol-champ-select/v1/session/my-selection', { spell1Id, spell2Id });
    return { ok: true };
  } catch (e) {
    return fallo('hechizos', e);
  }
}

/**
 * Mapa del conjunto de objetos (`associatedMaps`), según https://static.developer.riotgames.com/docs/lol/maps.json:
 * 11 = Grieta del Invocador, 12 = Abismo de los Lamentos (ARAM y ARAM: Caos).
 */
export type MapaConjunto = 11 | 12;

export async function importarObjetos(
  lcu: ClienteLcu,
  build: Build,
  campeonKey: number,
  titulo: string,
  mapa: MapaConjunto = 11,
): Promise<ResultadoImportacion> {
  try {
    const { summonerId } = await lcu.peticion<{ summonerId: number }>('GET', '/lol-summoner/v1/current-summoner');
    const ruta = `/lol-item-sets/v1/item-sets/${summonerId}/sets`;
    const doc = await lcu.peticion<{ itemSets?: Array<{ title?: string }> } & Record<string, unknown>>('GET', ruta);
    const bloque = (clave: string, ids: number[]) => ({
      type: t(`conjunto.${clave}`),
      items: ids.map((id) => ({ id: String(id), count: 1 })),
    });
    const blocks = [
      bloque('iniciales', build.objetosIniciales),
      bloque('nucleo', build.nucleo),
      ...(build.botas !== null ? [bloque('botas', [build.botas])] : []),
      bloque('situacionales', build.situacionales),
    ];
    const conservados = (doc.itemSets ?? []).filter((s) => !(s.title ?? '').startsWith(PREFIJO));
    const nuevo = {
      title: titulo,
      type: 'custom',
      map: 'any',
      mode: 'any',
      associatedChampions: [campeonKey],
      associatedMaps: [mapa],
      sortrank: 0,
      startedFrom: 'blank',
      preferredItemSlots: [],
      uid: randomUUID(),
      blocks,
    };
    await lcu.peticion('PUT', ruta, { ...doc, itemSets: [...conservados, nuevo] });
    return { ok: true };
  } catch (e) {
    return fallo('objetos', e);
  }
}

export async function importarTodo(
  lcu: ClienteLcu,
  build: Build,
  campeonKey: number,
  titulo: string,
  mapa: MapaConjunto = 11,
  opcionesRunas: OpcionesRunas = {},
): Promise<{ runas: ResultadoImportacion; hechizos: ResultadoImportacion; objetos: ResultadoImportacion }> {
  const [runas, hechizos, objetos] = await Promise.all([
    importarRunas(lcu, build, titulo, opcionesRunas),
    importarHechizos(lcu, build.hechizos),
    importarObjetos(lcu, build, campeonKey, titulo, mapa),
  ]);
  return { runas, hechizos, objetos };
}
