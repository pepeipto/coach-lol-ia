import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Build, BuildRotativa, ListaModosRotativos, ModoJuego, Rol } from '@coach/shared';
import { crearClienteBuilds, normalizarRotativos } from '../src/main/builds/clienteBuilds';
import { crearOrquestadorSeleccion } from '../src/main/orquestador/seleccion';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import type { ClienteLcu } from '../src/main/lcu/cliente';
import { infoColaDeFlujo, VigilanteLcu } from '../src/main/lcu/vigilante';
import { claveColaNormal, esColaRotativa, nombreBaseRespaldo, nombreCola, nombreRotativo, tipoCola } from '../src/shared/colas';
import { avisoEnPartida, esModoRapido, vozEnPartida } from '../src/shared/modosOverlay';
import { generarIndicaciones, resumenOverlay } from '../src/main/consejos/motor';
import { normalizarDatosPartida } from '../src/main/partida/normalizar';
import { DisparadorVoz } from '../src/main/consejos/voz';
import { SelectorVariantes } from '../src/main/consejos/variantes';
import type { EstadoPartida } from '../src/shared/tiposApp';
import { interpretarPartida } from '../src/main/perfil/lcuPerfil';
import { tendencias } from '../src/main/perfil/puntuaciones';
import { tendenciasPorCola } from '../src/main/perfil/servicio';
import { estadoReto } from '../src/main/perfil/retos';
import { partidaLcu } from './partidaLcu';
import allgamedata from './fixtures/allgamedata.json';

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });
const fetchCaido = (async () => {
  throw new Error('sin red');
}) as typeof fetch;

const LISTA: ListaModosRotativos = {
  actualizado: '2026-10-24T10:00:00.000Z',
  modos: [
    { cola: 900, gameMode: 'URF', mapa: 11, nombre: 'ARURF', conDatos: true, pve: false },
    { cola: 1020, gameMode: 'ONEFORALL', mapa: 11, nombre: 'One for All', conDatos: false, pve: false },
    { cola: 1830, gameMode: 'STRAWBERRY', mapa: 33, nombre: 'Swarm', conDatos: false, pve: true },
    { cola: 3270, gameMode: 'PORO', mapa: 12, nombre: 'Poro King', conDatos: false, pve: false },
  ],
};

const buildDe = (modo: ModoJuego | null, extra: Partial<Build> = {}): Build => ({
  campeon: 'Ahri',
  rol: modo === 'clasificatoria' ? 'MIDDLE' : null,
  ...(modo && modo !== 'clasificatoria' ? { modo } : {}),
  parche: '15.20',
  partidas: 500,
  tasaVictoria: 0.5,
  mezclaParches: false,
  runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  hechizos: [4, 14],
  objetosIniciales: [1056],
  nucleo: [6655],
  botas: null,
  situacionales: [],
  ordenHabilidades: [],
  calculadoEn: '',
  ...extra,
});
const BUILD_URF: BuildRotativa = { ...buildDe(null), rol: null, cola: 900, gameMode: 'URF', partidas: 80 };

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'coach-rotativos-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('colas (3.8)', () => {
  it('tipo de cola: los cuatro modos, las normales de la Grieta y el resto', () => {
    expect(tipoCola(420)).toBe('clasificatoria');
    expect(tipoCola(450)).toBe('aram');
    expect(tipoCola(2400)).toBe('caos');
    expect(tipoCola(1700)).toBe('arena');
    for (const c of [400, 430, 480, 490]) expect(tipoCola(c)).toBe('normales');
    // La 440 es la clasificatoria Flex.
    expect(tipoCola(440)).toBe('clasificatoria');
    expect(tipoCola(900)).toBe('otros');
    expect(tipoCola(undefined)).toBe('otros');
  });

  it('cola rotativa: ni de los cuatro modos ni normal, y positiva', () => {
    expect(esColaRotativa(900)).toBe(true);
    expect(esColaRotativa(420)).toBe(false);
    expect(esColaRotativa(400)).toBe(false);
    expect(esColaRotativa(0)).toBe(false);
    expect(esColaRotativa(undefined)).toBe(false);
  });

  it('nombre de las normales: «Normal», «Flex» y «Partida rápida»; el resto, el del modo', () => {
    expect(claveColaNormal(400)).toBe('cola.normal');
    expect(claveColaNormal(430)).toBe('cola.normal');
    expect(claveColaNormal(440)).toBe('cola.flex');
    expect(claveColaNormal(480)).toBe('cola.rapida');
    expect(claveColaNormal(490)).toBe('cola.rapida');
    expect(claveColaNormal(420)).toBeNull();
    expect(nombreCola(490)).toBe('Partida rápida');
    expect(nombreCola(420)).toBe('Clasificatoria');
    expect(nombreCola(450, 'aram')).toBe('ARAM');
  });

  it('nombre de un rotativo: la traducción propia por gameMode, si no la del servidor', () => {
    expect(nombreRotativo({ gameMode: 'ONEFORALL', nombre: 'One for All' })).toBe('Uno para todos');
    expect(nombreRotativo({ gameMode: 'PORO', nombre: 'Poro King' })).toBe('Poro King');
    expect(nombreRotativo({ gameMode: null, nombre: '', cola: 77 })).toBe('Modo especial (77)');
    expect(nombreBaseRespaldo('clasificatoria')).toBe('la Grieta del Invocador');
  });
});

describe('cliente de builds: modos rotativos', () => {
  const cliente = (f: typeof fetch) => crearClienteBuilds({ urlServidor: 'http://srv/', dirCache: dir, fetch: f });

  it('GET /rotativos con caché en disco; sin servidor, la última lista', async () => {
    const urls: string[] = [];
    const ok = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return json(LISTA);
    }) as typeof fetch;
    expect(await cliente(ok).obtenerRotativos()).toEqual({ estado: 'ok', lista: LISTA });
    expect(urls).toEqual(['http://srv/rotativos']);
    expect(await cliente(fetchCaido).obtenerRotativos()).toEqual({ estado: 'sin_conexion', lista: LISTA });
  });

  it('sin servidor ni caché → null; una respuesta rara no se guarda y los modos mal formados se descartan', async () => {
    expect(await cliente(fetchCaido).obtenerRotativos()).toBeNull();
    expect(await cliente((async () => json({ hola: 1 })) as typeof fetch).obtenerRotativos()).toBeNull();
    expect(normalizarRotativos({ actualizado: 'x', modos: [LISTA.modos[0], { cola: 'URF' }] })).toEqual({ actualizado: 'x', modos: [LISTA.modos[0]] });
  });

  it('build de un rotativo por RUTAS_ROTATIVOS.build, con caché; 404 sin caché → no_disponible', async () => {
    const urls: string[] = [];
    const ok = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return json(BUILD_URF);
    }) as typeof fetch;
    expect(await cliente(ok).obtenerBuildRotativa(900, 'Ahri')).toEqual({ estado: 'ok', build: BUILD_URF });
    expect(urls).toEqual(['http://srv/rotativos/900/builds/Ahri']);
    expect(await cliente(fetchCaido).obtenerBuildRotativa(900, 'Ahri')).toEqual({ estado: 'sin_conexion', build: BUILD_URF });
    const sinDatos = (async () => json({ error: 'sin_datos' }, 404)) as typeof fetch;
    expect(await cliente(sinDatos).obtenerBuildRotativa(1020, 'Ahri')).toEqual({ estado: 'no_disponible' });
  });
});

const datos = {
  version: '15.20.1',
  parche: '15.20',
  campeones: new Map([[103, { id: 'Ahri', nombre: 'Ahri' }]]),
  objetos: {},
  runas: new Map(),
  hechizos: new Map(),
} as unknown as DatosEstaticos;

function montar(o: { lista?: ListaModosRotativos | null; buildRotativa?: Build | null } = {}) {
  const obtenerBuild = vi.fn(async (_c: string, _r: Rol | null, modo: ModoJuego = 'clasificatoria') => ({ estado: 'ok' as const, build: buildDe(modo) }));
  const obtenerRoles = vi.fn(async () => ['MIDDLE', 'TOP'] as Rol[]);
  const obtenerRotativos = vi.fn(async () => (o.lista === null ? null : { estado: 'ok' as const, lista: o.lista ?? LISTA }));
  const obtenerBuildRotativa = vi.fn(async () =>
    o.buildRotativa === null ? { estado: 'no_disponible' as const } : { estado: 'ok' as const, build: o.buildRotativa ?? BUILD_URF },
  );
  const importar = vi.fn(async () => ({ runas: { ok: true }, hechizos: { ok: true }, objetos: { ok: true } }));
  const orq = crearOrquestadorSeleccion({
    dirCache: 'x',
    cargarDatos: async () => datos,
    obtenerAjustes: () => ({ ...AJUSTES_POR_DEFECTO, importacionAutomatica: true }),
    enviar: () => undefined,
    crearBuilds: (() => ({ obtenerRoles, obtenerBuild, obtenerRotativos, obtenerBuildRotativa })) as never,
    importarTodo: importar as never,
  });
  orq.conectado({} as ClienteLcu);
  return { orq, obtenerBuild, obtenerRoles, obtenerRotativos, obtenerBuildRotativa, importar };
}

describe('orquestador de selección: normales y modos rotativos (3.8)', () => {
  it('normal de la Grieta: build de clasificatoria con su rol y la cola para que la UI diga «Normal»', async () => {
    const { orq, obtenerBuild, obtenerRotativos } = montar();
    await orq.alSeleccionar({ campeonId: 103, rol: 'MIDDLE', cola: 400 });
    expect(obtenerBuild).toHaveBeenCalledWith('Ahri', 'MIDDLE', 'clasificatoria');
    expect(obtenerRotativos).not.toHaveBeenCalled();
    expect(orq.estado().seleccion).toMatchObject({ rol: 'MIDDLE', cola: 400 });
    expect(orq.estado().seleccion?.rotativo).toBeUndefined();
  });

  it('URF con datos: pide /rotativos y su build, la enseña con el nombre del modo e importa las runas', async () => {
    const { orq, obtenerBuild, obtenerBuildRotativa, obtenerRoles, importar } = montar();
    await orq.alSeleccionar({ campeonId: 103, rol: null, cola: 900, gameMode: 'URF', mapa: 11 });
    expect(obtenerBuildRotativa).toHaveBeenCalledWith(900, 'Ahri');
    expect(obtenerBuild).not.toHaveBeenCalled();
    expect(obtenerRoles).not.toHaveBeenCalled();
    const sel = orq.estado().seleccion!;
    expect(sel.rotativo).toEqual({ cola: 900, nombre: 'ARURF', gameMode: 'URF', base: 'clasificatoria', estado: 'datos' });
    expect(sel.rol).toBeNull();
    expect(sel.resultado).toEqual({ estado: 'ok', build: BUILD_URF });
    expect(importar).toHaveBeenCalledWith(expect.anything(), expect.anything(), 103, 'Coach: Ahri URF', 11, {});
  });

  it('Uno para todos sin datos: build de la Grieta marcada como respaldo (con roles)', async () => {
    const { orq, obtenerBuild, obtenerBuildRotativa, importar } = montar();
    await orq.alSeleccionar({ campeonId: 103, rol: null, cola: 1020 });
    expect(obtenerBuildRotativa).not.toHaveBeenCalled();
    expect(obtenerBuild).toHaveBeenCalledWith('Ahri', 'MIDDLE', 'clasificatoria');
    expect(orq.estado().seleccion).toMatchObject({
      rol: 'MIDDLE',
      rolesDisponibles: ['MIDDLE', 'TOP'],
      rotativo: { cola: 1020, base: 'clasificatoria', estado: 'respaldo' },
    });
    expect(importar).toHaveBeenCalledWith(expect.anything(), expect.anything(), 103, 'Coach: Ahri Uno para todos', 11, {});
  });

  it('el servidor dice conDatos pero aún no tiene la de este campeón (404): respaldo del mapa', async () => {
    const { orq, obtenerBuild } = montar({ buildRotativa: null });
    await orq.alSeleccionar({ campeonId: 103, rol: null, cola: 900 });
    expect(obtenerBuild).toHaveBeenCalledWith('Ahri', 'MIDDLE', 'clasificatoria');
    expect(orq.estado().seleccion?.rotativo?.estado).toBe('respaldo');
  });

  it('rotativo del Abismo sin datos: build de ARAM (mapa 12) y sin roles', async () => {
    const { orq, obtenerBuild, importar } = montar();
    await orq.alSeleccionar({ campeonId: 103, rol: null, cola: 3270 });
    expect(obtenerBuild).toHaveBeenCalledWith('Ahri', null, 'aram');
    expect(orq.estado().seleccion).toMatchObject({ modo: 'aram', rol: null, rotativo: { base: 'aram', estado: 'respaldo', nombre: 'Poro King' } });
    expect(importar).toHaveBeenCalledWith(expect.anything(), expect.anything(), 103, 'Coach: Ahri Poro King', 12, {});
  });

  it('PvE (Enjambre): no pide builds, no importa y lo dice', async () => {
    const { orq, obtenerBuild, obtenerBuildRotativa, importar } = montar();
    await orq.alSeleccionar({ campeonId: 103, rol: null, cola: 1830 });
    expect(obtenerBuild).not.toHaveBeenCalled();
    expect(obtenerBuildRotativa).not.toHaveBeenCalled();
    expect(importar).not.toHaveBeenCalled();
    expect(orq.estado().seleccion).toMatchObject({ resultado: { estado: 'no_disponible' }, rotativo: { estado: 'pve' } });
  });

  it('sin servidor ni lista guardada: el mapa de la sesión decide la build de respaldo', async () => {
    const { orq, obtenerBuild } = montar({ lista: null });
    await orq.alSeleccionar({ campeonId: 103, rol: null, cola: 2300, gameMode: 'BRAWL', mapa: 12 });
    expect(obtenerBuild).toHaveBeenCalledWith('Ahri', null, 'aram');
    expect(orq.estado().seleccion?.rotativo).toEqual({ cola: 2300, nombre: 'BRAWL', gameMode: 'BRAWL', base: 'aram', estado: 'respaldo' });
  });

  it('el servidor aún no sabe gameMode (vacío) ni mapa (0): valen los de la partida en curso', async () => {
    const lista: ListaModosRotativos = { actualizado: '', modos: [{ cola: 2300, gameMode: '', mapa: 0, nombre: 'Brawl', conDatos: false, pve: false }] };
    const { orq, obtenerBuild } = montar({ lista });
    await orq.alSeleccionar({ campeonId: 103, rol: null, cola: 2300, gameMode: 'BRAWL', mapa: 12 });
    expect(obtenerBuild).toHaveBeenCalledWith('Ahri', null, 'aram');
    expect(orq.estado().seleccion?.rotativo).toEqual({ cola: 2300, nombre: 'Brawl', gameMode: 'BRAWL', base: 'aram', estado: 'respaldo' });
  });

  it('clasificatoria, ARAM, ARAM: Caos y Arena siguen igual (sin pedir /rotativos)', async () => {
    const { orq, obtenerRotativos, obtenerBuild } = montar();
    await orq.alSeleccionar({ campeonId: 103, rol: 'MIDDLE' });
    await orq.alSeleccionar({ campeonId: 103, rol: null, modo: 'aram' });
    expect(obtenerRotativos).not.toHaveBeenCalled();
    expect(obtenerBuild).toHaveBeenLastCalledWith('Ahri', null, 'aram');
    expect(orq.estado().seleccion?.rotativo).toBeUndefined();
  });
});

describe('vigilante: cola, gameMode y mapa de la sesión de gameflow (3.8)', () => {
  it('infoColaDeFlujo lee gameMode y mapId', () => {
    expect(infoColaDeFlujo({ gameData: { queue: { id: 900, gameMode: 'URF', mapId: 11 } } })).toEqual({ gameMode: 'URF', mapa: 11 });
    expect(infoColaDeFlujo(null)).toEqual({});
  });

  it('una cola rotativa viaja en la selección con su gameMode y su mapa', async () => {
    vi.useFakeTimers();
    try {
      const sesion = { localPlayerCellId: 1, myTeam: [{ cellId: 1, championId: 103, assignedPosition: '' }] };
      const cliente: ClienteLcu = {
        peticion: vi.fn(async (_m: string, ruta: string) => {
          if (ruta.includes('gameflow-phase')) return 'ChampSelect';
          if (ruta === '/lol-gameflow/v1/session') return { gameData: { queue: { id: 900, gameMode: 'URF', mapId: 11 } } };
          return sesion;
        }) as never,
        suscribir: () => undefined,
        cerrar: vi.fn(),
      };
      const v = new VigilanteLcu({ intervaloMs: 100, leerArchivo: async () => 'LeagueClient:1:2:pw:https', conectar: async () => cliente, buscarDir: async () => 'C:\\LoL' });
      const sels: unknown[] = [];
      v.on('seleccion', (s) => sels.push(s));
      v.iniciar();
      await vi.advanceTimersByTimeAsync(150);
      expect(sels.at(-1)).toEqual({ campeonId: 103, rol: null, cola: 900, gameMode: 'URF', mapa: 11 });
      v.detener();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('voz y avisos por modo (3.8)', () => {
  it('URF en la Grieta: sin ritmo de CS ni fase; los objetivos sí', () => {
    expect(esModoRapido('URF')).toBe(true);
    expect(vozEnPartida('cs', 'clasificatoria', 'URF')).toBe(false);
    expect(vozEnPartida('fase', 'clasificatoria', 'URF')).toBe(false);
    expect(vozEnPartida('objetivo', 'clasificatoria', 'URF')).toBe(true);
    expect(avisoEnPartida('fase', 'clasificatoria', 'URF')).toBe(false);
    expect(avisoEnPartida('objetivo', 'clasificatoria', 'URF')).toBe(true);
  });

  it('rotativo fuera de la Grieta: sin objetivos (mapa) ni los consejos propios de ARAM', () => {
    expect(vozEnPartida('objetivo', 'aram', 'PORO')).toBe(false);
    expect(vozEnPartida('modo', 'aram', 'PORO')).toBe(false);
    expect(vozEnPartida('compra', 'aram', 'PORO')).toBe(true);
  });

  it('clasificatoria, ARAM, ARAM: Caos y Arena no cambian', () => {
    expect(vozEnPartida('cs', 'clasificatoria')).toBe(true);
    expect(vozEnPartida('fase', 'clasificatoria')).toBe(true);
    expect(vozEnPartida('modo', 'aram')).toBe(true);
    expect(vozEnPartida('modo', 'caos')).toBe(true);
    expect(vozEnPartida('modo', 'arena')).toBe(true);
    expect(vozEnPartida('habilidad', 'arena')).toBe(false);
  });

  it('la Live Client marca el rotativo con su gameMode; CLASSIC, ARAM, KIWI y CHERRY no', () => {
    const conModo = (gameMode: string, mapNumber = 11) =>
      normalizarDatosPartida({ ...allgamedata, gameData: { ...(allgamedata as { gameData: object }).gameData, gameMode, mapNumber } });
    expect(conModo('URF')).toMatchObject({ modo: 'clasificatoria', rotativo: 'URF' });
    expect(conModo('CLASSIC')?.rotativo).toBeUndefined();
    expect(conModo('ARAM', 12)?.rotativo).toBeUndefined();
  });

  const estadoUrf = (o: Partial<EstadoPartida> = {}): EstadoPartida => ({
    tiempo: 300,
    oro: 0,
    nivel: 6,
    campeon: 'Ahri',
    objetos: [3340],
    habilidades: { Q: 3, W: 1, E: 1, R: 1 },
    eventos: [],
    modo: 'clasificatoria',
    rotativo: 'URF',
    cs: 40,
    ...o,
  });

  it('URF: el widget de rendimiento no enseña el CS por rol y no hay aviso de fase', () => {
    const r = resumenOverlay(estadoUrf({ kda: { k: 1, d: 0, a: 0 } }), null, 'MIDDLE', {}, '');
    expect(r.rendimiento?.cs).toBeNull();
    expect(r.rendimiento?.kda).not.toBeNull();
    expect(resumenOverlay(estadoUrf({ rotativo: undefined }), null, 'MIDDLE', {}, '').rendimiento?.cs).not.toBeNull();
    expect(generarIndicaciones(estadoUrf(), null, 'MIDDLE', {}).some((i) => i.tipo === 'fase')).toBe(false);
    expect(generarIndicaciones(estadoUrf({ rotativo: undefined }), null, 'MIDDLE', {}).some((i) => i.tipo === 'fase')).toBe(true);
  });

  it('URF: el disparador de voz no dice la fase de partida al cambiar de fase', () => {
    const voz = AJUSTES_POR_DEFECTO.overlay.voz;
    const activa = { ...voz, activa: true, tipos: Object.fromEntries(Object.keys(voz.tipos).map((k) => [k, true])) as typeof voz.tipos };
    const decir = (rotativo: string | undefined) => {
      const d = new DisparadorVoz({ selector: new SelectorVariantes(() => 0) });
      const entrada = (tiempo: number) => {
        const estado = estadoUrf({ tiempo, rotativo });
        return { estado, overlay: resumenOverlay(estado, null, 'MIDDLE', {}, ''), rol: 'MIDDLE' as Rol, marcas: {}, jungla: false };
      };
      d.procesar(entrada(60), activa);
      return d.procesar(entrada(900), activa).map((f) => f.tipo);
    };
    expect(decir(undefined)).toContain('fase');
    expect(decir('URF')).not.toContain('fase');
  });
});

describe('perfil por cola (3.8)', () => {
  const YO = 'puuid-yo';
  const partidas = [
    ...[1, 2, 3, 4].map((id) => interpretarPartida(partidaLcu(id, { cola: 420 }), YO)!),
    ...[5, 6, 7].map((id) => interpretarPartida(partidaLcu(id, { cola: 400, yo: { kills: 15 } }), YO)!),
    interpretarPartida(partidaLcu(8, { cola: 900 }), YO)!,
  ];

  it('las normales de la Grieta siguen como «otro», pero con roles', () => {
    const normal = partidas[4]!;
    expect(normal.modo).toBe('otro');
    expect(normal.jugadores[0]!.rol).toBe('MIDDLE');
  });

  it('por defecto las tendencias y los retos cuentan como siempre (solo clasificatoria aquí)', () => {
    const solo = partidas.filter((p) => p.cola === 420);
    expect(tendencias(partidas)).toEqual(tendencias(solo));
    expect(estadoReto('kp50', '2000-01-01', partidas)).toEqual(estadoReto('kp50', '2000-01-01', solo));
  });

  it('tendencias de cada tipo de cola que tiene partidas', () => {
    const por = tendenciasPorCola(partidas);
    expect(Object.keys(por).sort()).toEqual(['clasificatoria', 'normales', 'otros']);
    expect(por.clasificatoria).toEqual(tendencias(partidas));
    // Las normales son de la Grieta: con CS y visión.
    expect(por.normales?.map((t) => t.id)).toContain('csMin');
    const kp = (tipo: 'clasificatoria' | 'normales') => por[tipo]!.find((t) => t.id === 'kp')!.valor;
    expect(kp('normales')).toBeGreaterThan(kp('clasificatoria'));
    // URF (otros): sin CS ni visión.
    expect(por.otros?.map((t) => t.id)).not.toContain('csMin');
  });
});
