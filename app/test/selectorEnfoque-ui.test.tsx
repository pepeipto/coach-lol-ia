// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { CategoriasVoz } from '../src/renderer/principal/vistas/CategoriasVoz';
import { SelectorEnfoque } from '../src/renderer/principal/vistas/SelectorEnfoque';
import { t } from '../src/shared/i18n';
import type { AjustesVoz } from '../src/shared/tiposApp';

afterEach(cleanup);

const VOZ: AjustesVoz = { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true };

describe('vista Overlay: modo enfoque (3.18)', () => {
  it('por defecto «Sin enfoque»; elegir uno lo guarda y volver a «Sin enfoque» lo quita', async () => {
    const alCambiar = vi.fn();
    render(<SelectorEnfoque voz={VOZ} alCambiar={alCambiar} />);
    expect(screen.getByText(t('overlay.config.enfoque.ningunoDesc'))).toBeTruthy();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await userEvent.selectOptions(select, 'objetivos');
    expect(alCambiar).toHaveBeenLastCalledWith('objetivos');
    await userEvent.selectOptions(select, '');
    expect(alCambiar).toHaveBeenLastCalledWith(null);
  });

  it('con un enfoque, explica qué dirá y las categorías quedan desactivadas', () => {
    const voz = { ...VOZ, enfoque: 'objetivos' as const };
    render(<SelectorEnfoque voz={voz} alCambiar={() => {}} />);
    expect(screen.getByText(t('overlay.config.enfoque.objetivosDesc'))).toBeTruthy();
    cleanup();
    render(<CategoriasVoz voz={voz} alCambiar={() => {}} />);
    for (const s of screen.getAllByRole('switch')) expect((s as HTMLButtonElement).disabled || s.getAttribute('aria-disabled') === 'true').toBe(true);
  });
});
