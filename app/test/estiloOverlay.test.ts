import { describe, expect, it } from 'vitest';
import { AJUSTES_POR_DEFECTO, normalizarAjustes } from '../src/main/ajustes';
import { ESTILOS_OVERLAY } from '../src/shared/estilosOverlay';
import { IDIOMAS, textosDe } from '../src/shared/i18n';

/* 3.12: estilo visual del overlay (Filo, Hextech, Neón y Cristal). */
describe('estilo del overlay', () => {
  it('por defecto «filo»; se conserva uno válido y uno raro vuelve al de por defecto', () => {
    expect(AJUSTES_POR_DEFECTO.overlay.estilo).toBe('filo');
    expect(normalizarAjustes({}).overlay.estilo).toBe('filo');
    expect(normalizarAjustes({ overlay: { estilo: 'neon' } }).overlay.estilo).toBe('neon');
    expect(normalizarAjustes({ overlay: { estilo: 'arcoiris' } }).overlay.estilo).toBe('filo');
  });

  it('cada estilo tiene nombre y descripción en los cinco idiomas', () => {
    for (const idioma of IDIOMAS) {
      const textos = textosDe(idioma);
      for (const e of ESTILOS_OVERLAY) {
        expect(textos[`overlay.estilo.${e}`], `${idioma}: ${e}`).toBeTruthy();
        expect(textos[`overlay.estilo.${e}Desc`], `${idioma}: ${e}Desc`).toBeTruthy();
      }
    }
  });
});
