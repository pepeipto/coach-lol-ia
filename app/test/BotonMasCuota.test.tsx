// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotonMasCuota } from '../src/renderer/principal/vistas/BotonMasCuota';
import type { ApiCoach, EstadoLicencia } from '../src/shared/tiposApp';

const gratis: EstadoLicencia = { plan: 'gratis', estado: 'sin_licencia', renuevaEn: null, claveVisible: null };
const pago: EstadoLicencia = { plan: 'premium', estado: 'activa', renuevaEn: '2026-12-01T00:00:00Z', claveVisible: 'CLIA-****', tipo: 'suscripcion' };
const prueba: EstadoLicencia = { ...pago, tipo: 'prueba' };

function montar(licencia: EstadoLicencia) {
  const abrirWeb = vi.fn().mockResolvedValue(undefined);
  window.coach = { licencia: vi.fn().mockResolvedValue(licencia), abrirWeb } as unknown as ApiCoach;
  render(<BotonMasCuota />);
  return abrirWeb;
}

afterEach(cleanup);

describe('BotonMasCuota', () => {
  it('en el plan Gratis lleva a los planes', async () => {
    const abrirWeb = montar(gratis);
    await userEvent.click(await screen.findByRole('button', { name: 'Seguir con tu coach desde 4,99 €/mes' }));
    expect(abrirWeb).toHaveBeenCalledWith('/premium');
  });

  it('con un plan de pago lleva a Gestionar (cambiar de plan o comprar partidas)', async () => {
    const abrirWeb = montar(pago);
    await userEvent.click(await screen.findByRole('button', { name: 'Ampliar plan o comprar partidas' }));
    expect(abrirWeb).toHaveBeenCalledWith('/premium/gestionar');
  });

  it('con la prueba gratuita lleva a los planes', async () => {
    const abrirWeb = montar(prueba);
    await userEvent.click(await screen.findByRole('button', { name: 'Seguir con tu coach desde 4,99 €/mes' }));
    expect(abrirWeb).toHaveBeenCalledWith('/premium');
  });
});
