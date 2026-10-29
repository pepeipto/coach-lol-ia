import { describe, expect, it } from 'vitest';
import { consejosComposicion, resumenEquipo } from '../src/shared/composicion';
import type { PerfilCampeon } from '../src/shared/tiposApp';

const p = (ataque: number, magia: number, clases: string[] = ['Fighter']): PerfilCampeon =>
  ({ clases, ataque, magia, alcance: 125, recurso: 'Mana' }) as PerfilCampeon;

describe('resumenEquipo', () => {
  it('reparte el daño según ataque y magia de Data Dragon y cuenta los tanques (clase principal)', () => {
    const r = resumenEquipo([p(8, 2), p(2, 8), p(10, 0), p(0, 0, ['Tank']), p(5, 5, ['Fighter', 'Tank'])]);
    expect(r).toEqual({ fisico: 63, tanques: 1, conocidos: 5 });
  });

  it('sin perfiles (Data Dragon antiguo en caché) no hay resumen', () => {
    expect(resumenEquipo([undefined, null])).toBeNull();
    expect(resumenEquipo([p(0, 0)])).toBeNull();
  });
});

describe('consejosComposicion', () => {
  it('rival sobre todo físico o mágico, mixto, y tanques', () => {
    expect(consejosComposicion({ fisico: 75, tanques: 0, conocidos: 5 }, null)).toEqual([{ clave: 'carga.consejo.rivalFisico', params: { n: 75 } }]);
    expect(consejosComposicion({ fisico: 20, tanques: 2, conocidos: 5 }, null)).toEqual([
      { clave: 'carga.consejo.rivalMagico', params: { n: 80 } },
      { clave: 'carga.consejo.tanques', params: { n: 2 } },
    ]);
    expect(consejosComposicion({ fisico: 50, tanques: 1, conocidos: 5 }, null).map((c) => c.clave)).toEqual(['carga.consejo.rivalMixto']);
  });

  it('avisa si tu equipo pega casi todo de un tipo', () => {
    expect(consejosComposicion(null, { fisico: 85, tanques: 0, conocidos: 5 }).map((c) => c.clave)).toEqual(['carga.consejo.aliadoFisico']);
    expect(consejosComposicion(null, { fisico: 15, tanques: 0, conocidos: 5 }).map((c) => c.clave)).toEqual(['carga.consejo.aliadoMagico']);
    expect(consejosComposicion(null, { fisico: 50, tanques: 0, conocidos: 5 })).toEqual([]);
  });
});
