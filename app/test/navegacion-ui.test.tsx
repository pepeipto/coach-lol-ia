// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/renderer/principal/App';
import { t } from '../src/shared/i18n';
import type { Ajustes, ApiCoach, EstadoLicencia, EstadoPrincipal } from '../src/shared/tiposApp';

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

function estadoConSeleccion(): EstadoPrincipal {
  return {
    ...estadoBase('conectado'),
    recursos: { objetos: { 3157: 'Reloj de arena' }, runas: {}, hechizos: {} },
    seleccion: {
      campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 },
      rol: 'MIDDLE',
      rolesDisponibles: ['MIDDLE'],
      resultado: {
        estado: 'ok',
        build: {
          campeon: 'Ahri', rol: 'MIDDLE', parche: '16.20', partidas: 100, tasaVictoria: 0.51, mezclaParches: false,
          runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112, 8126, 8138, 8135, 8304, 8313, 5008, 5008, 5001] },
          hechizos: [4, 14], objetosIniciales: [1056], nucleo: [3157], botas: 3020, situacionales: [],
          ordenHabilidades: ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E', 'R', 'E', 'E'],
          calculadoEn: '',
        },
      },
    },
  };
}

describe('plan de la licencia en la ventana principal', () => {
  it('si licencia() falla se usa el plan gratuito: banner promocional e insignia Gratis', async () => {
    render(<App />);
    act(() => emitir(estadoConSeleccion()));
    expect(await screen.findByText(t('banner.texto'))).toBeTruthy();
    expect(screen.getByText('Gratis')).toBeTruthy();
  });

  it('mientras la licencia no responde no se ve ni el banner ni el aviso de Premium', async () => {
    let responder: (e: EstadoLicencia) => void = () => {};
    window.coach.licencia = vi.fn(() => new Promise<EstadoLicencia>((r) => (responder = r)));
    render(<App />);
    act(() => emitir(estadoConSeleccion()));
    expect(screen.queryByText(t('banner.texto'))).toBeNull();
    expect(screen.queryByText('Gratis')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Overlay' }));
    expect(screen.queryByText(t('vistaOverlay.avisoPremium'))).toBeNull();

    // Con premium tampoco aparecen al llegar la respuesta.
    await act(async () => responder({ plan: 'premium', estado: 'activa', renuevaEn: null, claveVisible: null }));
    expect(screen.queryByText(t('vistaOverlay.avisoPremium'))).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Campeón' }));
    expect(screen.queryByText(t('banner.texto'))).toBeNull();
  });

  it('con plan gratuito confirmado la vista Overlay avisa de que el coach en partida es Premium', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Overlay' }));
    expect(await screen.findByText(t('vistaOverlay.avisoPremium'))).toBeTruthy();
  });
});
