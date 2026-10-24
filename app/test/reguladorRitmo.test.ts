import { describe, expect, it } from 'vitest';
import { ReguladorVoz } from '../src/main/consejos/regulador';

describe('3.7: ritmo de la voz', () => {
  const frase = (prioridad: number, clave: string) => ({ tipo: 'objetivo' as const, clave, texto: clave, prioridad, caducaMs: 60_000 });
  it('tranquilo: en una pelea solo pasa lo de prioridad 0 y el hueco es de 12 s', () => {
    const r = new ReguladorVoz();
    r.configurar('tranquilo');
    expect(r.procesar([frase(1, 'a30'), frase(0, 'ya')], 0, true).map((f) => f.clave)).toEqual(['ya']);
    const r2 = new ReguladorVoz();
    r2.configurar('tranquilo');
    expect(r2.procesar([frase(3, 'x')], 0).map((f) => f.clave)).toEqual(['x']);
    expect(r2.procesar([frase(3, 'y')], 6_000)).toEqual([]);
    expect(r2.procesar([], 12_000).map((f) => f.clave)).toEqual(['y']);
  });
  it('activo: hueco de 3 s', () => {
    const r = new ReguladorVoz();
    r.configurar('activo');
    expect(r.procesar([frase(3, 'x')], 0).length).toBe(1);
    expect(r.procesar([frase(3, 'y')], 3_000).map((f) => f.clave)).toEqual(['y']);
  });
});
