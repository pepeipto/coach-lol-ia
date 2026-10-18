// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VistaPremium } from '../src/renderer/principal/vistas/VistaPremium';
import { t } from '../src/shared/i18n';
import type { ApiCoach, EstadoLicencia } from '../src/shared/tiposApp';

const gratis: EstadoLicencia = { plan: 'gratis', estado: 'sin_licencia', renuevaEn: null, claveVisible: null };
const premium: EstadoLicencia = {
  plan: 'premium',
  estado: 'activa',
  renuevaEn: '2026-11-18T00:00:00Z',
  claveVisible: 'CLIA-****-****-****-7K2P',
};

beforeEach(() => {
  window.coach = {
    abrirWeb: vi.fn().mockResolvedValue(undefined),
    activarLicencia: vi.fn().mockResolvedValue(premium),
    quitarLicencia: vi.fn().mockResolvedValue(gratis),
  } as unknown as ApiCoach;
});
afterEach(cleanup);

describe('VistaPremium', () => {
  it('con plan gratis muestra el precio y Suscribirme abre la web de precios', async () => {
    render(<VistaPremium licencia={gratis} alCambiarLicencia={vi.fn()} />);
    expect(screen.getByText('4,99 €/mes')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Suscribirme' }));
    expect(window.coach.abrirWeb).toHaveBeenCalledWith('/premium');
  });

  it('Activar llama a activarLicencia con la clave recortada y avisa del cambio', async () => {
    const alCambiarLicencia = vi.fn();
    render(<VistaPremium licencia={gratis} alCambiarLicencia={alCambiarLicencia} />);
    await userEvent.type(screen.getByLabelText('Clave de licencia'), '  CLIA-ABCD-EFGH-JKLM-NPQR  ');
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    expect(window.coach.activarLicencia).toHaveBeenCalledWith('CLIA-ABCD-EFGH-JKLM-NPQR');
    expect(alCambiarLicencia).toHaveBeenCalledWith(premium);
  });

  it('si la clave no activa Premium muestra el error', async () => {
    vi.mocked(window.coach.activarLicencia).mockResolvedValue(gratis);
    render(<VistaPremium licencia={gratis} alCambiarLicencia={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Clave de licencia'), 'CLIA-MALA');
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('si main rechaza el formato (clave_no_valida) dice que la clave no es válida, no que falte conexión', async () => {
    vi.mocked(window.coach.activarLicencia).mockRejectedValue(
      new Error("Error invoking remote method 'coach:licencia-activar': Error: clave_no_valida"),
    );
    render(<VistaPremium licencia={gratis} alCambiarLicencia={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Clave de licencia'), 'CLIA-MALA');
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    expect((await screen.findByRole('alert')).textContent).toContain(t('premium.claveNoValida'));
  });

  it('si main no puede consultar el servidor avisa del problema de conexión', async () => {
    vi.mocked(window.coach.activarLicencia).mockRejectedValue(new Error("Error invoking remote method 'coach:licencia-activar': Error: sin_conexion"));
    render(<VistaPremium licencia={gratis} alCambiarLicencia={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Clave de licencia'), 'CLIA-ABCD-EFGH-JKLM-NPQR');
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    expect((await screen.findByRole('alert')).textContent).toContain(t('premium.errorActivar'));
  });

  it('con plan premium muestra el estado y Gestionar suscripción abre la web de gestión', async () => {
    render(<VistaPremium licencia={premium} alCambiarLicencia={vi.fn()} />);
    expect(screen.getByText('Premium activo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Suscribirme' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Gestionar suscripción' }));
    expect(window.coach.abrirWeb).toHaveBeenCalledWith('/premium/gestionar');
  });
});

describe('VistaPremium tras activar', () => {
  it('al pasar a premium tras activar muestra la confirmación', async () => {
    const { rerender } = render(<VistaPremium licencia={gratis} alCambiarLicencia={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Clave de licencia'), 'CLIA-ABCD-EFGH-JKLM-NPQR');
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    rerender(<VistaPremium licencia={premium} alCambiarLicencia={vi.fn()} />);
    expect(screen.getByText(t('premium.activada'))).toBeTruthy();
  });

  it('mientras la licencia carga no muestra precio ni estado', () => {
    render(<VistaPremium licencia={null} alCambiarLicencia={vi.fn()} />);
    expect(screen.queryByText('4,99 €/mes')).toBeNull();
    expect(screen.queryByText('Premium activo')).toBeNull();
  });
});
