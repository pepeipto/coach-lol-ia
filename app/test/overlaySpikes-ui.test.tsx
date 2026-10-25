// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { interpretarPartida } from '../src/main/perfil/lcuPerfil';
import { tendencias } from '../src/main/perfil/puntuaciones';
import { tendenciasPorCola } from '../src/main/perfil/servicio';
import { Overlay } from '../src/renderer/overlay/Overlay';
import { Reliquias } from '../src/renderer/overlay/widgets/Reliquias';
import { CategoriasVoz } from '../src/renderer/principal/vistas/CategoriasVoz';
import { VistaPerfil } from '../src/renderer/principal/vistas/VistaPerfil';
import { t } from '../src/shared/i18n';
import type { Perfil } from '../src/shared/perfil';
import { estadoReliquias } from '../src/shared/reliquias';
import type { AjustesOverlay, ApiOverlay, EstadoOverlay } from '../src/shared/tiposApp';
import { partidaLcu } from './partidaLcu';

afterEach(() => {
  cleanup();
  delete (window as { coach?: unknown }).coach;
});

describe('3.9 · widget de las reliquias de vida', () => {
  it('cuatro círculos (tu lado y el del rival) con su cuenta atrás o «Lista»', () => {
    render(<Reliquias estado={estadoReliquias({ propiaExterior: 120 }, 160)} alMarcar={() => {}} />);
    const seccion = screen.getByRole('region', { name: t('reliquias.titulo') });
    const botones = within(seccion).getAllByRole('button');
    expect(botones).toHaveLength(4);
    expect(within(screen.getByRole('group', { name: t('reliquias.lado.propia') })).getAllByRole('button')).toHaveLength(2);
    // Exterior propia marcada a 2:00: vuelve en 53 s (a 2:40); las demás ya están.
    expect(botones[0]!.textContent).toContain('53');
    expect(botones[0]!.className).toContain('marcado');
    expect(botones[1]!.className).toContain('disponible');
    expect(botones[0]!.getAttribute('aria-label')).toBe(`${t('reliquias.cancelar', { reliquia: t('reliquias.propiaExterior') })} (53)`);
  });

  it('un clic marca la reliquia; bloqueado (modo mover) no hace nada', () => {
    const alMarcar = vi.fn();
    const { rerender } = render(<Reliquias estado={estadoReliquias({}, 200)} alMarcar={alMarcar} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('reliquias.rivalInterior')) }));
    expect(alMarcar).toHaveBeenCalledWith('rivalInterior');
    rerender(<Reliquias estado={estadoReliquias({}, 200)} alMarcar={alMarcar} bloqueado />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('reliquias.rivalInterior')) }));
    expect(alMarcar).toHaveBeenCalledTimes(1);
  });
});

describe('3.9 · reliquias en el overlay', () => {
  let oyentes: Record<string, ((x: never) => void)[]> = {};
  let api: ApiOverlay;
  const oir = (canal: string) => (cb: unknown) => void (oyentes[canal] ??= []).push(cb as never);
  const emitir = <T,>(canal: string, dato: T) =>
    act(() => {
      for (const cb of oyentes[canal] ?? []) (cb as (x: T) => void)(dato);
    });
  const CON_RELIQUIAS: AjustesOverlay = {
    ...AJUSTES_POR_DEFECTO.overlay,
    widgets: { ...AJUSTES_POR_DEFECTO.overlay.widgets, reliquias: { ...AJUSTES_POR_DEFECTO.overlay.widgets.reliquias, activo: true } },
  };
  const estadoAram: EstadoOverlay = {
    tiempo: 200, objetivos: [], proximaHabilidad: null, rendimiento: null, compra: null, version: '', modo: 'aram',
    widgets: { objetivos: false, habilidad: true, cs: true, compra: true, jungla: false, avisos: true, aumentos: false, reliquias: true },
  };
  beforeEach(() => {
    oyentes = {};
    api = {
      alEstado: oir('estado'), alAviso: oir('aviso'), alMover: oir('mover'), alModo: oir('modo'), alCarga: oir('carga'),
      alConfig: oir('config'), alJungla: oir('jungla'), alReliquias: oir('reliquias'), alVoz: oir('voz'),
      obtenerConfig: vi.fn(async () => CON_RELIQUIAS), guardarWidget: vi.fn(), guardarMinimapa: vi.fn(), marcarJungla: vi.fn(),
      marcarReliquia: vi.fn(), capturarRaton: vi.fn(), capturarRatonJungla: vi.fn(), fijar: vi.fn(),
    };
    (window as unknown as { coachOverlay: ApiOverlay }).coachOverlay = api;
  });
  const montar = async () => {
    const r = render(<Overlay />);
    await act(async () => {});
    return r;
  };
  const widgets = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-widget]')).map((e) => e.getAttribute('data-widget'));

  it('en ARAM, con el widget encendido, salen las reliquias y un clic las marca (pide el ratón como la jungla)', async () => {
    const { container } = await montar();
    emitir('estado', estadoAram);
    emitir('reliquias', estadoReliquias({}, 200));
    expect(widgets(container)).toContain('reliquias');
    const caja = container.querySelector('[data-widget="reliquias"]') as HTMLElement;
    fireEvent.mouseEnter(caja);
    expect(api.capturarRatonJungla).toHaveBeenCalledWith(true);
    fireEvent.click(within(caja).getAllByRole('button')[0]!);
    expect(api.marcarReliquia).toHaveBeenCalledWith('propiaExterior');
  });

  it('en la Grieta no salen aunque estén encendidas; en el modo mover sale la muestra', async () => {
    const { container } = await montar();
    emitir('estado', { ...estadoAram, modo: 'clasificatoria', widgets: { ...estadoAram.widgets, reliquias: false } });
    expect(widgets(container)).not.toContain('reliquias');
    emitir('mover', true);
    expect(widgets(container)).toContain('reliquias');
    expect(screen.getByText(t('overlay.widget.reliquias'))).toBeTruthy();
  });
});

describe('3.9 · categoría de voz «spike» en Ajustes', () => {
  it('sale en el grupo de peleas, encendida por defecto, y se puede apagar', async () => {
    const alCambiar = vi.fn();
    render(<CategoriasVoz voz={{ ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true }} alCambiar={alCambiar} />);
    const fila = screen.getByText(t('overlay.config.tipo.spike')).closest('.interruptor') as HTMLElement;
    const interruptor = within(fila).getByRole('switch');
    expect(interruptor.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(interruptor);
    expect(alCambiar).toHaveBeenLastCalledWith(expect.objectContaining({ spike: false }));
  });
});

describe('3.9 · Perfil: puesto en la partida con MVP y ACE', () => {
  const YO = 'puuid-yo';

  function perfilCon(gano: boolean, yo: Partial<Record<string, number>>): Perfil {
    const partidas = [interpretarPartida(partidaLcu(1, { gano, yo }), YO)!];
    return {
      invocador: { nombre: 'AKIRA88', tag: 'EUW', nivel: 300, icono: 29 }, rangos: [], pl: [], partidas, campeones: [],
      tendencias: tendencias(partidas), tendenciasPorCola: tendenciasPorCola(partidas), reto: null, retoSugerido: 'muertes4',
      actualizado: null, conectado: true, version: '', campeonesDD: {},
    };
  }

  async function abrir(perfil: Perfil) {
    (window as unknown as { coach: unknown }).coach = { perfil: vi.fn(async () => perfil), historialAnalisis: vi.fn(async () => []) };
    const { container } = render(<VistaPerfil />);
    const fila = await vi.waitFor(() => {
      const f = container.querySelector('.perfil-partida') as HTMLElement | null;
      if (!f) throw new Error('sin historial');
      return f;
    });
    return { container, fila };
  }

  it('el mejor de la partida en el equipo ganador: «Has sido 1.º de 10» y MVP; el mejor del perdedor lleva ACE', async () => {
    const { container, fila } = await abrir(perfilCon(true, { kills: 15, deaths: 1, assists: 10, goldEarned: 18000, totalDamageDealtToChampions: 40000 }));
    // En el historial, la insignia MVP sustituye a la antigua etiqueta.
    expect(within(fila).getByText(t('perfil.insignia.mvp'))).toBeTruthy();
    await userEvent.click(fila);
    expect(screen.getByText(t('perfil.puesto.yo', { puesto: 1, total: 10 }))).toBeTruthy();
    expect(container.querySelectorAll('[data-insignia="mvp"]').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll('table [data-insignia="ace"]')).toHaveLength(1);
    expect(container.querySelectorAll('table [data-insignia="mvp"]')).toHaveLength(1);
    // Columna de puesto: los diez puestos, del 1 al 10, sin repetir.
    const puestos = Array.from(container.querySelectorAll('td[data-puesto]')).map((td) => Number(td.getAttribute('data-puesto')));
    expect(puestos.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(screen.getAllByRole('columnheader', { name: t('perfil.col.puesto') })).toHaveLength(2);
  });

  it('con una mala partida en el equipo perdedor el puesto baja y no hay insignia propia', async () => {
    const { fila } = await abrir(perfilCon(false, { kills: 0, deaths: 12, assists: 1, goldEarned: 5000, totalDamageDealtToChampions: 3000, totalMinionsKilled: 40 }));
    expect(within(fila).queryByText(t('perfil.insignia.mvp'))).toBeNull();
    expect(within(fila).queryByText(t('perfil.insignia.ace'))).toBeNull();
    await userEvent.click(fila);
    expect(screen.getByText(t('perfil.puesto.yo', { puesto: 10, total: 10 }))).toBeTruthy();
  });
});
