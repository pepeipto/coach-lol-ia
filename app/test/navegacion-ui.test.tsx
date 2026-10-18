// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/renderer/principal/App';
import { t } from '../src/shared/i18n';
import type { Ajustes, ApiCoach, EstadoPrincipal } from '../src/shared/tiposApp';

const ajustes: Ajustes = {
  avisos: { compra: true, habilidad: true, objetivo: true, vision: true, fase: true },
  voz: false,
  importacionAutomatica: true,
  teclaOverlay: 'Alt+C',
  posicionOverlay: null,
};

function estadoBase(cliente: EstadoPrincipal['cliente']): EstadoPrincipal {
  return {
    cliente,
    seleccion: null,
    version: '16.20.1',
    recursos: { objetos: {}, runas: {}, hechizos: {} },
    error: null,
    importacion: null,
    aviso: null,
  };
}

let emitir: (e: EstadoPrincipal) => void = () => {};

function api(): ApiCoach {
  return {
    alCambiarEstado: (cb) => {
      emitir = cb;
    },
    importar: vi.fn(),
    cambiarRol: vi.fn(),
    obtenerAjustes: vi.fn().mockResolvedValue(ajustes),
    guardarAjustes: vi.fn().mockResolvedValue(undefined),
    moverOverlay: vi.fn().mockResolvedValue(false),
    overlayMoviendo: vi.fn().mockResolvedValue(false),
    alCambiarMover: () => () => {},
    ventana: vi.fn(),
    // Aún no hay manejador en el proceso principal: la app debe tratarlo como plan gratuito.
    licencia: vi.fn().mockRejectedValue(new Error('No handler registered')),
    activarLicencia: vi.fn(),
    quitarLicencia: vi.fn(),
    abrirWeb: vi.fn().mockResolvedValue(undefined),
    alCambiarLicencia: () => () => {},
  };
}

beforeEach(() => {
  window.coach = api();
});
afterEach(cleanup);

describe('navegación de la ventana principal', () => {
  it('la barra lateral muestra Campeón, Overlay, Ajustes y Premium', () => {
    render(<App />);
    const nav = screen.getByRole('navigation');
    for (const texto of ['Campeón', 'Overlay', 'Ajustes', 'Premium']) {
      expect(nav.contains(screen.getByRole('button', { name: texto }))).toBe(true);
    }
    expect(screen.getByRole('button', { name: 'Campeón' }).getAttribute('aria-current')).toBe('page');
  });

  it('al hacer clic en Ajustes se ve la vista de ajustes', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    expect(screen.getByRole('button', { name: 'Ajustes' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText(t('ajustes.importacionAutomatica'))).toBeTruthy();
  });

  it('el indicador de conexión cambia según estado.cliente', () => {
    render(<App />);
    act(() => emitir(estadoBase('esperando')));
    expect(screen.getByText('Esperando al cliente…')).toBeTruthy();
    act(() => emitir(estadoBase('conectado')));
    expect(screen.getByText('Conectado')).toBeTruthy();
    expect(screen.queryByText('Esperando al cliente…')).toBeNull();
  });

  it('los botones de la barra de título llaman a ventana()', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: t('ventana.minimizar') }));
    await userEvent.click(screen.getByRole('button', { name: t('ventana.maximizar') }));
    await userEvent.click(screen.getByRole('button', { name: t('ventana.cerrar') }));
    expect(window.coach.ventana).toHaveBeenNthCalledWith(1, 'minimizar');
    expect(window.coach.ventana).toHaveBeenNthCalledWith(2, 'maximizar');
    expect(window.coach.ventana).toHaveBeenNthCalledWith(3, 'cerrar');
  });
});
