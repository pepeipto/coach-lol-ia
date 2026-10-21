import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Build } from '@coach/shared';
import { AJUSTES_POR_DEFECTO, IA_POR_DEFECTO, normalizarAjustes, normalizarIa } from '../src/main/ajustes';
import { esAnalisis, pedirAnalisis, pedirConsejo } from '../src/main/ia/clienteIa';
import { crearCoachIa, ENDPOINT_EOG, type DependenciasCoachIa } from '../src/main/ia/coachIa';
import { crearHistorial, MAX_HISTORIAL } from '../src/main/ia/historial';
import { DetectorMomentos, ORO_TIENDA } from '../src/main/ia/momentos';
import { duenoEstructura, objetivoDeEvento, RegistroPartida } from '../src/main/ia/registro';
import { leerEog, peticionAnalisis, peticionConsejo, sucesosRecientes } from '../src/main/ia/resumen';
import { esDinamica, marcarDinamica, olvidarDinamicas } from '../src/main/voz/dinamicas';
import type { Ajustes, EntradaAnalisis, EstadoOverlay, EstadoPartida, FraseVoz } from '../src/shared/tiposApp';

const ANALISIS = {
  veredicto: 'Partida sólida en la fase de líneas.',
  bien: [{ titulo: 'Farmeo', porque: '7,2 CS/min.' }],
  mejorar: [{ titulo: 'Muertes antes del dragón', porque: '2 de 4.' }],
  momentos: [{ t: 600, texto: 'Muerte antes del dragón.' }],
  enfoque: 'Llega vivo a los objetivos.',
};

function estado(extra: Partial<EstadoPartida> = {}): EstadoPartida {
  return {
    tiempo: 600,
    oro: 300,
    nivel: 9,
    campeon: 'Ahri',
    objetos: [3165],
    habilidades: { Q: 4, W: 2, E: 2, R: 1 },
    eventos: [],
    modo: 'clasificatoria',
    equipo: 'ORDER',
    cs: 80,
    kda: { k: 2, d: 1, a: 3 },
    muerto: false,
    jugadores: [
      { campeon: 'Ahri', equipo: 'ORDER', posicion: 'MIDDLE', castigo: false, nivel: 9, asesinatos: 2, objetos: [3165] },
      { campeon: 'Garen', equipo: 'ORDER', posicion: null, castigo: false, nivel: 9, asesinatos: 1 },
      { campeon: 'Soraka', equipo: 'CHAOS', posicion: null, castigo: false, nivel: 8, asesinatos: 0, objetos: [3504] },
      { campeon: 'Zed', equipo: 'CHAOS', posicion: null, castigo: true, nivel: 10, asesinatos: 5, objetos: [3142] },
    ],
    ...extra,
  };
}

const ajustes = (cambios: Partial<Ajustes['ia']> = {}, vozActiva = true, avisos = false): Ajustes => {
  const a = structuredClone(AJUSTES_POR_DEFECTO);
  a.ia = { ...a.ia, ...cambios };
  a.overlay.voz.activa = vozActiva;
  a.overlay.widgets.avisos.activo = avisos;
  return a;
};

describe('registro de la partida', () => {
  it('una muestra por minuto, muertes, compras (sin abalorios) y objetivos relativos al equipo', () => {
    const precios: Record<number, number> = { 3165: 2900, 1056: 400 };
    const r = new RegistroPartida((id) => precios[id] ?? 0);
    r.procesar(estado({ tiempo: 5, objetos: [1056, 3340], cs: 0, kda: { k: 0, d: 0, a: 0 }, oro: 100 }));
    r.procesar(estado({ tiempo: 61, objetos: [1056, 3340], cs: 8, kda: { k: 0, d: 0, a: 0 }, oro: 200 }));
    r.procesar(estado({ tiempo: 62, objetos: [1056, 3340], cs: 8, oro: 200 }));
    r.procesar(estado({ tiempo: 130, muerto: true, objetos: [1056], kda: { k: 0, d: 1, a: 0 } }));
    r.procesar(estado({ tiempo: 131, muerto: true, objetos: [1056] }));
    r.procesar(
      estado({
        tiempo: 200,
        muerto: false,
        objetos: [1056, 3165],
        eventos: [
          { nombre: 'DragonKill', tiempo: 190, equipo: 'CHAOS', dragon: 'Fire' },
          { nombre: 'TurretKilled', tiempo: 195, estructura: 'Turret_T2_L_03_A' },
          { nombre: 'DragonKill', tiempo: 199, equipo: 'ORDER', dragon: 'Elder' },
        ],
      }),
    );
    expect(r.linea.map((m) => m.m)).toEqual([1, 2, 3]);
    expect(r.linea[0]).toEqual({ m: 1, cs: 8, nivel: 9, k: 0, d: 0, a: 0, oro: 600 });
    expect(r.muertes).toEqual([130]);
    expect(r.compras).toEqual([
      { t: 5, id: 1056 },
      { t: 200, id: 3165 },
    ]);
    expect(r.objetivos).toEqual([
      { t: 190, tipo: 'dragon', equipo: 'enemigo', subtipo: 'Fire' },
      { t: 195, tipo: 'torre', equipo: 'aliado' },
      { t: 199, tipo: 'anciano', equipo: 'aliado' },
    ]);
  });

  it('no duplica objetivos aunque cambie el EventID y fecha la muerte por su ChampionKill', () => {
    const r = new RegistroPartida();
    const dragon = { nombre: 'DragonKill', tiempo: 330, equipo: 'CHAOS' as const, dragon: 'Fire' };
    r.procesar(estado({ tiempo: 340, eventos: [{ ...dragon, id: 1 }] }));
    r.procesar(estado({ tiempo: 350, eventos: [{ ...dragon, id: 2 }] }));
    r.procesar(estado({ tiempo: 620, muerto: true, eventos: [{ nombre: 'ChampionKill', tiempo: 611, victima: 'Ahri', asesino: 'Zed' }] }));
    expect(r.objetivos).toHaveLength(1);
    expect(r.muertes).toEqual([611]);
  });

  it('al entrar tarde, el inventario no cuenta como compras; GameEnd da el resultado', () => {
    const r = new RegistroPartida();
    r.procesar(estado({ tiempo: 900, objetos: [3165, 3020] }));
    r.procesar(estado({ tiempo: 901, objetos: [3165, 3020], eventos: [{ nombre: 'GameEnd', tiempo: 901, resultado: 'Win' }] }));
    expect(r.compras).toEqual([]);
    expect(r.resultado).toBe('victoria');
  });

  it('dueño de estructuras y objetivos sin equipo', () => {
    expect(duenoEstructura('Barracks_T1_L1')).toBe('ORDER');
    expect(duenoEstructura('Turret_T2_C_05_A')).toBe('CHAOS');
    expect(duenoEstructura('raro')).toBeNull();
    expect(objetivoDeEvento({ nombre: 'BaronKill', tiempo: 1300 }, 'ORDER')).toBeNull();
    expect(objetivoDeEvento({ nombre: 'ChampionKill', tiempo: 1300 }, 'ORDER')).toBeNull();
  });
});

describe('estadísticas de fin de partida de la LCU', () => {
  const eog = {
    gameLength: 1834,
    localPlayer: {
      summonerName: 'NoDebeSalir',
      puuid: 'x',
      detectedTeamPosition: 'BOTTOM',
      items: [3031, 3006, 0, 3094],
      stats: {
        CHAMPIONS_KILLED: 9,
        NUM_DEATHS: 4,
        ASSISTS: 6,
        MINIONS_KILLED: 210,
        NEUTRAL_MINIONS_KILLED: 12,
        GOLD_EARNED: 14200,
        TOTAL_DAMAGE_DEALT_TO_CHAMPIONS: 28000,
        VISION_SCORE: 21,
        WARD_PLACED: 9,
        VISION_WARDS_BOUGHT_IN_GAME: 2,
        LEVEL: 16,
      },
    },
    teams: [
      { isPlayerTeam: true, isWinningTeam: true, players: [{ stats: { CHAMPIONS_KILLED: 9 } }, { stats: { CHAMPIONS_KILLED: 11 } }] },
      { isPlayerTeam: false, isWinningTeam: false, stats: { CHAMPIONS_KILLED: 14 } },
    ],
  };

  it('lee KDA, CS, oro, daño, visión, objetos, resultado, marcador y rol (sin nombres)', () => {
    const r = leerEog(eog)!;
    expect(r.final).toEqual({
      k: 9,
      d: 4,
      a: 6,
      cs: 222,
      nivel: 16,
      oro: 14200,
      danoCampeones: 28000,
      vision: 21,
      guardianes: 9,
      guardianesControl: 2,
      objetos: [3031, 3006, 3094],
    });
    expect(r.resultado).toBe('victoria');
    expect(r.equipos).toEqual({ aliados: 20, enemigos: 14 });
    expect(r.duracion).toBe(1834);
    expect(r.rol).toBe('BOTTOM');
    expect(JSON.stringify(r)).not.toMatch(/NoDebeSalir|puuid/);
  });

  it('cualquier otra forma da null o datos parciales, sin fallar', () => {
    expect(leerEog(null)).toBeNull();
    expect(leerEog({ teams: [] })).toBeNull();
    expect(leerEog({ localPlayer: { stats: { kills: 2 } } })!.final).toEqual({ k: 2 });
  });
});

describe('peticiones al servidor', () => {
  const build = { campeon: 'Ahri', nucleo: [3165, 4645], botas: 3020, situacionales: [3157] } as unknown as Build;
  const objetos = { 3165: { name: 'Morellonomicón' }, 3020: { name: 'Botas del hechicero' }, 4645: { name: 'Llama sombría' }, 3157: { name: 'Zhonya' }, 3504: { name: 'Incensario' }, 3142: { name: 'Filo fantasmal' } };

  it('el análisis junta registro, LCU y build; rol de la LCU; nunca nombres de jugadores', () => {
    const r = new RegistroPartida();
    for (let t = 0; t <= 1800; t += 30) r.procesar(estado({ tiempo: t }));
    const eog = leerEog({ gameLength: 1800, localPlayer: { detectedTeamPosition: 'MIDDLE', summonerName: 'Oculto', stats: { CHAMPIONS_KILLED: 3, VISION_SCORE: 30 } }, teams: [{ isPlayerTeam: true, isWinningTeam: false }] });
    const p = peticionAnalisis(r, eog, { idioma: 'fr', modo: 'clasificatoria', build, rol: 'TOP', objetos, nombreCampeon: 'Ahri' })!;
    expect(p.idioma).toBe('fr');
    expect(p.rol).toBe('MIDDLE');
    expect(p.csObjetivoMinuto).toBe(7.5);
    expect(p.resultado).toBe('derrota');
    expect(p.final.k).toBe(3);
    expect(p.final.vision).toBe(30);
    expect(p.linea).toHaveLength(30);
    expect(p.build).toEqual({ nucleo: [3165, 4645], botas: 3020, situacionales: [3157] });
    expect(p.nombresObjetos['3165']).toBe('Morellonomicón');
    expect(p.equipos).toEqual({ aliados: 3, enemigos: 5 });
    expect(JSON.stringify(p)).not.toMatch(/Oculto|riotId|summoner/i);
  });

  it('en ARAM y Arena no hay rol ni CS de referencia; la build de otro campeón no se usa', () => {
    const r = new RegistroPartida();
    for (let t = 0; t <= 900; t += 60) r.procesar(estado({ tiempo: t, modo: 'aram', campeon: 'Lux' }));
    const p = peticionAnalisis(r, null, { idioma: 'es', modo: 'aram', build, rol: 'MIDDLE', objetos })!;
    expect(p.rol).toBeNull();
    expect(p.csObjetivoMinuto).toBeNull();
    expect(p.build).toBeNull();
  });

  it('el consejo lleva el marcador (TAB) de cada equipo y el próximo objetivo, sin nombres', () => {
    const resumen = { objetivos: [{ id: 'dragon', nombre: 'Dragón', subtipo: 'Water', aparece: 70, disponible: false }] } as unknown as EstadoOverlay;
    const e = estado({ tiempo: 1240, eventos: [{ nombre: 'ChampionKill', tiempo: 1230, asesino: 'Zed', victima: 'Ahri' }, { nombre: 'DragonKill', tiempo: 900, equipo: 'CHAOS', dragon: 'Fire' }] });
    const p = peticionConsejo(e, resumen, 'objetivo', { idioma: 'en', modo: 'clasificatoria', rol: null, objetos }, []);
    expect(p.yo).toMatchObject({ campeon: 'Ahri', rol: 'MIDDLE', oro: 300, objetos: [3165] });
    expect(p.aliados).toEqual([{ campeon: 'Garen', nivel: 9, objetos: [], k: 1 }]);
    expect(p.enemigos).toEqual([
      { campeon: 'Soraka', nivel: 8, objetos: [3504], k: 0 },
      { campeon: 'Zed', nivel: 10, objetos: [3142], k: 5 },
    ]);
    expect(p.marcador).toEqual({ aliados: 3, enemigos: 5 });
    expect(p.proximoObjetivo).toEqual({ tipo: 'dragon', enSegundos: 70, subtipo: 'Water' });
    expect(p.recientes).toEqual(['you were killed by Zed']);
    expect(p.nombresObjetos).toEqual({ '3165': 'Morellonomicón', '3504': 'Incensario', '3142': 'Filo fantasmal' });
    expect(sucesosRecientes(estado({ tiempo: 1000, eventos: [{ nombre: 'DragonKill', tiempo: 900, equipo: 'ORDER', dragon: 'Fire' }] }))).toEqual(['allies took dragon (Fire)']);
  });
});

describe('momentos muertos', () => {
  const sinObjetivo = { objetivos: [] } as unknown as EstadoOverlay;

  it('muerto con más de 8 s: un consejo por muerte; al reaparecer con oro, el de la tienda en su lugar', () => {
    const d = new DetectorMomentos();
    expect(d.procesar(estado({ tiempo: 600, muerto: true, reaparece: 20 }), sinObjetivo, 6)).toBeNull(); // recién muerto
    expect(d.procesar(estado({ tiempo: 603, muerto: true, reaparece: 17 }), sinObjetivo, 6)).toBe('muerte');
    expect(d.procesar(estado({ tiempo: 604, muerto: true, reaparece: 16 }), sinObjetivo, 6)).toBeNull();
    expect(d.procesar(estado({ tiempo: 620, muerto: false, oro: 2000 }), sinObjetivo, 6)).toBeNull(); // ya hubo en esta muerte
    // Otra muerte, con oro: se espera a la tienda.
    expect(d.procesar(estado({ tiempo: 700, muerto: true, reaparece: 25, oro: ORO_TIENDA + 100 }), sinObjetivo, 6)).toBeNull();
    expect(d.procesar(estado({ tiempo: 705, muerto: true, reaparece: 20, oro: ORO_TIENDA + 100 }), sinObjetivo, 6)).toBeNull();
    expect(d.procesar(estado({ tiempo: 725, muerto: false, oro: ORO_TIENDA + 100 }), sinObjetivo, 6)).toBe('tienda');
    expect(d.dados).toBe(2);
  });

  it('con un objetivo épico a 60-75 s y el jugador muerto, el consejo es de objetivo', () => {
    const d = new DetectorMomentos();
    const resumen = { objetivos: [{ id: 'baron', aparece: 70, disponible: false }] } as unknown as EstadoOverlay;
    d.procesar(estado({ tiempo: 1500, muerto: true, reaparece: 40, oro: 3000 }), resumen, 6);
    expect(d.procesar(estado({ tiempo: 1503, muerto: true, reaparece: 37, oro: 3000 }), resumen, 6)).toBe('objetivo');
  });

  it('respeta el máximo por partida, la separación de un minuto, el inicio y los modos', () => {
    const d = new DetectorMomentos();
    let t = 200;
    const morir = () => {
      d.procesar(estado({ tiempo: t, muerto: true, reaparece: 30 }), sinObjetivo, 2);
      const r = d.procesar(estado({ tiempo: t + 3, muerto: true, reaparece: 27 }), sinObjetivo, 2);
      d.procesar(estado({ tiempo: t + 30, muerto: false }), sinObjetivo, 2);
      t += 100;
      return r;
    };
    expect([morir(), morir(), morir()]).toEqual(['muerte', 'muerte', null]);
    const pronto = new DetectorMomentos();
    pronto.procesar(estado({ tiempo: 40, muerto: true, reaparece: 10 }), sinObjetivo, 6);
    expect(pronto.procesar(estado({ tiempo: 45, muerto: true, reaparece: 10 }), sinObjetivo, 6)).toBeNull();
    const arena = new DetectorMomentos();
    arena.procesar(estado({ tiempo: 600, modo: 'arena', muerto: true, reaparece: 30 }), sinObjetivo, 6);
    expect(arena.procesar(estado({ tiempo: 603, modo: 'arena', muerto: true, reaparece: 27 }), sinObjetivo, 6)).toBeNull();
    const aram = new DetectorMomentos();
    aram.procesar(estado({ tiempo: 600, modo: 'aram', muerto: true, reaparece: 30 }), sinObjetivo, 6);
    expect(aram.procesar(estado({ tiempo: 603, modo: 'aram', muerto: true, reaparece: 27 }), sinObjetivo, 6)).toBe('muerte');
    const corto = new DetectorMomentos();
    corto.procesar(estado({ tiempo: 600, muerto: true, reaparece: 9 }), sinObjetivo, 6);
    expect(corto.procesar(estado({ tiempo: 603, muerto: true, reaparece: 6 }), sinObjetivo, 6)).toBeNull();
  });

  it('nunca la tienda en plena pelea', () => {
    const d = new DetectorMomentos();
    d.procesar(estado({ tiempo: 700, muerto: true, reaparece: 5, oro: 2000 }), sinObjetivo, 6);
    const pelea = estado({ tiempo: 706, muerto: false, oro: 2000, eventos: [{ nombre: 'ChampionKill', tiempo: 705, asesino: 'Ahri', victima: 'Zed' }] });
    expect(d.procesar(pelea, sinObjetivo, 6)).toBeNull();
  });
});

describe('cliente del coach con IA', () => {
  const respuesta = (status: number, cuerpo: unknown) => ({ ok: status < 300, status, json: async () => cuerpo }) as Response;

  it('traduce las respuestas a códigos', async () => {
    const p = {} as never;
    const con = (r: Response | Error) => ({ urlServidor: 'http://s/', fetch: vi.fn(async () => (r instanceof Error ? Promise.reject(r) : r)) as unknown as typeof fetch });
    expect(await pedirAnalisis(p, con(respuesta(200, { analisis: ANALISIS })))).toEqual({ ok: true, datos: ANALISIS });
    expect(await pedirAnalisis(p, con(respuesta(200, { analisis: { veredicto: '' } })))).toEqual({ ok: false, error: 'no_disponible' });
    expect(await pedirAnalisis(p, con(respuesta(429, {})))).toEqual({ ok: false, error: 'limite' });
    expect(await pedirAnalisis(p, con(respuesta(503, {})))).toEqual({ ok: false, error: 'no_configurado' });
    expect(await pedirConsejo(p, con(respuesta(400, {})))).toEqual({ ok: false, error: 'no_valido' });
    expect(await pedirConsejo(p, con(new Error('red')))).toEqual({ ok: false, error: 'sin_conexion' });
    expect(await pedirConsejo(p, con(respuesta(200, { consejo: '  Compra  armadura. ' })))).toEqual({ ok: true, datos: 'Compra armadura.' });
    expect(esAnalisis(ANALISIS)).toBe(true);
  });
});

describe('historial local', () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'coach-ia-'))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  const entrada = (i: number): EntradaAnalisis => ({
    id: `id-${i}`,
    fecha: new Date(Date.UTC(2026, 9, 20, 0, i)).toISOString(),
    modo: 'clasificatoria',
    campeon: 'Ahri',
    rol: 'MIDDLE',
    resultado: 'victoria',
    duracion: 1800,
    final: { k: 1, d: 1, a: 1, cs: 100, nivel: 12, objetos: [] },
    linea: [],
    muertes: [],
    objetivos: [],
    csObjetivoMinuto: 7.5,
    analisis: ANALISIS,
  });

  it('guarda los 50 últimos, del más reciente al más antiguo, y sobrevive a un archivo dañado', () => {
    const ruta = join(dir, 'analisis.json');
    const h = crearHistorial(ruta);
    for (let i = 0; i < MAX_HISTORIAL + 5; i++) h.agregar(entrada(i));
    const otra = crearHistorial(ruta).lista();
    expect(otra).toHaveLength(MAX_HISTORIAL);
    expect(otra[0]!.id).toBe(`id-${MAX_HISTORIAL + 4}`);
    writeFileSync(ruta, '{roto', 'utf8');
    expect(crearHistorial(ruta).lista()).toEqual([]);
    expect(JSON.parse(readFileSync(ruta, 'utf8').replace('{roto', '{}'))).toEqual({});
  });
});

describe('ajustes del coach con IA', () => {
  it('por defecto encendido con 6 consejos; ajustes anteriores sin la sección los estrenan', () => {
    expect(IA_POR_DEFECTO).toEqual({ analisis: true, consejos: true, maxConsejos: 6, vozAnalisis: true, charlaPrevia: true });
    expect(normalizarAjustes({}).ia).toEqual(IA_POR_DEFECTO);
    expect(normalizarIa({ analisis: false, consejos: 'sí', maxConsejos: 20, vozAnalisis: false })).toEqual({ analisis: false, consejos: true, maxConsejos: 8, vozAnalisis: false, charlaPrevia: true });
    expect(normalizarIa({ maxConsejos: 0 }).maxConsejos).toBe(1);
  });
});

describe('frases dinámicas de la voz', () => {
  afterEach(() => olvidarDinamicas());
  it('los consejos con IA se marcan para la voz natural (nunca la pregrabada)', () => {
    expect(esDinamica('Compra armadura.')).toBe(false);
    marcarDinamica('Compra  armadura.');
    expect(esDinamica('Compra armadura.')).toBe(true);
    for (let i = 0; i < 50; i++) marcarDinamica(`frase ${i}`);
    expect(esDinamica('Compra armadura.')).toBe(false);
  });
});

describe('orquestación del coach con IA', () => {
  const resumen = { objetivos: [] } as unknown as EstadoOverlay;
  let a: Ajustes;
  let voz: FraseVoz[];
  let avisos: string[];
  let eventos: { estado: { estado: string } ; entrada?: EntradaAnalisis }[];
  let guardadas: EntradaAnalisis[];
  let fetchMock: ReturnType<typeof vi.fn>;
  let lcu: { peticion: ReturnType<typeof vi.fn> } | null;
  const dinamicas: string[] = [];

  const montar = (extra: Partial<DependenciasCoachIa> = {}) =>
    crearCoachIa({
      ajustes: () => a,
      idioma: () => 'es',
      urlServidor: () => 'http://servidor',
      fetch: fetchMock as unknown as typeof fetch,
      lcu: () => lcu as never,
      contexto: async () => ({ build: null, rol: null, objetos: {}, version: '15.20.1' }),
      historial: { lista: () => guardadas, agregar: (e) => void guardadas.unshift(e) },
      enviarVoz: (f) => voz.push(f),
      enviarAviso: (x) => avisos.push(x.texto),
      marcarDinamica: (t) => dinamicas.push(t),
      alAnalisis: (e) => eventos.push(e),
      esperar: async () => undefined,
      ahora: () => Date.UTC(2026, 9, 20, 12),
      ...extra,
    });

  beforeEach(() => {
    a = ajustes();
    voz = [];
    avisos = [];
    eventos = [];
    guardadas = [];
    dinamicas.length = 0;
    lcu = null;
    fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => (url.endsWith('/consejo') ? { consejo: 'Contra tanta curación, un objeto antiheal vale la pena.' } : { analisis: ANALISIS }),
    }));
  });

  const jugar = (c: ReturnType<typeof montar>, hasta = 1200, muerteEn = 600) => {
    for (let t = 0; t <= hasta; t += 1) {
      const muerto = t >= muerteEn && t < muerteEn + 25;
      c.alEstado(estado({ tiempo: t, muerto, reaparece: muerto ? muerteEn + 25 - t : 0 }), resumen, null);
    }
  };

  it('al morir pide un consejo, lo marca como dinámico y lo manda a la voz con prioridad normal', async () => {
    const c = montar();
    jugar(c, 700);
    await vi.waitFor(() => expect(voz).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('http://servidor/api/coach/consejo');
    const cuerpo = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(cuerpo.momento).toBe('muerte');
    expect(JSON.stringify(cuerpo)).not.toMatch(/riotId|summoner/i);
    expect(voz[0]).toMatchObject({ texto: 'Contra tanta curación, un objeto antiheal vale la pena.', tipo: 'muerte', prioridad: 4 });
    expect(dinamicas).toEqual([voz[0]!.texto]);
    // Los avisos en pantalla vienen apagados por defecto: no hay línea en el overlay.
    expect(avisos).toEqual([]);
  });

  it('con los avisos en pantalla encendidos, también sale como línea discreta; con los consejos apagados, nada', async () => {
    a = ajustes({}, false, true);
    const c = montar();
    jugar(c, 700);
    await vi.waitFor(() => expect(avisos).toHaveLength(1));
    expect(voz).toEqual([]);
    a = ajustes({ consejos: false });
    fetchMock.mockClear();
    const c2 = montar();
    jugar(c2, 700);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('al terminar (EndOfGame) lee la LCU, pide el análisis una vez, lo guarda y lo avisa', async () => {
    lcu = {
      peticion: vi
        .fn()
        .mockRejectedValueOnce(new Error('404'))
        .mockResolvedValue({ gameLength: 1210, localPlayer: { stats: { VISION_SCORE: 17 } }, teams: [{ isPlayerTeam: true, isWinningTeam: true }] }),
    };
    const c = montar();
    jugar(c, 1210);
    await c.fase('PreEndOfGame');
    await c.fase('EndOfGame');
    expect(lcu.peticion).toHaveBeenCalledWith('GET', ENDPOINT_EOG);
    const llamadas = fetchMock.mock.calls.filter((x) => String(x[0]).endsWith('/analisis'));
    expect(llamadas).toHaveLength(1);
    const cuerpo = JSON.parse((llamadas[0]![1] as RequestInit).body as string);
    expect(cuerpo).toMatchObject({ idioma: 'es', modo: 'clasificatoria', resultado: 'victoria', duracion: 1210, final: { vision: 17 } });
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]!.analisis).toEqual(ANALISIS);
    expect(eventos.map((e) => e.estado.estado)).toEqual(['analizando', 'listo']);
    expect(eventos[1]!.entrada!.version).toBe('15.20.1');
    expect(c.estado()).toEqual({ estado: 'listo', id: guardadas[0]!.id });
  });

  it('sin cliente de LoL (simulador), el evento GameEnd de la Live Client dispara el análisis', async () => {
    const c = montar();
    jugar(c, 900);
    c.alEstado(estado({ tiempo: 901, eventos: [{ nombre: 'GameEnd', tiempo: 901, resultado: 'Lose' }] }), resumen, null);
    await vi.waitFor(() => expect(guardadas).toHaveLength(1));
    expect(guardadas[0]!.resultado).toBe('derrota');
  });

  it('partidas cortas o con el análisis apagado no se analizan; un error se avisa', async () => {
    const corta = montar();
    jugar(corta, 200, 100);
    await corta.fase('EndOfGame');
    a = ajustes({ analisis: false });
    const apagado = montar();
    jugar(apagado, 900);
    await apagado.fase('EndOfGame');
    expect(fetchMock.mock.calls.filter((x) => String(x[0]).endsWith('/analisis'))).toHaveLength(0);
    a = ajustes();
    fetchMock.mockImplementation(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    const conError = montar();
    jugar(conError, 900);
    await conError.fase('EndOfGame');
    expect(eventos.at(-1)).toEqual({ estado: { estado: 'error', error: 'limite' } });
  });
});
