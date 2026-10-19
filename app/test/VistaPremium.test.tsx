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
  it('con una licencia vitalicia muestra «Licencia vitalicia» en lugar de la renovación y no ofrece gestionar la suscripción', () => {
    render(<VistaPremium licencia={{ ...premium, renuevaEn: null, vitalicia: true }} alCambiarLicencia={vi.fn()} />);
    expect(screen.getByText('Licencia vitalicia')).toBeTruthy();
    expect(screen.queryByText(/Se renueva/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gestionar suscripción' })).toBeNull();
    expect(screen.getByRole('button', { name: t('premium.quitar') })).toBeTruthy();
  });

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

describe('VistaPremium: pruebas', () => {
  const HORA = 3600 * 1000;
  const prueba = (msRestantes: number): EstadoLicencia => ({
    plan: 'premium',
    estado: 'activa',
    renuevaEn: null,
    claveVisible: 'CLIA-••••-••••-••••-7K2P',
    tipo: 'prueba',
    caducaEn: new Date(Date.now() + msRestantes).toISOString(),
  });

  it('una prueba activa muestra «Prueba gratuita: quedan N h» y no ofrece gestionar la suscripción', () => {
    render(<VistaPremium licencia={prueba(5 * HORA + 10 * 60 * 1000)} alCambiarLicencia={vi.fn()} />);
    expect(screen.getByText('Prueba gratuita: quedan 5 h')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gestionar suscripción' })).toBeNull();
  });

  it('con menos de 1 h muestra los minutos', () => {
    render(<VistaPremium licencia={prueba(42 * 60 * 1000 + 5000)} alCambiarLicencia={vi.fn()} />);
    expect(screen.getByText('Prueba gratuita: quedan 42 min')).toBeTruthy();
  });

  it('una prueba caducada invita a suscribirse', async () => {
    render(
      <VistaPremium
        licencia={{ plan: 'gratis', estado: 'caducada', renuevaEn: null, claveVisible: 'CLIA-••••-••••-••••-7K2P', tipo: 'prueba', caducaEn: new Date(Date.now() - HORA).toISOString() }}
        alCambiarLicencia={vi.fn()}
      />,
    );
    expect(screen.getByText('Tu prueba ha terminado. Hazte Premium por 4,99 €/mes.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Suscribirme' }));
    expect(window.coach.abrirWeb).toHaveBeenCalledWith('/premium');
  });

  it('otro dispositivo y prueba ya usada se explican en español', () => {
    const { rerender } = render(<VistaPremium licencia={{ ...gratis, estado: 'otro_dispositivo', tipo: 'prueba' }} alCambiarLicencia={vi.fn()} />);
    expect(screen.getByText(t('premium.estado.otro_dispositivo'))).toBeTruthy();
    rerender(<VistaPremium licencia={{ ...gratis, estado: 'prueba_ya_usada', tipo: 'prueba' }} alCambiarLicencia={vi.fn()} />);
    expect(screen.getByText(t('premium.estado.prueba_ya_usada'))).toBeTruthy();
  });

  it('al activar, los motivos de main (prueba_ya_usada…) se muestran con su texto', async () => {
    vi.mocked(window.coach.activarLicencia).mockRejectedValue(new Error("Error invoking remote method 'coach:licencia-activar': Error: prueba_ya_usada"));
    render(<VistaPremium licencia={gratis} alCambiarLicencia={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Clave de licencia'), 'CLIA-ABCD-EFGH-JKLM-NPQR');
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    expect((await screen.findByRole('alert')).textContent).toContain(t('premium.estado.prueba_ya_usada'));
  });
});
