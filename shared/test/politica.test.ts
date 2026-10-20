import { describe, expect, it } from 'vitest';
import { CAMPOS_RETIRADOS_POLITICA, sanearBuildPolitica, type Build } from '../src';

const base = { campeon: 'Ahri', rol: null, modo: 'arena', partidas: 40, tasaVictoria: 0.2 } as unknown as Build;
const conCifras = [{ id: 7, partidas: 12, uso: 0.3, tasaVictoria: 0.6, posicionMedia: 2.5 }];

describe('sanearBuildPolitica (política de Riot: sin % de victorias de aumentos ni de objetos de Arena)', () => {
  it('quita los campos de 3.1 y deja solo id, partidas y uso, también en las opciones', () => {
    const vieja = {
      ...base,
      aumentos: conCifras,
      aumentosMejores: conCifras,
      objetosArena: conCifras,
      objetosArenaMejores: conCifras,
      opciones: [{ ...base, aumentos: conCifras, aumentosMejores: conCifras }],
    } as unknown as Build;
    const b = sanearBuildPolitica(vieja);
    for (const x of [b, b.opciones![0]!]) {
      for (const campo of CAMPOS_RETIRADOS_POLITICA) expect(x).not.toHaveProperty(campo);
      expect(x.aumentosPopulares).toEqual([{ id: 7, partidas: 12, uso: 0.3 }]);
    }
    expect(b.objetosArenaPopulares).toEqual([{ id: 7, partidas: 12, uso: 0.3 }]);
    expect(JSON.stringify(b)).not.toMatch(/posicionMedia|0\.6/);
    // La build original no cambia.
    expect((vieja as unknown as { aumentos: unknown }).aumentos).toBe(conCifras);
  });

  it('las cifras extra dentro de los campos nuevos también se descartan', () => {
    const b = sanearBuildPolitica({ ...base, aumentosPopulares: conCifras } as unknown as Build);
    expect(b.aumentosPopulares).toEqual([{ id: 7, partidas: 12, uso: 0.3 }]);
  });

  it('una build sin aumentos ni objetos de Arena no gana campos', () => {
    expect(sanearBuildPolitica(base)).toEqual(base);
  });

  it('las cifras del campeón en Arena (victorias, posición media) se conservan', () => {
    const arena = { ...base, arena: { posicionMedia: 4.1, top4: 0.5, victorias: 0.2 } } as Build;
    expect(sanearBuildPolitica(arena).arena).toEqual({ posicionMedia: 4.1, top4: 0.5, victorias: 0.2 });
  });
});
