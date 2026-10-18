import { describe, expect, it } from 'vitest';
import type { Habilidad, ItemDDragonCrudo, Rol } from '@coach/shared';
import { abrirDb } from '../src/db';
import type { Participacion } from '../src/extraer';
import {
  agregarBuild,
  calcularBuilds,
  generarOrdenHabilidades,
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

  it('15 en total → no guarda build', () => {
    const db = abrirDb(':memory:');
    db.guardarParticipaciones('EUW', [...muchas(10, '15.20'), ...muchas(5, '15.19')]);
    expect(calcularBuilds(db, OBJETOS, '15.20', '15.19')).toBe(0);
    expect(db.build('Ahri', 'MIDDLE')).toBeNull();
    expect(MIN_PARTIDAS_PUBLICAR).toBe(20);
    db.cerrar();
  });
});
