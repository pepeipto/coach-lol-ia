import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { URL_VERSIONES } from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import { ejecutarCiclo } from '../src/programacion';
import type { LineaTiempoRiot, PartidaRiot, RiotApi } from '../src/riot/riotApi';
import partidaJson from './fixtures/partida.json';
import lineaJson from './fixtures/lineaTiempo.json';

const base = partidaJson as unknown as PartidaRiot;
const linea = lineaJson as unknown as LineaTiempoRiot;

const respuesta = (cuerpo: unknown) => ({ ok: true, status: 200, json: async () => cuerpo }) as Response;
const fetchDDragon = (async (url: string) => {
  if (url === URL_VERSIONES) return respuesta(['15.20.1', '15.19.1']);
  return respuesta({ data: { 3089: { gold: { total: 3500, purchasable: true }, maps: { '11': true } } } });
}) as unknown as typeof fetch;

/** Cada plataforma tiene un jugador y una partida propia: «<plataforma>-M1». */
function crearApi(o: { caida?: string } = {}): RiotApi {
  return {
    ligaApex: async (plataforma, liga) => {
      if (plataforma === o.caida) throw new Error('caída de la región');
      return liga === 'challenger' ? [{ puuid: plataforma }] : [];
    },
    entradasLiga: async (plataforma) => {
      if (plataforma === o.caida) throw new Error('caída de la región');
      return [];
    },
    idsPartidas: async (_ruta, puuid) => [`${puuid}-M1`],
    partida: async (_r, id) => ({ metadata: { matchId: id }, info: { ...base.info, gameVersion: '15.20.1.1', queueId: 420, gameDuration: 1800 } }),
    lineaTiempo: async () => linea,
  };
}

describe('ejecutarCiclo', () => {
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

  it('si una región falla, las demás se recolectan y las builds se calculan igualmente', async () => {
    const combinaciones = vi.spyOn(db, 'combinaciones');
    const borrar = vi.spyOn(db, 'borrarParchesAntiguos');
    await ejecutarCiclo({ api: crearApi({ caida: 'euw1' }), db, fetch: fetchDDragon });
    expect(db.partidaVista('euw1-M1')).toBe(false);
    expect(db.partidaVista('la1-M1')).toBe(true);
    expect(db.partidaVista('la2-M1')).toBe(true);
    expect(combinaciones).toHaveBeenCalled();
    expect(borrar).toHaveBeenCalledWith(['15.20', '15.19']);
  });

  it('por defecto recolecta EUW, LAN y LAS (no BR ni NA); con `regiones`, solo las pedidas', async () => {
    await ejecutarCiclo({ api: crearApi(), db, fetch: fetchDDragon });
    expect(db.partidaVista('euw1-M1')).toBe(true);
    expect(db.partidaVista('br1-M1')).toBe(false);
    expect(db.partidaVista('na1-M1')).toBe(false);
    await ejecutarCiclo({ api: crearApi(), db, fetch: fetchDDragon, regiones: ['BR', 'NA'] });
    expect(db.partidaVista('br1-M1')).toBe(true);
    expect(db.partidaVista('na1-M1')).toBe(true);
  });

  it('un error inesperado que tumba una región no detiene a las demás ni al agregador', async () => {
    const vistaReal = db.partidaVista.bind(db);
    vi.spyOn(db, 'partidaVista').mockImplementation((id) => {
      if (id.startsWith('la1')) throw new Error('disco lleno');
      return vistaReal(id);
    });
    const borrar = vi.spyOn(db, 'borrarParchesAntiguos');
    await ejecutarCiclo({ api: crearApi(), db, fetch: fetchDDragon });
    expect(vistaReal('euw1-M1')).toBe(true);
    expect(vistaReal('la2-M1')).toBe(true);
    expect(borrar).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('recolecta los cuatro modos en cada región (colas 420, 450, 2400, 1700, 1710 y 1750)', async () => {
    const api = crearApi();
    const colas = new Set<number | undefined>();
    const real = api.idsPartidas;
    api.idsPartidas = async (r, p, n, cola) => {
      colas.add(cola);
      return real(r, p, n, cola);
    };
    // Sin el detector de colas rotativas (3.8), que sondea otras colas: ver rotativos.test.ts.
    await ejecutarCiclo({ api, db, fetch: fetchDDragon, maxPartidasPorRegion: 20, rotativos: null });
    expect([...colas].sort()).toEqual([1700, 1710, 1750, 2400, 420, 450]);
  });
});
