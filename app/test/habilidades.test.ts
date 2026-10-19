import type { Habilidad } from '@coach/shared';
import { describe, expect, it } from 'vitest';
import { CAMPEONES_SIN_REGLAS_NORMALES, habilidadQueSubir, puedeSubir, puntoLibre, rangoMaximo } from '../src/main/consejos/habilidades';

type Rangos = Record<Habilidad, number>;
const r = (Q: number, W: number, E: number, R: number): Rangos => ({ Q, W, E, R });
// Orden típico de un mago: Q, W, E, máximo la Q, luego la W; R en 6, 11 y 16.
const ORDEN: Habilidad[] = ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E', 'R', 'E', 'E'];
const sube = (nivel: number, rangos: Rangos, campeon = 'Ahri', orden = ORDEN) => habilidadQueSubir({ nivel, habilidades: rangos, campeon }, orden);

describe('punto de habilidad libre', () => {
  it('hay punto libre cuando el nivel supera la suma de rangos', () => {
    expect(puntoLibre(1, r(0, 0, 0, 0))).toBe(true);
    expect(puntoLibre(1, r(1, 0, 0, 0))).toBe(false);
    expect(puntoLibre(6, r(3, 1, 1, 0))).toBe(true);
    expect(puntoLibre(6, r(3, 1, 1, 1))).toBe(false);
  });

  it('rango máximo: básicas 1/3/5/7/9 (hasta 5), R en 6/11/16 (hasta 3)', () => {
    expect([1, 2, 3, 4, 5, 9, 18].map((n) => rangoMaximo('Q', n))).toEqual([1, 1, 2, 2, 3, 5, 5]);
    expect([1, 5, 6, 10, 11, 15, 16, 18].map((n) => rangoMaximo('R', n))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('puedeSubir respeta los niveles de la R y el máximo de las básicas', () => {
    expect(puedeSubir('R', 5, r(2, 1, 1, 0))).toBe(false);
    expect(puedeSubir('R', 6, r(3, 1, 1, 0))).toBe(true);
    expect(puedeSubir('R', 10, r(5, 2, 2, 1))).toBe(false);
    expect(puedeSubir('R', 11, r(5, 2, 2, 1))).toBe(true);
    expect(puedeSubir('Q', 2, r(1, 0, 0, 0))).toBe(false); // la Q 2 pide nivel 3
    expect(puedeSubir('Q', 18, r(5, 5, 5, 2))).toBe(false);
  });
});

describe('habilidad que subir (la flecha)', () => {
  it('sigue el orden de la build mientras el jugador lo sigue', () => {
    expect(sube(1, r(0, 0, 0, 0))).toBe('Q');
    expect(sube(2, r(1, 0, 0, 0))).toBe('W');
    expect(sube(4, r(1, 1, 1, 0))).toBe('Q');
    expect(sube(6, r(3, 1, 1, 0))).toBe('R');
    expect(sube(11, r(5, 3, 1, 1))).toBe('R');
    expect(sube(16, r(5, 5, 3, 2))).toBe('R');
  });

  it('sin punto libre no hay flecha (se esconde al gastar el punto)', () => {
    expect(sube(6, r(3, 1, 1, 1))).toBeNull();
    expect(sube(18, r(5, 5, 5, 3))).toBeNull();
  });

  it('nunca marca la R antes del 6, 11 o 16', () => {
    // El jugador se adelantó con la W: el orden diría R en el 6 pero ya la tiene; o pediría la R a destiempo.
    const orden: Habilidad[] = ['Q', 'R', 'W', 'E', 'Q', 'Q'];
    expect(sube(2, r(1, 0, 0, 0), 'Ahri', orden)).toBe('W');
    expect(sube(10, r(4, 3, 1, 1))).not.toBe('R');
  });

  it('si el jugador se salió del orden, marca la primera que le falta y que puede subir', () => {
    // Nivel 3 con Q 2 (orden Q, W, E): le falta la W.
    expect(sube(3, r(2, 0, 0, 0))).toBe('W');
    // Nivel 4 con W 2 y Q 1: según el orden toca la E.
    expect(sube(4, r(1, 2, 0, 0))).toBe('E');
  });

  it('sin una que se pueda subir según el orden no marca nada', () => {
    expect(sube(3, r(1, 1, 0, 0), 'Ahri', ['Q', 'W'])).toBeNull();
    expect(sube(1, r(0, 0, 0, 0), 'Ahri', [])).toBeNull();
  });

  it('campeones con reglas propias (Udyr, Jayce, Elise, Nidalee, Karma, Aphelios…): nada, mejor que algo mal', () => {
    for (const c of ['Udyr', 'Jayce', 'Elise', 'Nidalee', 'Karma', 'Aphelios']) {
      expect(CAMPEONES_SIN_REGLAS_NORMALES.has(c)).toBe(true);
      expect(sube(1, r(0, 0, 0, 0), c)).toBeNull();
      expect(sube(6, r(3, 1, 1, 0), c)).toBeNull();
    }
  });

  it('datos que no cuadran con las reglas normales (R de nivel 1, más rangos que niveles, rango 6): nada', () => {
    // Un campeón nuevo con la R desde el nivel 1, como Jayce, aunque no esté en la lista.
    expect(sube(2, r(1, 0, 0, 1), 'CampeonNuevo')).toBeNull();
    expect(sube(3, r(2, 1, 1, 0), 'CampeonNuevo')).toBeNull();
    expect(sube(18, r(6, 5, 5, 0), 'CampeonNuevo')).toBeNull();
    expect(sube(0, r(0, 0, 0, 0))).toBeNull();
    expect(sube(19, r(5, 5, 5, 3))).toBeNull();
  });
});
