import { afterEach, describe, expect, it } from 'vitest';
import { textoAcelerador } from '../src/shared/teclas';
import { establecerIdioma } from '../src/shared/i18n';

afterEach(() => establecerIdioma('es'));

describe('textoAcelerador', () => {
  it('pasa el acelerador de Electron a una forma legible en español', () => {
    expect(textoAcelerador('CommandOrControl+Shift+O')).toBe('Ctrl+Mayús+O');
    expect(textoAcelerador('Alt+Shift+L')).toBe('Alt+Mayús+L');
    expect(textoAcelerador('Shift+Ctrl+o')).toBe('Ctrl+Mayús+O');
    expect(textoAcelerador('F5')).toBe('F5');
    expect(textoAcelerador('Alt+num4')).toBe('Alt+Num 4');
  });

  it('en el idioma de la app', () => {
    establecerIdioma('en');
    expect(textoAcelerador('CommandOrControl+Shift+O')).toBe('Ctrl+Shift+O');
    establecerIdioma('de');
    expect(textoAcelerador('CommandOrControl+Shift+O')).toBe('Strg+Umschalt+O');
    establecerIdioma('fr');
    expect(textoAcelerador('Alt+Shift+L')).toBe('Alt+Maj+L');
  });

  it('acepta nombres propios', () => {
    expect(textoAcelerador('Ctrl+Alt+num0', { ctrl: 'C', alt: 'A', shift: 'S', num: 'N{n}' })).toBe('C+A+N0');
  });
});
