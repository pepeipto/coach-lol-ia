// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { CategoriasVoz } from '../src/renderer/principal/vistas/CategoriasVoz';
import { t } from '../src/shared/i18n';
import type { AjustesVoz } from '../src/shared/tiposApp';
import { GRUPOS_VOZ, TIPOS_VOZ, tiposDeNivel } from '../src/shared/vozCategorias';

afterEach(cleanup);

function montar(voz: Partial<AjustesVoz> = {}) {
  const alCambiar = vi.fn();
  render(<CategoriasVoz voz={{ ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true, ...voz }} alCambiar={alCambiar} />);
  return alCambiar;
}

describe('vista Overlay: qué dice la voz (3.1)', () => {
  it('las 15 categorías, agrupadas, con «Normal» marcado por defecto', () => {
    montar();
    for (const grupo of Object.keys(GRUPOS_VOZ)) expect(screen.getByText(t(`overlay.config.grupoVoz.${grupo}`))).toBeTruthy();
    for (const tipo of TIPOS_VOZ) expect(screen.getByText(t(`overlay.config.tipo.${tipo}`))).toBeTruthy();
    expect(screen.getByRole('tab', { name: t('overlay.config.nivelDetalle.normal') }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(t('overlay.config.nivelDetalle.normalDesc'))).toBeTruthy();
  });

  it('elegir un nivel de detalle enciende exactamente sus categorías', async () => {
    const alCambiar = montar();
    await userEvent.click(screen.getByRole('tab', { name: t('overlay.config.nivelDetalle.completo') }));
    expect(alCambiar).toHaveBeenLastCalledWith(tiposDeNivel('completo'));
    await userEvent.click(screen.getByRole('tab', { name: t('overlay.config.nivelDetalle.basico') }));
    expect(alCambiar).toHaveBeenLastCalledWith(tiposDeNivel('basico'));
  });

  it('tocar una categoría la cambia sola; si ya no coincide con ningún nivel, es «personalizado»', async () => {
    const alCambiar = montar();
    const muerte = screen.getByText(t('overlay.config.tipo.muerte')).closest('.interruptor') as HTMLElement;
    await userEvent.click(within(muerte).getByRole('switch'));
    expect(alCambiar).toHaveBeenLastCalledWith({ ...tiposDeNivel('normal'), muerte: true });
    cleanup();
    montar({ tipos: { ...tiposDeNivel('normal'), cs: false } });
    expect(screen.getAllByRole('tab').every((tab) => tab.getAttribute('aria-selected') === 'false')).toBe(true);
    expect(screen.getByText(t('overlay.config.nivelDetalle.personalizado'))).toBeTruthy();
  });

  it('con la voz apagada no se puede cambiar nada', async () => {
    const alCambiar = montar({ activa: false });
    await userEvent.click(screen.getByRole('tab', { name: t('overlay.config.nivelDetalle.completo') }));
    const cs = screen.getByText(t('overlay.config.tipo.cs')).closest('.interruptor') as HTMLElement;
    await userEvent.click(within(cs).getByRole('switch'));
    expect(alCambiar).not.toHaveBeenCalled();
  });
});
