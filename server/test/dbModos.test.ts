import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Build, ModoJuego, Rol } from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import type { Participacion } from '../src/extraer';

function part(matchId: string, campeon: string, rol: Rol | null, modo: ModoJuego | undefined, parche = '15.20'): Participacion {
  return {
    matchId,
    campeon,
    rol,
    ...(modo ? { modo } : {}),
    victoria: true,
    parche,
    runas: { estiloPrincipal: 8100, estiloSecundario: 8000, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    hechizos: [4, 14],
    iniciales: [],
    compras: [3020],
    habilidades: [],
  };
}

function build(campeon: string, rol: Rol | null, modo: ModoJuego | undefined, partidas: number, parche = '15.20'): Build {
  return {
    campeon,
    rol,
    ...(modo ? { modo } : {}),
    parche,
    partidas,
    tasaVictoria: 0.5,
    mezclaParches: false,
    runas: { estiloPrincipal: 8100, estiloSecundario: 8000, runas: [] },
    hechizos: [4, 14],
    objetosIniciales: [],
    nucleo: [],
    botas: null,
    situacionales: [],
    ordenHabilidades: [],
    calculadoEn: '2026-10-19T00:00:00.000Z',
  };
}

describe('db por modo', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  it('separa las participaciones por modo; en los modos sin rol, el rol es null', () => {
    db.guardarParticipaciones('EUW', [
      part('R1', 'Ahri', 'MIDDLE', 'clasificatoria'),
      part('A1', 'Ahri', null, 'aram'),
      part('C1', 'Ahri', null, 'caos'),
      part('X1', 'Ahri', null, 'arena'),
    ]);
    expect(db.participacionesDe('Ahri', 'MIDDLE', ['15.20']).map((p) => p.matchId)).toEqual(['R1']);
    expect(db.participacionesDe('Ahri', null, ['15.20'], 'aram').map((p) => p.matchId)).toEqual(['A1']);
    expect(db.participacionesDe('Ahri', 'TOP', ['15.20'], 'caos').map((p) => p.matchId)).toEqual(['C1']); // rol ignorado
    expect(db.combinaciones(['15.20'], 'arena')).toEqual([{ campeon: 'ahri', rol: null }]);
    expect(db.combinaciones(['15.20'])).toEqual([{ campeon: 'ahri', rol: 'MIDDLE' }]);
    expect(db.roles('Ahri', '15.20')).toEqual([{ rol: 'MIDDLE', partidas: 1 }]);
  });

  it('guarda una build por campeón y modo, sin pisar la de clasificatoria', () => {
    db.guardarBuild(build('Ahri', 'MIDDLE', undefined, 40));
    db.guardarBuild(build('Ahri', null, 'aram', 30));
    db.guardarBuild(build('Ahri', null, 'arena', 20));
    expect(db.build('Ahri', 'MIDDLE')!.partidas).toBe(40);
    expect(db.build('Ahri', null, 'aram')!.partidas).toBe(30);
    expect(db.build('Ahri', 'TOP', 'arena')!.partidas).toBe(20);
    expect(db.build('Ahri', null, 'caos')).toBeNull();
    expect(db.builds().map((b) => b.partidas)).toEqual([40]);
    expect(db.builds('aram').map((b) => b.partidas)).toEqual([30]);
  });

  it('borrarParchesAntiguos borra en todos los modos', () => {
    db.guardarParticipaciones('EUW', [part('A1', 'Ahri', null, 'aram', '15.18')]);
    db.guardarBuild(build('Ahri', null, 'aram', 30, '15.18'));
    db.borrarParchesAntiguos(['15.20']);
    expect(db.participacionesDe('Ahri', null, ['15.18'], 'aram')).toEqual([]);
    expect(db.build('Ahri', null, 'aram')).toBeNull();
  });
});

describe('migración de bases anteriores a 3.0', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'coach-db-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function baseAntigua(ruta: string) {
    const sql = new Database(ruta);
    sql.exec(`
      CREATE TABLE participaciones (match_id TEXT NOT NULL, campeon TEXT NOT NULL, rol TEXT NOT NULL, parche TEXT NOT NULL,
        region TEXT NOT NULL, datos TEXT NOT NULL, PRIMARY KEY (match_id, campeon));
      CREATE TABLE builds (campeon TEXT NOT NULL, rol TEXT NOT NULL, parche TEXT NOT NULL, datos TEXT NOT NULL, PRIMARY KEY (campeon, rol));
    `);
    const p = part('OLD1', 'Ahri', 'MIDDLE', undefined);
    sql.prepare('INSERT INTO participaciones VALUES (?, ?, ?, ?, ?, ?)').run('OLD1', 'ahri', 'MIDDLE', '15.20', 'EUW', JSON.stringify(p));
    sql.prepare('INSERT INTO builds VALUES (?, ?, ?, ?)').run('ahri', 'MIDDLE', '15.20', JSON.stringify(build('Ahri', 'MIDDLE', undefined, 50)));
    sql.close();
  }

  it('las filas existentes pasan a clasificatoria y la migración se puede repetir', () => {
    const ruta = join(dir, 'datos.db');
    baseAntigua(ruta);
    for (let i = 0; i < 2; i++) {
      const db = abrirDb(ruta);
      expect(db.participacionesDe('Ahri', 'MIDDLE', ['15.20']).map((p) => p.matchId)).toEqual(['OLD1']);
      expect(db.build('Ahri', 'MIDDLE')!.partidas).toBe(50);
      const modos = db.sql.prepare('SELECT DISTINCT modo FROM participaciones').all();
      expect(modos).toEqual([{ modo: 'clasificatoria' }]);
      expect((db.sql.prepare("SELECT modo FROM builds WHERE rol = 'MIDDLE'").all() as { modo: string }[])[0]!.modo).toBe('clasificatoria');
      db.guardarBuild(build('Ahri', null, 'aram', 12));
      expect(db.build('Ahri', null, 'aram')!.partidas).toBe(12);
      db.cerrar();
    }
  });
});
