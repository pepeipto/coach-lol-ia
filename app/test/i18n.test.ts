import { describe, expect, it } from 'vitest';
import { t } from '../src/shared/i18n';
import es from '../src/shared/i18n/es.json';

describe('t', () => {
  it('interpola parámetros', () => {
    expect(t('aviso.compra', { oro: 1250, objeto: 'Códice demoníaco' })).toBe(
      'Tienes 1250 de oro: ya puedes comprar Códice demoníaco',
    );
  });
  it('devuelve la clave si no existe', () => {
    expect(t('no.existe')).toBe('no.existe');
  });
  it('tiene los 15 consejos de fase con su prefijo', () => {
    const prefijos = { temprana: 'Fase temprana: ', media: 'Fase media: ', tardia: 'Fase tardía: ' };
    for (const rol of ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']) {
      for (const [fase, prefijo] of Object.entries(prefijos)) {
        expect(t(`fase.${rol}.${fase}`).startsWith(prefijo)).toBe(true);
      }
    }
    expect(t('fase.MIDDLE.media')).toBe('Fase media: agrupa con tu equipo para los objetivos');
  });
  it('contiene el aviso legal', () => {
    expect(es['legal.aviso' as keyof typeof es]).toContain('no está respaldado por Riot Games');
  });
});
