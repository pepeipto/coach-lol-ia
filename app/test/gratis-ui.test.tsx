// @vitest-environment jsdom
// Coach LoL IA gratis (PREMIUM_HABILITADO apagado): sin licencia, sin banner y con «Apoya el proyecto».
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/renderer/principal/App';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { t } from '../src/shared/i18n';
import { VERSION_ACTUAL } from '../src/shared/novedades';
import type { Ajustes, ApiCoach, EstadoLicencia, EstadoPrincipal } from '../src/shared/tiposApp';

const ajustes: Ajustes = {
  avisos: { compra: true, habilidad: true, objetivo: true, vision: true, fase: true },
  voz: false,
  importacionAutomatica: true,
  teclaOverlay: 'Alt+C',
  posicionOverlay: null,
  bienvenidaVista: true,
  ultimaVersionVista: VERSION_ACTUAL,
  overlay: AJUSTES_POR_DEFECTO.overlay,
  teclasJungla: {},
  teclaJungla: 'Alt+Shift+L',
  junglaEnemiga: { avisos: true, ruta: false },
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
    cambiarOpcion: vi.fn().mockResolvedValue(undefined),
    asistente: vi.fn().mockResolvedValue({ ok: true, respuesta: 'Hola' }),
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
    campeones: vi.fn().mockResolvedValue({ ok: false, error: 'datos' }),
    buildDe: vi.fn().mockResolvedValue({ ok: false, error: 'datos' }),
  };
}

beforeEach(() => {
  window.coach = api();
});
afterEach(cleanup);

function estadoConSeleccion(): EstadoPrincipal {
  return {
    ...estadoBase('conectado'),
    recursos: { objetos: { 3157: 'Reloj de arena' }, runas: {}, hechizos: {} },
    seleccion: {
      campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 },
      rol: 'MIDDLE',
      rolesDisponibles: ['MIDDLE'],
      opcion: 0,
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

describe('ventana principal con Premium desactivado (por defecto)', () => {
  it('la barra lateral cambia «Premium» por «Apoya el proyecto»', () => {
    render(<App />);
    const nav = screen.getByRole('navigation');
    for (const texto of ['Campeón', 'Overlay', 'Ajustes', 'Apoya el proyecto', 'Ayuda']) {
      expect(nav.contains(screen.getByRole('button', { name: texto }))).toBe(true);
    }
    expect(screen.queryByRole('button', { name: 'Premium' })).toBeNull();
  });

  it('no consulta la licencia ni muestra el banner, la insignia del plan o el aviso de Premium', async () => {
    render(<App />);
    act(() => emitir(estadoConSeleccion()));
    await act(async () => {});
    expect(window.coach.licencia).not.toHaveBeenCalled();
    expect(screen.queryByText(t('banner.texto'))).toBeNull();
    expect(screen.queryByText('Gratis')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Overlay' }));
    expect(screen.queryByText(t('vistaOverlay.avisoPremium'))).toBeNull();
    expect(screen.queryByText(/premium/i)).toBeNull();
  });

  it('Ajustes no tiene la sección Licencia', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    expect(screen.getByRole('tab', { name: t('ajustes.general') })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: t('ajustes.licencia') })).toBeNull();
  });

  it('«Apoya el proyecto» explica que es gratis y «Ver cómo apoyar» abre /apoyar en la web', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Apoya el proyecto' }));
    expect(screen.getByRole('button', { name: 'Apoya el proyecto' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText(t('apoyar.texto'))).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Ver cómo apoyar' }));
    expect(window.coach.abrirWeb).toHaveBeenCalledWith('/apoyar');
  });
});
