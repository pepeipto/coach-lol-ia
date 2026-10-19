// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/renderer/principal/App';
import { aplicarTema, iniciarTema } from '../src/renderer/comun/tema';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { VERSION_ACTUAL } from '../src/shared/novedades';
import type { Ajustes, ApiCoach } from '../src/shared/tiposApp';

const ajustes: Ajustes = { ...AJUSTES_POR_DEFECTO, bienvenidaVista: true, ultimaVersionVista: VERSION_ACTUAL };

function api(guardar = vi.fn().mockResolvedValue(undefined), a: Ajustes = ajustes): ApiCoach {
  return {
    alCambiarEstado: () => {},
    importar: vi.fn(),
    cambiarRol: vi.fn(),
    cambiarOpcion: vi.fn().mockResolvedValue(undefined),
    cambiarRunas: vi.fn().mockResolvedValue(undefined),
    asistente: vi.fn(),
    obtenerAjustes: vi.fn().mockResolvedValue(a),
    guardarAjustes: guardar,
    moverOverlay: vi.fn().mockResolvedValue(false),
    overlayMoviendo: vi.fn().mockResolvedValue(false),
    alCambiarMover: () => () => {},
    ventana: vi.fn(),
    licencia: vi.fn().mockRejectedValue(new Error('sin licencia')),
    activarLicencia: vi.fn(),
    quitarLicencia: vi.fn(),
    abrirWeb: vi.fn().mockResolvedValue(undefined),
    alCambiarLicencia: () => () => {},
    campeones: vi.fn().mockResolvedValue({ ok: false, error: 'datos' }),
    buildDe: vi.fn().mockResolvedValue({ ok: false, error: 'datos' }),
  };
}

const temaDocumento = () => document.documentElement.dataset.tema;

beforeEach(() => {
  window.coach = api();
  delete document.documentElement.dataset.tema;
});
afterEach(() => cleanup());

describe('tema de la ventana principal (3.0.1)', () => {
  it('iniciarTema pone el tema del preload en <html> y sigue los cambios de ajustes', () => {
    let avisar: (a: Ajustes) => void = () => {};
    iniciarTema({ tema: 'sombra', alCambiarAjustes: (cb) => ((avisar = cb), () => {}) });
    expect(temaDocumento()).toBe('sombra');
    avisar({ ...ajustes, tema: 'clasico' });
    expect(temaDocumento()).toBe('clasico');
  });

  it('sin tema del preload (o con uno desconocido), el clásico', () => {
    iniciarTema(undefined);
    expect(temaDocumento()).toBe('clasico');
    aplicarTema('otro');
    expect(temaDocumento()).toBe('clasico');
  });

  it('Ajustes ofrece Clásico y Sombra; elegir Sombra lo aplica al momento y lo guarda', async () => {
    const guardar = vi.fn().mockResolvedValue(undefined);
    window.coach = api(guardar);
    aplicarTema('clasico');
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    const grupo = await screen.findByRole('radiogroup', { name: 'Tema' });
    const clasico = screen.getByRole('radio', { name: 'Clásico' });
    const sombra = screen.getByRole('radio', { name: 'Sombra' });
    expect(grupo).toBeTruthy();
    expect(clasico.getAttribute('aria-checked')).toBe('true');
    expect(sombra.getAttribute('aria-checked')).toBe('false');

    await userEvent.click(sombra);
    expect(temaDocumento()).toBe('sombra');
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ tema: 'sombra' }));
    expect(screen.getByRole('radio', { name: 'Sombra' }).getAttribute('aria-checked')).toBe('true');
  });

  it('con las flechas se cambia de tema dentro del grupo', async () => {
    const guardar = vi.fn().mockResolvedValue(undefined);
    window.coach = api(guardar, { ...ajustes, tema: 'sombra' });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    const sombra = await screen.findByRole('radio', { name: 'Sombra' });
    sombra.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ tema: 'clasico' }));
    expect(temaDocumento()).toBe('clasico');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Clásico' }));
  });
});
