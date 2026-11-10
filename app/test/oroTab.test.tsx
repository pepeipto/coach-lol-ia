// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO, normalizarAjustes } from '../src/main/ajustes';
import { crearLectorWindows, crearVigiaTab, INTERVALO_TAB_MS, type LectorTeclado } from '../src/main/partida/teclaTab';
import { Overlay } from '../src/renderer/overlay/Overlay';
import { PanelOroTab } from '../src/renderer/overlay/widgets/PanelOroTab';
import { widgetsDeModo } from '../src/shared/modosOverlay';
import { t } from '../src/shared/i18n';
import type { AjustesOverlay, ApiOverlay, EstadoOverlay } from '../src/shared/tiposApp';

afterEach(() => cleanup());

/** Reloj manual: `pasar()` ejecuta una vuelta del temporizador. */
function relojFalso() {
  let cb: (() => void) | null = null;
  return {
    reloj: { setInterval: vi.fn((f: () => void, _ms: number) => ((cb = f), 1)), clearInterval: vi.fn(() => void (cb = null)) },
    pasar: () => cb?.(),
    activo: () => cb !== null,
  };
}

describe('3.19 · vigía de Tab (solo lee la tecla)', () => {
  it('avisa solo al cambiar, y solo con el juego delante', async () => {
    const lector: LectorTeclado = { tabPulsada: () => false, juegoDelante: () => true };
    const r = relojFalso();
    const cambios: boolean[] = [];
    const vigia = crearVigiaTab(async () => lector, (p) => cambios.push(p), r.reloj);
    await vigia.activar(true);
    expect(r.reloj.setInterval).toHaveBeenCalledWith(expect.any(Function), INTERVALO_TAB_MS);
    r.pasar();
    lector.tabPulsada = () => true;
    r.pasar();
    r.pasar();
    lector.tabPulsada = () => false;
    r.pasar();
    expect(cambios).toEqual([true, false]);
    // Con Discord (u otra ventana) delante, Tab no cuenta.
    lector.tabPulsada = () => true;
    lector.juegoDelante = () => false;
    r.pasar();
    expect(cambios).toEqual([true, false]);
  });

  it('al acabar la partida deja de mirar y suelta el panel si estaba pulsada', async () => {
    const r = relojFalso();
    const cambios: boolean[] = [];
    const vigia = crearVigiaTab(async () => ({ tabPulsada: () => true, juegoDelante: () => true }), (p) => cambios.push(p), r.reloj);
    await vigia.activar(true);
    r.pasar();
    await vigia.activar(false);
    expect(r.activo()).toBe(false);
    expect(cambios).toEqual([true, false]);
    expect(vigia.pulsada()).toBe(false);
  });

  it('sin lector (fuera de Windows o sin user32) no hace nada; activar dos veces no duplica el temporizador', async () => {
    const r = relojFalso();
    const sin = crearVigiaTab(async () => null, () => {}, r.reloj);
    await sin.activar(true);
    expect(r.reloj.setInterval).not.toHaveBeenCalled();
    const obtener = vi.fn(async () => ({ tabPulsada: () => false, juegoDelante: () => true }));
    const con = crearVigiaTab(obtener, () => {}, r.reloj);
    await con.activar(true);
    await con.activar(true);
    expect(r.reloj.setInterval).toHaveBeenCalledTimes(1);
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it('fuera de Windows no se carga nada', async () => {
    expect(await crearLectorWindows('linux')).toBeNull();
  });
});

describe('3.19 · widget «Diferencia de oro con Tab»', () => {
  it('encendido por defecto y al actualizar; se respeta si se apagó; solo en la Grieta', () => {
    expect(AJUSTES_POR_DEFECTO.overlay.widgets.oroTab.activo).toBe(true);
    expect(normalizarAjustes({ overlay: { widgets: {} } }).overlay.widgets.oroTab.activo).toBe(true);
    expect(normalizarAjustes({ overlay: { widgets: { oroTab: { activo: false } } } }).overlay.widgets.oroTab.activo).toBe(false);
    expect(widgetsDeModo('clasificatoria').oroTab).toBe(true);
    expect(widgetsDeModo('aram').oroTab).toBe(false);
  });
});

const parejas = [
  { aliado: 'Garen', enemigo: 'Darius', diferencia: -400, tuyo: false },
  { aliado: 'Lee Sin', enemigo: 'Vi', diferencia: 600, tuyo: false },
  { aliado: 'Zed', enemigo: 'Ahri', diferencia: 350, tuyo: true },
  { aliado: 'Jinx', enemigo: 'Caitlyn', diferencia: 0, tuyo: false },
  { aliado: 'Thresh', enemigo: 'Lulu', diferencia: -1200, tuyo: false },
];

describe('3.19 · panel de oro del Tab', () => {
  it('total del equipo arriba y una fila por pareja enfrentada, con la tuya resaltada', () => {
    render(<PanelOroTab oro={{ equipo: -650, rival: 350, parejas }} />);
    expect(screen.getByText('−650').className).toContain('tono-atras');
    const filas = screen.getAllByRole('listitem');
    expect(filas).toHaveLength(5);
    expect(filas.map((f) => f.textContent)).toEqual(['−400', '+600', '+350', '0', '−1,2k']);
    expect(filas[2]!.className).toContain('tuyo');
    expect(filas[0]!.getAttribute('aria-label')).toBe(t('overlay.oroTab.fila', { aliado: 'Garen', enemigo: 'Darius', diferencia: '−400' }));
    expect(screen.getByText('+600').className).toContain('tono-ok');
    expect(screen.getByText('0').className).toContain('tono-igual');
    expect(screen.getByText(/Hecho con ayuda de IA/)).toBeTruthy();
  });
});

describe('3.19 · el overlay enseña el panel solo mientras se mantiene Tab', () => {
  const oyentes: Record<string, ((x: never) => void)[]> = {};
  const oir = (canal: string) => (cb: unknown) => void (oyentes[canal] ??= []).push(cb as never);
  const emitir = <T,>(canal: string, dato: T) =>
    act(() => {
      for (const cb of oyentes[canal] ?? []) (cb as (x: T) => void)(dato);
    });
  const estado: EstadoOverlay = {
    tiempo: 900,
    objetivos: [],
    proximaHabilidad: null,
    rendimiento: { cs: { cs: 90, porMinuto: 6, objetivoPorMinuto: 7.5, cs10: null }, kda: null, kdaMedio: null, oro: { equipo: 900, rival: 200, parejas } },
    compra: null,
    version: '16.20.1',
    modo: 'clasificatoria',
    widgets: { objetivos: true, habilidad: true, cs: true, compra: true, proximoObjeto: true, jungla: true, avisos: true, aumentos: false, reliquias: false },
  };
  async function montar(config: AjustesOverlay = AJUSTES_POR_DEFECTO.overlay) {
    for (const k of Object.keys(oyentes)) delete oyentes[k];
    const api: ApiOverlay = {
      alEstado: oir('estado'),
      alAviso: oir('aviso'),
      alMover: oir('mover'),
      alModo: oir('modo'),
      alCarga: oir('carga'),
      alConfig: oir('config'),
      alJungla: oir('jungla'),
      alVoz: oir('voz'),
      alTab: oir('tab'),
      obtenerConfig: vi.fn(async () => config),
      guardarWidget: vi.fn(),
      guardarMinimapa: vi.fn(),
      marcarJungla: vi.fn(),
      capturarRaton: vi.fn(),
      capturarRatonJungla: vi.fn(),
      fijar: vi.fn(),
    };
    (window as unknown as { coachOverlay: ApiOverlay }).coachOverlay = api;
    const r = render(<Overlay />);
    await act(async () => {});
    emitir('estado', estado);
    return r;
  }

  it('sale al pulsar Tab y se va al soltarla o al acabar la partida', async () => {
    const { container } = await montar();
    expect(container.querySelector('.ov-oro-tab')).toBeNull();
    emitir('tab', true);
    expect(container.querySelector('.ov-oro-tab')).not.toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    emitir('tab', false);
    expect(container.querySelector('.ov-oro-tab')).toBeNull();
    emitir('tab', true);
    emitir('modo', 'oculto');
    expect(container.querySelector('.ov-oro-tab')).toBeNull();
  });

  it('con el ajuste apagado no sale', async () => {
    const { container } = await montar({ ...AJUSTES_POR_DEFECTO.overlay, widgets: { ...AJUSTES_POR_DEFECTO.overlay.widgets, oroTab: { ...AJUSTES_POR_DEFECTO.overlay.widgets.oroTab, activo: false } } });
    emitir('tab', true);
    expect(container.querySelector('.ov-oro-tab')).toBeNull();
  });
});
