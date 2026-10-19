import { describe, expect, it } from 'vitest';
import { avisoEnModo, widgetsDeModo } from '../src/shared/modosOverlay';

describe('overlay según el modo', () => {
  it('en la Grieta (o sin modo) se ve todo', () => {
    for (const modo of ['clasificatoria', undefined] as const) {
      expect(Object.values(widgetsDeModo(modo)).every(Boolean)).toBe(true);
      expect(avisoEnModo('objetivo', modo)).toBe(true);
    }
  });

  it('en ARAM, ARAM: Caos y Arena se ocultan objetivos, CS y jungla, y quedan compra, habilidad y avisos', () => {
    for (const modo of ['aram', 'caos', 'arena'] as const) {
      expect(widgetsDeModo(modo)).toEqual({ objetivos: false, habilidad: true, cs: false, compra: true, jungla: false, avisos: true });
      expect(['compra', 'habilidad', 'objetivo', 'vision', 'fase'].filter((t) => avisoEnModo(t as never, modo))).toEqual(['compra', 'habilidad']);
    }
  });
});
