import { describe, expect, it } from 'vitest';
import { avisoEnModo, vozEnModo, widgetsDeModo } from '../src/shared/modosOverlay';

describe('overlay según el modo', () => {
  it('en la Grieta (o sin modo) se ve todo', () => {
    for (const modo of ['clasificatoria', undefined] as const) {
      // Todo menos el panel de aumentos, que es solo de ARAM: Caos (3.4).
      const { aumentos, ...resto } = widgetsDeModo(modo);
      expect(Object.values(resto).every(Boolean)).toBe(true);
      expect(aumentos).toBe(false);
      expect(avisoEnModo('objetivo', modo)).toBe(true);
    }
  });

  it('en ARAM, ARAM: Caos y Arena se ocultan objetivos y jungla; Rendimiento queda (solo el KDA) con compra y avisos', () => {
    for (const modo of ['aram', 'caos', 'arena'] as const) {
      expect(widgetsDeModo(modo)).toMatchObject({ objetivos: false, cs: true, compra: true, jungla: false, avisos: true });
      expect(['compra', 'habilidad', 'objetivo', 'vision', 'fase'].filter((t) => avisoEnModo(t as never, modo))).toEqual(['compra', 'habilidad']);
    }
  });

  it('la flecha de habilidad sale en ARAM y ARAM: Caos, pero no en Arena (no hay orden de habilidades)', () => {
    expect(widgetsDeModo('aram').habilidad).toBe(true);
    expect(widgetsDeModo('caos').habilidad).toBe(true);
    expect(widgetsDeModo('arena').habilidad).toBe(false);
  });

  it('la voz fuera de la Grieta: compra, habilidad y KDA no; objetivos, CS, visión, fase y jungla tampoco', () => {
    expect(vozEnModo('compra', 'aram')).toBe(true);
    expect(vozEnModo('habilidad', 'aram')).toBe(true);
    expect(vozEnModo('habilidad', 'arena')).toBe(false);
    for (const tipo of ['objetivo', 'cs', 'vision', 'fase', 'jungla'] as const) expect(vozEnModo(tipo, 'caos')).toBe(false);
    expect(vozEnModo('cs', 'clasificatoria')).toBe(true);
  });
});
