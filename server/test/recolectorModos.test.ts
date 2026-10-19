import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemDDragonCrudo } from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import { recolectar, recolectarModos } from '../src/recolector';
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
    expect(llamadas.ids).toEqual([450]);
    expect(db.participacionesDe('Ahri', null, ['15.20'], 'aram')).toHaveLength(1);
    expect(db.participacionesDe('Ahri', 'MIDDLE', ['15.20'])).toHaveLength(0);
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

  it('Arena pide las colas 1700 y 1710 y no descarga la línea de tiempo', async () => {
    const llamadas = { ids: [] as number[], lineas: [] as string[] };
    const api = crearApi({ 1710: [partida('R1', 1710, { placement: 2, playerAugment1: 7 })] }, llamadas);
    const n = await recolectar(api, db, objetos, { ...opciones, maxPartidas: 5, modo: 'arena' });
    expect(n).toBe(1);
    expect(llamadas.ids).toEqual([1700, 1710]);
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
});
