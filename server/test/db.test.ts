import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Build, Rol } from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import type { Participacion } from '../src/extraer';

function part(matchId: string, campeon: string, rol: Rol, parche: string): Participacion {
  return {
    matchId,
    campeon,
    rol,
    victoria: true,
    parche,
    runas: { estiloPrincipal: 8100, estiloSecundario: 8000, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    hechizos: [4, 14],
    iniciales: [1056],
    compras: [3020, 3157],
    habilidades: ['Q', 'W', 'E'],
  };
}

function build(campeon: string, rol: Rol, parche: string, partidas: number): Build {
  return {
    campeon,
    rol,
    parche,
    partidas,
    tasaVictoria: 0.5,
    mezclaParches: false,
    runas: { estiloPrincipal: 8100, estiloSecundario: 8000, runas: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    hechizos: [4, 14],
    objetosIniciales: [1056],
    nucleo: [3020],
    botas: 3020,
    situacionales: [],
    ordenHabilidades: ['Q', 'W', 'E'],
    calculadoEn: '2026-10-18T00:00:00.000Z',
  };
}

describe('db', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  it('guarda y lee participaciones, y marca la partida como vista', () => {
    const p = part('EUW1_1', 'Ahri', 'MID', '15.20');
    expect(db.partidaVista('EUW1_1')).toBe(false);
    db.guardarParticipaciones('EUW', [p, part('EUW1_1', 'Zed', 'MID', '15.20')]);
    expect(db.partidaVista('EUW1_1')).toBe(true);
    expect(db.participacionesDe('Ahri', 'MID', ['15.20'])).toEqual([p]);
    expect(db.participacionesDe('Ahri', 'MID', ['15.19'])).toEqual([]);
    expect(db.participacionesDe('Ahri', 'MID', [])).toEqual([]);
  });

  it('marcarVista registra partidas sin participaciones', () => {
    db.marcarVista('EUW1_2');
    expect(db.partidaVista('EUW1_2')).toBe(true);
  });

  it('lista combinaciones de los parches indicados', () => {
    db.guardarParticipaciones('LAN', [
      part('A', 'Ahri', 'MID', '15.20'),
      part('B', 'Ahri', 'MID', '15.19'),
      part('C', 'Zed', 'MID', '15.18'),
    ]);
    const c = db.combinaciones(['15.20', '15.19']);
    expect(c).toEqual([{ campeon: 'Ahri', rol: 'MID' }]);
  });

  it('guardarBuild reemplaza la anterior', () => {
    expect(db.build('Ahri', 'MID')).toBeNull();
    db.guardarBuild(build('Ahri', 'MID', '15.19', 30));
    db.guardarBuild(build('Ahri', 'MID', '15.20', 50));
    expect(db.build('Ahri', 'MID')).toEqual(build('Ahri', 'MID', '15.20', 50));
  });

  it('roles ordena de más a menos partidas', () => {
    db.guardarParticipaciones('LAS', [
      part('A', 'Ahri', 'TOP', '15.20'),
      part('B', 'Ahri', 'MID', '15.20'),
      part('C', 'Ahri', 'MID', '15.20'),
      part('D', 'Ahri', 'MID', '15.19'),
    ]);
    expect(db.roles('Ahri', '15.20')).toEqual([
      { rol: 'MID', partidas: 2 },
      { rol: 'TOP', partidas: 1 },
    ]);
  });

  it('borrarParchesAntiguos elimina otros parches (comparación numérica)', () => {
    db.guardarParticipaciones('EUW', [
      part('A', 'Ahri', 'MID', '15.20'),
      part('B', 'Ahri', 'MID', '15.9'),
      part('C', 'Ahri', 'MID', '15.18'),
    ]);
    db.guardarBuild(build('Ahri', 'MID', '15.18', 30));
    db.guardarBuild(build('Zed', 'MID', '15.20', 30));
    db.borrarParchesAntiguos(['15.20', '15.19']);
    expect(db.participacionesDe('Ahri', 'MID', ['15.18', '15.9'])).toEqual([]);
    expect(db.participacionesDe('Ahri', 'MID', ['15.20'])).toHaveLength(1);
    expect(db.build('Ahri', 'MID')).toBeNull();
    expect(db.build('Zed', 'MID')).not.toBeNull();
  });
});
