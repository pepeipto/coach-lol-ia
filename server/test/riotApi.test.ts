import { describe, it, expect } from 'vitest';
import { crearRiotApi, ErrorRiot } from '../src/riot/riotApi';
import { crearLimitador } from '../src/riot/limitador';

type Resp = { status: number; body?: unknown; headers?: Record<string, string> };

function montar(respuestas: Resp[]) {
  const llamadas: { url: string; init?: RequestInit }[] = [];
  const esperas: number[] = [];
  let i = 0;
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url: String(url), init });
    const r = respuestas[Math.min(i++, respuestas.length - 1)];
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: r.headers,
    });
  }) as unknown as typeof fetch;
  const api = crearRiotApi({
    clave: 'RGAPI-test',
    fetch: fetchFalso,
    esperar: async (ms) => {
      esperas.push(ms);
    },
    limitadores: new Map([
      ['euw1.api.riotgames.com', crearLimitador([{ peticiones: 1000, ventanaMs: 1000 }])],
    ]),
  });
  return { api, llamadas, esperas };
}

const partida = { metadata: { matchId: 'EUW1_1' }, info: {} };

describe('crearRiotApi', () => {
  it('envía X-Riot-Token y usa el host de la plataforma o la ruta', async () => {
    const { api, llamadas } = montar([{ status: 200, body: [] }]);
    await api.entradasLiga('euw1', 'EMERALD', 'I', 2);
    await api.idsPartidas('europe', 'p', 5);
    expect(llamadas[0].url).toMatch(/^https:\/\/euw1\.api\.riotgames\.com\//);
    expect(llamadas[0].url).toContain('/lol/league/v4/entries/RANKED_SOLO_5x5/EMERALD/I?page=2');
    expect(llamadas[1].url).toMatch(/^https:\/\/europe\.api\.riotgames\.com\//);
    const h = llamadas[0].init?.headers as Record<string, string>;
    expect(h['X-Riot-Token']).toBe('RGAPI-test');
  });

  it('ligaApex devuelve entries', async () => {
    const { api, llamadas } = montar([{ status: 200, body: { entries: [{ puuid: 'a' }] } }]);
    expect(await api.ligaApex('euw1', 'challenger')).toEqual([{ puuid: 'a' }]);
    expect(llamadas[0].url).toContain('/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5');
  });

  it('idsPartidas pide queue=420 y count', async () => {
    const { api, llamadas } = montar([{ status: 200, body: ['EUW1_1'] }]);
    expect(await api.idsPartidas('europe', 'abc', 20)).toEqual(['EUW1_1']);
    expect(llamadas[0].url).toContain('/by-puuid/abc/ids?queue=420&count=20');
  });

  it('idsPartidas pide la cola indicada (ARAM: Caos, 2400)', async () => {
    const { api, llamadas } = montar([{ status: 200, body: [] }]);
    await api.idsPartidas('europe', 'abc', 20, 2400);
    expect(llamadas[0].url).toContain('/by-puuid/abc/ids?queue=2400&count=20');
  });

  it('idsPartidas añade startTime (segundos) si se indica', async () => {
    const { api, llamadas } = montar([{ status: 200, body: [] }]);
    await api.idsPartidas('europe', 'abc', 20, 450, 1_799_000_000.7);
    expect(llamadas[0].url).toContain('/by-puuid/abc/ids?queue=450&count=20&startTime=1799000000');
  });

  it('lineaTiempo usa /timeline', async () => {
    const { api, llamadas } = montar([{ status: 200, body: { info: { frames: [] } } }]);
    await api.lineaTiempo('europe', 'EUW1_1');
    expect(llamadas[0].url).toContain('/lol/match/v5/matches/EUW1_1/timeline');
  });

  it('429: espera Retry-After segundos y reintenta', async () => {
    const { api, esperas, llamadas } = montar([
      { status: 429, headers: { 'Retry-After': '3' } },
      { status: 200, body: partida },
    ]);
    expect(await api.partida('europe', 'EUW1_1')).toEqual(partida);
    expect(esperas).toEqual([3000]);
    expect(llamadas).toHaveLength(2);
  });

  it('429 sin Retry-After espera 10 s', async () => {
    const { api, esperas } = montar([{ status: 429 }, { status: 200, body: partida }]);
    await api.partida('europe', 'EUW1_1');
    expect(esperas).toEqual([10000]);
  });

  it('429 cuatro veces seguidas → lanza ErrorRiot con estado 429', async () => {
    const { api, llamadas } = montar([{ status: 429, headers: { 'Retry-After': '1' } }]);
    await expect(api.partida('europe', 'x')).rejects.toMatchObject({ estado: 429 });
    await expect(api.partida('europe', 'x')).rejects.toBeInstanceOf(ErrorRiot);
    expect(llamadas).toHaveLength(8);
  });

  it('404 → devuelve null', async () => {
    const { api } = montar([{ status: 404 }]);
    expect(await api.partida('europe', 'x')).toBeNull();
    expect(await api.lineaTiempo('europe', 'x')).toBeNull();
  });

  it('500 → lanza ErrorRiot con estado 500', async () => {
    const { api } = montar([{ status: 500 }]);
    await expect(api.partida('europe', 'x')).rejects.toMatchObject({ estado: 500 });
  });
});

describe('crearRiotApi: jugadores de la pantalla de carga', () => {
  it('rangoPorPuuid pide league-v4 por puuid y devuelve solo la cola RANKED_SOLO_5x5', async () => {
    const { api, llamadas } = montar([
      {
        status: 200,
        body: [
          { queueType: 'RANKED_FLEX_SR', tier: 'GOLD', rank: 'I', leaguePoints: 10, wins: 5, losses: 5 },
          { queueType: 'RANKED_SOLO_5x5', tier: 'EMERALD', rank: 'II', leaguePoints: 42, wins: 30, losses: 20 },
        ],
      },
    ]);
    expect(await api.rangoPorPuuid('euw1', 'abc')).toEqual({
      queueType: 'RANKED_SOLO_5x5',
      tier: 'EMERALD',
      rank: 'II',
      leaguePoints: 42,
      wins: 30,
      losses: 20,
    });
    expect(llamadas[0].url).toBe('https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/abc');
  });

  it('rangoPorPuuid sin clasificatoria en solitario o con 404 → null', async () => {
    expect(await montar([{ status: 200, body: [] }]).api.rangoPorPuuid('euw1', 'abc')).toBeNull();
    expect(await montar([{ status: 404 }]).api.rangoPorPuuid('euw1', 'abc')).toBeNull();
  });

  it('maestria pide champion-mastery-v4 por puuid y campeón', async () => {
    const { api, llamadas } = montar([{ status: 200, body: { championLevel: 7, championPoints: 123456 } }]);
    expect(await api.maestria('euw1', 'a/b', 103)).toEqual({ championLevel: 7, championPoints: 123456 });
    expect(llamadas[0].url).toBe(
      'https://euw1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/a%2Fb/by-champion/103',
    );
  });

  it('maestria con 404 (nunca lo jugó) → null', async () => {
    expect(await montar([{ status: 404 }]).api.maestria('euw1', 'abc', 1)).toBeNull();
  });
});

describe('prioridad de las peticiones a Riot', () => {
  function conEspia() {
    const turnos: { host: string; prioridad: string }[] = [];
    const espia = (host: string) => ({
      esperarTurno: async (prioridad?: 'interactiva' | 'fondo') => {
        turnos.push({ host, prioridad: prioridad ?? 'fondo' });
      },
    });
    const fetchFalso = (async () => new Response(JSON.stringify([]), { status: 200 })) as unknown as typeof fetch;
    const api = crearRiotApi({
      clave: 'RGAPI-test',
      fetch: fetchFalso,
      limitadores: new Map([
        ['euw1.api.riotgames.com', espia('euw1')],
        ['europe.api.riotgames.com', espia('europe')],
      ]),
    });
    return { api, turnos };
  }

  it('la pantalla de carga (rango y maestría) pide turno como interactiva', async () => {
    const { api, turnos } = conEspia();
    await api.rangoPorPuuid('euw1', 'p');
    await api.maestria('euw1', 'p', 103).catch(() => null);
    expect(turnos).toEqual([
      { host: 'euw1', prioridad: 'interactiva' },
      { host: 'euw1', prioridad: 'interactiva' },
    ]);
  });

  it('el recolector pide turno como fondo', async () => {
    const { api, turnos } = conEspia();
    await api.entradasLiga('euw1', 'EMERALD', 'I', 1);
    await api.ligaApex('euw1', 'master');
    await api.idsPartidas('europe', 'p', 5);
    await api.partida('europe', 'EUW1_1');
    await api.lineaTiempo('europe', 'EUW1_1');
    expect(turnos.map((t) => t.prioridad)).toEqual(['fondo', 'fondo', 'fondo', 'fondo', 'fondo']);
  });

  it('con el recolector saturando el host, la pantalla de carga no espera a que se vacíe su cola', async () => {
    const lento: (() => void)[] = [];
    const fetchFalso = (async (url: string) => {
      // El recolector ocupa su hueco; la consulta interactiva responde al momento.
      if (String(url).includes('/entries/RANKED_SOLO_5x5/')) await new Promise<void>((r) => lento.push(r));
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;
    const api = crearRiotApi({
      clave: 'RGAPI-test',
      fetch: fetchFalso,
      limitadores: new Map([['euw1.api.riotgames.com', crearLimitador([{ peticiones: 3, ventanaMs: 60_000, reservaInteractiva: 1 }])]]),
    });
    const orden: string[] = [];
    for (let i = 0; i < 5; i++) void api.entradasLiga('euw1', 'EMERALD', 'I', i).then(() => orden.push('recolector'));
    const rango = api.rangoPorPuuid('euw1', 'p').then(() => orden.push('carga'));
    await rango;
    expect(orden).toEqual(['carga']);
    lento.forEach((r) => r());
  });
});
