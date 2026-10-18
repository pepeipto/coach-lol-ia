import { randomUUID } from 'node:crypto';
import type { Build } from '@coach/shared';
import { t } from '../../shared/i18n';
import { registrar } from '../log';
import type { ClienteLcu } from './cliente';

export type ResultadoImportacion = { ok: true } | { ok: false; motivo: 'sin_paginas' | 'error' };

const PREFIJO = 'Coach:';
const DESTELLO = 4;

interface PaginaLcu {
  id: number;
  name: string;
  isEditable: boolean;
}

function fallo(contexto: string, e: unknown): ResultadoImportacion {
  registrar('error', `Importación de ${contexto} fallida: ${e instanceof Error ? e.message : String(e)}`);
  return { ok: false, motivo: 'error' };
}

export async function importarRunas(lcu: ClienteLcu, build: Build, titulo: string): Promise<ResultadoImportacion> {
  try {
    const paginas = await lcu.peticion<PaginaLcu[]>('GET', '/lol-perks/v1/pages');
    const inventario = await lcu.peticion<{ ownedPageCount: number }>('GET', '/lol-perks/v1/inventory');
    const previa = paginas.find((p) => p.isEditable && p.name.startsWith(PREFIJO));
    const restantes = paginas.filter((p) => p.isEditable && p !== previa).length;
    if (restantes >= inventario.ownedPageCount) return { ok: false, motivo: 'sin_paginas' };
    if (previa) await lcu.peticion('DELETE', `/lol-perks/v1/pages/${previa.id}`);
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

export async function importarObjetos(
  lcu: ClienteLcu,
  build: Build,
  campeonKey: number,
  titulo: string,
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
      associatedMaps: [11],
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
): Promise<{ runas: ResultadoImportacion; hechizos: ResultadoImportacion; objetos: ResultadoImportacion }> {
  const [runas, hechizos, objetos] = await Promise.all([
    importarRunas(lcu, build, titulo),
    importarHechizos(lcu, build.hechizos),
    importarObjetos(lcu, build, campeonKey, titulo),
  ]);
  return { runas, hechizos, objetos };
}
