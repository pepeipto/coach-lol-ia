import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Build, Rol } from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';
import { ErrorRiot, type EntradaLigaRiot, type MaestriaRiot, type RiotApiJugadores } from '../src/riot/riotApi';
import { crearCatalogoCampeones } from '../src/jugadores/catalogo';
import { crearServicioJugadores, INTERVALO_BARRIDO_MS, VIGENCIA_CACHE_MS, type CatalogoCampeones } from '../src/jugadores/servicio';
import type { InfoCampeon, JugadorPedido } from '../src/jugadores/tipos';

const CAMPEONES = new Map<number, InfoCampeon>([
  [103, { id: 'Ahri', nombre: 'Ahri', tags: ['Mage', 'Assassin'], dificultad: 5 }],
  [62, { id: 'MonkeyKing', nombre: 'Wukong', tags: ['Fighter', 'Tank'], dificultad: 3 }],
]);
const catalogo: CatalogoCampeones = { campeones: async () => CAMPEONES };

function build(campeon: string, rol: Rol, tasaVictoria: number, partidas = 200): Build {
  return { campeon, rol, parche: '16.20', partidas, tasaVictoria } as unknown as Build;
}

/** Riot falso: rangos y maestrías por puuid; un valor `Error` se lanza. */
function riotFalso(datos: {
  rangos?: Record<string, EntradaLigaRiot | null | Error>;
  maestrias?: Record<string, MaestriaRiot | null | Error>;
  colgado?: boolean;
}) {
  const llamadas: string[] = [];
  const api: RiotApiJugadores = {
    async rangoPorPuuid(plataforma, puuid) {
      llamadas.push(`rango:${plataforma}:${puuid}`);
      if (datos.colgado) return new Promise(() => undefined);
      const r = datos.rangos?.[puuid] ?? null;
      if (r instanceof Error) throw r;
      return r;
    },
    async maestria(plataforma, puuid, championId) {
      llamadas.push(`maestria:${plataforma}:${puuid}:${championId}`);
      if (datos.colgado) return new Promise(() => undefined);
      const m = datos.maestrias?.[`${puuid}:${championId}`] ?? null;
      if (m instanceof Error) throw m;
      return m;
    },
  };
  return { api, llamadas };
}

const solo = (tier: string, rank: string, lp: number, wins: number, losses: number): EntradaLigaRiot => ({
  queueType: 'RANKED_SOLO_5x5',
  tier,
  rank,
  leaguePoints: lp,
  wins,
  losses,
});

const pedido = (puuid: string, campeonId: number, rol: Rol | null, equipo: 'aliado' | 'enemigo' = 'aliado'): JugadorPedido => ({
  puuid,
  campeonId,
  rol,
  equipo,
});

describe('servicio de jugadores', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  it('junta rango oficial, maestría, winrate del campeón y etiquetas', async () => {
    db.guardarBuild(build('Ahri', 'MIDDLE', 0.531));
    const { api, llamadas } = riotFalso({
      rangos: { p1: solo('EMERALD', 'II', 42, 30, 20) },
      maestrias: { 'p1:103': { championLevel: 12, championPoints: 250_000 } },
    });
    const servicio = crearServicioJugadores({ api, db, catalogo });
    const [j] = await servicio.consultar('EUW', [{ ...pedido('p1', 103, 'MIDDLE'), riotId: 'Ana#EUW' }]);
    expect(j).toEqual({
      equipo: 'aliado',
      riotId: 'Ana#EUW',
      campeonId: 103,
      campeon: 'Ahri',
      nombre: 'Ahri',
      rol: 'MIDDLE',
      rango: { tier: 'EMERALD', division: 'II', lp: 42, victorias: 30, derrotas: 20 },
      maestria: { nivel: 12, puntos: 250_000 },
      campeonWinrate: 0.531,
      etiquetas: [
        { tipo: 'positivo', texto: 'Especialista en Ahri', clave: 'carga.etiqueta.especialista', params: { campeon: 'Ahri' } },
        { tipo: 'positivo', texto: 'Racha positiva esta temporada', clave: 'carga.etiqueta.racha' },
        { tipo: 'neutro', texto: 'Daño mágico en área', clave: 'carga.rasgo.Mage' },
      ],
    });
    expect(llamadas).toEqual(['rango:euw1:p1', 'maestria:euw1:p1:103']);
  });

  it('usa la plataforma de la región (LAN → la1, LAS → la2)', async () => {
    const { api, llamadas } = riotFalso({});
    const servicio = crearServicioJugadores({ api, db, catalogo });
    await servicio.consultar('LAN', [pedido('a', 103, null)]);
    await servicio.consultar('LAS', [pedido('b', 103, null)]);
    expect(llamadas).toEqual(['rango:la1:a', 'maestria:la1:a:103', 'rango:la2:b', 'maestria:la2:b:103']);
  });

  it('BR y NA (3.0) usan br1 y na1', async () => {
    const { api, llamadas } = riotFalso({});
    const servicio = crearServicioJugadores({ api, db, catalogo });
    await servicio.consultar('BR', [pedido('c', 103, null)]);
    await servicio.consultar('NA', [pedido('d', 103, null)]);
    expect(llamadas).toEqual(['rango:br1:c', 'maestria:br1:c:103', 'rango:na1:d', 'maestria:na1:d:103']);
  });

  it('un 404 de Riot deja el rango a null y la maestría a 0 (nunca lo jugó)', async () => {
    const servicio = crearServicioJugadores({ api: riotFalso({}).api, db, catalogo });
    const [j] = await servicio.consultar('EUW', [pedido('p', 103, 'MIDDLE')]);
    expect(j!.rango).toBeNull();
    expect(j!.maestria).toEqual({ nivel: 0, puntos: 0 });
    expect(j!.etiquetas[0]).toEqual({ tipo: 'info', texto: 'Poca experiencia con este campeón', clave: 'carga.etiqueta.pocaExperiencia' });
  });

  it('un error de Riot solo anula ese dato: la respuesta nunca falla entera', async () => {
    const { api } = riotFalso({
      rangos: { a: new ErrorRiot(500), b: solo('GOLD', 'I', 0, 1, 1) },
      maestrias: { 'b:103': new ErrorRiot(429) },
    });
    const servicio = crearServicioJugadores({ api, db, catalogo });
    const [a, b] = await servicio.consultar('EUW', [pedido('a', 103, null), pedido('b', 103, null)]);
    expect(a!.rango).toBeNull();
    expect(a!.maestria).toEqual({ nivel: 0, puntos: 0 });
    expect(b!.rango).toMatchObject({ tier: 'GOLD' });
    expect(b!.maestria).toBeNull();
  });

  it('si Riot no responde a tiempo, esos datos quedan a null', async () => {
    const servicio = crearServicioJugadores({ api: riotFalso({ colgado: true }).api, db, catalogo, tiempoMaximoMs: 10 });
    const [j] = await servicio.consultar('EUW', [pedido('p', 103, 'MIDDLE')]);
    expect(j!.rango).toBeNull();
    expect(j!.maestria).toBeNull();
  });

  it('una respuesta que llega tarde se guarda igual en caché, y mientras sigue en curso no se vuelve a pedir', async () => {
    let soltar: (v: EntradaLigaRiot) => void = () => {};
    const llamadas: string[] = [];
    const plazos: (number | undefined)[] = [];
    const api: RiotApiJugadores = {
      rangoPorPuuid: (_p, puuid, turno) => {
        llamadas.push(`rango:${puuid}`);
        plazos.push(turno?.plazo);
        return new Promise((r) => (soltar = r));
      },
      maestria: async () => null,
    };
    const servicio = crearServicioJugadores({ api, db, catalogo, tiempoMaximoMs: 10 });
    const [a] = await servicio.consultar('EUW', [pedido('p', 103, 'MIDDLE')]);
    expect(a!.rango).toBeNull(); // se agotó el tiempo
    expect(typeof plazos[0]).toBe('number'); // el limitador sabe hasta cuándo esperar el turno
    const [b] = await servicio.consultar('EUW', [pedido('p', 103, 'MIDDLE')]);
    expect(b!.rango).toBeNull();
    expect(llamadas).toEqual(['rango:p']); // la primera sigue en curso: no se encola otra
    soltar(solo('GOLD', 'I', 10, 5, 5));
    await new Promise((r) => setTimeout(r, 0));
    const [c] = await servicio.consultar('EUW', [pedido('p', 103, 'MIDDLE')]);
    expect(c!.rango).toMatchObject({ tier: 'GOLD' });
    expect(llamadas).toEqual(['rango:p']);
  });

  it('la respuesta entera tiene un tope de unos 4 s: con el catálogo colgado responde igual, sin nombres', async () => {
    const { TIEMPO_MAXIMO_POR_DEFECTO_MS } = await import('../src/jugadores/servicio');
    expect(TIEMPO_MAXIMO_POR_DEFECTO_MS).toBe(4000);
    const colgado = { campeones: () => new Promise<never>(() => undefined) };
    const { api } = riotFalso({ rangos: { p: solo('GOLD', 'I', 0, 1, 1) } });
    const [j] = await crearServicioJugadores({ api, db, catalogo: colgado, tiempoMaximoMs: 20 }).consultar('EUW', [pedido('p', 103, 'MIDDLE')]);
    expect(j!.campeon).toBe('');
    expect(j!.rango).toMatchObject({ tier: 'GOLD' });
  });

  it('campeon es el id de Data Dragon; las etiquetas usan el nombre en español', async () => {
    const { api } = riotFalso({ maestrias: { 'p:62': { championLevel: 9, championPoints: 150_000 } } });
    const [j] = await crearServicioJugadores({ api, db, catalogo }).consultar('EUW', [pedido('p', 62, 'TOP')]);
    expect(j!.campeon).toBe('MonkeyKing');
    expect(j!.etiquetas[0]).toEqual({ tipo: 'positivo', texto: 'Especialista en Wukong', clave: 'carga.etiqueta.especialista', params: { campeon: 'Wukong' } });
  });

  it('los bots (puuid vacío) no se consultan en Riot', async () => {
    const { api, llamadas } = riotFalso({});
    const servicio = crearServicioJugadores({ api, db, catalogo });
    const [j] = await servicio.consultar('EUW', [pedido('', 62, 'TOP', 'enemigo')]);
    expect(llamadas).toEqual([]);
    expect(j).toMatchObject({ equipo: 'enemigo', campeon: 'MonkeyKing', rango: null, maestria: null, riotId: '' });
  });

  it('caché de 10 min por puuid y por campeón', async () => {
    let t = 0;
    const { api, llamadas } = riotFalso({ rangos: { p: solo('GOLD', 'I', 0, 1, 1) } });
    const servicio = crearServicioJugadores({ api, db, catalogo, ahora: () => t });
    await servicio.consultar('EUW', [pedido('p', 103, null)]);
    t = 9 * 60_000;
    await servicio.consultar('EUW', [pedido('p', 103, null)]);
    expect(llamadas).toHaveLength(2);
    await servicio.consultar('EUW', [pedido('p', 62, null)]); // otro campeón: solo la maestría
    expect(llamadas).toEqual(['rango:euw1:p', 'maestria:euw1:p:103', 'maestria:euw1:p:62']);
    t = 10 * 60_000 + 1;
    await servicio.consultar('EUW', [pedido('p', 103, null)]);
    expect(llamadas).toHaveLength(5);
  });

  it('privacidad: un barrido cada minuto borra lo caducado (PUUID, rango y maestría no duran más de 10 min)', async () => {
    vi.useFakeTimers();
    try {
      let t = 0;
      const { api } = riotFalso({ rangos: { p: solo('GOLD', 'I', 0, 1, 1), q: solo('SILVER', 'I', 0, 1, 1) } });
      const servicio = crearServicioJugadores({ api, db, catalogo, ahora: () => t });
      await servicio.consultar('EUW', [pedido('p', 103, null)]);
      expect(servicio.entradasEnCache()).toBe(2); // rango y maestría de p
      t = 5 * 60_000;
      await servicio.consultar('EUW', [pedido('q', 103, null)]);
      expect(servicio.entradasEnCache()).toBe(4);
      // Sin ninguna consulta más (lejos de las 5000 entradas), lo caducado desaparece en el siguiente barrido.
      t = VIGENCIA_CACHE_MS;
      await vi.advanceTimersByTimeAsync(INTERVALO_BARRIDO_MS);
      expect(servicio.entradasEnCache()).toBe(2); // las de p ya no están; las de q siguen vigentes
      t = 5 * 60_000 + VIGENCIA_CACHE_MS;
      await vi.advanceTimersByTimeAsync(INTERVALO_BARRIDO_MS);
      expect(servicio.entradasEnCache()).toBe(0);
      servicio.detener();
    } finally {
      vi.useRealTimers();
    }
  });

  it('privacidad: ni con errores de Riot se registra un PUUID o un Riot ID', async () => {
    const PUUID = 'a'.repeat(78);
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    try {
      const { api } = riotFalso({ rangos: { [PUUID]: new ErrorRiot(500) }, maestrias: { [`${PUUID}:103`]: new Error(`fallo con ${PUUID}`) } });
      const servicio = crearServicioJugadores({ api, db, catalogo });
      await servicio.consultar('EUW', [{ ...pedido(PUUID, 103, null), riotId: 'Nombre#TAG' }]);
      servicio.detener();
      const escrito = espias.flatMap((e) => e.mock.calls.flat().map(String)).join(' | ');
      expect(escrito).not.toContain(PUUID);
      expect(escrito).not.toContain('Nombre#TAG');
    } finally {
      for (const e of espias) e.mockRestore();
    }
  });

  it('el barrido no mantiene vivo el proceso (unref) y detener() lo para', () => {
    const unref = vi.fn();
    const id = { unref } as unknown as ReturnType<typeof setInterval>;
    const intervalo = vi.spyOn(globalThis, 'setInterval').mockReturnValue(id);
    const limpiar = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => undefined);
    try {
      const servicio = crearServicioJugadores({ api: riotFalso({}).api, db, catalogo });
      expect(intervalo).toHaveBeenCalledWith(expect.any(Function), INTERVALO_BARRIDO_MS);
      expect(unref).toHaveBeenCalled();
      servicio.detener();
      expect(limpiar).toHaveBeenCalledWith(id);
    } finally {
      intervalo.mockRestore();
      limpiar.mockRestore();
    }
  });

  it('dos consultas simultáneas del mismo dato comparten la llamada a Riot', async () => {
    const { api, llamadas } = riotFalso({ rangos: { p: solo('GOLD', 'I', 0, 1, 1) } });
    const servicio = crearServicioJugadores({ api, db, catalogo });
    const [a, b] = await Promise.all([
      servicio.consultar('EUW', [pedido('p', 103, null)]),
      servicio.consultar('EUW', [pedido('p', 103, null)]),
    ]);
    expect(llamadas).toEqual(['rango:euw1:p', 'maestria:euw1:p:103']);
    expect(a[0]!.rango).toEqual(b[0]!.rango);
    expect(a[0]!.rango).toMatchObject({ tier: 'GOLD' });
  });

  it('el nombre visible del campeón viene de Data Dragon', async () => {
    const [j] = await crearServicioJugadores({ api: riotFalso({}).api, db, catalogo }).consultar('EUW', [pedido('', 62, null)]);
    expect(j).toMatchObject({ campeon: 'MonkeyKing', nombre: 'Wukong' });
  });

  it('los errores no se guardan en la caché', async () => {
    const datos: { rangos: Record<string, EntradaLigaRiot | Error> } = { rangos: { p: new ErrorRiot(503) } };
    const { api } = riotFalso(datos);
    const servicio = crearServicioJugadores({ api, db, catalogo });
    expect((await servicio.consultar('EUW', [pedido('p', 103, null)]))[0]!.rango).toBeNull();
    datos.rangos.p = solo('SILVER', 'III', 3, 1, 1);
    expect((await servicio.consultar('EUW', [pedido('p', 103, null)]))[0]!.rango).toMatchObject({ tier: 'SILVER' });
  });

  it('winrate: el del rol pedido; sin rol, el del rol con más partidas; sin datos, null', async () => {
    db.guardarBuild(build('MonkeyKing', 'TOP', 0.5, 300));
    db.guardarBuild(build('MonkeyKing', 'JUNGLE', 0.54, 900));
    const servicio = crearServicioJugadores({ api: riotFalso({}).api, db, catalogo });
    const [top, sinRol, mid, desconocido] = await servicio.consultar('EUW', [
      pedido('', 62, 'TOP'),
      pedido('', 62, null),
      pedido('', 62, 'MIDDLE'),
      pedido('', 999, 'TOP'),
    ]);
    expect(top!.campeonWinrate).toBe(0.5);
    expect(sinRol!.campeonWinrate).toBe(0.54);
    expect(mid!.campeonWinrate).toBeNull();
    expect(desconocido).toMatchObject({ campeon: '', campeonWinrate: null, etiquetas: [] });
  });
});

describe('catálogo de campeones (Data Dragon)', () => {
  function fetchDDragon(contador: { n: number }, fallar = false) {
    return (async (url: string) => {
      contador.n++;
      if (fallar) return new Response('x', { status: 500 });
      if (String(url).endsWith('versions.json')) return Response.json(['16.20.1', '16.19.1']);
      expect(String(url)).toBe('https://ddragon.leagueoflegends.com/cdn/16.20.1/data/es_MX/champion.json');
      return Response.json({
        data: { MonkeyKing: { key: '62', id: 'MonkeyKing', name: 'Wukong', tags: ['Fighter', 'Tank'], info: { difficulty: 3 } } },
      });
    }) as unknown as typeof fetch;
  }

  it('descarga los campeones con sus etiquetas y dificultad, y los guarda en memoria', async () => {
    const c = { n: 0 };
    const catalogo = crearCatalogoCampeones({ fetch: fetchDDragon(c) });
    expect((await catalogo.campeones()).get(62)).toEqual({ id: 'MonkeyKing', nombre: 'Wukong', tags: ['Fighter', 'Tank'], dificultad: 3 });
    await catalogo.campeones();
    expect(c.n).toBe(2);
  });

  it('si Data Dragon falla devuelve un catálogo vacío y lo reintenta más tarde', async () => {
    const c = { n: 0 };
    let t = 0;
    const catalogo = crearCatalogoCampeones({ fetch: fetchDDragon(c, true), ahora: () => t });
    expect((await catalogo.campeones()).size).toBe(0);
    await catalogo.campeones();
    expect(c.n).toBe(1); // no reintenta en cada petición
    t = 5 * 60_000 + 1;
    await catalogo.campeones();
    expect(c.n).toBe(2);
  });
});

describe('POST /api/partida/jugadores', () => {
  let db: Db;
  let app: FastifyInstance;
  // Un PUUID de verdad: 78 caracteres de [A-Za-z0-9_-].
  const P1 = 'p1'.padEnd(78, 'x');
  const cuerpo = { region: 'EUW', jugadores: [pedido(P1, 103, 'MIDDLE')] };

  beforeEach(() => {
    db = abrirDb(':memory:');
    app = crearServidor(db, { jugadores: { api: riotFalso({ rangos: { [P1]: solo('GOLD', 'IV', 12, 3, 4) } }).api, catalogo } });
  });
  afterEach(async () => {
    await app.close();
    db.cerrar();
  });

  const pedir = (payload: unknown, ip = '1.2.3.4') =>
    app.inject({
      method: 'POST',
      url: '/api/partida/jugadores',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
      remoteAddress: ip,
    });

  it('devuelve los jugadores', async () => {
    const r = await pedir(cuerpo);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      jugadores: [
        expect.objectContaining({ campeon: 'Ahri', rango: { tier: 'GOLD', division: 'IV', lp: 12, victorias: 3, derrotas: 4 } }),
      ],
    });
  });

  it.each([
    ['región desconocida', { ...cuerpo, region: 'KR' }],
    ['sin jugadores', { region: 'EUW', jugadores: [] }],
    ['más de 10 jugadores', { region: 'EUW', jugadores: Array.from({ length: 11 }, (_, i) => pedido(`p${i}`, 103, null)) }],
    ['rol no válido', { region: 'EUW', jugadores: [{ ...pedido('p', 103, null), rol: 'ADC' }] }],
    ['equipo no válido', { region: 'EUW', jugadores: [{ ...pedido('p', 103, null), equipo: 'rojo' }] }],
    ['campeón no válido', { region: 'EUW', jugadores: [pedido('p', -1, null)] }],
    ['puuid con caracteres raros', { region: 'EUW', jugadores: [pedido('../x'.padEnd(78, 'x'), 103, null)] }],
    ['puuid corto (77)', { region: 'EUW', jugadores: [pedido('a'.repeat(77), 103, null)] }],
    ['puuid largo (79)', { region: 'EUW', jugadores: [pedido('a'.repeat(79), 103, null)] }],
    ['puuid de 100', { region: 'EUW', jugadores: [pedido('a'.repeat(100), 103, null)] }],
    ['puuid con espacio', { region: 'EUW', jugadores: [pedido(' '.padEnd(78, 'a'), 103, null)] }],
    ['puuid con +', { region: 'EUW', jugadores: [pedido('+'.padEnd(78, 'a'), 103, null)] }],
    ['puuid que no es texto', { region: 'EUW', jugadores: [{ ...pedido('', 103, null), puuid: 123 }] }],
    ['riotId demasiado largo', { region: 'EUW', jugadores: [{ ...pedido('p', 103, null), riotId: 'x'.repeat(100) }] }],
    ['cuerpo nulo', null],
  ])('400 con %s', async (_n, payload) => {
    const r = await pedir(payload);
    expect(r.statusCode).toBe(400);
    expect(r.json()).toEqual({ error: 'peticion_no_valida' });
  });

  it('acepta PUUID de 78 caracteres de [A-Za-z0-9_-] y vacío (bots)', async () => {
    const r = await pedir({ region: 'EUW', jugadores: [pedido('aZ09_-'.padEnd(78, 'q'), 103, null), pedido('', 62, null, 'enemigo')] });
    expect(r.statusCode).toBe(200);
  });

  it('límite de 6 peticiones por minuto y por IP', async () => {
    for (let i = 0; i < 6; i++) expect((await pedir(cuerpo)).statusCode).toBe(200);
    const r = await pedir(cuerpo);
    expect(r.statusCode).toBe(429);
    expect(r.json()).toEqual({ error: 'limite' });
    expect((await pedir(cuerpo, '5.6.7.8')).statusCode).toBe(200);
  });

  it('sin cliente de Riot configurado responde 503', async () => {
    const otra = crearServidor(db);
    const r = await otra.inject({ method: 'POST', url: '/api/partida/jugadores', payload: cuerpo });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ error: 'no_disponible' });
    await otra.close();
  });
});
