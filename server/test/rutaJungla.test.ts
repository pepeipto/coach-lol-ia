import { describe, expect, it } from 'vitest';
import {
  agregarRuta,
  calleCercana,
  ladoInicio,
  MIN_PARTIDAS_RUTA,
  primerGank,
  rutaDePartida,
  type RutaPartida,
} from '../src/rutaJungla';
import type { LineaTiempoRiot } from '../src/riot/riotApi';

/*
 * Posiciones de referencia de la Grieta (0..14870; el lado azul, ORDER (100), abajo a la izquierda).
 * Bufos y campamentos aproximados de los mapas de la comunidad; las calles, por sus torres.
 */
const AZUL_ORDER = { x: 3821, y: 8101 }; // bufo azul del lado azul (arriba del río de mid)
const ROJO_ORDER = { x: 7762, y: 4011 }; // bufo rojo del lado azul (abajo)
const AZUL_CHAOS = { x: 11031, y: 6990 };
const ROJO_CHAOS = { x: 7101, y: 10900 };
const FUENTE_ORDER = { x: 400, y: 420 };
const GROMP_ORDER = { x: 2288, y: 8448 };
const KRUGS_ORDER = { x: 8394, y: 2641 };
const GROMP_CHAOS = { x: 12703, y: 6444 };
const KRUGS_CHAOS = { x: 6476, y: 12142 };
const AVES_ORDER = { x: 7061, y: 5325 };
const AVES_CHAOS = { x: 7852, y: 9425 };
const TOP = { x: 1300, y: 11500 }; // calle de arriba, cerca de la torre exterior azul
const ESQUINA_TOP = { x: 1500, y: 13300 };
const MID = { x: 7400, y: 7300 };
const BOT = { x: 12000, y: 1300 }; // calle de abajo
const ESQUINA_BOT = { x: 13500, y: 1600 };

describe('geometría de la Grieta', () => {
  it('a ~300 unidades de los Aves y del Gromp (los dos lados), hacia la calle más cercana, sigue siendo jungla', () => {
    const d = 300 / Math.SQRT2;
    const cerca = [
      { x: AVES_ORDER.x - d, y: AVES_ORDER.y + d }, // hacia mid
      { x: AVES_CHAOS.x + d, y: AVES_CHAOS.y - d }, // hacia mid
      { x: AVES_ORDER.x + 300, y: AVES_ORDER.y },
      { x: AVES_CHAOS.x, y: AVES_CHAOS.y - 300 },
      { x: GROMP_ORDER.x - 300, y: GROMP_ORDER.y }, // hacia top
      { x: GROMP_CHAOS.x + 300, y: GROMP_CHAOS.y }, // hacia bot
      { x: GROMP_ORDER.x, y: GROMP_ORDER.y + 300 },
      { x: GROMP_CHAOS.x, y: GROMP_CHAOS.y - 300 },
    ];
    for (const p of cerca) expect(calleCercana(p), JSON.stringify(p)).toBeNull();
  });

  it('mid tiene un pasillo más estrecho que las calles de los lados', () => {
    const d = 700 / Math.SQRT2;
    expect(calleCercana({ x: 7400 - d, y: 7400 + d })).toBeNull(); // 700 de mid
    expect(calleCercana({ x: 7400 - 350, y: 7400 + 350 })).toBe('mid'); // ~495
    expect(calleCercana({ x: 1100 + 700, y: 9000 })).toBe('top'); // ~650 de top
  });

  it('el lado de inicio es relativo al equipo: arriba del río de mid el azul para ORDER y el rojo para CHAOS', () => {
    expect(ladoInicio(AZUL_ORDER, 100)).toBe('azul');
    expect(ladoInicio(ROJO_ORDER, 100)).toBe('rojo');
    expect(ladoInicio(AZUL_CHAOS, 200)).toBe('azul');
    expect(ladoInicio(ROJO_CHAOS, 200)).toBe('rojo');
  });

  it('en la base, en el río o en la jungla rival no hay lado de inicio', () => {
    expect(ladoInicio(FUENTE_ORDER, 100)).toBeNull();
    expect(ladoInicio({ x: 7435, y: 7435 }, 100)).toBeNull(); // centro del mapa
    expect(ladoInicio(AZUL_CHAOS, 100)).toBeNull(); // invasión
  });

  it('cerca de cada calle (también en las esquinas), y ningún campamento cuenta como calle', () => {
    expect(calleCercana(TOP)).toBe('top');
    expect(calleCercana(ESQUINA_TOP)).toBe('top');
    expect(calleCercana(MID)).toBe('mid');
    expect(calleCercana(BOT)).toBe('bot');
    expect(calleCercana(ESQUINA_BOT)).toBe('bot');
    for (const c of [AZUL_ORDER, ROJO_ORDER, AZUL_CHAOS, ROJO_CHAOS, GROMP_ORDER, KRUGS_ORDER, GROMP_CHAOS, KRUGS_CHAOS, AVES_ORDER, AVES_CHAOS, FUENTE_ORDER]) {
      expect(calleCercana(c), JSON.stringify(c)).toBeNull();
    }
  });
});

/** Línea de tiempo con la posición del jungla (participante 2) en cada minuto. */
function linea(posiciones: ({ x: number; y: number } | null)[], participante = 2): LineaTiempoRiot {
  return {
    info: {
      frames: posiciones.map((p, m) => ({
        timestamp: m * 60_000 + 30,
        events: [],
        participantFrames: p ? { [String(participante)]: { position: p } } : {},
      })),
    },
  };
}

describe('ruta de una partida', () => {
  it('inicio por el minuto 1 y primer gank en el primer minuto (2 a 4) cerca de una calle', () => {
    const l = linea([FUENTE_ORDER, ROJO_ORDER, KRUGS_ORDER, BOT, MID]);
    expect(rutaDePartida(l, 2, 100)).toEqual({ inicio: 'rojo', primerGank: { calle: 'bot', minuto: 3 } });
  });

  it('si en el minuto 1 sigue en la base, el lado sale del minuto 2', () => {
    const l = linea([FUENTE_ORDER, FUENTE_ORDER, AZUL_ORDER, GROMP_ORDER, TOP]);
    expect(rutaDePartida(l, 2, 100)).toEqual({ inicio: 'azul', primerGank: { calle: 'top', minuto: 4 } });
  });

  it('el lado rojo (CHAOS) con su propio lado; sin gank hasta el minuto 4 → null', () => {
    const l = linea([null, AZUL_CHAOS, GROMP_CHAOS, AVES_CHAOS, KRUGS_CHAOS], 7);
    expect(rutaDePartida(l, 7, 200)).toEqual({ inicio: 'azul', primerGank: null });
  });

  it('el primer gank solo mira los minutos 2 a 4 (un paso por la calle en el 1 o el 5 no cuenta)', () => {
    expect(primerGank(linea([FUENTE_ORDER, MID, ROJO_ORDER, KRUGS_ORDER, AVES_ORDER, BOT]), 2)).toBeNull();
    expect(primerGank(linea([FUENTE_ORDER, ROJO_ORDER, MID]), 2)).toEqual({ calle: 'mid', minuto: 2 });
  });

  it('sin posiciones (línea de tiempo antigua o vacía) → null', () => {
    expect(rutaDePartida(linea([null, null, null]), 2, 100)).toBeNull();
    expect(rutaDePartida({ info: { frames: [{ events: [] }] } } as LineaTiempoRiot, 2, 100)).toBeNull();
  });
});

describe('agregarRuta', () => {
  const muchas = (n: number, r: RutaPartida) => Array.from({ length: n }, () => r);

  it(`solo se publica con al menos ${MIN_PARTIDAS_RUTA} partidas`, () => {
    expect(MIN_PARTIDAS_RUTA).toBe(30);
    expect(agregarRuta(muchas(29, { inicio: 'rojo', primerGank: { calle: 'bot', minuto: 3 } }))).toBeNull();
    expect(agregarRuta(muchas(30, { inicio: 'rojo', primerGank: { calle: 'bot', minuto: 3 } }))).toEqual({
      inicio: 'rojo',
      primerGank: { calle: 'bot', minuto: 3 },
      partidas: 30,
    });
  });

  it('el lado más frecuente y la calle del primer gank más frecuente con su minuto mediano', () => {
    const rutas = [
      ...muchas(20, { inicio: 'azul', primerGank: { calle: 'top', minuto: 3 } }),
      ...muchas(8, { inicio: 'azul', primerGank: { calle: 'top', minuto: 4 } }),
      ...muchas(5, { inicio: 'rojo', primerGank: { calle: 'mid', minuto: 2 } }),
      ...muchas(7, { inicio: null, primerGank: null }),
    ];
    expect(agregarRuta(rutas)).toEqual({ inicio: 'azul', primerGank: { calle: 'top', minuto: 3 }, partidas: 40 });
  });

  it('sin un lado claro (menos del 60 %) o sin gank frecuente (menos del 25 %), null en esa parte', () => {
    const rutas = [
      ...muchas(16, { inicio: 'azul', primerGank: null }),
      ...muchas(14, { inicio: 'rojo', primerGank: null }),
      ...muchas(5, { inicio: 'rojo', primerGank: { calle: 'bot', minuto: 3 } }),
      ...muchas(5, { inicio: 'azul', primerGank: { calle: 'mid', minuto: 3 } }),
    ];
    expect(agregarRuta(rutas)).toEqual({ inicio: null, primerGank: null, partidas: 40 });
  });

  it('la mediana de un número par de minutos es la media de los dos centrales', () => {
    const rutas = [
      ...muchas(15, { inicio: 'rojo', primerGank: { calle: 'bot', minuto: 3 } }),
      ...muchas(15, { inicio: 'rojo', primerGank: { calle: 'bot', minuto: 4 } }),
    ];
    expect(agregarRuta(rutas)?.primerGank).toEqual({ calle: 'bot', minuto: 3.5 });
  });
});

describe('integración: extracción, agregación y GET /jungla/ruta/:campeon', () => {
  it('la participación del jungla de clasificatoria guarda su ruta (equipo por teamId o por participantId)', async () => {
    const { extraerParticipaciones } = await import('../src/extraer');
    const partidaJson = (await import('./fixtures/partida.json')).default;
    const p = structuredClone(partidaJson) as unknown as import('../src/riot/riotApi').PartidaRiot;
    p.info.participants[1] = { ...p.info.participants[1]!, teamPosition: 'JUNGLE', championName: 'LeeSin' };
    const l = linea([FUENTE_ORDER, ROJO_ORDER, KRUGS_ORDER, BOT]);
    const ps = extraerParticipaciones(p, l, {});
    expect(ps.find((x) => x.rol === 'JUNGLE')?.rutaJungla).toEqual({ inicio: 'rojo', primerGank: { calle: 'bot', minuto: 3 } });
    // Los demás roles no llevan ruta.
    expect(ps.find((x) => x.rol === 'MIDDLE')).not.toHaveProperty('rutaJungla');
    // Sin posiciones en la línea de tiempo no hay ruta.
    expect(extraerParticipaciones(p, linea([null, null]), {}).find((x) => x.rol === 'JUNGLE')).not.toHaveProperty('rutaJungla');
  });

  it('calcularBuilds publica la ruta en la build del jungla con 30 partidas o más, y la API la sirve', async () => {
    const { abrirDb } = await import('../src/db');
    const { calcularBuilds } = await import('../src/agregador');
    const { crearServidor } = await import('../src/http');
    const db = abrirDb(':memory:');
    const part = (i: number, campeon: string, ruta?: RutaPartida) => ({
      matchId: `J${campeon}${i}`,
      campeon,
      rol: 'JUNGLE' as const,
      victoria: i % 2 === 0,
      parche: '15.20',
      runas: { estiloPrincipal: 8100, estiloSecundario: 8000, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
      hechizos: [4, 11] as [number, number],
      iniciales: [1101],
      compras: [],
      habilidades: ['Q', 'W', 'E'] as ('Q' | 'W' | 'E')[],
      ...(ruta ? { rutaJungla: ruta } : {}),
    });
    db.guardarParticipaciones('EUW', [
      ...Array.from({ length: 30 }, (_, i) => part(i, 'LeeSin', { inicio: 'rojo', primerGank: { calle: 'bot', minuto: 3 } })),
      ...Array.from({ length: 25 }, (_, i) => part(i, 'Vi', { inicio: 'azul', primerGank: null })),
      ...Array.from({ length: 10 }, (_, i) => part(100 + i, 'Vi')), // partidas antiguas sin ruta
    ]);
    await calcularBuilds(db, {}, '15.20', '15.19');
    expect(db.build('LeeSin', 'JUNGLE')?.rutaJungla).toEqual({ inicio: 'rojo', primerGank: { calle: 'bot', minuto: 3 }, partidas: 30 });
    expect(db.build('Vi', 'JUNGLE')).not.toBeNull();
    expect(db.build('Vi', 'JUNGLE')).not.toHaveProperty('rutaJungla'); // 25 partidas con ruta: no llega a 30

    const app = crearServidor(db);
    try {
      const ok = await app.inject({ method: 'GET', url: '/jungla/ruta/leesin' });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toEqual({ inicio: 'rojo', primerGank: { calle: 'bot', minuto: 3 }, partidas: 30 });
      for (const campeon of ['Vi', 'Ahri']) {
        const r = await app.inject({ method: 'GET', url: `/jungla/ruta/${campeon}` });
        expect(r.statusCode).toBe(404);
        expect(r.json()).toEqual({ error: 'sin_datos' });
      }
    } finally {
      await app.close();
      db.cerrar();
    }
  });
});
