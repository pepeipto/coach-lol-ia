import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearOrquestadorCarga, DURACION_MAXIMA_CARGA_MS, type DependenciasCarga } from '../src/main/orquestador/carga';
import type { EstadoCarga, JugadorCarga } from '../src/shared/tiposApp';

vi.mock('../src/main/log', () => ({ registrar: vi.fn() }));

const SESION = {
  map: { id: 11 },
  gameData: {
    teamOne: [
      { puuid: 'yo', championId: 103, selectedPosition: 'MIDDLE', gameName: 'Yo', tagLine: 'EUW' },
      { puuid: 'a2', championId: 64, selectedPosition: 'JUNGLE' },
    ],
    teamTwo: [{ puuid: 'e1', championId: 62, selectedPosition: 'TOP', gameName: 'Rival', tagLine: '1' }],
  },
};

function lcuFalso(o: { region?: string; sesion?: unknown; fallar?: boolean } = {}) {
  const rutas: string[] = [];
  return {
    rutas,
    cliente: {
      async peticion<T>(_m: string, ruta: string): Promise<T> {
        rutas.push(ruta);
        if (o.fallar) throw new Error('LCU caído');
        if (ruta === '/lol-gameflow/v1/session') return (o.sesion ?? SESION) as T;
        if (ruta === '/riotclient/region-locale') return { region: o.region ?? 'EUW', locale: 'es_ES' } as T;
        if (ruta === '/lol-summoner/v1/current-summoner') return { puuid: 'yo' } as T;
        throw new Error(`ruta inesperada ${ruta}`);
      },
    },
  };
}

const DATOS = {
  version: '16.20.1',
  campeones: new Map([
    [103, { id: 'Ahri', nombre: 'Ahri' }],
    [64, { id: 'LeeSin', nombre: 'Lee Sin' }],
    [62, { id: 'MonkeyKing', nombre: 'Wukong' }],
  ]),
};

const delServidor = (j: Partial<JugadorCarga>): JugadorCarga => ({
  equipo: 'aliado',
  riotId: '',
  campeonId: 103,
  campeon: 'Ahri',
  rol: 'MIDDLE',
  rango: null,
  maestria: null,
  campeonWinrate: null,
  etiquetas: [],
  ...j,
});

function montar(o: { lcu?: ReturnType<typeof lcuFalso>; respuesta?: () => Promise<Response>; enPartida?: boolean } = {}) {
  const lcu = o.lcu ?? lcuFalso();
  const modos: string[] = [];
  const cargas: EstadoCarga[] = [];
  const llamadas: { url: string; cuerpo: unknown }[] = [];
  const eventos: string[] = [];
  const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
    llamadas.push({ url, cuerpo: JSON.parse(String(init?.body)) });
    return o.respuesta
      ? o.respuesta()
      : Response.json({
          jugadores: [
            delServidor({ campeonId: 64, campeon: 'LeeSin', rol: 'JUNGLE' }),
            delServidor({ riotId: 'Yo#EUW', rango: { tier: 'GOLD', division: 'II', lp: 30, victorias: 10, derrotas: 8 }, campeonWinrate: 0.52 }),
            delServidor({ equipo: 'enemigo', campeonId: 62, campeon: 'MonkeyKing', rol: 'TOP', riotId: 'Rival#1' }),
          ],
        });
  });
  const dep: DependenciasCarga = {
    urlServidor: () => 'https://servidor.test/',
    fetch: fetchFalso as unknown as typeof fetch,
    datos: async () => DATOS,
    enviarModo: (m) => {
      modos.push(m);
      eventos.push(`modo:${m}`);
    },
    enviarCarga: (c) => {
      cargas.push(c);
      eventos.push('carga');
    },
    mostrar: () => eventos.push('mostrar'),
    ocultar: () => eventos.push('ocultar'),
    enPartida: () => o.enPartida ?? false,
  };
  const carga = crearOrquestadorCarga(dep);
  carga.conectado(lcu.cliente);
  return { carga, modos, cargas, llamadas, eventos, lcu, fetchFalso };
}

describe('orquestador de la pantalla de carga', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('al entrar en InProgress lee la sesión, pregunta al servidor y muestra el modo carga', async () => {
    const { carga, modos, cargas, llamadas, eventos } = montar();
    await carga.fase('InProgress');
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]!.url).toBe('https://servidor.test/api/partida/jugadores');
    expect(llamadas[0]!.cuerpo).toEqual({
      region: 'EUW',
      jugadores: [
        // ordenados por rol, como en el juego
        { puuid: 'a2', campeonId: 64, rol: 'JUNGLE', equipo: 'aliado', riotId: '' },
        { puuid: 'yo', campeonId: 103, rol: 'MIDDLE', equipo: 'aliado', riotId: 'Yo#EUW' },
        { puuid: 'e1', campeonId: 62, rol: 'TOP', equipo: 'enemigo', riotId: 'Rival#1' },
      ],
    });
    expect(modos).toEqual(['carga']);
    expect(eventos.slice(0, 3)).toEqual(['modo:carga', 'carga', 'mostrar']);
    const final = cargas.at(-1)!;
    expect(final.version).toBe('16.20.1');
    expect(final.jugadores[1]).toMatchObject({ riotId: 'Yo#EUW', rango: { tier: 'GOLD' }, campeonWinrate: 0.52 });
    expect(carga.activa()).toBe(true);
  });

  it('primero pinta las tarjetas con la información local y luego las completa', async () => {
    const { carga, cargas } = montar();
    await carga.fase('GameStart');
    expect(cargas).toHaveLength(2);
    expect(cargas[0]!.jugadores.map((j) => j.campeon)).toEqual(['LeeSin', 'Ahri', 'MonkeyKing']);
    expect(cargas[0]!.jugadores.every((j) => j.rango === null && j.maestria === null && j.etiquetas.length === 0)).toBe(true);
  });

  it('solo una vez por partida (GameStart y luego InProgress)', async () => {
    const { carga, llamadas } = montar();
    await carga.fase('GameStart');
    await carga.fase('InProgress');
    expect(llamadas).toHaveLength(1);
  });

  it.each([['NA1'], ['KR']])('región %s: no llama al servidor y muestra solo la información local', async (region) => {
    const { carga, llamadas, cargas, modos } = montar({ lcu: lcuFalso({ region }) });
    await carga.fase('InProgress');
    expect(llamadas).toHaveLength(0);
    expect(modos).toEqual(['carga']);
    expect(cargas).toHaveLength(1);
    expect(cargas[0]!.jugadores[2]).toMatchObject({ equipo: 'enemigo', riotId: 'Rival#1', campeon: 'MonkeyKing', rango: null });
  });

  it('LAN y LAS se piden con su región', async () => {
    const { carga, llamadas } = montar({ lcu: lcuFalso({ region: 'LA1' }) });
    await carga.fase('InProgress');
    expect((llamadas[0]!.cuerpo as { region: string }).region).toBe('LAN');
  });

  it('si el servidor falla, se queda con la información local', async () => {
    const { carga, cargas, modos } = montar({ respuesta: async () => new Response('x', { status: 503 }) });
    await carga.fase('InProgress');
    expect(modos).toEqual(['carga']);
    expect(cargas).toHaveLength(1);
  });

  it('una respuesta del servidor con otra forma se ignora', async () => {
    const { carga, cargas } = montar({ respuesta: async () => Response.json({ jugadores: [{ raro: true }] }) });
    await carga.fase('InProgress');
    expect(cargas).toHaveLength(1);
  });

  it('pasa a modo partida con el primer estado válido de Live Client', async () => {
    const { carga, modos } = montar();
    await carga.fase('InProgress');
    carga.partidaIniciada();
    expect(modos).toEqual(['carga', 'partida']);
    expect(carga.activa()).toBe(false);
    vi.advanceTimersByTime(DURACION_MAXIMA_CARGA_MS);
    expect(modos).toEqual(['carga', 'partida']);
  });

  it('a los 3 minutos sin partida pasa a modo partida y oculta el overlay si no hay partida', async () => {
    const { carga, modos, eventos } = montar();
    await carga.fase('InProgress');
    vi.advanceTimersByTime(DURACION_MAXIMA_CARGA_MS - 1);
    expect(modos).toEqual(['carga']);
    vi.advanceTimersByTime(1);
    expect(modos).toEqual(['carga', 'partida']);
    expect(eventos.at(-1)).toBe('ocultar');
  });

  it('a los 3 minutos con la partida ya en marcha no oculta nada', async () => {
    const { carga, eventos } = montar({ enPartida: true });
    await carga.fase('InProgress');
    vi.advanceTimersByTime(DURACION_MAXIMA_CARGA_MS);
    expect(eventos.at(-1)).toBe('modo:partida');
  });

  it('si la partida termina durante la carga, oculta el overlay', async () => {
    const { carga, modos, eventos } = montar();
    await carga.fase('InProgress');
    await carga.fase('EndOfGame');
    expect(modos).toEqual(['carga', 'oculto']);
    expect(eventos.at(-1)).toBe('ocultar');
    // la siguiente partida vuelve a tener pantalla de carga
    await carga.fase('InProgress');
    expect(modos).toEqual(['carga', 'oculto', 'carga']);
  });

  it('una respuesta que llega tarde (la carga ya terminó) no se envía', async () => {
    let soltar!: (r: Response) => void;
    const { carga, cargas, modos } = montar({ respuesta: () => new Promise<Response>((r) => (soltar = r)) });
    const fase = carga.fase('InProgress');
    await vi.waitFor(() => expect(cargas).toHaveLength(1));
    carga.partidaIniciada();
    soltar(Response.json({ jugadores: [] }));
    await fase;
    expect(cargas).toHaveLength(1);
    expect(modos).toEqual(['carga', 'partida']);
  });

  it('Reconnect no reinicia la pantalla de carga', async () => {
    const { carga, modos } = montar();
    await carga.fase('InProgress');
    carga.partidaIniciada();
    await carga.fase('Reconnect');
    await carga.fase('InProgress');
    expect(modos).toEqual(['carga', 'partida']);
  });

  it('sin cliente de LoL, fuera de la Grieta o con el LCU caído no hace nada', async () => {
    const sinMapa = montar({ lcu: lcuFalso({ sesion: { map: { id: 12 }, gameData: SESION.gameData } }) });
    await sinMapa.carga.fase('InProgress');
    expect(sinMapa.modos).toEqual([]);

    const caido = montar({ lcu: lcuFalso({ fallar: true }) });
    await caido.carga.fase('InProgress');
    expect(caido.modos).toEqual([]);

    const desconectado = montar();
    desconectado.carga.desconectado();
    await desconectado.carga.fase('InProgress');
    expect(desconectado.modos).toEqual([]);
  });

  it('al desconectarse el cliente durante la carga, oculta el overlay', async () => {
    const { carga, modos } = montar();
    await carga.fase('InProgress');
    carga.desconectado();
    expect(modos).toEqual(['carga', 'oculto']);
  });
});
