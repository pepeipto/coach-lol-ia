import { describe, expect, it } from 'vitest';
import { esComboValido, normalizarConsejosEnfrentamiento, RUTAS_CONSEJOS_ENFRENTAMIENTO, type ConsejosEnfrentamiento } from '../src';

const CONSEJOS: ConsejosEnfrentamiento = {
  campeon: 'Darius',
  rival: 'Teemo',
  idioma: 'es',
  rol: 'TOP',
  consejos: ['Cuidado con su ceguera.', 'A nivel 2 tu E lo atrapa.', 'Su ventana de poder llega a nivel 6.'],
  combos: ['E → AA → W → Q'],
  generadoEn: '2026-10-25T10:00:00.000Z',
};

describe('contrato de los consejos del enfrentamiento', () => {
  it('la ruta lleva los dos campeones, el rol y el idioma', () => {
    expect(RUTAS_CONSEJOS_ENFRENTAMIENTO.consejos('MonkeyKing', 'Teemo', 'TOP', 'pt-BR')).toBe('/enfrentamiento-consejos/MonkeyKing/Teemo/TOP?idioma=pt-BR');
  });

  it('acepta unos consejos bien formados tal cual', () => {
    expect(normalizarConsejosEnfrentamiento(CONSEJOS)).toEqual(CONSEJOS);
  });

  it('recorta, descarta frases largas y combos sin habilidades, y quita los combos si no queda ninguno', () => {
    const c = normalizarConsejosEnfrentamiento({
      ...CONSEJOS,
      consejos: ['  uno  ', 'x'.repeat(181), 'dos', 'tres', 'cuatro', 'cinco'],
      combos: ['Pégale', 'Q', 'W → E', 'R → Q → W'],
    })!;
    expect(c.consejos).toEqual(['uno', 'dos', 'tres', 'cuatro']);
    expect(c.combos).toEqual(['Q', 'W → E']);
    expect(normalizarConsejosEnfrentamiento({ ...CONSEJOS, combos: ['nada'] })).not.toHaveProperty('combos');
    expect(esComboValido('AA → Qiyana')).toBe(false);
  });

  it('rechaza lo que no tiene la forma del contrato', () => {
    expect(normalizarConsejosEnfrentamiento(null)).toBeNull();
    expect(normalizarConsejosEnfrentamiento({ ...CONSEJOS, consejos: ['uno', 'dos'] })).toBeNull();
    expect(normalizarConsejosEnfrentamiento({ ...CONSEJOS, rival: 'darius' })).toBeNull();
    expect(normalizarConsejosEnfrentamiento({ ...CONSEJOS, rol: 'MID' })).toBeNull();
    expect(normalizarConsejosEnfrentamiento({ ...CONSEJOS, idioma: 'it' })).toBeNull();
    expect(normalizarConsejosEnfrentamiento({ ...CONSEJOS, campeon: '../x' })).toBeNull();
    expect(normalizarConsejosEnfrentamiento({ ...CONSEJOS, generadoEn: '' })).toBeNull();
  });
});
