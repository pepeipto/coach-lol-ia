// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DURACION_INTRO, IntroLogo, introPermitida } from '../src/renderer/principal/IntroLogo';

describe('IntroLogo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('termina sola al acabar la animación, una sola vez', () => {
    const alTerminar = vi.fn();
    render(<IntroLogo alTerminar={alTerminar} />);
    expect(screen.getByTestId('intro-logo')).toBeTruthy();
    act(() => vi.advanceTimersByTime(DURACION_INTRO - 1));
    expect(alTerminar).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(5000));
    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('se salta con un clic o una tecla', () => {
    const alTerminar = vi.fn();
    render(<IntroLogo alTerminar={alTerminar} />);
    fireEvent.click(screen.getByTestId('intro-logo'));
    expect(screen.getByTestId('intro-logo').className).toContain('intro-saltada');
    act(() => vi.advanceTimersByTime(300));
    expect(alTerminar).toHaveBeenCalledTimes(1);

    const otra = vi.fn();
    cleanup();
    render(<IntroLogo alTerminar={otra} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => vi.advanceTimersByTime(300));
    expect(otra).toHaveBeenCalledTimes(1);
  });

  it('no se muestra sin matchMedia ni con «reducir movimiento»', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(introPermitida()).toBe(false);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    expect(introPermitida()).toBe(false);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(introPermitida()).toBe(true);
  });
});
