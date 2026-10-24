import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Build, CountersCampeon, Enfrentamiento, ListaCampeones } from '@coach/shared';
import { crearClienteBuilds } from '../src/main/builds/clienteBuilds';
import { buenasEleccionesContra, countersVista, indiceCampeones, rivalDeLinea } from '../src/main/builds/counters';
import { interpretarRivales } from '../src/main/lcu/seleccion';
import { registrarIpcCampeones } from '../src/main/campeones';
import { crearOrquestadorSeleccion } from '../src/main/orquestador/seleccion';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import type { ClienteLcu } from '../src/main/lcu/cliente';
import type { CampeonDDragon } from '../src/shared/tiposApp';

const BUILD: Build = {
  campeon: 'Darius', rol: 'TOP', parche: '15.20', partidas: 60, tasaVictoria: 0.6, mezclaParches: false,
  runas: { estiloPrincipal: 8000, estiloSecundario: 8400, runas: [8010, 9111, 9104, 8299, 8444, 8242, 5005, 5008, 5001] },
  hechizos: [4, 12], objetosIniciales: [1054], nucleo: [6631, 3071, 3053], botas: 3047, situacionales: [],
  ordenHabilidades: [], calculadoEn: '2026-10-18T00:00:00Z',
};

const COUNTERS: CountersCampeon = {
  campeon: 'Darius', rol: 'TOP', parche: '15.20', partidas: 300,
  enfrentamientos: [
    { rival: 'Garen', partidas: 120, tasaVictoria: 0.58, datosLimitados: false },
    { rival: 'Fiddlesticks', partidas: 10, tasaVictoria: 0.6, datosLimitados: true },
    { rival: 'Teemo', partidas: 170, tasaVictoria: 0.44, datosLimitados: false },
  ],
  faciles: [
    { rival: 'Garen', partidas: 120, tasaVictoria: 0.58, datosLimitados: false },
    { rival: 'Fiddlesticks', partidas: 10, tasaVictoria: 0.6, datosLimitados: true },
  ],
  dificiles: [{ rival: 'Teemo', partidas: 170, tasaVictoria: 0.44, datosLimitados: false }],
};

const ENFRENTAMIENTO: Enfrentamiento = {
  campeon: 'Darius', rival: 'Garen', rol: 'TOP', parche: '15.20', partidas: 120, tasaVictoria: 0.58, datosLimitados: false, build: BUILD,
};

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });
const fetchCaido = (async () => {
  throw new Error('sin red');
}) as typeof fetch;

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'coach-counters-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
const cliente = (f: typeof fetch) => crearClienteBuilds({ urlServidor: 'http://srv/', dirCache: dir, fetch: f });

describe('cliente de counters', () => {
  it('pide /counters/:campeon/:rol, lo guarda en caché y sin red usa la caché', async () => {
    const urls: string[] = [];
    const ok = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return json(COUNTERS);
    }) as typeof fetch;
    expect(await cliente(ok).obtenerCounters('Darius', 'TOP')).toEqual({ estado: 'ok', counters: COUNTERS });
    expect(urls).toEqual(['http://srv/counters/Darius/TOP']);
    expect(await cliente(fetchCaido).obtenerCounters('Darius', 'TOP')).toEqual({ estado: 'sin_conexion', counters: COUNTERS });
  });

  it('404 sin caché → no_disponible; un id raro ni se pide', async () => {
    const f = vi.fn(async () => json({ error: 'sin_datos' }, 404));
    expect(await cliente(f as never).obtenerCounters('Darius', 'TOP')).toEqual({ estado: 'no_disponible' });
    expect(await cliente(f as never).obtenerCounters('../../x', 'TOP')).toEqual({ estado: 'no_disponible' });
    expect(await cliente(f as never).obtenerEnfrentamiento('Darius', 'Ga ren', 'TOP')).toEqual({ estado: 'no_disponible' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('descarta respuestas con otra forma y los cruces no válidos', async () => {
    const raro = (async () => json({ campeon: 'Darius', rol: 'TOP' })) as typeof fetch;
    expect(await cliente(raro).obtenerCounters('Darius', 'TOP')).toEqual({ estado: 'no_disponible' });
    const conBasura = (async () =>
      json({ ...COUNTERS, faciles: [...COUNTERS.faciles, { rival: 'X', partidas: 10, tasaVictoria: 7, datosLimitados: false }] })) as typeof fetch;
    const r = await cliente(conBasura).obtenerCounters('Darius', 'TOP');
    expect(r.estado === 'ok' && r.counters.faciles).toHaveLength(2);
  });

  it('con un servidor sin la lista completa, la arma con los dos extremos', async () => {
    const { enfrentamientos: _e, ...antiguo } = COUNTERS;
    const r = await cliente((async () => json(antiguo)) as typeof fetch).obtenerCounters('Darius', 'TOP');
    expect(r.estado === 'ok' && r.counters.enfrentamientos.map((e) => e.rival)).toEqual(['Garen', 'Fiddlesticks', 'Teemo']);
  });

  it('pide /enfrentamiento/:campeon/:rival/:rol, sanea la build y la guarda en caché', async () => {
    const urls: string[] = [];
    const conAumentos = { ...ENFRENTAMIENTO, build: { ...BUILD, aumentos: [{ id: 1, tasaVictoria: 0.6 }] } };
    const ok = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return json(conAumentos);
    }) as typeof fetch;
    const r = await cliente(ok).obtenerEnfrentamiento('Darius', 'Garen', 'TOP');
    expect(urls).toEqual(['http://srv/enfrentamiento/Darius/Garen/TOP']);
    expect(r).toEqual({ estado: 'ok', enfrentamiento: ENFRENTAMIENTO });
    expect(await cliente(fetchCaido).obtenerEnfrentamiento('Darius', 'Garen', 'TOP')).toEqual({ estado: 'sin_conexion', enfrentamiento: ENFRENTAMIENTO });
  });
});

describe('rivales en la sesión de champ select', () => {
  const sesion = (extra: object = {}) => ({
    localPlayerCellId: 2,
    queueId: 420,
    myTeam: [{ cellId: 2, championId: 0, assignedPosition: 'top' }],
    theirTeam: [
      { cellId: 5, championId: 86, assignedPosition: '' },
      { cellId: 6, championId: 0, assignedPosition: '' },
    ],
    ...extra,
  });

  it('tu rol y los campeones ya elegidos por el otro equipo (aunque tú no hayas elegido)', () => {
    expect(interpretarRivales(sesion())).toEqual({ rol: 'TOP', rivales: [{ campeonId: 86, rol: null }] });
  });

  it('el rol del rival si el cliente lo dice', () => {
    expect(interpretarRivales(sesion({ theirTeam: [{ championId: 86, assignedPosition: 'top' }] }))?.rivales).toEqual([{ campeonId: 86, rol: 'TOP' }]);
  });

  it('nada fuera de la Grieta (ARAM, Arena o un modo rotativo) ni con una sesión rara', () => {
    expect(interpretarRivales(sesion({ queueId: 450 }))).toBeNull();
    expect(interpretarRivales(sesion({ queueId: 1700 }))).toBeNull();
    expect(interpretarRivales(sesion({ queueId: 1900 }))).toBeNull();
    expect(interpretarRivales(sesion({ queueId: undefined }), 450)).toBeNull();
    expect(interpretarRivales(sesion({ queueId: 400 }))).not.toBeNull();
    expect(interpretarRivales(null)).toBeNull();
    expect(interpretarRivales({ myTeam: [] })).toBeNull();
  });
});

const campeon = (id: string, key: number): CampeonDDragon => ({ id, nombre: id, key });
const INDICE = new Map<number, CampeonDDragon>([
  [86, campeon('Garen', 86)],
  [17, campeon('Teemo', 17)],
  [64, campeon('LeeSin', 64)],
  [103, campeon('Ahri', 103)],
]);
const entrada = (c: string, rol: 'TOP' | 'JUNGLE' | 'MIDDLE', partidas: number) => ({
  campeon: c, rol, partidas, tasaVictoria: 0.5, uso: 0.1, tier: 'B' as const, datosLimitados: false,
});
const LISTA: ListaCampeones = {
  parche: '15.20',
  campeones: [
    entrada('Garen', 'TOP', 900), entrada('Garen', 'MIDDLE', 100),
    entrada('Teemo', 'TOP', 600), entrada('Teemo', 'MIDDLE', 50),
    entrada('LeeSin', 'JUNGLE', 1000),
    entrada('Ahri', 'MIDDLE', 1000),
  ],
};

describe('rival de tu línea', () => {
  it('si el cliente dice el rol, ese manda', () => {
    expect(rivalDeLinea({ rol: 'TOP', rivales: [{ campeonId: 17, rol: 'TOP' }] }, 'TOP', INDICE, null)).toEqual({ ...campeon('Teemo', 17), inferido: false });
  });

  it('si no, se deduce por cuánto juega cada uno cada rol', () => {
    const r = { rol: 'TOP' as const, rivales: [{ campeonId: 64, rol: null }, { campeonId: 86, rol: null }] };
    expect(rivalDeLinea(r, 'TOP', INDICE, LISTA)).toEqual({ ...campeon('Garen', 86), inferido: true });
    expect(rivalDeLinea(r, 'MIDDLE', INDICE, LISTA)).toBeNull(); // Garen va a top: nadie a mid todavía
  });

  it('reparte a los dos de top: el que menos juega mid va a mid si hace falta', () => {
    const r = { rol: 'MIDDLE' as const, rivales: [{ campeonId: 86, rol: null }, { campeonId: 17, rol: null }, { campeonId: 103, rol: null }] };
    // Ahri ocupa mid: ni Garen ni Teemo son tu rival.
    expect(rivalDeLinea(r, 'MIDDLE', INDICE, LISTA)?.id).toBe('Ahri');
    expect(rivalDeLinea(r, 'TOP', INDICE, LISTA)?.id).toMatch(/Garen|Teemo/);
  });

  it('nadie si el único rival casi nunca juega tu rol, o sin lista', () => {
    expect(rivalDeLinea({ rol: 'JUNGLE', rivales: [{ campeonId: 86, rol: null }] }, 'JUNGLE', INDICE, LISTA)).toBeNull();
    expect(rivalDeLinea({ rol: 'TOP', rivales: [{ campeonId: 86, rol: null }] }, 'TOP', INDICE, null)).toBeNull();
  });
});

describe('counters para la vista', () => {
  const d = { campeones: new Map([[122, { id: 'Darius', nombre: 'Darius' }], [86, { id: 'Garen', nombre: 'Garen' }], [9, { id: 'Fiddlesticks', nombre: 'Fiddlesticks' }], [17, { id: 'Teemo', nombre: 'Teemo' }]]) };
  it('resuelve los campeones sin distinguir mayúsculas y descarta los desconocidos', () => {
    const v = countersVista({ ...COUNTERS, faciles: [...COUNTERS.faciles, { rival: 'Nadie', partidas: 9, tasaVictoria: 0.7, datosLimitados: true }] }, indiceCampeones(d), false);
    expect(v.faciles.map((l) => l.campeon.id)).toEqual(['Garen', 'Fiddlesticks']);
    expect(v.todos).toHaveLength(3);
    expect(v.dificiles[0]).toEqual({ campeon: { id: 'Teemo', nombre: 'Teemo', key: 17 }, partidas: 170, tasaVictoria: 0.44, datosLimitados: false });
  });
  it('buenas elecciones contra un rival: quienes más le cuestan, con tu % (el inverso)', () => {
    const delRival: CountersCampeon = { ...COUNTERS, campeon: 'Garen', dificiles: [{ rival: 'Teemo', partidas: 100, tasaVictoria: 0.4, datosLimitados: false }] };
    const b = buenasEleccionesContra(delRival, indiceCampeones(d));
    expect(b).toHaveLength(1);
    expect(b[0]!.campeon.id).toBe('Teemo');
    expect(b[0]!.tasaVictoria).toBeCloseTo(0.6);
  });
});

describe('orquestador: enfrentamientos en la selección', () => {
  const datos = {
    version: '15.20.1', parche: '15.20',
    campeones: new Map([[122, { id: 'Darius', nombre: 'Darius' }], [86, { id: 'Garen', nombre: 'Garen' }], [17, { id: 'Teemo', nombre: 'Teemo' }]]),
    objetos: {}, runas: new Map(), hechizos: new Map(),
  } as unknown as DatosEstaticos;

  function montar() {
    const importar = vi.fn(async () => ({ runas: { ok: true }, hechizos: { ok: true }, objetos: { ok: true } }));
    const obtenerCounters = vi.fn(async (c: string) =>
      c === 'Garen'
        ? { estado: 'ok', counters: { ...COUNTERS, campeon: 'Garen', dificiles: [{ rival: 'Darius', partidas: 120, tasaVictoria: 0.42, datosLimitados: false }] } }
        : { estado: 'ok', counters: COUNTERS },
    );
    const obtenerEnfrentamiento = vi.fn(async () => ({ estado: 'ok', enfrentamiento: ENFRENTAMIENTO }));
    const o = crearOrquestadorSeleccion({
      dirCache: 'x',
      cargarDatos: async () => datos,
      obtenerAjustes: () => ({ ...AJUSTES_POR_DEFECTO, importacionAutomatica: false }),
      enviar: () => undefined,
      crearBuilds: (() => ({
        obtenerRoles: async () => ['TOP'],
        obtenerBuild: async () => ({ estado: 'ok', build: BUILD }),
        obtenerCampeones: async () => ({ estado: 'ok', lista: { parche: '15.20', campeones: [entrada('Garen', 'TOP', 900)] } }),
        obtenerCounters,
        obtenerEnfrentamiento,
      })) as never,
      importarTodo: importar as never,
    });
    o.conectado({} as ClienteLcu);
    return { o, importar, obtenerCounters, obtenerEnfrentamiento };
  }

  it('sin campeón elegido y con el rival de tu línea elegido: buenas elecciones contra él', async () => {
    const { o, obtenerCounters } = montar();
    await o.alRivales({ rol: 'TOP', rivales: [{ campeonId: 86, rol: null }] });
    const e = o.estado().enfrentamientos!;
    expect(e.rival).toMatchObject({ id: 'Garen', inferido: true });
    expect(obtenerCounters).toHaveBeenCalledWith('Garen', 'TOP');
    expect(e.buenasElecciones.map((l) => l.campeon.id)).toEqual(['Darius']);
    expect(e.buenasElecciones[0]!.tasaVictoria).toBeCloseTo(0.58);
    expect(e.counters).toBeNull();
  });

  it('con tu campeón: tus counters y tu cruce contra el rival, con su build importable', async () => {
    const { o, importar, obtenerEnfrentamiento } = montar();
    await o.alRivales({ rol: 'TOP', rivales: [{ campeonId: 86, rol: null }] });
    await o.alSeleccionar({ campeonId: 122, rol: 'TOP' });
    const e = o.estado().enfrentamientos!;
    expect(obtenerEnfrentamiento).toHaveBeenCalledWith('Darius', 'Garen', 'TOP');
    expect(e.counters?.faciles.map((l) => l.campeon.id)).toEqual(['Garen']); // Fiddlesticks no está en estos datos
    expect(e.contra).toMatchObject({ partidas: 120, tasaVictoria: 0.58, build: BUILD });
    expect(e.buenasElecciones).toEqual([]);
    await o.importarEnfrentamiento();
    expect(importar).toHaveBeenCalledTimes(1);
    const llamada = importar.mock.calls[0] as unknown as unknown[];
    expect(llamada[1]).toEqual(BUILD);
    expect(llamada[3]).toBe('Coach: Darius vs Garen');
    // El resultado no pisa el de «Importar» de la build normal.
    expect(o.estado().importacion).toBeNull();
  });

  it('fuera de la Grieta (ARAM) no hay enfrentamientos, y al salir de la selección se quitan', async () => {
    const { o, obtenerCounters } = montar();
    await o.alSeleccionar({ campeonId: 122, rol: 'TOP' });
    expect(o.estado().enfrentamientos?.counters).not.toBeNull();
    o.fase('InProgress');
    expect(o.estado().enfrentamientos).toBeNull();
    obtenerCounters.mockClear();
    await o.alSeleccionar({ campeonId: 122, rol: null, modo: 'aram' });
    expect(o.estado().enfrentamientos ?? null).toBeNull();
    expect(obtenerCounters).not.toHaveBeenCalled();
  });
});

describe("IPC 'coach:counters'", () => {
  function montarIpc(obtenerCounters?: (c: string, r: string) => Promise<unknown>) {
    const manejadores = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
    const ipc = { handle: (c: string, h: (e: { sender: unknown }, ...a: unknown[]) => unknown) => void manejadores.set(c, h) };
    const principal = {};
    const d = {
      version: '15.20.1', parche: '15.20',
      campeones: new Map([[122, { id: 'Darius', nombre: 'Darius' }], [86, { id: 'Garen', nombre: 'Garen' }], [17, { id: 'Teemo', nombre: 'Teemo' }]]),
      objetos: {}, runas: new Map(), hechizos: new Map(),
    } as unknown as DatosEstaticos;
    registrarIpcCampeones(ipc, {
      esPrincipal: (s) => s === principal,
      cargarDatos: async () => d,
      builds: () => ({ obtenerCampeones: vi.fn(), obtenerBuild: vi.fn(), obtenerRoles: vi.fn(), ...(obtenerCounters ? { obtenerCounters } : {}) }) as never,
    });
    const invocar = (sender: unknown, ...args: unknown[]) => Promise.resolve().then(() => manejadores.get('coach:counters')!({ sender }, ...args));
    return { invocar, principal };
  }

  it('devuelve los counters resueltos para la vista; solo a la ventana principal y con argumentos válidos', async () => {
    const obtener = vi.fn(async () => ({ estado: 'ok', counters: COUNTERS }));
    const { invocar, principal } = montarIpc(obtener);
    const r = await invocar(principal, 'Darius', 'TOP');
    expect(r).toMatchObject({ ok: true, version: '15.20.1', counters: { parche: '15.20', sinConexion: false } });
    expect(obtener).toHaveBeenCalledWith('Darius', 'TOP');
    await expect(invocar({}, 'Darius', 'TOP')).rejects.toThrow();
    await expect(invocar(principal, '../x', 'TOP')).rejects.toThrow();
    await expect(invocar(principal, 'Darius', 'SUPPORT')).rejects.toThrow();
  });

  it('sin datos → ok: false', async () => {
    const { invocar, principal } = montarIpc(async () => ({ estado: 'no_disponible' }));
    expect(await invocar(principal, 'Darius', 'TOP')).toEqual({ ok: false });
  });
});
