import { describe, expect, it } from 'vitest';
import type { Habilidad, ItemDDragonCrudo, Rol } from '@coach/shared';
import { abrirDb } from '../src/db';
import type { Participacion } from '../src/extraer';
import {
  agregarBuild,
  agregarOpciones,
  agregarOpcionesRunas,
  calcularBuilds,
  generarOrdenHabilidades,
  MAX_PARTIDAS_DATOS_LIMITADOS,
  MIN_PARTIDAS_KDA,
  MIN_PARTIDAS_PARCHE,
  MIN_PARTIDAS_PUBLICAR,
} from '../src/agregador';

const legendario = (): ItemDDragonCrudo => ({ gold: { total: 3000, purchasable: true } });
const botas = (): ItemDDragonCrudo => ({
  gold: { total: 1100, purchasable: true },
  tags: ['Boots'],
  into: undefined,
});

const OBJETOS: Record<number, ItemDDragonCrudo> = {
  3020: botas(),
  3111: botas(),
  6655: legendario(),
  3157: legendario(),
  3089: legendario(),
  3135: legendario(),
  3165: legendario(),
  3102: legendario(),
  3003: legendario(),
  3040: legendario(),
};

const HAB: Habilidad[] = ['Q', 'E', 'W', 'Q', 'Q', 'R', 'Q', 'E', 'Q', 'E', 'R', 'E', 'E', 'W', 'W', 'R', 'W', 'W'];

function part(i: number, extra: Partial<Participacion> = {}, parche = '15.20'): Participacion {
  return {
    matchId: `EUW1_${parche}_${i}`,
    campeon: 'Ahri',
    rol: 'MIDDLE' as Rol,
    victoria: i % 2 === 0,
    parche,
    runas: { estiloPrincipal: 8100, estiloSecundario: 8000, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    hechizos: [4, 14],
    iniciales: [1056, 2003],
    compras: [3020, 6655, 3157, 3089],
    habilidades: HAB,
    ...extra,
  };
}

const muchas = (n: number, parche: string, extra: Partial<Participacion> = {}) =>
  Array.from({ length: n }, (_, i) => part(i, extra, parche));

describe('generarOrdenHabilidades', () => {
  it('maximizar Q, luego E y luego W, con inicio Q,E,W', () => {
    expect(generarOrdenHabilidades([HAB, HAB, HAB])).toEqual(HAB);
  });

  it('siempre tiene 18 niveles, R en 6/11/16 y ninguna básica por encima de ceil(nivel/2)', () => {
    const raras: Habilidad[][] = [
      ['W', 'Q', 'E', 'W', 'W', 'R'],
      ['E', 'E', 'E', 'E', 'E'],
      ['Q'],
    ];
    const orden = generarOrdenHabilidades(raras);
    expect(orden).toHaveLength(18);
    const puntos: Record<string, number> = { Q: 0, W: 0, E: 0, R: 0 };
    orden.forEach((h, i) => {
      const nivel = i + 1;
      puntos[h]++;
      if ([6, 11, 16].includes(nivel)) expect(h).toBe('R');
      else {
        expect(h).not.toBe('R');
        expect(puntos[h]).toBeLessThanOrEqual(Math.ceil(nivel / 2));
        expect(puntos[h]).toBeLessThanOrEqual(5);
      }
    });
  });

  it('inicio con habilidad repetida respeta el tope ceil(nivel/2)', () => {
    const q: Habilidad[] = ['Q', 'Q', 'Q', 'W', 'Q', 'R', 'Q', 'E', 'Q', 'E', 'R', 'E', 'E', 'W', 'W', 'R', 'W', 'W'];
    const orden = generarOrdenHabilidades([q, q, q]);
    expect(orden).toHaveLength(18);
    expect(orden[0]).toBe('Q');
    const puntos: Record<string, number> = { Q: 0, W: 0, E: 0, R: 0 };
    orden.forEach((h, i) => {
      puntos[h]++;
      if (h !== 'R') expect(puntos[h]).toBeLessThanOrEqual(Math.ceil((i + 1) / 2));
    });
    expect(orden.filter((h) => h === 'R')).toHaveLength(3);
  });

  it('sin secuencias devuelve igualmente 18 niveles', () => {
    expect(generarOrdenHabilidades([])).toHaveLength(18);
  });
});

describe('agregarBuild', () => {
  it('núcleo = triple más frecuente en orden', () => {
    const ps = [
      ...muchas(3, '15.20', { compras: [3020, 6655, 3157, 3089] }),
      part(10, { compras: [3020, 3135, 3165, 3102] }),
    ];
    expect(agregarBuild(ps, OBJETOS, '15.20', false).nucleo).toEqual([6655, 3157, 3089]);
  });

  it('núcleo usa lo que haya si ninguna participación llega a 3 legendarios', () => {
    const ps = muchas(3, '15.20', { compras: [3020, 6655, 3157] });
    expect(agregarBuild(ps, OBJETOS, '15.20', false).nucleo).toEqual([6655, 3157]);
  });

  it('botas es la primera compra de botas más frecuente', () => {
    const ps = [
      ...muchas(2, '15.20', { compras: [3111, 6655, 3020] }),
      part(9, { compras: [3020, 6655] }),
    ];
    expect(agregarBuild(ps, OBJETOS, '15.20', false).botas).toBe(3111);
  });

  it('botas null si menos del 30 % compró botas', () => {
    const ps = [
      ...muchas(7, '15.20', { compras: [6655, 3157, 3089] }),
      ...muchas(2, '15.20', { compras: [3020, 6655, 3157, 3089] }),
    ];
    expect(agregarBuild(ps, OBJETOS, '15.20', false).botas).toBeNull();
  });

  it('situacionales excluye el núcleo y tiene como máximo 5', () => {
    const ps = muchas(4, '15.20', { compras: [3020, 6655, 3157, 3089, 3135, 3165, 3102, 3003, 3040] });
    const b = agregarBuild(ps, OBJETOS, '15.20', false);
    expect(b.nucleo).toEqual([6655, 3157, 3089]);
    expect(b.situacionales).toHaveLength(5);
    expect(b.situacionales).toEqual([3135, 3165, 3102, 3003, 3040]);
    for (const id of b.nucleo) expect(b.situacionales).not.toContain(id);
  });

  it('tasaVictoria = victorias / partidas', () => {
    const ps = [
      part(1, { victoria: true }),
      part(2, { victoria: false }),
      part(3, { victoria: false }),
      part(4, { victoria: false }),
    ];
    const b = agregarBuild(ps, OBJETOS, '15.20', true, new Date('2026-10-18T00:00:00Z'));
    expect(b.tasaVictoria).toBe(0.25);
    expect(b.partidas).toBe(4);
    expect(b.mezclaParches).toBe(true);
    expect(b.calculadoEn).toBe('2026-10-18T00:00:00.000Z');
    expect(b.runas.runas).toHaveLength(9);
    expect(b.hechizos).toEqual([4, 14]);
    expect(b.objetosIniciales).toEqual([1056, 2003]);
  });

  it('moda de objetos iniciales compara el array ordenado como JSON', () => {
    const ps = [
      part(1, { iniciales: [1055] }),
      part(2, { iniciales: [1056, 2003] }),
      part(3, { iniciales: [1056, 2003] }),
    ];
    expect(agregarBuild(ps, OBJETOS, '15.20', false).objetosIniciales).toEqual([1056, 2003]);
  });
});

describe('calcularBuilds', () => {
  it('250 partidas del parche actual → mezclaParches false', () => {
    const db = abrirDb(':memory:');
    db.guardarParticipaciones('EUW', muchas(250, '15.20'));
    expect(calcularBuilds(db, OBJETOS, '15.20', '15.19')).toBe(1);
    const b = db.build('Ahri', 'MIDDLE')!;
    expect(b.mezclaParches).toBe(false);
    expect(b.partidas).toBe(250);
    expect(b.parche).toBe('15.20');
    expect(MIN_PARTIDAS_PARCHE).toBe(200);
    db.cerrar();
  });

  it('150 actuales + 100 anteriores → mezclaParches true y partidas 250', () => {
    const db = abrirDb(':memory:');
    db.guardarParticipaciones('EUW', [...muchas(150, '15.20'), ...muchas(100, '15.19')]);
    expect(calcularBuilds(db, OBJETOS, '15.20', '15.19')).toBe(1);
    const b = db.build('Ahri', 'MIDDLE')!;
    expect(b.mezclaParches).toBe(true);
    expect(b.partidas).toBe(250);
    expect(b.parche).toBe('15.20');
    db.cerrar();
  });

  it('9 en total → no guarda build', () => {
    const db = abrirDb(':memory:');
    db.guardarParticipaciones('EUW', [...muchas(5, '15.20'), ...muchas(4, '15.19')]);
    expect(calcularBuilds(db, OBJETOS, '15.20', '15.19')).toBe(0);
    expect(db.build('Ahri', 'MIDDLE')).toBeNull();
    expect(MIN_PARTIDAS_PUBLICAR).toBe(10);
    db.cerrar();
  });

  it('12 en total → se publica, con «datos limitados»', () => {
    const db = abrirDb(':memory:');
    db.guardarParticipaciones('EUW', [...muchas(7, '15.20'), ...muchas(5, '15.19')]);
    expect(calcularBuilds(db, OBJETOS, '15.20', '15.19')).toBe(1);
    const b = db.build('Ahri', 'MIDDLE')!;
    expect(b.partidas).toBe(12);
    expect(b.datosLimitados).toBe(true);
    db.cerrar();
  });

  it('el umbral de datos limitados son 30 partidas', () => {
    expect(MAX_PARTIDAS_DATOS_LIMITADOS).toBe(30);
    const ps = (n: number) => Array.from({ length: n }, (_, i) => part(i));
    expect(agregarBuild(ps(29), OBJETOS, '15.20', false).datosLimitados).toBe(true);
    expect(agregarBuild(ps(30), OBJETOS, '15.20', false).datosLimitados).toBe(false);
  });
});

describe('agregarOpciones: hasta 3 builds por campeón y rol', () => {
  const NUCLEO_A = [3020, 6655, 3157, 3089];
  const NUCLEO_B = [3020, 3135, 3165, 3102];
  const NUCLEO_C = [3111, 3003, 3040, 6655];
  /** n partidas con unas compras y una tasa de victorias exacta (victorias primero). */
  const grupo = (desde: number, n: number, compras: number[], victorias: number) =>
    Array.from({ length: n }, (_, i) => part(desde + i, { compras, victoria: i < victorias }));

  it('tres núcleos distintos → 3 opciones ordenadas por partidas, cada una con su tasa de victorias y popularidad', () => {
    const ps = [...grupo(0, 60, NUCLEO_A, 30), ...grupo(100, 100, NUCLEO_B, 40), ...grupo(300, 40, NUCLEO_C, 30)];
    const op = agregarOpciones(ps, OBJETOS, '15.20', false);
    expect(op).toHaveLength(3);
    expect(op.map((b) => b.nucleo)).toEqual([[3135, 3165, 3102], [6655, 3157, 3089], [3003, 3040, 6655]]);
    expect(op.map((b) => b.partidas)).toEqual([100, 60, 40]);
    expect(op.map((b) => b.tasaVictoria)).toEqual([0.4, 0.5, 0.75]);
    expect(op.map((b) => b.popularidad)).toEqual([0.5, 0.3, 0.2]);
    expect(op[2]!.botas).toBe(3111);
    for (const b of op) expect(b.opciones).toBeUndefined();
  });

  it('descarta los grupos por debajo de max(10, 5 % del total) y como mucho devuelve max', () => {
    const ps = [
      ...grupo(0, 300, NUCLEO_A, 150),
      ...grupo(1000, 30, NUCLEO_B, 15), // 30 < 5 % de 345 (17,25)? no: 30 ≥ 17,25 → entra
      ...grupo(2000, 15, NUCLEO_C, 10), // 15 < 17,25 → fuera
    ];
    const op = agregarOpciones(ps, OBJETOS, '15.20', false);
    expect(op.map((b) => b.partidas)).toEqual([300, 30]);
    const pocas = [...grupo(0, 25, NUCLEO_A, 10), ...grupo(100, 9, NUCLEO_B, 5)]; // 9 < 10 → fuera
    expect(agregarOpciones(pocas, OBJETOS, '15.20', false).map((b) => b.partidas)).toEqual([25]);
    expect(agregarOpciones([...grupo(0, 50, NUCLEO_A, 1), ...grupo(100, 50, NUCLEO_B, 1)], OBJETOS, '15.20', false, 1)).toHaveLength(1);
  });

  it('si ningún grupo llega al mínimo, la build global de v1 es la única opción', () => {
    // 3 núcleos de 8 partidas y 6 partidas con solo 2 legendarios: ningún grupo llega a 10.
    const ps = [
      ...grupo(0, 8, NUCLEO_A, 4),
      ...grupo(100, 8, NUCLEO_B, 4),
      ...grupo(200, 8, NUCLEO_C, 4),
      ...grupo(300, 6, [3020, 6655, 3157], 3),
    ];
    const op = agregarOpciones(ps, OBJETOS, '15.20', true);
    expect(op).toHaveLength(1);
    const global = agregarBuild(ps, OBJETOS, '15.20', true, new Date(op[0]!.calculadoEn));
    expect(op[0]).toEqual({ ...global, popularidad: 1 });
  });

  it('calcularBuilds guarda arriba la build GLOBAL (v1: todas las partidas) y las 1-3 opciones en `opciones`', async () => {
    const db = abrirDb(':memory:');
    db.guardarParticipaciones('EUW', [...grupo(0, 150, NUCLEO_A, 75), ...grupo(1000, 100, NUCLEO_B, 60)].map((p) => ({ ...p, parche: '15.20' })));
    expect(calcularBuilds(db, OBJETOS, '15.20', '15.19')).toBe(1);
    const b = db.build('Ahri', 'MIDDLE')!;
    // Nivel superior con la semántica de v1: todas las partidas del campeón y rol.
    expect(b.partidas).toBe(250);
    expect(b.tasaVictoria).toBe(135 / 250);
    expect(b.nucleo).toEqual([6655, 3157, 3089]);
    expect(b.popularidad).toBe(1);
    // Las opciones, de más a menos jugada; la primera ya no es igual al nivel superior.
    expect(b.opciones?.map((o) => o.nucleo)).toEqual([[6655, 3157, 3089], [3135, 3165, 3102]]);
    expect(b.opciones?.map((o) => o.partidas)).toEqual([150, 100]);
    expect(b.opciones?.[1]?.tasaVictoria).toBe(0.6);
    const { opciones, ...arriba } = b;
    expect(opciones?.[0]).not.toEqual(arriba);
    for (const o of opciones ?? []) expect(o.opciones).toBeUndefined();
    db.cerrar();
  });

});

describe('agregarBuild: KDA medio', () => {
  const conKda = (i: number, k: number, d: number, a: number) => part(i, { asesinatos: k, muertes: d, asistencias: a });

  it('media de asesinatos, muertes y asistencias, y su ratio (K + A) / máx(1, D)', () => {
    const ps = Array.from({ length: 10 }, (_, i) => (i < 5 ? conKda(i, 6, 3, 8) : conKda(i, 4, 5, 6)));
    const b = agregarBuild(ps, OBJETOS, '15.20', false);
    expect(b.kda).toEqual({ asesinatos: 5, muertes: 4, asistencias: 7, ratio: 3 });
  });

  it('solo cuenta las participaciones que tienen el dato', () => {
    const ps = [...Array.from({ length: MIN_PARTIDAS_KDA }, (_, i) => conKda(i, 2, 0, 3)), ...Array.from({ length: 5 }, (_, i) => part(100 + i))];
    const b = agregarBuild(ps, OBJETOS, '15.20', false);
    // Sin muertes, el ratio divide entre 1.
    expect(b.kda).toEqual({ asesinatos: 2, muertes: 0, asistencias: 3, ratio: 5 });
  });

  it('con menos de 10 participaciones con datos, kda es null', () => {
    const ps = [...Array.from({ length: MIN_PARTIDAS_KDA - 1 }, (_, i) => conKda(i, 2, 1, 3)), ...Array.from({ length: 20 }, (_, i) => part(100 + i))];
    expect(agregarBuild(ps, OBJETOS, '15.20', false).kda).toBeNull();
  });

  it('redondea las medias a una décima y el ratio a dos', () => {
    const ps = Array.from({ length: 12 }, (_, i) => conKda(i, i % 3, 1 + (i % 2), 5));
    const b = agregarBuild(ps, OBJETOS, '15.20', false);
    expect(b.kda).toEqual({ asesinatos: 1, muertes: 1.5, asistencias: 5, ratio: 4 });
    const otra = agregarBuild(Array.from({ length: 10 }, (_, i) => conKda(i, i < 3 ? 1 : 0, 3, i < 1 ? 1 : 0)), OBJETOS, '15.20', false);
    expect(otra.kda).toEqual({ asesinatos: 0.3, muertes: 3, asistencias: 0.1, ratio: 0.13 });
  });

  it('cada opción lleva su propio KDA', () => {
    const ps = Array.from({ length: 20 }, (_, i) => conKda(i, 3, 3, 3));
    for (const o of agregarOpciones(ps, OBJETOS, '15.20', false)) expect(o.kda).toEqual({ asesinatos: 3, muertes: 3, asistencias: 3, ratio: 2 });
  });
});

describe('agregarOpcionesRunas: páginas de runas elegibles (3.0.1)', () => {
  const pagina = (clave: number, secundario: number, resto: number[] = [2, 3, 4, 5, 6, 7, 8, 9]) => ({
    estiloPrincipal: 8100,
    estiloSecundario: secundario,
    runas: [clave, ...resto],
  });
  /** n partidas con una página y una cantidad exacta de victorias (victorias primero). */
  const grupo = (desde: number, n: number, runas: ReturnType<typeof pagina>, victorias: number) =>
    Array.from({ length: n }, (_, i) => part(desde + i, { runas, victoria: i < victorias }));

  it('agrupa por runa clave y rama secundaria, de más a menos jugada, con sus cifras', () => {
    const ps = [
      ...grupo(0, 40, pagina(8112, 8000), 20),
      ...grupo(100, 100, pagina(8128, 8200), 60),
      ...grupo(300, 20, pagina(8112, 8300), 15),
      ...grupo(400, 40, pagina(8112, 8000), 20), // mismo grupo que el primero: 80 en total
    ];
    const op = agregarOpcionesRunas(ps);
    expect(op.map((o) => [o.runas.runas[0], o.runas.estiloSecundario])).toEqual([[8128, 8200], [8112, 8000], [8112, 8300]]);
    expect(op.map((o) => o.partidas)).toEqual([100, 80, 20]);
    expect(op.map((o) => o.tasaVictoria)).toEqual([0.6, 0.5, 0.75]);
    expect(op.map((o) => o.popularidad)).toEqual([0.5, 0.4, 0.1]);
    expect(op.map((o) => o.datosLimitados)).toEqual([false, false, true]);
  });

  it('dentro de cada grupo toma la página completa más habitual (secundarias y fragmentos incluidos)', () => {
    const comun = pagina(8112, 8000, [8126, 8138, 8135, 8226, 8210, 5008, 5008, 5001]);
    const rara = pagina(8112, 8000, [8139, 8138, 8135, 8234, 8237, 5005, 5008, 5011]);
    const ps = [...grupo(0, 7, rara, 0), ...grupo(100, 12, comun, 0)];
    const [o] = agregarOpcionesRunas(ps);
    expect(o!.runas).toEqual(comun);
    expect(o!.partidas).toBe(19);
  });

  it('descarta los grupos de menos de 10 partidas, como mucho 3 y sin páginas vacías', () => {
    const ps = [
      ...grupo(0, 30, pagina(8112, 8000), 10),
      ...grupo(100, 9, pagina(8128, 8000), 5), // 9 < 10 → fuera
      ...grupo(200, 20, pagina(8010, 8000), 5),
      ...grupo(300, 15, pagina(8021, 8000), 5),
      ...grupo(400, 12, pagina(8230, 8000), 5), // cuarto grupo válido → fuera por el máximo
      ...Array.from({ length: 50 }, (_, i) => part(600 + i, { runas: { estiloPrincipal: 0, estiloSecundario: 0, runas: [] } })),
    ];
    const op = agregarOpcionesRunas(ps);
    expect(op.map((o) => o.partidas)).toEqual([30, 20, 15]);
    expect(op[0]!.datosLimitados).toBe(false); // 30 ya no es «datos limitados»
    expect(agregarOpcionesRunas(grupo(0, 9, pagina(8112, 8000), 1))).toEqual([]);
  });

  it('calcularBuilds publica `opcionesRunas` en la build de nivel superior (no en cada opción de objetos)', () => {
    const db = abrirDb(':memory:');
    db.guardarParticipaciones('EUW', [...grupo(0, 30, pagina(8112, 8000), 15), ...grupo(100, 15, pagina(8128, 8200), 10)]);
    calcularBuilds(db, OBJETOS, '15.20', '15.19');
    const b = db.build('Ahri', 'MIDDLE')!;
    expect(b.opcionesRunas?.map((o) => o.partidas)).toEqual([30, 15]);
    expect(b.opcionesRunas?.[1]?.runas.runas[0]).toBe(8128);
    for (const o of b.opciones ?? []) expect(o.opcionesRunas).toBeUndefined();
    db.cerrar();
  });

  it('sin ningún grupo de 10 partidas, la build no lleva el campo (los clientes usan las runas de cada opción)', () => {
    const db = abrirDb(':memory:');
    db.guardarParticipaciones('EUW', [...grupo(0, 6, pagina(8112, 8000), 3), ...grupo(100, 6, pagina(8128, 8200), 3)]);
    calcularBuilds(db, OBJETOS, '15.20', '15.19');
    expect(db.build('Ahri', 'MIDDLE')).not.toHaveProperty('opcionesRunas');
    db.cerrar();
  });
});
