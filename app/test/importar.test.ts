import { describe, expect, it } from 'vitest';
import type { Build } from '@coach/shared';
import { ErrorLcu, type ClienteLcu } from '../src/main/lcu/cliente';
import { importarHechizos, importarObjetos, importarRunas, importarTodo } from '../src/main/lcu/importar';

type Llamada = { metodo: string; ruta: string; cuerpo?: unknown };

function falso(respuestas: Record<string, unknown>) {
  const llamadas: Llamada[] = [];
  const lcu: ClienteLcu = {
    async peticion(metodo: string, ruta: string, cuerpo?: unknown) {
      llamadas.push({ metodo, ruta, cuerpo });
      const clave = `${metodo} ${ruta}`;
      if (!(clave in respuestas)) return undefined as never;
      const r = respuestas[clave];
      if (r instanceof Error) throw r;
      return r as never;
    },
    suscribir() {},
    cerrar() {},
  };
  return { lcu, llamadas };
}

const BUILD = {
  campeon: 'Ahri',
  rol: 'MIDDLE',
  parche: '15.20',
  partidas: 500,
  tasaVictoria: 0.52,
  mezclaParches: false,
  runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112, 8126, 8138, 8135, 8304, 8347, 5008, 5008, 5001] },
  hechizos: [14, 4],
  objetosIniciales: [1056, 2003],
  nucleo: [6655, 3020],
  botas: 3020,
  situacionales: [3157],
  ordenHabilidades: [],
  calculadoEn: '2026-10-18T00:00:00Z',
} as unknown as Build;

const pagina = (id: number, name: string, isEditable = true) => ({ id, name, isEditable, isDeletable: isEditable });

describe('importarRunas', () => {
  it('reemplaza la página Coach: existente y crea la nueva como actual', async () => {
    const { lcu, llamadas } = falso({
      'GET /lol-perks/v1/pages': [pagina(1, 'Coach: Ahri'), pagina(2, 'Mía'), pagina(3, 'Otra')],
      'GET /lol-perks/v1/inventory': { ownedPageCount: 3 },
    });
    expect(await importarRunas(lcu, BUILD, 'Coach: Ahri MID')).toEqual({ ok: true });
    expect(llamadas.filter((l) => l.metodo === 'DELETE')).toEqual([
      { metodo: 'DELETE', ruta: '/lol-perks/v1/pages/1', cuerpo: undefined },
    ]);
    expect(llamadas.at(-1)).toEqual({
      metodo: 'POST',
      ruta: '/lol-perks/v1/pages',
      cuerpo: {
        name: 'Coach: Ahri MID',
        primaryStyleId: 8100,
        subStyleId: 8300,
        selectedPerkIds: BUILD.runas.runas,
        current: true,
      },
    });
  });
  it('todas las páginas ocupadas por el jugador → sin_paginas y ningún DELETE', async () => {
    const { lcu, llamadas } = falso({
      'GET /lol-perks/v1/pages': [pagina(1, 'A'), pagina(2, 'B'), pagina(3, 'Fija', false)],
      'GET /lol-perks/v1/inventory': { ownedPageCount: 2 },
    });
    expect(await importarRunas(lcu, BUILD, 'Coach: x')).toEqual({ ok: false, motivo: 'sin_paginas' });
    expect(llamadas.some((l) => l.metodo === 'DELETE' || l.metodo === 'POST')).toBe(false);
  });
  it('nunca borra páginas sin el prefijo Coach:', async () => {
    const { lcu, llamadas } = falso({
      'GET /lol-perks/v1/pages': [pagina(1, 'Mi Coach: página'), pagina(2, 'Otra')],
      'GET /lol-perks/v1/inventory': { ownedPageCount: 5 },
    });
    expect(await importarRunas(lcu, BUILD, 'Coach: x')).toEqual({ ok: true });
    expect(llamadas.some((l) => l.metodo === 'DELETE')).toBe(false);
  });
});

describe('importarHechizos', () => {
  const sesion = (s1: number, s2: number) => ({
    'GET /lol-champ-select/v1/session': {
      localPlayerCellId: 3,
      myTeam: [
        { cellId: 0, spell1Id: 1, spell2Id: 2 },
        { cellId: 3, spell1Id: s1, spell2Id: s2 },
      ],
    },
  });
  it('respeta Destello en la posición 2 del jugador', async () => {
    const { lcu, llamadas } = falso(sesion(14, 4));
    expect(await importarHechizos(lcu, [4, 14])).toEqual({ ok: true });
    expect(llamadas.at(-1)).toEqual({
      metodo: 'PATCH',
      ruta: '/lol-champ-select/v1/session/my-selection',
      cuerpo: { spell1Id: 14, spell2Id: 4 },
    });
  });
  it('sin Destello en la posición 2 → Destello en spell1Id', async () => {
    const { lcu, llamadas } = falso(sesion(4, 14));
    await importarHechizos(lcu, [14, 4]);
    expect(llamadas.at(-1)?.cuerpo).toEqual({ spell1Id: 4, spell2Id: 14 });
  });
  it('sin Destello en la build → orden de la build', async () => {
    const { lcu, llamadas } = falso(sesion(14, 4));
    await importarHechizos(lcu, [12, 6]);
    expect(llamadas.at(-1)?.cuerpo).toEqual({ spell1Id: 12, spell2Id: 6 });
  });
});

describe('importarObjetos', () => {
  const doc = {
    accountId: 77,
    timestamp: 5,
    extra: 'x',
    itemSets: [
      { title: 'Mi conjunto', uid: 'a' },
      { title: 'Coach: viejo', uid: 'b' },
    ],
  };
  const resp = () => ({
    'GET /lol-summoner/v1/current-summoner': { summonerId: 99 },
    'GET /lol-item-sets/v1/item-sets/99/sets': doc,
  });
  it('conserva los conjuntos del jugador y reemplaza el de Coach:', async () => {
    const { lcu, llamadas } = falso(resp());
    expect(await importarObjetos(lcu, BUILD, 103, 'Coach: Ahri')).toEqual({ ok: true });
    const put = llamadas.at(-1)!;
    expect(put.metodo).toBe('PUT');
    expect(put.ruta).toBe('/lol-item-sets/v1/item-sets/99/sets');
    const c = put.cuerpo as typeof doc & { itemSets: Array<Record<string, unknown>> };
    expect(c.accountId).toBe(77);
    expect(c.extra).toBe('x');
    expect(c.timestamp).toBe(5);
    expect(c.itemSets).toHaveLength(2);
    expect(c.itemSets[0]).toEqual({ title: 'Mi conjunto', uid: 'a' });
    const nuevo = c.itemSets[1];
    expect(nuevo).toMatchObject({
      title: 'Coach: Ahri',
      type: 'custom',
      map: 'any',
      mode: 'any',
      associatedChampions: [103],
      associatedMaps: [11],
      sortrank: 0,
      startedFrom: 'blank',
      preferredItemSlots: [],
    });
    expect(typeof nuevo.uid).toBe('string');
    const bloques = nuevo.blocks as Array<{ type: string; items: unknown }>;
    expect(bloques.map((b) => b.type)).toEqual(['Objetos iniciales', 'Núcleo', 'Botas', 'Situacionales']);
    expect(bloques[0].items).toEqual([
      { id: '1056', count: 1 },
      { id: '2003', count: 1 },
    ]);
  });
  it('sin botas (null) no crea ese bloque', async () => {
    const { lcu, llamadas } = falso(resp());
    await importarObjetos(lcu, { ...BUILD, botas: null }, 103, 'Coach: Ahri');
    const c = llamadas.at(-1)!.cuerpo as { itemSets: Array<{ blocks?: Array<{ type: string }> }> };
    expect(c.itemSets[1].blocks!.map((b) => b.type)).toEqual(['Objetos iniciales', 'Núcleo', 'Situacionales']);
  });
});

describe('errores', () => {
  it('error del LCU → {ok:false, motivo:"error"}', async () => {
    const { lcu } = falso({ 'GET /lol-perks/v1/pages': new ErrorLcu(500, 'x') });
    expect(await importarRunas(lcu, BUILD, 'Coach: x')).toEqual({ ok: false, motivo: 'error' });
  });
  it('importarTodo: un fallo no detiene los demás y no lanza', async () => {
    const { lcu } = falso({
      'GET /lol-perks/v1/pages': new ErrorLcu(500, 'x'),
      'GET /lol-champ-select/v1/session': { localPlayerCellId: 0, myTeam: [{ cellId: 0, spell1Id: 1, spell2Id: 2 }] },
      'GET /lol-summoner/v1/current-summoner': { summonerId: 1 },
      'GET /lol-item-sets/v1/item-sets/1/sets': { accountId: 1, itemSets: [], timestamp: 0 },
    });
    expect(await importarTodo(lcu, BUILD, 103, 'Coach: x')).toEqual({
      runas: { ok: false, motivo: 'error' },
      hechizos: { ok: true },
      objetos: { ok: true },
    });
  });
});
