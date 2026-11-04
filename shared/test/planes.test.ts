import { describe, expect, it } from 'vitest';
import { esIdPaquete, esIdPlan, formatearEuros, PAQUETES, periodoActual, PLANES, PLANES_DE_PAGO } from '../src/planes';

describe('planes', () => {
  it('el plan Gratis existe y no cuesta nada', () => {
    expect(PLANES.gratis.centimosMes).toBe(0);
    expect(PLANES.gratis.cuota.partida).toBeGreaterThan(0);
  });

  it('cada plan de pago da al menos la cuota del anterior', () => {
    const orden = ['gratis', ...PLANES_DE_PAGO] as const;
    for (let i = 1; i < orden.length; i++) {
      const a = PLANES[orden[i - 1]!];
      const b = PLANES[orden[i]!];
      expect(b.centimosMes).toBeGreaterThan(a.centimosMes);
      expect(b.cuota.partida).toBeGreaterThanOrEqual(a.cuota.partida);
      expect(b.cuota.pregunta).toBeGreaterThanOrEqual(a.cuota.pregunta);
    }
  });

  it('los paquetes grandes salen más baratos por partida', () => {
    const p = Object.values(PAQUETES).map((x) => x.centimos / x.partidas);
    expect(p[0]!).toBeGreaterThan(p[1]!);
    expect(p[1]!).toBeGreaterThan(p[2]!);
  });

  it('valida identificadores', () => {
    expect(esIdPlan('coach')).toBe(true);
    expect(esIdPlan('toString')).toBe(false);
    expect(esIdPaquete('partidas50')).toBe(true);
    expect(esIdPaquete(50)).toBe(false);
  });

  it('formatea euros', () => {
    expect(formatearEuros(899)).toBe('8,99 €');
    expect(formatearEuros(2500)).toBe('25 €');
    expect(formatearEuros(405)).toBe('4,05 €');
  });
});

describe('periodoActual', () => {
  const alta = '2026-01-15T10:00:00.000Z';

  it('el primer mes empieza en el alta', () => {
    expect(periodoActual(alta, Date.parse('2026-01-20T00:00:00Z'))).toEqual({ inicio: alta, fin: '2026-02-15T10:00:00.000Z' });
  });

  it('se renueva cada mes el día del alta', () => {
    expect(periodoActual(alta, Date.parse('2026-03-15T09:59:59Z')).inicio).toBe('2026-02-15T10:00:00.000Z');
    expect(periodoActual(alta, Date.parse('2026-03-15T10:00:00Z')).inicio).toBe('2026-03-15T10:00:00.000Z');
  });

  it('cruza el año', () => {
    expect(periodoActual('2025-12-20T00:00:00Z', Date.parse('2026-01-05T00:00:00Z'))).toEqual({
      inicio: '2025-12-20T00:00:00.000Z',
      fin: '2026-01-20T00:00:00.000Z',
    });
  });

  it('un alta el 31 se renueva el último día de los meses cortos', () => {
    const a = '2026-01-31T12:00:00.000Z';
    expect(periodoActual(a, Date.parse('2026-03-01T00:00:00Z'))).toEqual({ inicio: '2026-02-28T12:00:00.000Z', fin: '2026-03-31T12:00:00.000Z' });
  });

  it('un alta en el futuro (reloj desajustado) cuenta desde el alta', () => {
    expect(periodoActual(alta, Date.parse('2026-01-01T00:00:00Z')).inicio).toBe(alta);
  });
});
