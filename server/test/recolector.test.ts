import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ItemDDragonCrudo } from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import { recolectar } from '../src/recolector';
import {
  ErrorRiot,
  type LineaTiempoRiot,
  type PartidaRiot,
  type RiotApi,
} from '../src/riot/riotApi';
import partidaJson from './fixtures/partida.json';
import lineaJson from './fixtures/lineaTiempo.json';

const base = partidaJson as unknown as PartidaRiot;
const linea = lineaJson as unknown as LineaTiempoRiot;
const objetos: Record<number, ItemDDragonCrudo> = {
  3089: { gold: { total: 3500, purchasable: true }, maps: { '11': true } },
};

function crearPartida(id: string, version = '15.20.712.3456', queueId = 420): PartidaRiot {
  return {
    metadata: { matchId: id },
    info: { ...base.info, gameVersion: version, queueId },
  };
}

interface Contadores {
  partida: string[];
  lineaTiempo: string[];
}

function crearApi(
  partidas: Record<string, PartidaRiot | Error>,
  contadores: Contadores = { partida: [], lineaTiempo: [] },
): RiotApi {
  return {
    ligaApex: async (_p, liga) => (liga === 'challenger' ? [{ puuid: 'j1' }] : []),
    entradasLiga: async () => [],
    idsPartidas: async () => Object.keys(partidas),
    partida: async (_r, id) => {
      contadores.partida.push(id);
      const p = partidas[id];
      if (p instanceof Error) throw p;
      return p;
    },
    lineaTiempo: async (_r, id) => {
      contadores.lineaTiempo.push(id);
      return linea;
    },
  };
}

const opciones = { region: 'EUW' as const, parche: '15.20', aleatorio: () => 0.5 };

describe('recolectar', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    db.cerrar();
    vi.restoreAllMocks();
  });

  it('guarda las partidas nuevas y se detiene en maxPartidas', async () => {
    const api = crearApi({
      A1: crearPartida('A1'),
      A2: crearPartida('A2'),
      A3: crearPartida('A3'),
    });
    const n = await recolectar(api, db, objetos, { ...opciones, maxPartidas: 2 });
    expect(n).toBe(2);
    expect(db.partidaVista('A1')).toBe(true);
    expect(db.partidaVista('A2')).toBe(true);
    expect(db.partidaVista('A3')).toBe(false);
    expect(db.participacionesDe('Ahri', 'MIDDLE', ['15.20'])).toHaveLength(2);
  });

  it('no vuelve a pedir partidas ya vistas', async () => {
    const contadores: Contadores = { partida: [], lineaTiempo: [] };
    const api = crearApi({ A1: crearPartida('A1'), A2: crearPartida('A2') }, contadores);
    db.marcarVista('A1');
    const n = await recolectar(api, db, objetos, { ...opciones, maxPartidas: 10 });
    expect(n).toBe(1);
    expect(contadores.partida).toEqual(['A2']);
  });

  it('salta las partidas de otro parche o cola y las marca como vistas', async () => {
    const contadores: Contadores = { partida: [], lineaTiempo: [] };
    const api = crearApi(
      {
        VIEJA: crearPartida('VIEJA', '15.19.1.1'),
        OTRACOLA: crearPartida('OTRACOLA', '15.20.1.1', 400),
        BUENA: crearPartida('BUENA'),
      },
      contadores,
    );
    const n = await recolectar(api, db, objetos, { ...opciones, maxPartidas: 10 });
    expect(n).toBe(1);
    expect(db.partidaVista('VIEJA')).toBe(true);
    expect(db.partidaVista('OTRACOLA')).toBe(true);
    expect(contadores.lineaTiempo).toEqual(['BUENA']);
  });

  it('un ErrorRiot en una partida no detiene la recolección', async () => {
    const api = crearApi({
      MALA: new ErrorRiot(500),
      BUENA: crearPartida('BUENA'),
    });
    const n = await recolectar(api, db, objetos, { ...opciones, maxPartidas: 10 });
    expect(n).toBe(1);
    expect(db.partidaVista('MALA')).toBe(false);
    expect(db.partidaVista('BUENA')).toBe(true);
    expect(console.error).toHaveBeenCalled();
  });
});
