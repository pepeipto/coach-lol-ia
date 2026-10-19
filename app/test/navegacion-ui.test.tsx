// @vitest-environment jsdom
// Con Premium encendido (las pruebas fuerzan el interruptor para seguir cubriendo su código); el
// comportamiento por defecto, con Premium desactivado, está en gratis-ui.test.tsx.
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
  idioma: 'es',
  tema: 'clasico',
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

describe('navegación de la ventana principal', () => {
  it('la barra lateral muestra Campeón, Overlay, Ajustes, Premium y Ayuda', () => {
    render(<App premiumHabilitado />);
    const nav = screen.getByRole('navigation');
    for (const texto of ['Campeón', 'Overlay', 'Ajustes', 'Premium', 'Ayuda']) {
      expect(nav.contains(screen.getByRole('button', { name: texto }))).toBe(true);
    }
    expect(screen.getByRole('button', { name: 'Campeón' }).getAttribute('aria-current')).toBe('page');
  });

  it('la barra lateral tiene «Campeones», tras «Campeón», y abre la lista de campeones', async () => {
    render(<App premiumHabilitado />);
    const entradas = Array.from(screen.getByRole('navigation').querySelectorAll('button')).map((b) => b.textContent);
    expect(entradas.slice(0, 2)).toEqual(['Campeón', 'Campeones']);
    await userEvent.click(screen.getByRole('button', { name: 'Campeones' }));
    expect(screen.getByRole('button', { name: 'Campeones' }).getAttribute('aria-current')).toBe('page');
    expect(window.coach.campeones).toHaveBeenCalledWith({ modo: 'clasificatoria' });
    expect(await screen.findByText(t('campeones.errorTitulo'))).toBeTruthy();
  });

  it('al hacer clic en Ayuda se ve el chat del asistente', async () => {
    render(<App premiumHabilitado />);
    await userEvent.click(screen.getByRole('button', { name: 'Ayuda' }));
    expect(screen.getByRole('button', { name: 'Ayuda' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByLabelText('Tu pregunta')).toBeTruthy();
  });

  it('al hacer clic en Ajustes se ve la vista de ajustes', async () => {
    render(<App premiumHabilitado />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    expect(screen.getByRole('button', { name: 'Ajustes' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText(t('ajustes.importacionAutomatica'))).toBeTruthy();
  });

  it('el indicador de conexión cambia según estado.cliente', () => {
    render(<App premiumHabilitado />);
    act(() => emitir(estadoBase('esperando')));
    expect(screen.getByText('Esperando al cliente…')).toBeTruthy();
    act(() => emitir(estadoBase('conectado')));
    expect(screen.getByText('Conectado')).toBeTruthy();
    expect(screen.queryByText('Esperando al cliente…')).toBeNull();
  });

  it('los botones de la barra de título llaman a ventana()', async () => {
    render(<App premiumHabilitado />);
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

describe('plan de la licencia en la ventana principal', () => {
  it('si licencia() falla se usa el plan gratuito: banner promocional e insignia Gratis', async () => {
    render(<App premiumHabilitado />);
    act(() => emitir(estadoConSeleccion()));
    expect(await screen.findByText(t('banner.texto'))).toBeTruthy();
    expect(screen.getByText('Gratis')).toBeTruthy();
  });

  it('mientras la licencia no responde no se ve ni el banner ni el aviso de Premium', async () => {
    let responder: (e: EstadoLicencia) => void = () => {};
    window.coach.licencia = vi.fn(() => new Promise<EstadoLicencia>((r) => (responder = r)));
    render(<App premiumHabilitado />);
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
    render(<App premiumHabilitado />);
    await userEvent.click(screen.getByRole('button', { name: 'Overlay' }));
    expect(await screen.findByText(t('vistaOverlay.avisoPremium'))).toBeTruthy();
  });
});
