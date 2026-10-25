import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemDDragonCrudo } from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import { maxJugadoresOtrosModos, recolectar, recolectarModos } from '../src/recolector';
import type { LineaTiempoRiot, PartidaRiot, RiotApi } from '../src/riot/riotApi';
import partidaJson from './fixtures/partida.json';
import lineaJson from './fixtures/lineaTiempo.json';

const base = partidaJson as unknown as PartidaRiot;
const linea = lineaJson as unknown as LineaTiempoRiot;
const objetos: Record<number, ItemDDragonCrudo> = { 3089: { gold: { total: 3500, purchasable: true }, maps: { '11': true } } };

function partida(id: string, queueId: number, extra: Record<string, unknown> = {}): PartidaRiot {
  return {
    metadata: { matchId: id },
    info: {
      ...base.info,
      gameVersion: '15.20.1.1',
      queueId,
      gameDuration: 1500,
      participants: base.info.participants.map((p) => ({ ...p, ...extra })),
    },
  };
}

/** Un jugador; por cada cola, las partidas indicadas. Registra las llamadas. */
function crearApi(porCola: Record<number, PartidaRiot[]>, llamadas: { ids: number[]; lineas: string[] }): RiotApi {
  const todas = new Map(Object.values(porCola).flat().map((p) => [p.metadata.matchId, p]));
  return {
    ligaApex: async (_p, liga) => (liga === 'challenger' ? [{ puuid: 'j1' }] : []),
    entradasLiga: async () => [],
    idsPartidas: async (_r, _puuid, _n, cola = 420) => {
      llamadas.ids.push(cola);
      return (porCola[cola] ?? []).map((p) => p.metadata.matchId);
    },
    partida: async (_r, id) => todas.get(id) ?? null,
    lineaTiempo: async (_r, id) => {
      llamadas.lineas.push(id);
      return linea;
    },
  };
}

const opciones = { region: 'EUW' as const, parche: '15.20', aleatorio: () => 0.5 };

describe('recolectar por modo', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    db.cerrar();
    vi.restoreAllMocks();
  });

  it('ARAM pide la cola 450 y guarda a todos sin rol', async () => {
    const llamadas = { ids: [] as number[], lineas: [] as string[] };
    const api = crearApi({ 450: [partida('A1', 450)] }, llamadas);
    const n = await recolectar(api, db, objetos, { ...opciones, maxPartidas: 5, modo: 'aram' });
    expect(n).toBe(1);
    // 3.4: después se piden también los compañeros de la partida (bola de nieve), siempre de la misma cola.
    expect(new Set(llamadas.ids)).toEqual(new Set([450]));
    expect(db.participacionesDe('Ahri', null, ['15.20'], 'aram')).toHaveLength(1);
    expect(db.participacionesDe('Ahri', 'MIDDLE', ['15.20'])).toHaveLength(0);
  });

  it('3.7: ARAM: Caos y Arena prueban primero a los jugadores de las partidas de ARAM (los de las ligas no los juegan)', async () => {
    const llamadas = { ids: [] as number[], lineas: [] as string[] };
    const api = crearApi({ 450: [partida('A1', 450)] }, llamadas);
    const caos = partida('C1', 2400);
    const pedidosCaos: string[] = [];
    // Solo los jugadores de la partida de ARAM tienen partidas de ARAM: Caos; el de la liga (j1), ninguna.
    const idsBase = api.idsPartidas;
    api.idsPartidas = async (r, puuid, n, cola, inicio) => {
      if (cola !== 2400) return idsBase(r, puuid, n, cola, inicio);
      pedidosCaos.push(puuid);
      return puuid === 'j1' ? [] : ['C1'];
    };
    const partidaBase = api.partida;
    api.partida = async (r, id) => (id === 'C1' ? caos : partidaBase(r, id));
    const r = await recolectarModos(api, db, objetos, { ...opciones, maxPartidas: 100 });
    expect(r.aram).toBe(1);
    expect(r.caos).toBe(1);
    expect(pedidosCaos[0]).not.toBe('j1');
  });

  it('descarta una partida de otra cola aunque llegue en la lista del modo', async () => {
    const llamadas = { ids: [] as number[], lineas: [] as string[] };
    const api = crearApi({ 2400: [partida('X1', 420)] }, llamadas);
    expect(await recolectar(api, db, objetos, { ...opciones, maxPartidas: 5, modo: 'caos' })).toBe(0);
    expect(db.partidaVista('X1')).toBe(true);
  });

  it('ARAM: Caos sin aumentos en Match-v5: guarda la partida y avisa de que no está soportado', async () => {
    const llamadas = { ids: [] as number[], lineas: [] as string[] };
    const api = crearApi({ 2400: [partida('C1', 2400)] }, llamadas);
    expect(await recolectar(api, db, objetos, { ...opciones, maxPartidas: 5, modo: 'caos' })).toBe(1);
    expect(db.participacionesDe('Ahri', null, ['15.20'], 'caos')[0]!.aumentos).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no soportado'));
  });

  it('Arena pide las colas 1700, 1710 y 1750 y no descarga la línea de tiempo', async () => {
    const llamadas = { ids: [] as number[], lineas: [] as string[] };
    const api = crearApi({ 1710: [partida('R1', 1710, { placement: 2, playerAugment1: 7 })] }, llamadas);
    const n = await recolectar(api, db, objetos, { ...opciones, maxPartidas: 5, modo: 'arena' });
    expect(n).toBe(1);
    expect(llamadas.ids.slice(0, 3)).toEqual([1700, 1710, 1750]);
    expect(new Set(llamadas.ids)).toEqual(new Set([1700, 1710, 1750]));
    expect(llamadas.lineas).toEqual([]);
    expect(db.participacionesDe('Ahri', null, ['15.20'], 'arena')[0]).toMatchObject({ posicion: 2, aumentos: [7] });
  });

  it('recolectarModos reúne a los jugadores una vez y reparte el presupuesto 60/15/10/15', async () => {
    const llamadas = { ids: [] as number[], lineas: [] as string[] };
    const muchas = (cola: number, pre: string) => Array.from({ length: 50 }, (_, i) => partida(`${pre}${i}`, cola, { placement: 1 }));
    const api = crearApi({ 420: muchas(420, 'R'), 450: muchas(450, 'A'), 2400: muchas(2400, 'C'), 1700: muchas(1700, 'X') }, llamadas);
    const ligas = vi.spyOn(api, 'ligaApex');
    const r = await recolectarModos(api, db, objetos, { ...opciones, maxPartidas: 20 });
    expect(r).toEqual({ clasificatoria: 12, aram: 3, caos: 2, arena: 3 });
    expect(ligas).toHaveBeenCalledTimes(3); // challenger, grandmaster y master, una sola vez
  });

  it('un modo que falla no impide recolectar los demás', async () => {
    const llamadas = { ids: [] as number[], lineas: [] as string[] };
    const api = crearApi({ 450: [partida('A1', 450)] }, llamadas);
    const real = api.idsPartidas;
    api.idsPartidas = async (r, p, n, cola) => {
      if (cola === 420) throw new Error('fallo inesperado');
      return real(r, p, n, cola);
    };
    vi.spyOn(db, 'partidaVista').mockImplementationOnce(() => {
      throw new Error('disco lleno');
    });
    const r = await recolectarModos(api, db, objetos, { ...opciones, maxPartidas: 100 });
    expect(r.aram).toBe(0); // su primera consulta a la base falló
    expect(llamadas.ids).toEqual(expect.arrayContaining([2400, 1700, 1710]));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('aram'), expect.anything());
  });

  it('pide solo partidas desde el inicio del parche o, si no se sabe, de los últimos 14 días', async () => {
    const inicios: (number | undefined)[] = [];
    const api = crearApi({}, { ids: [], lineas: [] });
    api.idsPartidas = async (_r, _p, _n, _c, inicio) => {
      inicios.push(inicio);
      return [];
    };
    const ahora = () => 1_800_000_000_000;
    await recolectar(api, db, objetos, { ...opciones, maxPartidas: 5, ahora });
    await recolectar(api, db, objetos, { ...opciones, maxPartidas: 5, ahora, inicioParche: 1_799_000_000 });
    expect(inicios).toEqual([1_800_000_000 - 14 * 24 * 3600, 1_799_000_000]);
  });

  it('3.4: los compañeros de una partida del modo pasan delante en la cola y no se repite a nadie', async () => {
    const caos = partida('EUW1_C1', 2400, { playerAugment1: 1 });
    const compis = caos.info.participants.map((p) => p.puuid);
    const pedidos: string[] = [];
    const api: RiotApi = {
      ligaApex: async () => [],
      entradasLiga: async () => [],
      idsPartidas: async (_r, puuid) => {
        pedidos.push(puuid);
        return puuid === 'semilla' ? ['EUW1_C1'] : [];
      },
      partida: async () => caos,
      lineaTiempo: async () => linea,
    };
    await recolectar(api, db, objetos, { ...opciones, modo: 'caos', maxPartidas: 5, jugadores: ['semilla', 'otro'] });
    // Tras la semilla van sus compañeros de la partida de Caos (sin repetirla) y al final el resto.
    expect(pedidos[0]).toBe('semilla');
    expect(pedidos.slice(1, 1 + new Set(compis.filter((p) => p !== 'semilla')).size)).toEqual([...new Set(compis.filter((p) => p !== 'semilla'))]);
    expect(pedidos.at(-1)).toBe('otro');
    expect(new Set(pedidos).size).toBe(pedidos.length);
  });

  it('el tope de jugadores fuera de clasificatoria es max(80, presupuesto / 2)', async () => {
    expect(maxJugadoresOtrosModos(45)).toBe(80);
    expect(maxJugadoresOtrosModos(450)).toBe(225);
    const llamadas = { ids: [] as number[], lineas: [] as string[] };
    const api = crearApi({}, llamadas);
    api.ligaApex = async (_p, liga) => (liga === 'challenger' ? Array.from({ length: 400 }, (_, i) => ({ puuid: `j${i}` })) : []);
    await recolectar(api, db, objetos, { ...opciones, maxPartidas: 300, modo: 'aram' });
    expect(llamadas.ids).toHaveLength(150);
  });

  it('lo que no gastan ARAM, ARAM: Caos y Arena pasa a clasificatoria en el mismo ciclo', async () => {
    const llamadas = { ids: [] as number[], lineas: [] as string[] };
    const muchas = Array.from({ length: 50 }, (_, i) => partida(`R${i}`, 420));
    const api = crearApi({ 420: muchas }, llamadas);
    const r = await recolectarModos(api, db, objetos, { ...opciones, maxPartidas: 20 });
    expect(r).toEqual({ clasificatoria: 20, aram: 0, caos: 0, arena: 0 });
    expect(llamadas.ids.at(-1)).toBe(420); // clasificatoria va la última
  });
});

