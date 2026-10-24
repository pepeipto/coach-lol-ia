import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RUTAS_ROTATIVOS, URL_VERSIONES, type ItemDDragonCrudo, type ListaCampeones, type ListaModosRotativos } from '@coach/shared';
import { calcularBuilds } from '../src/agregador';
import { abrirDb, type Db } from '../src/db';
import type { Participacion } from '../src/extraer';
import { crearServidor } from '../src/http';
import { ejecutarCiclo } from '../src/programacion';
import { recolectar, recolectarModos, repartirRotativos } from '../src/recolector';
import {
  CANDIDATAS_RESPALDO,
  candidatasDeColas,
  crearDetectorRotativos,
  INTERVALO_REVISION_MS,
  leerEstadoRotativos,
  URL_COLAS,
  type ColaRotativa,
  type DetectorRotativos,
} from '../src/rotativos/colas';
import { colaDeModo, colasDe, esModoRotativo, modoRotativo } from '../src/rotativos/modos';
import type { LineaTiempoRiot, PartidaRiot, RiotApi } from '../src/riot/riotApi';
import partidaJson from './fixtures/partida.json';
import lineaJson from './fixtures/lineaTiempo.json';

const base = partidaJson as unknown as PartidaRiot;
const linea = lineaJson as unknown as LineaTiempoRiot;
const objetos: Record<number, ItemDDragonCrudo> = { 3089: { gold: { total: 3500, purchasable: true }, maps: { '11': true } } };

/** Extracto de https://static.developer.riotgames.com/docs/lol/queues.json (descargado el 2026-10-24). */
const COLAS_JSON = [
  { queueId: 0, map: 'Custom games', description: null, notes: null },
  { queueId: 98, map: 'Twisted Treeline', description: '6v6 Hexakill games', notes: null },
  { queueId: 400, map: "Summoner's Rift", description: '5v5 Draft Pick games', notes: null },
  { queueId: 420, map: "Summoner's Rift", description: '5v5 Ranked Solo games', notes: null },
  { queueId: 430, map: "Summoner's Rift", description: '5v5 Blind Pick games', notes: null },
  { queueId: 440, map: "Summoner's Rift", description: '5v5 Ranked Flex games', notes: null },
  { queueId: 450, map: 'Howling Abyss', description: '5v5 ARAM games', notes: null },
  { queueId: 480, map: "Summoner's Rift", description: 'Swiftplay Games', notes: null },
  { queueId: 490, map: "Summoner's Rift", description: 'Normal (Quickplay)', notes: null },
  { queueId: 700, map: "Summoner's Rift", description: "Summoner's Rift Clash games", notes: null },
  { queueId: 870, map: "Summoner's Rift", description: 'Co-op vs. AI Intro Bot games', notes: null },
  { queueId: 900, map: "Summoner's Rift", description: 'ARURF games', notes: null },
  { queueId: 960, map: "Summoner's Rift", description: 'Doom Bots Standard games', notes: null },
  { queueId: 1020, map: "Summoner's Rift", description: 'One for All games', notes: null },
  { queueId: 1090, map: 'Convergence', description: 'Teamfight Tactics games', notes: null },
  { queueId: 1300, map: 'Nexus Blitz', description: 'Nexus Blitz games', notes: null },
  { queueId: 1400, map: "Summoner's Rift", description: 'Ultimate Spellbook games', notes: null },
  { queueId: 1700, map: 'Rings of Wrath', description: 'Arena', notes: null },
  { queueId: 1710, map: 'Rings of Wrath', description: 'Arena', notes: '16 player lobby' },
  { queueId: 1810, map: 'Swarm', description: 'Swarm Mode Games', notes: 'Swarm Mode 1 player' },
  { queueId: 1820, map: 'Swarm Mode Games', description: 'Swarm', notes: 'Swarm Mode 2 players' },
  { queueId: 1900, map: "Summoner's Rift", description: 'Pick URF games', notes: null },
  { queueId: 2000, map: "Summoner's Rift", description: 'Tutorial 1', notes: null },
  { queueId: 2300, map: 'The Bandlewood', description: 'Brawl', notes: null },
  { queueId: 2400, map: 'Howling Abyss', description: 'ARAM: Mayhem', notes: null },
  { queueId: 65, map: 'Howling Abyss', description: '5v5 ARAM games', notes: 'Deprecated in patch 7.19 in favor of queueId 450' },
];

const respuesta = (cuerpo: unknown) => ({ ok: true, status: 200, json: async () => cuerpo }) as Response;
const fetchColas = vi.fn(async (url: string) => {
  if (url === URL_COLAS) return respuesta(COLAS_JSON);
  throw new Error(`URL inesperada ${url}`);
}) as unknown as typeof fetch;

function partida(id: string, queueId: number, extra: Partial<PartidaRiot['info']> = {}, participante: Record<string, unknown> = {}): PartidaRiot {
  return {
    metadata: { matchId: id },
    info: {
      ...base.info,
      gameVersion: '15.20.1.1',
      queueId,
      gameDuration: 1500,
      ...extra,
      participants: base.info.participants.map((p) => ({ ...p, ...participante })),
    },
  };
}

describe('modos internos rotativos', () => {
  it('«rotativo:<cola>» se distingue de los modos del contrato y da su cola', () => {
    expect(modoRotativo(1900)).toBe('rotativo:1900');
    expect(colaDeModo('rotativo:1900')).toBe(1900);
    expect(colaDeModo('aram')).toBeNull();
    expect(esModoRotativo('rotativo:0')).toBe(false);
    expect(esModoRotativo('rotativo:abc')).toBe(false);
    expect(colasDe('rotativo:1020')).toEqual([1020]);
    expect(colasDe('arena')).toEqual([1700, 1710]);
  });
});

describe('candidatasDeColas', () => {
  it('toma las colas de LoL que no son clasificatoria, ARAM, Caos, Arena ni normales de la Grieta', () => {
    const c = candidatasDeColas(COLAS_JSON);
    expect(c.map((x) => x.cola).sort((a, b) => a - b)).toEqual([900, 960, 1020, 1300, 1400, 1810, 1820, 1900, 2300]);
    expect(c.find((x) => x.cola === 1900)).toEqual({ cola: 1900, nombre: 'Pick URF', mapa: 11, gameMode: 'URF', pve: false });
    expect(c.find((x) => x.cola === 1300)).toMatchObject({ mapa: 21, gameMode: 'NEXUSBLITZ', pve: false });
    // Enjambre y los Doom Bots son contra la IA: PvE.
    expect(c.filter((x) => x.pve).map((x) => x.cola)).toEqual([960, 1810, 1820]);
    // Una cola nueva sin gameMode conocido entra con '' (se lee de su partida al confirmarla).
    expect(c.find((x) => x.cola === 2300)).toMatchObject({ nombre: 'Brawl', gameMode: '', mapa: 0 });
  });

  it('ignora lo que no tiene la forma esperada', () => {
    expect(candidatasDeColas({ data: {} })).toEqual([]);
    expect(candidatasDeColas([null, { queueId: 'x' }, { queueId: -3 }])).toEqual([]);
  });
});

describe('repartirRotativos', () => {
  it('un 10 % del total, a partes iguales y el resto a las primeras; nada sin colas activas', () => {
    expect(repartirRotativos(300, [1900])).toEqual({ 1900: 30 });
    expect(repartirRotativos(300, [900, 1900])).toEqual({ 900: 15, 1900: 15 });
    expect(repartirRotativos(320, [900, 1020, 1900])).toEqual({ 900: 11, 1020: 11, 1900: 10 });
    expect(repartirRotativos(300, [])).toEqual({});
  });
});

describe('detector de colas rotativas', () => {
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

  /** Solo «p2» tiene una partida de URF (1900) reciente. */
  function apiSondeo(llamadas: { ids: [string, number | undefined, number][]; partidas: string[] }, o: { colaReal?: number } = {}): RiotApi {
    return {
      ligaApex: async () => [],
      entradasLiga: async () => [],
      idsPartidas: async (_r, puuid, n, cola) => {
        llamadas.ids.push([puuid, cola, n]);
        return puuid === 'p2' && cola === 1900 ? ['EUW1_U1'] : [];
      },
      partida: async (_r, id) => {
        llamadas.partidas.push(id);
        return partida(id, o.colaReal ?? 1900, { gameMode: 'URF', mapId: 11 });
      },
      lineaTiempo: async () => linea,
    };
  }

  it('sondea cada candidata con pocos jugadores, confirma con la partida y guarda el resultado', async () => {
    const llamadas = { ids: [] as [string, number | undefined, number][], partidas: [] as string[] };
    const ahora = () => Date.parse('2026-10-24T12:00:00Z');
    const d = crearDetectorRotativos({ api: apiSondeo(llamadas), db, fetch: fetchColas, ahora });
    const activas = await d.revisar('EUW', ['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(activas).toEqual([{ cola: 1900, nombre: 'Pick URF', mapa: 11, gameMode: 'URF', pve: false }]);
    // Como mucho 3 jugadores por cola, una partida por petición, y una sola descarga (la que confirma).
    expect(llamadas.ids.every(([p, , n]) => ['p1', 'p2', 'p3'].includes(p) && n === 1)).toBe(true);
    expect(llamadas.ids.length).toBeLessThanOrEqual(candidatasDeColas(COLAS_JSON).length * 3);
    expect(llamadas.partidas).toEqual(['EUW1_U1']);
    expect(leerEstadoRotativos(db)).toMatchObject({ actualizado: '2026-10-24T12:00:00.000Z', activas: [1900] });
    // Los jugadores de la partida que confirmó el modo se recuerdan para sembrarlo.
    expect(d.jugadoresDe('EUW', 1900)).toEqual(base.info.participants.map((p) => p.puuid));
  });

  it('como mucho una revisión por ciclo: dentro del intervalo usa la guardada (también tras reiniciar)', async () => {
    const llamadas = { ids: [] as [string, number | undefined, number][], partidas: [] as string[] };
    let t = Date.parse('2026-10-24T12:00:00Z');
    const ahora = () => t;
    const d = crearDetectorRotativos({ api: apiSondeo(llamadas), db, fetch: fetchColas, ahora });
    await d.revisar('EUW', ['p2']);
    const tras1 = llamadas.ids.length;
    t += INTERVALO_REVISION_MS - 1000;
    expect((await d.revisar('LAN', ['p2'])).map((c) => c.cola)).toEqual([1900]);
    // Un detector nuevo (servidor reiniciado) lee el estado de la base.
    const otro = crearDetectorRotativos({ api: apiSondeo(llamadas), db, fetch: fetchColas, ahora });
    expect((await otro.revisar('EUW', ['p2'])).map((c) => c.cola)).toEqual([1900]);
    expect(llamadas.ids.length).toBe(tras1);
    t += 2000;
    await d.revisar('EUW', ['p2']);
    expect(llamadas.ids.length).toBeGreaterThan(tras1);
  });

  it('primero prueba a los jugadores que ya jugaron el modo', async () => {
    const llamadas = { ids: [] as [string, number | undefined, number][], partidas: [] as string[] };
    const d = crearDetectorRotativos({ api: apiSondeo(llamadas), db, fetch: fetchColas });
    d.anotarJugadores('EUW', 1900, ['p2']);
    await d.revisar('EUW', ['p1', 'p3', 'p4']);
    expect(llamadas.ids.filter(([, c]) => c === 1900).map(([p]) => p)).toEqual(['p2']);
  });

  it('no da por activa una cola si la partida es de otra cola', async () => {
    const llamadas = { ids: [] as [string, number | undefined, number][], partidas: [] as string[] };
    const d = crearDetectorRotativos({ api: apiSondeo(llamadas, { colaReal: 420 }), db, fetch: fetchColas });
    expect(await d.revisar('EUW', ['p2'])).toEqual([]);
    expect(leerEstadoRotativos(db).activas).toEqual([]);
  });

  it('sin respuesta de Riot no se da por revisado (se reintenta) y sin jugadores no sondea', async () => {
    const api: RiotApi = {
      ligaApex: async () => [],
      entradasLiga: async () => [],
      idsPartidas: vi.fn(async () => {
        throw new Error('403');
      }),
      partida: async () => null,
      lineaTiempo: async () => null,
    };
    const d = crearDetectorRotativos({ api, db, fetch: fetchColas });
    expect(await d.revisar('EUW', [])).toEqual([]);
    expect(api.idsPartidas).not.toHaveBeenCalled();
    expect(await d.revisar('EUW', ['p1'])).toEqual([]);
    expect(leerEstadoRotativos(db).actualizado).toBeNull();
  });

  it('si queues.json no se puede leer, sondea las colas conocidas', async () => {
    const colas = new Set<number | undefined>();
    const api: RiotApi = {
      ligaApex: async () => [],
      entradasLiga: async () => [],
      idsPartidas: async (_r, _p, _n, cola) => {
        colas.add(cola);
        return [];
      },
      partida: async () => null,
      lineaTiempo: async () => null,
    };
    const caido = (async () => ({ ok: false, status: 503 }) as Response) as unknown as typeof fetch;
    await crearDetectorRotativos({ api, db, fetch: caido }).revisar('EUW', ['p1']);
    expect([...colas].sort()).toEqual(CANDIDATAS_RESPALDO.map((c) => c.cola).sort());
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('queues.json'));
  });
});

describe('recogida de los modos rotativos', () => {
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

  const opciones = { region: 'EUW' as const, parche: '15.20', aleatorio: () => 0.5 };
  const URF: ColaRotativa = { cola: 1900, nombre: 'Pick URF', mapa: 11, gameMode: 'URF', pve: false };
  const ENJAMBRE: ColaRotativa = { cola: 1810, nombre: 'Swarm Mode', mapa: 33, gameMode: 'STRAWBERRY', pve: true };

  function detectorFijo(activas: ColaRotativa[]): DetectorRotativos & { anotados: string[]; sondeados: string[][] } {
    const anotados: string[] = [];
    const sondeados: string[][] = [];
    return {
      anotados,
      sondeados,
      revisar: async (_r, jugadores) => {
        sondeados.push(jugadores);
        return activas;
      },
      jugadoresDe: (_r, cola) => (cola === 1900 ? ['urf-conocido'] : []),
      anotarJugadores: (_r, _c, ps) => void anotados.push(...ps),
    };
  }

  /** Muchas partidas de cada cola para cualquier jugador. */
  function apiMuchas(colas: number[], llamadas: { ids: [string, number | undefined][] }): RiotApi {
    const porCola = new Map(colas.map((c) => [c, Array.from({ length: 60 }, (_, i) => partida(`${c}-${i}`, c, { gameMode: c === 1900 ? 'URF' : 'CLASSIC', mapId: 11 }, { placement: 1 }))]));
    const todas = new Map([...porCola.values()].flat().map((p) => [p.metadata.matchId, p]));
    return {
      ligaApex: async (_p, liga) => (liga === 'challenger' ? [{ puuid: 'j1' }] : []),
      entradasLiga: async () => [],
      idsPartidas: async (_r, puuid, _n, cola = 420) => {
        llamadas.ids.push([puuid, cola]);
        return (porCola.get(cola) ?? []).map((p) => p.metadata.matchId);
      },
      partida: async (_r, id) => todas.get(id) ?? null,
      lineaTiempo: async () => linea,
    };
  }

  it('con una cola activa, un 10 % sale de clasificatoria y se guarda en «rotativo:<cola>»; los PvE no se recogen', async () => {
    const llamadas = { ids: [] as [string, number | undefined][] };
    const api = apiMuchas([420, 450, 2400, 1700, 1900, 1810], llamadas);
    const detector = detectorFijo([URF, ENJAMBRE]);
    const r = await recolectarModos(api, db, objetos, { ...opciones, maxPartidas: 100, rotativos: detector });
    expect(r).toEqual({ clasificatoria: 50, aram: 15, caos: 10, arena: 15, rotativos: { 1900: 10 } });
    expect(llamadas.ids.some(([, c]) => c === 1810)).toBe(false);
    // Siembra: primero los jugadores conocidos del modo y los de las partidas de ARAM.
    expect(llamadas.ids.find(([, c]) => c === 1900)![0]).toBe('urf-conocido');
    expect(detector.sondeados[0]).toEqual(expect.arrayContaining(['j1', ...base.info.participants.map((p) => p.puuid)]));
    expect(detector.anotados.length).toBeGreaterThan(0);
    const ps = db.participacionesDe('Ahri', null, ['15.20'], 'rotativo:1900');
    expect(ps).toHaveLength(10);
    expect(ps[0]).toMatchObject({ modo: 'rotativo:1900', rol: null, mapa: 11, gameMode: 'URF' });
    // Los modos actuales no se tocan.
    expect(db.participacionesDe('Ahri', null, ['15.20'], 'aram')).toHaveLength(15);
  });

  it('lo que no gasta el modo rotativo vuelve a clasificatoria; sin activas, el reparto de siempre', async () => {
    const llamadas = { ids: [] as [string, number | undefined][] };
    const api = apiMuchas([420], llamadas);
    expect(await recolectarModos(api, db, objetos, { ...opciones, maxPartidas: 100, rotativos: detectorFijo([URF]) })).toEqual({
      clasificatoria: 60,
      aram: 0,
      caos: 0,
      arena: 0,
      rotativos: { 1900: 0 },
    });
  });

  it('un fallo del detector no impide recolectar los demás modos', async () => {
    const llamadas = { ids: [] as [string, number | undefined][] };
    const api = apiMuchas([420], llamadas);
    const detector = detectorFijo([]);
    detector.revisar = async () => {
      throw new Error('fallo');
    };
    const r = await recolectarModos(api, db, objetos, { ...opciones, maxPartidas: 20, rotativos: detector });
    expect(r).toMatchObject({ clasificatoria: 20, rotativos: {} });
  });

  it('recolectar descarta en un modo rotativo las partidas de otra cola', async () => {
    const api = apiMuchas([], { ids: [] });
    api.idsPartidas = async () => ['X1'];
    api.partida = async () => partida('X1', 420);
    expect(await recolectar(api, db, objetos, { ...opciones, maxPartidas: 5, modo: 'rotativo:1900', jugadores: ['a'] })).toBe(0);
    expect(db.partidaVista('X1')).toBe(true);
  });
});

describe('ciclo con modos rotativos', () => {
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

  it('detecta URF, lo recoge con su parte del presupuesto, calcula sus builds y la ruta las sirve', async () => {
    const urf = Array.from({ length: 40 }, (_, i) => partida(`EUW1_U${i}`, 1900, { gameMode: 'URF', mapId: 11 }));
    const todas = new Map(urf.map((p) => [p.metadata.matchId, p]));
    const api: RiotApi = {
      ligaApex: async (_p, liga) => (liga === 'challenger' ? [{ puuid: 'j1' }] : []),
      entradasLiga: async () => [],
      idsPartidas: async (_r, _p, cantidad, cola) => (cola === 1900 ? urf.slice(0, cantidad).map((p) => p.metadata.matchId) : []),
      partida: async (_r, id) => todas.get(id) ?? null,
      lineaTiempo: async () => linea,
    };
    const hacerFetch = (async (url: string) => {
      if (url === URL_VERSIONES) return respuesta(['15.20.1', '15.19.1']);
      if (url === URL_COLAS) return respuesta(COLAS_JSON);
      return respuesta({ data: { 3089: { gold: { total: 3500, purchasable: true }, maps: { '11': true } } } });
    }) as unknown as typeof fetch;
    await ejecutarCiclo({ api, db, fetch: hacerFetch, regiones: ['EUW'], maxPartidasPorRegion: 200 });
    expect(leerEstadoRotativos(db).activas).toEqual([1900]);
    // 10 % de 200 = 20 partidas; cada una tiene a Ahri (las 20 ≥ 10 para publicar).
    expect(db.participacionesDe('Ahri', null, ['15.20'], 'rotativo:1900')).toHaveLength(20);
    const app = crearServidor(db);
    try {
      const r = await app.inject({ method: 'GET', url: RUTAS_ROTATIVOS.build(1900, 'Ahri') });
      expect(r.json()).toMatchObject({ cola: 1900, gameMode: 'URF', partidas: 20, rol: null });
      expect((await app.inject({ method: 'GET', url: '/rotativos' })).json().modos).toEqual([
        { cola: 1900, gameMode: 'URF', mapa: 11, nombre: 'Pick URF', conDatos: true, pve: false, activo: true },
      ]);
    } finally {
      await app.close();
    }
  });
});

let n = 0;
function participacion(modo: Participacion['modo'], extra: Partial<Participacion> = {}): Participacion {
  return {
    matchId: `M${n++}`,
    campeon: 'Ahri',
    rol: null,
    modo,
    mapa: 11,
    gameMode: 'URF',
    victoria: n % 2 === 0,
    parche: '15.20',
    runas: { estiloPrincipal: 8100, estiloSecundario: 8200, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    hechizos: [4, 14],
    iniciales: [1056],
    compras: [3089],
    habilidades: ['Q', 'W', 'E'],
    ...extra,
  };
}

describe('builds y rutas de los modos rotativos', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  function sembrar(): void {
    db.guardarParticipaciones('EUW', [
      ...Array.from({ length: 12 }, () => participacion('rotativo:1900', { aumentos: [5, 6] })),
      ...Array.from({ length: 10 }, () => participacion('rotativo:1900', { campeon: 'Lux' })),
      ...Array.from({ length: 4 }, () => participacion('rotativo:1020', { gameMode: 'ONEFORALL' })),
    ]);
    calcularBuilds(db, objetos, '15.20', '15.19');
  }

  it('agrega por campeón (rol null) con la cola y el gameMode; aumentos solo con su uso', () => {
    sembrar();
    const b = db.build('ahri', null, 'rotativo:1900') as unknown as Record<string, unknown>;
    expect(b).toMatchObject({ campeon: 'Ahri', rol: null, cola: 1900, gameMode: 'URF', partidas: 12 });
    expect(b).not.toHaveProperty('modo');
    expect(b.aumentosPopulares).toEqual([
      { id: 5, partidas: 12, uso: 1 },
      { id: 6, partidas: 12, uso: 1 },
    ]);
    for (const o of b.opciones as Record<string, unknown>[]) {
      expect(o).toMatchObject({ rol: null, cola: 1900 });
      for (const campo of ['aumentos', 'aumentosMejores']) expect(o).not.toHaveProperty(campo);
    }
    // Sin aumentos en el modo, no hay lista; menos de 10 partidas, sin build.
    expect(db.build('lux', null, 'rotativo:1900')).not.toHaveProperty('aumentosPopulares');
    expect(db.build('ahri', null, 'rotativo:1020')).toBeNull();
    // No se mezcla con ARAM ni con clasificatoria.
    expect(db.build('ahri', null, 'aram')).toBeNull();
    expect(db.builds()).toEqual([]);
  });

  it('GET /rotativos, /rotativos/:cola/builds/:campeon y /rotativos/:cola/campeones', async () => {
    sembrar();
    db.sql
      .prepare("INSERT INTO ajustes_servidor (clave, valor) VALUES ('rotativos_estado', ?)")
      .run(
        JSON.stringify({
          actualizado: '2026-10-24T12:00:00.000Z',
          activas: [1020, 1810],
          info: {
            1020: { cola: 1020, nombre: 'One for All', mapa: 11, gameMode: 'ONEFORALL', pve: false },
            1810: { cola: 1810, nombre: 'Swarm Mode', mapa: 33, gameMode: 'STRAWBERRY', pve: true },
          },
        }),
      );
    const app = crearServidor(db);
    try {
      const lista = await app.inject({ method: 'GET', url: RUTAS_ROTATIVOS.lista });
      expect(lista.statusCode).toBe(200);
      expect(lista.json<ListaModosRotativos>()).toEqual({
        actualizado: '2026-10-24T12:00:00.000Z',
        modos: [
          { cola: 1020, gameMode: 'ONEFORALL', mapa: 11, nombre: 'One for All', conDatos: false, pve: false, activo: true },
          { cola: 1810, gameMode: 'STRAWBERRY', mapa: 33, nombre: 'Swarm Mode', conDatos: false, pve: true, activo: true },
          // Ya no está activa, pero tiene datos del parche (su gameMode sale de las builds).
          { cola: 1900, gameMode: 'URF', mapa: 0, nombre: 'Queue 1900', conDatos: true, pve: false, activo: false },
        ],
      });

      const build = await app.inject({ method: 'GET', url: RUTAS_ROTATIVOS.build(1900, 'AHRI') });
      expect(build.statusCode).toBe(200);
      expect(build.json()).toMatchObject({ campeon: 'Ahri', rol: null, cola: 1900, gameMode: 'URF' });

      const sinDatos = await app.inject({ method: 'GET', url: RUTAS_ROTATIVOS.build(1020, 'Ahri') });
      expect(sinDatos.statusCode).toBe(404);
      expect(sinDatos.json()).toEqual({ error: 'sin_datos' });

      for (const cola of ['abc', '0', '-1', '1.5', '019', '99999999999']) {
        const r = await app.inject({ method: 'GET', url: `/rotativos/${cola}/builds/Ahri` });
        expect(r.statusCode, cola).toBe(400);
        expect(r.json()).toEqual({ error: 'cola_invalida' });
        expect((await app.inject({ method: 'GET', url: `/rotativos/${cola}/campeones` })).statusCode).toBe(400);
      }

      const campeones = await app.inject({ method: 'GET', url: RUTAS_ROTATIVOS.campeones(1900) });
      const l = campeones.json<ListaCampeones>();
      expect(l.parche).toBe('15.20');
      expect(l.campeones.map((c) => c.campeon).sort()).toEqual(['Ahri', 'Lux']);
      expect(l.campeones.every((c) => c.rol === null)).toBe(true);
      expect((await app.inject({ method: 'GET', url: RUTAS_ROTATIVOS.campeones(1300) })).json()).toEqual({ parche: '', campeones: [] });
    } finally {
      await app.close();
    }
  });

  it('GET /rotativos sin ninguna revisión ni datos', async () => {
    const app = crearServidor(db);
    try {
      const r = await app.inject({ method: 'GET', url: '/rotativos' });
      expect(r.json()).toEqual({ actualizado: new Date(0).toISOString(), modos: [] });
    } finally {
      await app.close();
    }
  });
});
