// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO, normalizarAjustes } from '../src/main/ajustes';
import { crearLectorWindows, crearVigiaTab, INTERVALO_TAB_MS, type LectorTeclado } from '../src/main/partida/teclaTab';
import { Overlay } from '../src/renderer/overlay/Overlay';
import { PanelOroTab, oroCorto, parteAliada } from '../src/renderer/overlay/widgets/PanelOroTab';
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

describe('3.19 · ajuste «Diferencia de oro con Tab»', () => {
  it('encendido por defecto y al actualizar; se respeta si se apagó', () => {
    expect(AJUSTES_POR_DEFECTO.overlay.oroTab).toBe(true);
    expect(normalizarAjustes({ overlay: {} }).overlay.oroTab).toBe(true);
    expect(normalizarAjustes({ overlay: { oroTab: false } }).overlay.oroTab).toBe(false);
  });
});

describe('3.19 · panel de oro del Tab', () => {
  it('diferencia del equipo, barra con los totales y tú frente a tu rival', () => {
    const { container } = render(<PanelOroTab oro={{ equipo: 1200, rival: -350, aliados: 12400, enemigos: 11200, rivalNombre: 'Ahri' }} />);
    expect(screen.getByText(t('overlay.oroTab.titulo'))).toBeTruthy();
    expect(screen.getByText('+1,2k').className).toContain('tono-ok');
    expect(screen.getByText('−350').className).toContain('tono-atras');
    expect(screen.getByText(t('overlay.oroTab.contra', { rival: 'Ahri' }))).toBeTruthy();
    expect(screen.getByText('12,4k')).toBeTruthy();
    expect(screen.getByText('11,2k')).toBeTruthy();
    expect((container.querySelector('.ov-oro-tab-pista i') as HTMLElement).style.width).toBe('52.5%');
    expect(screen.getByText(/Hecho con ayuda de IA/)).toBeTruthy();
  });

  it('sin rival de línea conocido, solo el equipo', () => {
    render(<PanelOroTab oro={{ equipo: -800, rival: null }} />);
    expect(screen.getByText('−800').className).toContain('tono-atras');
    expect(screen.queryByText(t('overlay.oroTab.linea'))).toBeNull();
  });

  it('cálculos de apoyo', () => {
    expect(parteAliada(0, 0)).toBe(0.5);
    expect(parteAliada(3000, 1000)).toBe(0.75);
    expect(oroCorto(-1500)).toBe('1,5k');
    expect(oroCorto(850)).toBe('850');
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
    rendimiento: { cs: { cs: 90, porMinuto: 6, objetivoPorMinuto: 7.5, cs10: null }, kda: null, kdaMedio: null, oro: { equipo: 900, rival: 200, aliados: 10000, enemigos: 9100, rivalNombre: 'Zed' } },
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
    expect(screen.getByText(t('overlay.oroTab.contra', { rival: 'Zed' }))).toBeTruthy();
    emitir('tab', false);
    expect(container.querySelector('.ov-oro-tab')).toBeNull();
    emitir('tab', true);
    emitir('modo', 'oculto');
    expect(container.querySelector('.ov-oro-tab')).toBeNull();
  });

  it('con el ajuste apagado no sale', async () => {
    const { container } = await montar({ ...AJUSTES_POR_DEFECTO.overlay, oroTab: false });
    emitir('tab', true);
    expect(container.querySelector('.ov-oro-tab')).toBeNull();
  });
});
