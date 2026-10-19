import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  crearOrquestadorCarga,
  DURACION_MAXIMA_CARGA_MS,
  ESPERA_REINTENTO_MS,
  MAX_INTENTOS_SESION,
  TIEMPO_ESPERA_SERVIDOR_MS,
  type DependenciasCarga,
} from '../src/main/orquestador/carga';
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

function lcuFalso(o: { region?: string; sesion?: unknown | (() => unknown); fallar?: boolean } = {}) {
  const rutas: string[] = [];
  return {
    rutas,
    cliente: {
      async peticion<T>(_m: string, ruta: string): Promise<T> {
        rutas.push(ruta);
        if (o.fallar) throw new Error('LCU caído');
        if (ruta === '/lol-gameflow/v1/session') return (typeof o.sesion === 'function' ? o.sesion() : (o.sesion ?? SESION)) as T;
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
  nombre: 'Ahri',
  rol: 'MIDDLE',
  rango: null,
  maestria: null,
  campeonWinrate: null,
  etiquetas: [],
  ...j,
});

function montar(
  o: { lcu?: ReturnType<typeof lcuFalso>; respuesta?: (signal?: AbortSignal | null) => Promise<Response>; enPartida?: boolean } = {},
) {
  const lcu = o.lcu ?? lcuFalso();
  const modos: string[] = [];
  const cargas: EstadoCarga[] = [];
  const llamadas: { url: string; cuerpo: unknown }[] = [];
  const eventos: string[] = [];
  const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
    llamadas.push({ url, cuerpo: JSON.parse(String(init?.body)) });
    return o.respuesta
      ? o.respuesta(init?.signal)
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
    // overlay:carga antes que overlay:modo, para que el modo nunca enseñe datos viejos.
    expect(eventos.slice(0, 3)).toEqual(['carga', 'modo:carga', 'mostrar']);
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
    expect(cargas[0]!.jugadores.map((j) => j.nombre)).toEqual(['Lee Sin', 'Ahri', 'Wukong']);
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

  it('GameStart con la sesión aún vacía: reintenta y la pantalla de carga sale igual', async () => {
    let llamadas = 0;
    const lcu = lcuFalso({ sesion: () => (++llamadas === 1 ? { map: { id: 11 }, gameData: { teamOne: [], teamTwo: [] } } : SESION) });
    const { carga, modos } = montar({ lcu });
    await carga.fase('GameStart');
    expect(modos).toEqual([]);
    await vi.advanceTimersByTimeAsync(ESPERA_REINTENTO_MS);
    expect(modos).toEqual(['carga']);
    expect(llamadas).toBe(2);
  });

  it('GameStart con la sesión vacía y luego InProgress: InProgress la lanza sin esperar al reintento', async () => {
    let llamadas = 0;
    const lcu = lcuFalso({ sesion: () => (++llamadas === 1 ? {} : SESION) });
    const { carga, modos } = montar({ lcu });
    await carga.fase('GameStart');
    await carga.fase('InProgress');
    expect(modos).toEqual(['carga']);
    await vi.advanceTimersByTimeAsync(ESPERA_REINTENTO_MS * 3);
    expect(llamadas).toBe(2); // el reintento pendiente se canceló
  });

  it('si el LCU falla, reintenta como mucho 5 veces y solo mientras dure la fase', async () => {
    const lcu = lcuFalso({ fallar: true });
    const { carga, modos } = montar({ lcu });
    await carga.fase('InProgress');
    await vi.advanceTimersByTimeAsync(ESPERA_REINTENTO_MS * 10);
    expect(lcu.rutas.filter((r) => r === '/lol-gameflow/v1/session')).toHaveLength(MAX_INTENTOS_SESION);
    expect(modos).toEqual([]);

    const otra = lcuFalso({ fallar: true });
    const segunda = montar({ lcu: otra });
    await segunda.carga.fase('InProgress');
    await segunda.carga.fase('EndOfGame');
    await vi.advanceTimersByTimeAsync(ESPERA_REINTENTO_MS * 10);
    expect(otra.rutas.filter((r) => r === '/lol-gameflow/v1/session')).toHaveLength(1);
  });

  it('una partida nueva mientras sigue pendiente la respuesta de la anterior: la vieja no se envía', async () => {
    const pendientes: ((r: Response) => void)[] = [];
    const { carga, cargas } = montar({ respuesta: () => new Promise<Response>((r) => pendientes.push(r)) });
    const primera = carga.fase('InProgress');
    await vi.waitFor(() => expect(pendientes).toHaveLength(1));
    await carga.fase('EndOfGame');
    const segunda = carga.fase('InProgress');
    await vi.waitFor(() => expect(pendientes).toHaveLength(2));
    const enviadasAntes = cargas.length;
    const vieja = [delServidor({ campeonId: 64, campeon: 'LeeSin', riotId: 'VIEJO#1' }), delServidor({ riotId: 'VIEJO#2' }), delServidor({ riotId: 'VIEJO#3' })];
    pendientes[0]!(Response.json({ jugadores: vieja }));
    await primera;
    expect(cargas).toHaveLength(enviadasAntes);
    const nueva = [delServidor({ campeonId: 64, campeon: 'LeeSin', riotId: 'NUEVO#1' }), delServidor({}), delServidor({})];
    pendientes[1]!(Response.json({ jugadores: nueva }));
    await segunda;
    expect(cargas).toHaveLength(enviadasAntes + 1);
    expect(cargas.at(-1)!.jugadores[0]!.riotId).toBe('NUEVO#1');
    expect(cargas.flatMap((c) => c.jugadores).some((j) => j.riotId.startsWith('VIEJO'))).toBe(false);
  });

  it('el servidor tiene 12 s para responder; después se queda la información local', async () => {
    let abortada = false;
    const { carga, cargas, modos } = montar({
      respuesta: (signal) =>
        new Promise<Response>((_, rechazar) => {
          signal?.addEventListener('abort', () => {
            abortada = true;
            rechazar(signal.reason);
          });
        }),
    });
    const fase = carga.fase('InProgress');
    // (vi.waitFor adelantaría los relojes falsos: aquí solo se dejan correr las promesas)
    await vi.advanceTimersByTimeAsync(0);
    expect(cargas).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(TIEMPO_ESPERA_SERVIDOR_MS - 1);
    expect(abortada).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await fase;
    expect(abortada).toBe(true);
    expect(cargas).toHaveLength(1);
    expect(modos).toEqual(['carga']);
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

describe('ruta estimada del jungla enemigo en la pantalla de carga (Track F2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const SESION_JUNGLA = {
    map: { id: 11 },
    gameData: {
      teamOne: [{ puuid: 'yo', championId: 103, selectedPosition: 'MIDDLE', gameName: 'Yo', tagLine: 'EUW' }],
      teamTwo: [
        { puuid: 'e1', championId: 62, selectedPosition: 'TOP', gameName: 'Rival', tagLine: '1' },
        { puuid: 'e2', championId: 64, selectedPosition: 'JUNGLE', gameName: 'Jungla', tagLine: '1' },
      ],
    },
  };

  function montarRuta(o: { ruta: boolean; respuestaRuta?: () => Promise<Response> }) {
    const cargas: EstadoCarga[] = [];
    const urls: string[] = [];
    const fetchFalso = vi.fn(async (url: string) => {
      urls.push(url);
      if (url.includes('/jungla/ruta/')) {
        return o.respuestaRuta
          ? o.respuestaRuta()
          : Response.json({ inicio: 'rojo', primerGank: { calle: 'bot', minuto: 3 }, partidas: 120 });
      }
      return new Response('x', { status: 503 });
    });
    const carga = crearOrquestadorCarga({
      urlServidor: () => 'https://servidor.test/',
      fetch: fetchFalso as unknown as typeof fetch,
      datos: async () => DATOS,
      enviarModo: () => {},
      enviarCarga: (c) => cargas.push(c),
      mostrar: () => {},
      ocultar: () => {},
      enPartida: () => false,
      rutaJunglaActiva: () => o.ruta,
    });
    carga.conectado(lcuFalso({ sesion: SESION_JUNGLA }).cliente);
    return { carga, cargas, urls };
  }

  it('con el ajuste encendido pide la ruta del jungla enemigo y la añade como estimación («suele»)', async () => {
    const { carga, cargas, urls } = montarRuta({ ruta: true });
    await carga.fase('InProgress');
    await vi.waitFor(() => expect(cargas.at(-1)?.rutaJungla).toBeTruthy());
    expect(urls).toContain('https://servidor.test/jungla/ruta/LeeSin');
    expect(cargas.at(-1)!.rutaJungla).toEqual({
      campeon: 'LeeSin',
      texto: 'Estimación: Lee Sin suele empezar por rojo y gankear bot hacia el minuto 3',
    });
    expect(carga.actual()?.rutaJungla?.campeon).toBe('LeeSin');
  });

  it('con el ajuste apagado (por defecto) no se pide nada', async () => {
    const { carga, cargas, urls } = montarRuta({ ruta: false });
    await carga.fase('InProgress');
    expect(urls.some((u) => u.includes('/jungla/'))).toBe(false);
    expect(cargas.every((c) => !c.rutaJungla)).toBe(true);
    expect(carga.actual()?.jugadores).toHaveLength(3);
  });

  it('sin datos suficientes (404) o con una respuesta rara, no hay estimación', async () => {
    for (const respuestaRuta of [
      async () => new Response('x', { status: 404 }),
      async () => Response.json({ inicio: 'verde', primerGank: { calle: 'top', minuto: -1 }, partidas: 'muchas' }),
    ]) {
      const { carga, cargas } = montarRuta({ ruta: true, respuestaRuta });
      await carga.fase('InProgress');
      await vi.advanceTimersByTimeAsync(0);
      expect(cargas.every((c) => !c.rutaJungla)).toBe(true);
    }
  });

  it('al terminar la partida se olvida la carga', async () => {
    const { carga } = montarRuta({ ruta: false });
    await carga.fase('InProgress');
    expect(carga.actual()).not.toBeNull();
    await carga.fase('EndOfGame');
    expect(carga.actual()).toBeNull();
  });
});
