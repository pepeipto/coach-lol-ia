import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { MAX_SINERGIAS_POR_ROL, MIN_PARTIDAS_ENFRENTAMIENTO, RUTAS_COUNTERS, type Rol, type SinergiasCampeon } from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import type { Participacion } from '../src/extraer';
import { calcularSinergias, crearConsultasSinergias, emparejarEquipos } from '../src/sinergias';
import { crearServidor } from '../src/http';

const RUNAS = { estiloPrincipal: 8000, estiloSecundario: 8400, runas: [8010, 9111, 9104, 8299, 8444, 8242, 5005, 5008, 5001] };
const ROLES_5: Rol[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

function participacion(matchId: string, campeon: string, rol: Rol, victoria: boolean, parche: string): Participacion {
  return { matchId, campeon, rol, modo: 'clasificatoria', victoria, parche, runas: RUNAS, hechizos: [4, 12], iniciales: [], compras: [], habilidades: [] };
}

let contador = 0;
/** `n` partidas 5c5: el equipo A (campeones de `a` por rol) gana las `victorias` primeras. */
function partidas(db: Db, a: Partial<Record<Rol, string>>, n: number, victorias: number, parche = '15.20') {
  const ps: Participacion[] = [];
  for (let i = 0; i < n; i++) {
    const id = `EUW1_s${++contador}`;
    const gana = i < victorias;
    for (const rol of ROLES_5) {
      ps.push(participacion(id, a[rol] ?? `A${rol}`, rol, gana, parche));
      ps.push(participacion(id, `B${rol}`, rol, !gana, parche));
    }
  }
  db.guardarParticipaciones('EUW', ps);
}

describe('sinergias', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  it('empareja a los compañeros del mismo equipo (mismo resultado) y de roles distintos, desde los dos lados', () => {
    partidas(db, { BOTTOM: 'Jinx', UTILITY: 'Lulu' }, 10, 7);
    expect(calcularSinergias(db, '15.20', '15.19')).toBeGreaterThan(0);
    const q = crearConsultasSinergias(db.sql);
    const jinx = q.sinergias('jinx', 'BOTTOM')!;
    expect(jinx).toMatchObject({ campeon: 'Jinx', rol: 'BOTTOM', parche: '15.20' });
    expect(jinx.porRol.map((r) => r.rol)).toEqual(['TOP', 'JUNGLE', 'MIDDLE', 'UTILITY']);
    expect(jinx.porRol.find((r) => r.rol === 'UTILITY')!.aliados).toEqual([{ aliado: 'Lulu', partidas: 10, tasaVictoria: 0.7, datosLimitados: true }]);
    expect(q.sinergias('Lulu', 'UTILITY')!.porRol.find((r) => r.rol === 'BOTTOM')!.aliados[0]).toMatchObject({ aliado: 'Jinx', tasaVictoria: 0.7 });
    // Los rivales (otro resultado) nunca son compañeros.
    expect(jinx.porRol.flatMap((r) => r.aliados).some((x) => x.aliado.startsWith('B'))).toBe(false);
    expect(q.sinergias('Jinx', 'MIDDLE')).toBeNull();
  });

  it(`no guarda pares de menos de ${MIN_PARTIDAS_ENFRENTAMIENTO} partidas`, () => {
    partidas(db, { BOTTOM: 'Jinx', UTILITY: 'Lulu' }, MIN_PARTIDAS_ENFRENTAMIENTO - 1, 4);
    calcularSinergias(db, '15.20', '15.19');
    expect(crearConsultasSinergias(db.sql).sinergias('Jinx', 'BOTTOM')).toBeNull();
  });

  it('ordena con suavizado y deja como mucho 5 por rol', () => {
    partidas(db, { BOTTOM: 'Jinx', UTILITY: 'Lulu' }, 8, 8);
    partidas(db, { BOTTOM: 'Jinx', UTILITY: 'Nami' }, 60, 42);
    for (let i = 0; i < 6; i++) partidas(db, { BOTTOM: 'Jinx', UTILITY: `Sup${i}` }, 10, 3);
    calcularSinergias(db, '15.20', '15.19');
    const apoyos = crearConsultasSinergias(db.sql).sinergias('Jinx', 'BOTTOM')!.porRol.find((r) => r.rol === 'UTILITY')!.aliados;
    expect(apoyos).toHaveLength(MAX_SINERGIAS_POR_ROL);
    expect(apoyos.slice(0, 2).map((x) => x.aliado)).toEqual(['Nami', 'Lulu']);
  });

  it('descarta los equipos con un rol repetido y las partidas sin resultado claro', () => {
    const ps: Participacion[] = [];
    for (let i = 0; i < 10; i++) {
      ps.push(participacion(`EUW1_rep_${i}`, 'Jinx', 'BOTTOM', true, '15.20'));
      ps.push(participacion(`EUW1_rep_${i}`, 'Lulu', 'BOTTOM', true, '15.20'));
    }
    db.guardarParticipaciones('EUW', ps);
    expect(emparejarEquipos(db.sql, '15.20', '15.19').size).toBe(0);
  });

  it('mezcla con el parche anterior solo los pares con pocos datos en el actual', () => {
    partidas(db, { BOTTOM: 'Jinx', UTILITY: 'Lulu' }, 10, 5, '15.20');
    partidas(db, { BOTTOM: 'Jinx', UTILITY: 'Lulu' }, 10, 10, '15.19');
    calcularSinergias(db, '15.20', '15.19');
    const lulu = crearConsultasSinergias(db.sql).sinergias('Jinx', 'BOTTOM')!.porRol.find((r) => r.rol === 'UTILITY')!.aliados[0]!;
    expect(lulu).toMatchObject({ partidas: 20, tasaVictoria: 0.75 });
  });

  it('cada recálculo sustituye las anteriores', () => {
    partidas(db, { BOTTOM: 'Jinx', UTILITY: 'Lulu' }, 10, 5, '15.19');
    calcularSinergias(db, '15.19', '15.18');
    db.borrarParchesAntiguos(['15.21', '15.20']);
    calcularSinergias(db, '15.21', '15.20');
    expect(crearConsultasSinergias(db.sql).sinergias('Jinx', 'BOTTOM')).toBeNull();
  });
});

describe('ruta de sinergias', () => {
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

  it('GET /sinergias/:campeon/:rol devuelve los compañeros por rol, sin distinguir mayúsculas', async () => {
    partidas(db, { BOTTOM: 'Jinx', UTILITY: 'Lulu' }, 12, 9);
    calcularSinergias(db, '15.20', '15.19');
    const r = await app.inject({ method: 'GET', url: RUTAS_COUNTERS.sinergias('jinx', 'BOTTOM') });
    expect(r.statusCode).toBe(200);
    const s = r.json<SinergiasCampeon>();
    expect(s.campeon).toBe('Jinx');
    expect(s.porRol.find((x) => x.rol === 'UTILITY')!.aliados[0]).toMatchObject({ aliado: 'Lulu', partidas: 12, tasaVictoria: 0.75 });
  });

  it('404 sin_datos sin datos y 400 con parámetros no válidos', async () => {
    const r = await app.inject({ method: 'GET', url: '/sinergias/Jinx/BOTTOM' });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ error: 'sin_datos' });
    for (const [url, error] of [
      ['/sinergias/Jinx/ADC', 'rol_invalido'],
      ['/sinergias/Ji..nx/BOTTOM', 'campeon_invalido'],
    ] as const) {
      const x = await app.inject({ method: 'GET', url });
      expect(x.statusCode, url).toBe(400);
      expect(x.json()).toEqual({ error });
    }
  });
});
