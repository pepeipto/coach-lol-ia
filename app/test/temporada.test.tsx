// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { temporadaDe } from '../src/shared/temporada';
import { EfectosTemporada } from '../src/renderer/principal/EfectosTemporada';

describe('efectos de temporada', () => {
  it('elige la temporada por la fecha', () => {
    expect(temporadaDe(new Date(2026, 11, 20))).toBe('invierno');
    expect(temporadaDe(new Date(2027, 0, 25))).toBe('lunar');
    expect(temporadaDe(new Date(2026, 6, 4))).toBe('verano');
    expect(temporadaDe(new Date(2026, 9, 31))).toBe('otono');
    expect(temporadaDe(new Date(2026, 3, 10))).toBeNull();
  });
  it('está apagada por defecto', () => {
    window.localStorage.removeItem('coach.efectosTemporada');
    render(<EfectosTemporada fecha={new Date(2026, 10, 10)} />);
    expect(screen.queryByTestId('efectos-temporada')).toBeNull();
  });
  it('pinta la capa solo en temporada y la oculta a lectores de pantalla', () => {
    window.localStorage.setItem('coach.efectosTemporada', '1');
    const { unmount } = render(<EfectosTemporada fecha={new Date(2026, 10, 10)} />);
    expect(screen.getByTestId('efectos-temporada').getAttribute('aria-hidden')).toBe('true');
    unmount();
    render(<EfectosTemporada fecha={new Date(2026, 3, 10)} />);
    expect(screen.queryByTestId('efectos-temporada')).toBeNull();
  });
});
