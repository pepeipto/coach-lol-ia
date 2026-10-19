import { describe, expect, it } from 'vitest';
import type { Build, Rol } from '@coach/shared';
import { listaCampeones, tierDePuntuacion } from '../src/campeones';

function b(campeon: string, rol: Rol, partidas: number, tasaVictoria: number, parche = '15.20'): Build {
  return {
    campeon,
    rol,
    parche,
    partidas,
    tasaVictoria,
    mezclaParches: false,
    runas: { estiloPrincipal: 8100, estiloSecundario: 8000, runas: [] },
    hechizos: [4, 14],
    objetosIniciales: [],
    nucleo: [],
    botas: null,
    situacionales: [],
    ordenHabilidades: [],
    calculadoEn: '',
  };
}

describe('tierDePuntuacion', () => {
  it('aplica los cortes S ≥ 1, A ≥ 0.25, B ≥ −0.5 y C por debajo', () => {
    expect(tierDePuntuacion(1)).toBe('S');
    expect(tierDePuntuacion(0.99)).toBe('A');
    expect(tierDePuntuacion(0.25)).toBe('A');
    expect(tierDePuntuacion(0.2)).toBe('B');
    expect(tierDePuntuacion(-0.5)).toBe('B');
    expect(tierDePuntuacion(-0.51)).toBe('C');
  });
});

describe('listaCampeones', () => {
  it('sin builds devuelve una lista vacía', () => {
    expect(listaCampeones([])).toEqual({ parche: '', campeones: [] });
  });

  it('calcula el uso como fracción de las partidas del rol', () => {
    const r = listaCampeones([b('Ahri', 'MIDDLE', 300, 0.5), b('Zed', 'MIDDLE', 100, 0.5), b('Garen', 'TOP', 50, 0.5)]);
    const uso = Object.fromEntries(r.campeones.map((c) => [c.campeon, c.uso]));
    expect(uso).toEqual({ Ahri: 0.75, Zed: 0.25, Garen: 1 });
    expect(r.parche).toBe('15.20');
  });

  it('puntúa con z(victorias)·0.7 + z(uso)·0.3 dentro del rol', () => {
    // Uso igual para todos (z = 0): solo cuenta la tasa de victorias. WR 0.45/0.50/0.55 → z = −1.22/0/1.22.
    const r = listaCampeones([b('A', 'TOP', 100, 0.45), b('B', 'TOP', 100, 0.5), b('C', 'TOP', 100, 0.55)]);
    const tier = Object.fromEntries(r.campeones.map((c) => [c.campeon, c.tier]));
    // 1.2247·0.7 = 0.857 → A; 0 → B; −0.857 → C
    expect(tier).toEqual({ A: 'C', B: 'B', C: 'A' });
  });

  it('el uso pesa un 30 %', () => {
    // Misma tasa de victorias: z(WR) = 0. Uso 0.6/0.2/0.2 → z(uso) = 1.414/−0.707/−0.707 → ·0.3 = 0.42 (A) y −0.21 (B).
    const r = listaCampeones([b('A', 'JUNGLE', 300, 0.5), b('B', 'JUNGLE', 100, 0.5), b('C', 'JUNGLE', 100, 0.5)]);
    const tier = Object.fromEntries(r.campeones.map((c) => [c.campeon, c.tier]));
    expect(tier).toEqual({ A: 'A', B: 'B', C: 'B' });
  });

  it('llega a S con victorias y uso altos', () => {
    const r = listaCampeones([
      b('Top1', 'TOP', 400, 0.56),
      b('Top2', 'TOP', 100, 0.5),
      b('Top3', 'TOP', 100, 0.49),
      b('Top4', 'TOP', 100, 0.48),
    ]);
    expect(r.campeones.find((c) => c.campeon === 'Top1')!.tier).toBe('S');
  });

  it('un rol con un solo campeón (desviación 0) queda en B', () => {
    const r = listaCampeones([b('Ahri', 'MIDDLE', 300, 0.6)]);
    expect(r.campeones[0]!.tier).toBe('B');
  });

  it('con menos de 30 partidas nunca pasa de B y se marca como datos limitados', () => {
    const r = listaCampeones([
      b('Raro', 'UTILITY', 29, 0.9),
      b('X', 'UTILITY', 30, 0.45),
      b('Y', 'UTILITY', 30, 0.45),
      b('Z', 'UTILITY', 30, 0.45),
    ]);
    const raro = r.campeones.find((c) => c.campeon === 'Raro')!;
    expect(raro.tier).toBe('B');
    expect(raro.datosLimitados).toBe(true);
    expect(r.campeones.find((c) => c.campeon === 'X')!.datosLimitados).toBe(false);
  });

  it('con pocas partidas y mala puntuación sigue siendo C', () => {
    const r = listaCampeones([b('A', 'TOP', 20, 0.3), b('B', 'TOP', 100, 0.5), b('C', 'TOP', 100, 0.55)]);
    expect(r.campeones.find((c) => c.campeon === 'A')!.tier).toBe('C');
  });

  it('solo usa las builds del parche más reciente', () => {
    const r = listaCampeones([b('Viejo', 'TOP', 500, 0.6, '15.19'), b('Nuevo', 'TOP', 100, 0.5, '15.20'), b('Otro', 'MIDDLE', 100, 0.5, '15.9')]);
    expect(r.parche).toBe('15.20');
    expect(r.campeones.map((c) => c.campeon)).toEqual(['Nuevo']);
    expect(r.campeones[0]!.uso).toBe(1);
  });

  it('ordena por rol y, dentro de cada rol, de mejor a peor puntuación', () => {
    const r = listaCampeones([b('Malo', 'TOP', 100, 0.45), b('Bueno', 'TOP', 100, 0.55), b('Mid', 'MIDDLE', 100, 0.5)]);
    expect(r.campeones.map((c) => c.campeon)).toEqual(['Bueno', 'Malo', 'Mid']);
  });

  it('las entradas tienen exactamente los campos del contrato', () => {
    const r = listaCampeones([b('Ahri', 'MIDDLE', 300, 0.5)]);
    expect(Object.keys(r.campeones[0]!).sort()).toEqual(['campeon', 'datosLimitados', 'partidas', 'rol', 'tasaVictoria', 'tier', 'uso']);
  });
  describe('entradas con menos de 30 partidas (fuera de la media y la desviación)', () => {
    const base = [
      b('Top1', 'TOP', 400, 0.56),
      b('Top2', 'TOP', 100, 0.5),
      b('Top3', 'TOP', 100, 0.49),
      b('Top4', 'TOP', 100, 0.48),
      b('Top5', 'TOP', 250, 0.52),
    ];
    const tiers = (l: Build[]) =>
      Object.fromEntries(listaCampeones(l).campeones.filter((c) => c.partidas >= 30).map((c) => [c.campeon, c.tier]));

    it('los valores extremos con pocas partidas no cambian los tiers de las de 30 o más', () => {
      const conRaros = [...base, b('Raro1', 'TOP', 12, 0.95), b('Raro2', 'TOP', 15, 0.05), b('Raro3', 'TOP', 29, 0.8)];
      expect(tiers(conRaros)).toEqual(tiers(base));
    });

    it('el uso sigue siendo la fracción de todas las partidas del rol', () => {
      const r = listaCampeones([b('A', 'MIDDLE', 90, 0.5), b('B', 'MIDDLE', 90, 0.5), b('Raro', 'MIDDLE', 20, 0.5)]);
      expect(r.campeones.find((c) => c.campeon === 'Raro')!.uso).toBeCloseTo(0.1);
      expect(r.campeones.find((c) => c.campeon === 'A')!.uso).toBeCloseTo(0.45);
    });

    it('un rol con menos de 2 entradas de 30 o más partidas da B a todas', () => {
      const r = listaCampeones([b('Uno', 'JUNGLE', 300, 0.6), b('Raro', 'JUNGLE', 10, 0.2), b('Raro2', 'JUNGLE', 25, 0.9)]);
      expect(r.campeones.map((c) => c.tier)).toEqual(['B', 'B', 'B']);
    });

    it('con pocas partidas y una puntuación excelente queda en B', () => {
      const r = listaCampeones([...base, b('Raro', 'TOP', 25, 0.9)]);
      const raro = r.campeones.find((c) => c.campeon === 'Raro')!;
      expect(raro.tier).toBe('B');
      expect(raro.datosLimitados).toBe(true);
    });
  });
});
