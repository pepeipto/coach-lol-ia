import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  MIN_PARTIDAS_ENFRENTAMIENTO,
  RUTAS_COUNTERS,
  tasaSuavizada,
  type CountersCampeon,
  type Enfrentamiento,
  type Habilidad,
  type ItemDDragonCrudo,
  type Rol,
} from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import type { Participacion } from '../src/extraer';
import { calcularEnfrentamientos, crearConsultasEnfrentamientos, emparejarLineas, idDDragon } from '../src/enfrentamientos';
import { crearServidor } from '../src/http';

const legendario = (): ItemDDragonCrudo => ({ gold: { total: 3000, purchasable: true } });
const OBJETOS: Record<number, ItemDDragonCrudo> = {
  6631: legendario(),
  3071: legendario(),
  3053: legendario(),
  6333: legendario(),
  3065: legendario(),
  3742: legendario(),
};
const NUCLEO_A = [6631, 3071, 3053];
const NUCLEO_B = [6333, 3065, 3742];
const RUNAS_A = { estiloPrincipal: 8000, estiloSecundario: 8400, runas: [8010, 9111, 9104, 8299, 8444, 8242, 5005, 5008, 5001] };
const RUNAS_B = { estiloPrincipal: 8400, estiloSecundario: 8000, runas: [8437, 8446, 8429, 8451, 9111, 8299, 5005, 5008, 5001] };
const HAB: Habilidad[] = ['Q', 'E', 'W', 'Q', 'Q', 'R', 'Q', 'E', 'Q', 'E', 'R', 'E', 'E', 'W', 'W', 'R', 'W', 'W'];

function participacion(matchId: string, campeon: string, rol: Rol, victoria: boolean, parche: string, extra: Partial<Participacion> = {}): Participacion {
  return {
    matchId,
    campeon,
    rol,
    modo: 'clasificatoria',
    victoria,
    parche,
    runas: RUNAS_A,
    hechizos: [4, 12],
    iniciales: [1054, 2003],
    compras: NUCLEO_A,
    habilidades: HAB,
    ...extra,
  };
}

let contador = 0;
/**
 * `n` partidas de `campeon` contra `rival` en `rol` (con `victorias` ganadas por `campeon`). Cada partida trae
 * también los otros cuatro roles con relleno, como una partida real de 5c5.
 */
function cruces(db: Db, campeon: string, rival: string, rol: Rol, n: number, victorias: number, parche = '15.20', extra: (i: number) => Partial<Participacion> = () => ({})) {
  const ps: Participacion[] = [];
  for (let i = 0; i < n; i++) {
    const id = `EUW1_${++contador}`;
    const gana = i < victorias;
    ps.push(participacion(id, campeon, rol, gana, parche, extra(i)));
    ps.push(participacion(id, rival, rol, !gana, parche));
    for (const otro of ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as Rol[]) {
      if (otro === rol) continue;
      ps.push(participacion(id, `Relleno${otro}A`, otro, gana, parche));
      ps.push(participacion(id, `Relleno${otro}B`, otro, !gana, parche));
    }
  }
  db.guardarParticipaciones('EUW', ps);
}

describe('enfrentamientos de línea', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  it('empareja a los dos jugadores del mismo rol con resultado distinto, desde los dos lados', () => {
    cruces(db, 'Darius', 'Garen', 'TOP', 10, 7);
    expect(calcularEnfrentamientos(db, OBJETOS, '15.20', '15.19')).toBeGreaterThan(0);
    const q = crearConsultasEnfrentamientos(db.sql);
    const darius = q.enfrentamiento('darius', 'GAREN', 'TOP')!;
    expect(darius).toMatchObject({ campeon: 'Darius', rival: 'Garen', rol: 'TOP', parche: '15.20', partidas: 10, tasaVictoria: 0.7, datosLimitados: true });
    expect(darius.build).toBeUndefined(); // menos de 40 partidas: sin build del cruce
    expect(q.enfrentamiento('Garen', 'Darius', 'TOP')).toMatchObject({ partidas: 10, tasaVictoria: 0.3 });
    // Los otros roles de las mismas partidas también se emparejan entre sí, pero nunca entre roles distintos.
    expect(q.enfrentamiento('Darius', 'RellenoMIDDLEB', 'TOP')).toBeNull();
    expect(q.enfrentamiento('Darius', 'Garen', 'MIDDLE')).toBeNull();
  });

  it(`no lista cruces de menos de ${MIN_PARTIDAS_ENFRENTAMIENTO} partidas`, () => {
    cruces(db, 'Darius', 'Garen', 'TOP', MIN_PARTIDAS_ENFRENTAMIENTO - 1, 5);
    calcularEnfrentamientos(db, OBJETOS, '15.20', '15.19');
    const q = crearConsultasEnfrentamientos(db.sql);
    expect(q.enfrentamiento('Darius', 'Garen', 'TOP')).toBeNull();
    expect(q.counters('Darius', 'TOP')).toBeNull();
  });

  it('descarta las partidas raras: un rol con tres jugadores, o los dos con el mismo resultado', () => {
    const ps: Participacion[] = [];
    for (let i = 0; i < 10; i++) {
      ps.push(participacion(`EUW1_raro3_${i}`, 'Darius', 'TOP', true, '15.20'));
      ps.push(participacion(`EUW1_raro3_${i}`, 'Garen', 'TOP', false, '15.20'));
      ps.push(participacion(`EUW1_raro3_${i}`, 'Sett', 'TOP', false, '15.20'));
      ps.push(participacion(`EUW1_igual_${i}`, 'Darius', 'TOP', true, '15.20'));
      ps.push(participacion(`EUW1_igual_${i}`, 'Garen', 'TOP', true, '15.20'));
    }
    db.guardarParticipaciones('EUW', ps);
    expect(emparejarLineas(db.sql, '15.20', '15.19').size).toBe(0);
  });

  it('usa solo las partidas de clasificatoria', () => {
    const ps: Participacion[] = [];
    for (let i = 0; i < 10; i++) {
      ps.push(participacion(`EUW1_aram_${i}`, 'Darius', null as unknown as Rol, true, '15.20', { modo: 'aram', rol: null }));
      ps.push(participacion(`EUW1_aram_${i}`, 'Garen', null as unknown as Rol, false, '15.20', { modo: 'aram', rol: null }));
    }
    db.guardarParticipaciones('EUW', ps);
    expect(emparejarLineas(db.sql, '15.20', '15.19').size).toBe(0);
  });

  it('mezcla con el parche anterior solo los cruces con pocos datos en el actual', () => {
    cruces(db, 'Darius', 'Garen', 'TOP', 20, 10, '15.20');
    cruces(db, 'Darius', 'Garen', 'TOP', 15, 15, '15.19');
    cruces(db, 'Darius', 'Sett', 'TOP', 30, 15, '15.20');
    cruces(db, 'Darius', 'Sett', 'TOP', 10, 10, '15.19');
    calcularEnfrentamientos(db, OBJETOS, '15.20', '15.19');
    const q = crearConsultasEnfrentamientos(db.sql);
    expect(q.enfrentamiento('Darius', 'Garen', 'TOP')).toMatchObject({ partidas: 35, tasaVictoria: 25 / 35, datosLimitados: false });
    expect(q.enfrentamiento('Darius', 'Sett', 'TOP')).toMatchObject({ partidas: 30, tasaVictoria: 0.5 });
  });

  it('ordena con suavizado bayesiano: un 8 de 8 no pasa por delante de un 70 % en 60 partidas', () => {
    cruces(db, 'Darius', 'Garen', 'TOP', 8, 8);
    cruces(db, 'Darius', 'Sett', 'TOP', 60, 42);
    cruces(db, 'Darius', 'Teemo', 'TOP', 50, 15);
    cruces(db, 'Darius', 'Quinn', 'TOP', 9, 3);
    expect(tasaSuavizada(42, 60)).toBeGreaterThan(tasaSuavizada(8, 8));
    calcularEnfrentamientos(db, OBJETOS, '15.20', '15.19');
    const c = crearConsultasEnfrentamientos(db.sql).counters('Darius', 'TOP')!;
    expect(c.faciles.map((e) => e.rival)).toEqual(['Sett', 'Garen']);
    expect(c.dificiles.map((e) => e.rival)).toEqual(['Teemo', 'Quinn']);
    expect(c.faciles[1]).toEqual({ rival: 'Garen', partidas: 8, tasaVictoria: 1, datosLimitados: true });
    expect(c).toMatchObject({ campeon: 'Darius', rol: 'TOP', parche: '15.20', partidas: 8 + 60 + 50 + 9 });
  });

  it('como mucho 6 fáciles y 6 difíciles', () => {
    for (let i = 0; i < 8; i++) cruces(db, 'Darius', `Facil${i}`, 'TOP', 10, 9);
    for (let i = 0; i < 8; i++) cruces(db, 'Darius', `Dificil${i}`, 'TOP', 10, 1);
    calcularEnfrentamientos(db, OBJETOS, '15.20', '15.19');
    const c = crearConsultasEnfrentamientos(db.sql).counters('Darius', 'TOP')!;
    expect(c.faciles).toHaveLength(6);
    expect(c.dificiles).toHaveLength(6);
  });

  it('con 40 partidas o más, la build del cruce es la opción de núcleo y la página de runas que más ganan', () => {
    // 30 partidas con el núcleo A (12 ganadas) y 30 con el B (24 ganadas); las runas B ganan más.
    cruces(db, 'Darius', 'Garen', 'TOP', 60, 36, '15.20', (i) =>
      i < 24 ? { compras: NUCLEO_B, runas: RUNAS_B } : i < 36 ? { compras: NUCLEO_A, runas: RUNAS_A } : i < 42 ? { compras: NUCLEO_B, runas: RUNAS_B } : { compras: NUCLEO_A, runas: RUNAS_A },
    );
    calcularEnfrentamientos(db, OBJETOS, '15.20', '15.19');
    const e = crearConsultasEnfrentamientos(db.sql).enfrentamiento('Darius', 'Garen', 'TOP')!;
    expect(e.build).toBeDefined();
    expect(e.build!.nucleo).toEqual(NUCLEO_B);
    expect(e.build!.runas).toEqual(RUNAS_B);
    expect(e.build!.partidas).toBe(30);
    expect(e.build!.tasaVictoria).toBeCloseTo(0.8);
    expect(e.build!.opciones).toBeUndefined();
  });

  it('cada recálculo sustituye los enfrentamientos anteriores', () => {
    cruces(db, 'Darius', 'Garen', 'TOP', 10, 7, '15.19');
    calcularEnfrentamientos(db, OBJETOS, '15.19', '15.18');
    db.borrarParchesAntiguos(['15.21', '15.20']);
    cruces(db, 'Darius', 'Sett', 'TOP', 10, 7, '15.21');
    calcularEnfrentamientos(db, OBJETOS, '15.21', '15.20');
    const q = crearConsultasEnfrentamientos(db.sql);
    expect(q.enfrentamiento('Darius', 'Garen', 'TOP')).toBeNull();
    expect(q.enfrentamiento('Darius', 'Sett', 'TOP')).toMatchObject({ parche: '15.21' });
  });

  it('da el id de Data Dragon del rival', () => {
    expect(idDDragon('FiddleSticks')).toBe('Fiddlesticks');
    expect(idDDragon('MonkeyKing')).toBe('MonkeyKing');
    cruces(db, 'Graves', 'FiddleSticks', 'JUNGLE', 10, 6);
    calcularEnfrentamientos(db, OBJETOS, '15.20', '15.19');
    const q = crearConsultasEnfrentamientos(db.sql);
    expect(q.counters('Graves', 'JUNGLE')!.faciles[0]!.rival).toBe('Fiddlesticks');
    expect(q.counters('fiddlesticks', 'JUNGLE')!.campeon).toBe('Fiddlesticks');
  });
});

describe('rutas de counters', () => {
  let db: Db;
  let app: FastifyInstance;
  beforeEach(async () => {
    db = abrirDb(':memory:');
    app = crearServidor(db);
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
    db.cerrar();
  });

  it('GET /counters/:campeon/:rol devuelve las dos listas, sin distinguir mayúsculas', async () => {
    cruces(db, 'Darius', 'Garen', 'TOP', 12, 9);
    cruces(db, 'Darius', 'Teemo', 'TOP', 12, 3);
    calcularEnfrentamientos(db, OBJETOS, '15.20', '15.19');
    const r = await app.inject({ method: 'GET', url: RUTAS_COUNTERS.counters('darius', 'TOP') });
    expect(r.statusCode).toBe(200);
    const c = r.json<CountersCampeon>();
    expect(c.faciles.map((e) => e.rival)).toEqual(['Garen']);
    expect(c.dificiles.map((e) => e.rival)).toEqual(['Teemo']);
    expect(c.partidas).toBe(24);
  });

  it('GET /enfrentamiento/:campeon/:rival/:rol devuelve el cruce', async () => {
    cruces(db, 'Darius', 'Garen', 'TOP', 12, 9);
    calcularEnfrentamientos(db, OBJETOS, '15.20', '15.19');
    const r = await app.inject({ method: 'GET', url: RUTAS_COUNTERS.enfrentamiento('Darius', 'Garen', 'TOP') });
    expect(r.statusCode).toBe(200);
    expect(r.json<Enfrentamiento>()).toMatchObject({ campeon: 'Darius', rival: 'Garen', rol: 'TOP', partidas: 12, tasaVictoria: 0.75 });
  });

  it('404 sin_datos si no hay datos (también antes del primer cálculo)', async () => {
    for (const url of ['/counters/Darius/TOP', '/enfrentamiento/Darius/Garen/TOP']) {
      const r = await app.inject({ method: 'GET', url });
      expect(r.statusCode).toBe(404);
      expect(r.json()).toEqual({ error: 'sin_datos' });
    }
  });

  it('400 con un rol o un campeón no válidos', async () => {
    const casos: [string, string][] = [
      ['/counters/Darius/SUPPORT', 'rol_invalido'],
      ['/counters/Da%20rius/TOP', 'campeon_invalido'],
      [`/counters/${'A'.repeat(41)}/TOP`, 'campeon_invalido'],
      ['/enfrentamiento/Darius/Garen/top', 'rol_invalido'],
      ['/enfrentamiento/Darius/Ga..ren/TOP', 'campeon_invalido'],
    ];
    for (const [url, error] of casos) {
      const r = await app.inject({ method: 'GET', url });
      expect(r.statusCode, url).toBe(400);
      expect(r.json()).toEqual({ error });
    }
  });
});
