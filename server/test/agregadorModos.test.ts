import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ItemDDragonCrudo, ModoJuego } from '@coach/shared';
import { agregarArena, agregarBuild, calcularBuilds, elementosPopulares } from '../src/agregador';
import { abrirDb, type Db } from '../src/db';
import type { Participacion } from '../src/extraer';

const OBJETOS: Record<number, ItemDDragonCrudo> = {
  3020: { gold: { total: 1100, purchasable: true }, tags: ['Boots'], from: ['1001'] },
  6655: { gold: { total: 2900, purchasable: true }, maps: { '11': true } },
  3157: { gold: { total: 3000, purchasable: true }, maps: { '11': true } },
  3089: { gold: { total: 3500, purchasable: true }, maps: { '11': true } },
};

let n = 0;
function p(modo: ModoJuego, extra: Partial<Participacion> = {}): Participacion {
  return {
    matchId: `M${n++}`,
    campeon: 'Ahri',
    rol: modo === 'clasificatoria' ? 'MIDDLE' : null,
    modo,
    victoria: true,
    parche: '15.20',
    runas: { estiloPrincipal: 8100, estiloSecundario: 8200, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    hechizos: [4, 14],
    iniciales: [1056],
    compras: [3020, 6655, 3157, 3089],
    habilidades: ['Q', 'W', 'E'],
    ...extra,
  };
}

/** Campos con cifras de rendimiento que la política de Riot no permite para aumentos ni objetos de Arena. */
const PROHIBIDOS = ['aumentos', 'aumentosMejores', 'objetosArena', 'objetosArenaMejores'];

/** Ninguna cifra de victorias ni de posición en los aumentos u objetos de Arena de la build ni de sus opciones. */
function sinRendimientoDeElementos(b: object): void {
  for (const x of [b, ...((b as { opciones?: object[] }).opciones ?? [])]) {
    for (const campo of PROHIBIDOS) expect(x).not.toHaveProperty(campo);
    const r = x as { aumentosPopulares?: object[]; objetosArenaPopulares?: object[] };
    for (const e of [...(r.aumentosPopulares ?? []), ...(r.objetosArenaPopulares ?? [])]) {
      expect(Object.keys(e).sort()).toEqual(['id', 'partidas', 'uso']);
    }
  }
}

describe('elementosPopulares', () => {
  it('cuenta solo el uso (sin victorias ni posición media); de más a menos elegidos', () => {
    const ps = [
      p('arena', { aumentos: [1, 2], posicion: 1, victoria: true }),
      p('arena', { aumentos: [2], posicion: 5, victoria: false }),
      p('arena', { aumentos: [2, 3], posicion: 3, victoria: false }),
      p('arena', { aumentos: [], posicion: 8, victoria: false }),
    ];
    const e = elementosPopulares(ps, (x) => x.aumentos ?? []);
    expect(e.map((x) => x.id)).toEqual([2, 1, 3]);
    expect(e[0]).toEqual({ id: 2, partidas: 3, uso: 0.75 });
  });

  it('un id repetido en la misma partida cuenta una vez', () => {
    const e = elementosPopulares([p('caos', { aumentos: [7, 7] }), p('caos', { aumentos: [] })], (x) => x.aumentos ?? []);
    expect(e).toEqual([{ id: 7, partidas: 1, uso: 0.5 }]);
  });
});

describe('agregarArena', () => {
  it('posición media, top 4 y victorias (1.º) del campeón; objetos y aumentos solo por uso', () => {
    const ps = [1, 2, 4, 5, 8].map((posicion) =>
      p('arena', { posicion, victoria: posicion === 1, aumentos: [10], compras: [3089], habilidades: [], iniciales: [] }),
    );
    const b = agregarArena(ps, '15.20', false, new Date('2026-10-19T00:00:00Z'));
    expect(b).toMatchObject({ campeon: 'Ahri', rol: null, modo: 'arena', partidas: 5, tasaVictoria: 0.2, datosLimitados: true });
    expect(b.arena).toEqual({ posicionMedia: 4, top4: 0.6, victorias: 0.2 });
    expect(b.objetosArenaPopulares?.[0]).toEqual({ id: 3089, partidas: 5, uso: 1 });
    expect(b.aumentosPopulares?.[0]).toEqual({ id: 10, partidas: 5, uso: 1 });
    sinRendimientoDeElementos(b);
    expect(b.ordenHabilidades).toEqual([]);
    expect(b.nucleo).toEqual([]);
  });
});

describe('calcularBuilds por modo', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  it('guarda una build por modo: clasificatoria por rol y el resto por campeón', async () => {
    const ps = [
      ...Array.from({ length: 12 }, () => p('clasificatoria')),
      ...Array.from({ length: 11 }, () => p('aram')),
      ...Array.from({ length: 10 }, () => p('caos', { aumentos: [1205, 1141] })),
      ...Array.from({ length: 10 }, (_, i) => p('arena', { posicion: (i % 8) + 1, aumentos: [5], compras: [3089], habilidades: [] })),
      ...Array.from({ length: 3 }, () => p('arena', { campeon: 'Zed', posicion: 1 })),
    ];
    db.guardarParticipaciones('EUW', ps);
    const guardadas = await calcularBuilds(db, OBJETOS, '15.20', '15.19');
    expect(guardadas).toBe(4);
    expect(db.build('Ahri', 'MIDDLE')).toMatchObject({ partidas: 12, rol: 'MIDDLE' });
    expect(db.build('Ahri', 'MIDDLE')!.modo).toBeUndefined(); // como en v1, para los clientes antiguos
    const aram = db.build('Ahri', null, 'aram')!;
    expect(aram).toMatchObject({ partidas: 11, rol: null, modo: 'aram' });
    expect(aram.aumentosPopulares).toBeUndefined();
    expect(aram.ordenHabilidades).toHaveLength(18);
    expect(db.build('Ahri', null, 'caos')!.aumentosPopulares?.map((a) => a.id)).toEqual([1141, 1205]); // empate: por id
    for (const modo of ['caos', 'arena'] as const) sinRendimientoDeElementos(db.build('Ahri', null, modo)!);
    expect(db.build('Ahri', null, 'arena')!.arena?.top4).toBe(0.6);
    expect(db.build('Zed', null, 'arena')).toBeNull(); // menos de 10 partidas
    // Páginas de runas elegibles: en clasificatoria, ARAM y ARAM: Caos; Arena no tiene runas.
    expect(db.build('Ahri', 'MIDDLE')!.opcionesRunas).toHaveLength(1);
    expect(aram.opcionesRunas?.[0]).toMatchObject({ partidas: 11, datosLimitados: true });
    expect(db.build('Ahri', null, 'caos')!.opcionesRunas?.[0]?.partidas).toBe(10);
    expect(db.build('Ahri', null, 'arena')!.opcionesRunas).toBeUndefined();
  });
});

describe('aumentos en cada opción, sin % de victorias (política de Riot)', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  it('ARAM: Caos con opciones: cada opción lleva los aumentos más elegidos, sin lista de «mejores»', async () => {
    const ps = [
      ...Array.from({ length: 12 }, (_, i) => p('caos', { aumentos: [1205], victoria: i < 3 })),
      ...Array.from({ length: 12 }, () => p('caos', { aumentos: [1141], compras: [3089, 3157, 6655] })),
    ];
    db.guardarParticipaciones('EUW', ps);
    await calcularBuilds(db, OBJETOS, '15.20', '15.19');
    const b = db.build('Ahri', null, 'caos')!;
    expect(b.opciones!.length).toBeGreaterThan(1);
    for (const o of b.opciones!) {
      expect(o.modo).toBe('caos');
      expect(o.aumentosPopulares?.map((a) => a.id)).toEqual([1141, 1205]);
    }
    sinRendimientoDeElementos(b);
  });

  it('Arena: ni aumentos ni objetos llevan victorias, posición media ni lista de «mejores»', () => {
    const ps = [
      ...Array.from({ length: 5 }, () => p('arena', { aumentos: [1], posicion: 4 })),
      ...Array.from({ length: 5 }, () => p('arena', { aumentos: [2], posicion: 2 })),
      ...Array.from({ length: 4 }, () => p('arena', { aumentos: [3], posicion: 1 })),
    ];
    const b = agregarArena(ps, '15.20', false);
    sinRendimientoDeElementos(b);
    expect(JSON.stringify(b.aumentosPopulares)).not.toMatch(/tasaVictoria|posicionMedia/);
  });

  it('una build guardada por un servidor 3.1 se lee sin las cifras prohibidas', () => {
    const vieja = {
      ...agregarArena(Array.from({ length: 10 }, () => p('arena', { aumentos: [5], posicion: 2, compras: [3089] })), '15.20', false),
      aumentos: [{ id: 5, partidas: 10, uso: 1, tasaVictoria: 0.4, posicionMedia: 2 }],
      aumentosMejores: [{ id: 5, partidas: 10, uso: 1, tasaVictoria: 0.4, posicionMedia: 2 }],
      objetosArena: [{ id: 3089, partidas: 10, uso: 1, tasaVictoria: 0.4, posicionMedia: 2 }],
      objetosArenaMejores: [{ id: 3089, partidas: 10, uso: 1, tasaVictoria: 0.4, posicionMedia: 2 }],
    };
    delete (vieja as { aumentosPopulares?: unknown }).aumentosPopulares;
    delete (vieja as { objetosArenaPopulares?: unknown }).objetosArenaPopulares;
    db.guardarBuild(vieja);
    const leida = db.build('Ahri', null, 'arena')!;
    sinRendimientoDeElementos(leida);
    expect(leida.aumentosPopulares).toEqual([{ id: 5, partidas: 10, uso: 1 }]);
    expect(leida.objetosArenaPopulares).toEqual([{ id: 3089, partidas: 10, uso: 1 }]);
    expect(db.builds('arena').every((x) => !('aumentos' in x) && !('objetosArenaMejores' in x))).toBe(true);
  });

  it('en Arena se clasifican los objetos con el mapa 30: un objeto solo de Arena cuenta como legendario', () => {
    const soloArena: Record<number, ItemDDragonCrudo> = {
      447100: { gold: { total: 2800, purchasable: true }, maps: { '11': false, '30': true } },
      447101: { gold: { total: 2800, purchasable: true }, maps: { '11': false, '30': true } },
      447102: { gold: { total: 2800, purchasable: true }, maps: { '11': false, '30': true } },
    };
    const ps = Array.from({ length: 3 }, () => p('arena', { compras: [447100, 447101, 447102] }));
    expect(agregarBuild(ps, soloArena, '15.20', false).nucleo).toEqual([447100, 447101, 447102]);
    const grieta = Array.from({ length: 3 }, () => p('clasificatoria', { compras: [447100, 447101, 447102] }));
    expect(agregarBuild(grieta, soloArena, '15.20', false).nucleo).toEqual([]);
  });
});

describe('KDA medio por modo', () => {
  const conKda = (modo: ModoJuego, extra: Partial<Participacion> = {}) =>
    Array.from({ length: 10 }, () => p(modo, { asesinatos: 6, muertes: 3, asistencias: 9, ...extra }));

  it('ARAM y ARAM: Caos dan el KDA medio como clasificatoria', () => {
    for (const modo of ['clasificatoria', 'aram', 'caos'] as const) {
      expect(agregarBuild(conKda(modo), OBJETOS, '15.20', false).kda, modo).toEqual({ asesinatos: 6, muertes: 3, asistencias: 9, ratio: 5 });
    }
  });

  it('Arena también lleva el KDA medio; con menos de 10 partidas con el dato, null', () => {
    expect(agregarArena(conKda('arena', { posicion: 2 }), '15.20', false).kda).toEqual({ asesinatos: 6, muertes: 3, asistencias: 9, ratio: 5 });
    expect(agregarArena(conKda('arena', { posicion: 2 }).slice(0, 9), '15.20', false).kda).toBeNull();
  });
});
