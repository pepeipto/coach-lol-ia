// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/renderer/principal/App';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { t } from '../src/shared/i18n';
import { NOVEDADES, VERSION_ACTUAL } from '../src/shared/novedades';
import type { Ajustes, ApiCoach } from '../src/shared/tiposApp';

const base: Ajustes = {
  avisos: { compra: true, habilidad: true, objetivo: true, vision: true, fase: true },
  voz: false,
  importacionAutomatica: false,
  teclaOverlay: 'CommandOrControl+Shift+O',
  posicionOverlay: null,
  overlay: AJUSTES_POR_DEFECTO.overlay,
  teclasJungla: {},
  teclaJungla: 'Alt+Shift+L',
  junglaEnemiga: { avisos: true, ruta: false },
  idioma: 'es',
  tema: 'clasico',
};

let guardados: Ajustes[];

function montar(ajustes: Ajustes) {
  guardados = [];
  const api = {
    alCambiarEstado: () => {},
    importar: vi.fn(),
    cambiarRol: vi.fn(),
    cambiarOpcion: vi.fn().mockResolvedValue(undefined),
    asistente: vi.fn(),
    obtenerAjustes: vi.fn().mockResolvedValue(ajustes),
    guardarAjustes: vi.fn().mockImplementation(async (a: Ajustes) => {
      guardados.push(a);
    }),
    moverOverlay: vi.fn().mockResolvedValue(false),
    overlayMoviendo: vi.fn().mockResolvedValue(false),
    alCambiarMover: () => () => {},
    ventana: vi.fn(),
    licencia: vi.fn().mockRejectedValue(new Error('sin manejador')),
    activarLicencia: vi.fn(),
    quitarLicencia: vi.fn(),
    abrirWeb: vi.fn().mockResolvedValue(undefined),
    alCambiarLicencia: () => () => {},
  } as unknown as ApiCoach;
  window.coach = api;
  return render(<App />);
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('bienvenida de la primera vez', () => {
  it('aparece si no se ha visto y recorre los 4 pasos', async () => {
    montar(base);
    const dialogo = await screen.findByRole('dialog', { name: t('bienvenida.p1.titulo') });
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText(t('bienvenida.paso', { n: 1, total: 4 }))).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('bienvenida.atras') })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: t('bienvenida.siguiente') }));
    expect(screen.getByRole('dialog', { name: 'Pon LoL en modo Sin bordes' })).toBeTruthy();
    expect(screen.getByText(t('bienvenida.paso', { n: 2, total: 4 }))).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: t('bienvenida.siguiente') }));
    expect(screen.getByRole('dialog', { name: 'Cómo se importa' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: t('bienvenida.atras') }));
    expect(screen.getByRole('dialog', { name: 'Pon LoL en modo Sin bordes' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t('bienvenida.siguiente') }));
    await userEvent.click(screen.getByRole('button', { name: t('bienvenida.siguiente') }));

    expect(screen.getByRole('dialog', { name: 'El overlay y la tecla Ctrl+Mayús+O' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('bienvenida.siguiente') })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: t('bienvenida.empezar') }));

    await waitFor(() => expect(guardados).toHaveLength(1));
    expect(guardados[0].bienvenidaVista).toBe(true);
    expect(guardados[0].ultimaVersionVista).toBe(VERSION_ACTUAL);
    expect(screen.queryByRole('dialog')).toBeNull();
    // Es la primera vez: no se encadenan las novedades.
    expect(screen.queryByText(t('novedades.modalTitulo', { version: VERSION_ACTUAL }))).toBeNull();
  });

  it('«Saltar» y Escape también la dan por vista', async () => {
    montar(base);
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: t('bienvenida.saltar') }));
    await waitFor(() => expect(guardados).toHaveLength(1));
    expect(guardados[0].bienvenidaVista).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();

    montar(base);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(guardados).toHaveLength(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('no aparece si ya se vio ni se vuelve a guardar nada', async () => {
    montar({ ...base, bienvenidaVista: true, ultimaVersionVista: VERSION_ACTUAL });
    await act(async () => {});
    await waitFor(() => expect(window.coach.obtenerAjustes).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(guardados).toHaveLength(0);
  });
});

describe('novedades tras actualizar', () => {
  it('muestra «Novedades de la versión X» una vez y la marca como vista', async () => {
    montar({ ...base, bienvenidaVista: true, ultimaVersionVista: '2.1.0' });
    const dialogo = await screen.findByRole('dialog', { name: t('novedades.modalTitulo', { version: VERSION_ACTUAL }) });
    for (const punto of NOVEDADES[0].puntos) expect(dialogo.textContent).toContain(punto);
    await userEvent.click(screen.getByRole('button', { name: t('novedades.entendido') }));
    await waitFor(() => expect(guardados).toHaveLength(1));
    expect(guardados[0].ultimaVersionVista).toBe(VERSION_ACTUAL);
    expect(guardados[0].bienvenidaVista).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('«Ver todas» abre la vista Novedades', async () => {
    montar({ ...base, bienvenidaVista: true, ultimaVersionVista: null });
    await userEvent.click(await screen.findByRole('button', { name: t('novedades.verTodas') }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: t('novedades.titulo') })).toBeTruthy();
    await waitFor(() => expect(guardados).toHaveLength(1));
  });
});

describe('vista Novedades', () => {
  it('está en la barra lateral y lista todas las versiones', async () => {
    montar({ ...base, bienvenidaVista: true, ultimaVersionVista: VERSION_ACTUAL });
    await userEvent.click(screen.getByRole('button', { name: t('nav.novedades') }));
    for (const n of NOVEDADES) {
      expect(screen.getByRole('heading', { name: t('novedades.version', { version: n.version }) })).toBeTruthy();
    }
    expect(screen.getByText(NOVEDADES[4].puntos[0])).toBeTruthy();
    expect(screen.getByText(t('novedades.actual'))).toBeTruthy();
  });
});

describe('foco dentro del diálogo', () => {
  it('Tab y Mayús+Tab dan la vuelta sin salir de la bienvenida', async () => {
    montar(base);
    const dialogo = await screen.findByRole('dialog');
    const botones = Array.from(dialogo.querySelectorAll('button'));
    const primero = botones[0];
    const ultimo = botones[botones.length - 1];
    // «Siguiente» recibe el foco al abrir (en un efecto: con la máquina cargada puede tardar un instante).
    await waitFor(() => expect(document.activeElement).toBe(ultimo));
    await userEvent.tab();
    expect(document.activeElement).toBe(primero);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(ultimo);
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialogo.contains(document.activeElement)).toBe(true);
    }
  });

  it('también en el diálogo de novedades', async () => {
    montar({ ...base, bienvenidaVista: true, ultimaVersionVista: null });
    const dialogo = await screen.findByRole('dialog');
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      expect(dialogo.contains(document.activeElement)).toBe(true);
    }
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    expect(dialogo.contains(document.activeElement)).toBe(true);
  });
});
