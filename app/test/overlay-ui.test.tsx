// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { estadoJungla } from '../src/shared/jungla';
import { Avisos } from '../src/renderer/overlay/Avisos';
import { Overlay } from '../src/renderer/overlay/Overlay';
import { BarraObjetivos } from '../src/renderer/overlay/widgets/BarraObjetivos';
import { FlechaHabilidad } from '../src/renderer/overlay/widgets/FlechaHabilidad';
import { ToastCompra, useCompraNueva } from '../src/renderer/overlay/widgets/ToastCompra';
import { tonoCs, tonoKda, WidgetCs, WidgetRendimiento } from '../src/renderer/overlay/widgets/WidgetCs';
import { t } from '../src/shared/i18n';
import type { AjustesOverlay, ApiOverlay, AvisoOverlay, EstadoCarga, EstadoOverlay, ModoOverlay } from '../src/shared/tiposApp';

afterEach(cleanup);
const pantalla = { ancho: 1920, alto: 1080 };

describe('barra de objetivos', () => {
  const objetivos: EstadoOverlay['objetivos'] = [
    { id: 'larvas', nombre: 'Larvas', subtipo: null, aparece: null, disponible: true },
    { id: 'dragon', nombre: 'Dragón', subtipo: 'Infernal', aparece: 45, disponible: false },
    { id: 'baron', nombre: 'Barón', subtipo: null, aparece: 1170, disponible: false },
  ];

  it('un icono por objetivo con su cuenta atrás (m:ss) o «Ya»', () => {
    render(<BarraObjetivos objetivos={objetivos} />);
    const lista = screen.getByRole('list', { name: 'Objetivos' });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas.map((f) => f.textContent)).toEqual(['Ya', '0:45', '19:30']);
    expect(filas[1]!.getAttribute('aria-label')).toBe('Dragón Infernal: 0:45');
  });

  it('resalta lo disponible, hace latir lo que sale en ≤ 60 s y colorea el tipo de dragón', () => {
    render(<BarraObjetivos objetivos={objetivos} />);
    const [larvas, dragon, baron] = screen.getAllByRole('listitem');
    expect(larvas!.className).toContain('disponible');
    expect(dragon!.className).toContain('pronto');
    expect(dragon!.className).toContain('tipo-infernal');
    expect(baron!.className).not.toContain('pronto');
    expect(baron!.className).not.toContain('disponible');
  });
});

describe('flecha de habilidad', () => {
  it('muestra la letra sobre la casilla de su habilidad', () => {
    render(<FlechaHabilidad habilidad="E" pantalla={pantalla} escala={1} calibrando={false} />);
    const flecha = screen.getByRole('img', { name: 'Habilidad E' });
    expect(flecha.textContent).toBe('E');
    expect(flecha.className).toContain('hab-E');
    // Casillas de 55 px a 1080p: el centro de la E es 27,5 + 2 × 55.
    expect(flecha.style.left).toBe('137.5px');
  });

  it('sin punto que gastar no hay flecha', () => {
    render(<FlechaHabilidad habilidad={null} pantalla={pantalla} escala={1} calibrando={false} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('al calibrar dibuja las cuatro casillas guía y una flecha de muestra', () => {
    const { container } = render(<FlechaHabilidad habilidad={null} pantalla={pantalla} escala={1} calibrando />);
    expect(Array.from(container.querySelectorAll('.ov-casilla-guia')).map((e) => e.textContent)).toEqual(['Q', 'W', 'E', 'R']);
    expect(screen.getByRole('img', { name: 'Habilidad Q' }).className).toContain('demo');
  });
});

describe('widget de CS', () => {
  it('verde con el objetivo, ámbar a menos de un 15 % y neutro por debajo (nunca rojo)', () => {
    expect(tonoCs(8, 7.5)).toBe('ok');
    expect(tonoCs(7.5, 7.5)).toBe('ok');
    expect(tonoCs(6.5, 7.5)).toBe('cerca');
    expect(tonoCs(6.3, 7.5)).toBe('neutro');
    expect(tonoCs(0, 7.5)).toBe('neutro');
  });

  it('muestra CS, ritmo con coma decimal, objetivo y CS@10', () => {
    const { container } = render(<WidgetCs cs={{ cs: 74, porMinuto: 6.6, objetivoPorMinuto: 7.5, cs10: 71 }} />);
    expect(container.querySelector('.ov-cs')!.className).toContain('tono-cerca');
    expect(screen.getByText('74')).toBeTruthy();
    expect(screen.getByText('6,6')).toBeTruthy();
    expect(screen.getByText('Objetivo 7,5')).toBeTruthy();
    expect(screen.getByText('10 min: 71')).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/rojo|error|malo/);
  });

  it('sin CS@10 todavía no lo muestra', () => {
    render(<WidgetCs cs={{ cs: 20, porMinuto: 8, objetivoPorMinuto: 7.5, cs10: null }} />);
    expect(screen.queryByText(/10 min/)).toBeNull();
  });
});

describe('aviso de compra', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const codice = { id: 3108, nombre: 'Códice demoníaco', coste: 0, puedeComprar: true };

  it('sale al llegar el oro, se va a los 6 s y no vuelve para el mismo objeto', () => {
    const { result, rerender } = renderHook(({ c }) => useCompraNueva(c), { initialProps: { c: { ...codice, puedeComprar: false } } });
    expect(result.current).toBeNull();
    rerender({ c: codice });
    expect(result.current?.id).toBe(3108);
    act(() => vi.advanceTimersByTime(6000));
    expect(result.current).toBeNull();
    // Gasta el oro y lo vuelve a tener: el mismo objeto no se repite.
    rerender({ c: { ...codice, puedeComprar: false } });
    rerender({ c: codice });
    expect(result.current).toBeNull();
    // Un objeto nuevo sí.
    rerender({ c: { id: 3020, nombre: 'Botas de hechicero', coste: 0, puedeComprar: true } });
    expect(result.current?.id).toBe(3020);
  });

  it('si la próxima compra cambia, el aviso anterior se retira', () => {
    const { result, rerender } = renderHook(({ c }) => useCompraNueva(c), { initialProps: { c: codice } });
    expect(result.current?.id).toBe(3108);
    rerender({ c: { id: 3020, nombre: 'Botas', coste: 900, puedeComprar: false } });
    expect(result.current).toBeNull();
  });

  it('pinta «Ya puedes comprar» con el icono y el nombre del objeto', () => {
    const { container } = render(<ToastCompra compra={codice} version="16.20.1" />);
    expect(screen.getByText('Ya puedes comprar')).toBeTruthy();
    expect(screen.getByText('Códice demoníaco')).toBeTruthy();
    expect(container.querySelector('img')!.getAttribute('src')).toContain('/16.20.1/img/item/3108.png');
  });
});

describe('Avisos del overlay', () => {
  it('cada aviso lleva el icono de su tipo', () => {
    render(
      <Avisos
        avisos={[
          { id: 1, texto: t('aviso.vision'), tipo: 'vision' },
          { id: 2, texto: t('aviso.compra', { oro: 1250, objeto: 'Códice demoníaco' }) },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: t('ajustes.aviso.vision') })).toBeTruthy();
    // Sin tipo explícito se deduce del texto.
    expect(screen.getByRole('img', { name: t('ajustes.aviso.compra') })).toBeTruthy();
  });
});

describe('widget de rendimiento (CS y KDA)', () => {
  const cs = { cs: 74, porMinuto: 7.6, objetivoPorMinuto: 7.5, cs10: 71 };
  const medio = { asesinatos: 5.1, muertes: 4.8, asistencias: 6.9, ratio: 2.5 };

  it('verde con el KDA igual o por encima de la media; neutro si no (nunca rojo)', () => {
    expect(tonoKda(2.5, medio)).toBe('ok');
    expect(tonoKda(4, medio)).toBe('ok');
    expect(tonoKda(1.2, medio)).toBe('neutro');
    expect(tonoKda(9, null)).toBe('neutro');
  });

  it('muestra el CS, el KDA en vivo con su ratio y la media del campeón en su rol', () => {
    const { container } = render(<WidgetRendimiento rendimiento={{ cs, kda: { k: 4, d: 2, a: 7, ratio: 5.5 }, kdaMedio: medio }} />);
    expect(screen.getByText('74')).toBeTruthy();
    expect(screen.getByText('4/2/7')).toBeTruthy();
    expect(screen.getByText('5,5')).toBeTruthy();
    expect(screen.getByText(t('overlay.rendimiento.media', { ratio: '2,5' }))).toBeTruthy();
    expect(container.querySelector('.ov-kda')!.className).toContain('tono-ok');
    expect(screen.getByRole('group', { name: /KDA 4\/2\/7/ })).toBeTruthy();
  });

  it('por debajo de la media es solo un dato neutro, sin textos negativos', () => {
    const { container } = render(<WidgetRendimiento rendimiento={{ cs, kda: { k: 0, d: 6, a: 1, ratio: 0.2 }, kdaMedio: medio }} />);
    expect(container.querySelector('.ov-kda')!.className).toContain('tono-neutro');
    expect(container.innerHTML).not.toMatch(/rojo|error|malo|peor|negativ/i);
  });

  it('sin media (pocos datos o build antigua) no la muestra; sin KDA solo queda el CS', () => {
    const { rerender, container } = render(<WidgetRendimiento rendimiento={{ cs, kda: { k: 1, d: 1, a: 1, ratio: 2 }, kdaMedio: null }} />);
    expect(screen.queryByText(/Media/)).toBeNull();
    expect(screen.getByText('1/1/1')).toBeTruthy();
    rerender(<WidgetRendimiento rendimiento={{ cs, kda: null, kdaMedio: medio }} />);
    expect(container.querySelector('.ov-kda')).toBeNull();
    expect(screen.getByText('74')).toBeTruthy();
  });
});

describe('Overlay (widgets independientes)', () => {
  // Como ipcRenderer.on: cada canal admite varios oyentes (el overlay y la pantalla de carga escuchan 'modo').
  let oyentes: Record<string, ((x: never) => void)[]> = {};
  let api: ApiOverlay;
  const oir = (canal: string) => (cb: unknown) => void (oyentes[canal] ??= []).push(cb as never);

  beforeEach(() => {
    oyentes = {};
    api = {
      alEstado: oir('estado'),
      alAviso: oir('aviso'),
      alMover: oir('mover'),
      alModo: oir('modo'),
      alCarga: oir('carga'),
      alConfig: oir('config'),
      alJungla: oir('jungla'),
      alVoz: oir('voz'),
      obtenerConfig: vi.fn(async () => AJUSTES_POR_DEFECTO.overlay),
      guardarWidget: vi.fn(),
      marcarJungla: vi.fn(),
      capturarRaton: vi.fn(),
      capturarRatonJungla: vi.fn(),
      fijar: vi.fn(),
    };
    (window as unknown as { coachOverlay: ApiOverlay }).coachOverlay = api;
  });
  const emitir = <T,>(canal: string, dato: T) => act(() => {
    for (const cb of oyentes[canal] ?? []) (cb as (x: T) => void)(dato);
  });
  const estado: EstadoOverlay = {
    tiempo: 400,
    objetivos: [{ id: 'dragon', nombre: 'Dragón', subtipo: null, aparece: 20, disponible: false }],
    proximaHabilidad: 'W',
    rendimiento: { cs: { cs: 50, porMinuto: 7.5, objetivoPorMinuto: 7.5, cs10: null }, kda: { k: 2, d: 1, a: 3, ratio: 5 }, kdaMedio: null },
    compra: null,
    version: '16.20.1',
  };
  const montar = async () => {
    const r = render(<Overlay />);
    await act(async () => {});
    return r;
  };
  const widgets = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-widget]')).map((e) => e.getAttribute('data-widget'));

  it('pinta cada widget activo con los datos de la partida', async () => {
    const { container } = await montar();
    emitir('estado', estado);
    expect(widgets(container)).toEqual(['objetivos', 'habilidad', 'cs', 'compra', 'avisos']);
    expect(screen.getByRole('img', { name: 'Habilidad W' })).toBeTruthy();
    // El widget de rendimiento lleva el CS y el KDA de la partida.
    expect(screen.getByText('2/1/3')).toBeTruthy();
    expect(screen.getByText('0:20')).toBeTruthy();
  });

  it('un widget apagado no se pinta y la escala y la opacidad se aplican', async () => {
    const { container } = await montar();
    const config: AjustesOverlay = {
      ...AJUSTES_POR_DEFECTO.overlay,
      opacidad: 0.7,
      widgets: { ...AJUSTES_POR_DEFECTO.overlay.widgets, cs: { activo: false, x: null, y: null, escala: 1 }, objetivos: { activo: true, x: 100, y: 50, escala: 1.25 } },
    };
    emitir('config', config);
    emitir('estado', estado);
    expect(widgets(container)).not.toContain('cs');
    const barra = container.querySelector('[data-widget="objetivos"]') as HTMLElement;
    expect(barra.style.left).toBe('100px');
    expect(barra.style.top).toBe('50px');
    expect(barra.style.opacity).toBe('0.7');
    expect((barra.firstElementChild as HTMLElement).style.transform).toBe('scale(1.25)');
  });

  it('sin punto de habilidad no hay flecha; fuera de la partida (modo carga u oculto) no hay widgets', async () => {
    const { container } = await montar();
    emitir('estado', { ...estado, proximaHabilidad: null });
    expect(screen.queryByRole('img', { name: /^Habilidad/ })).toBeNull();
    emitir<ModoOverlay>('modo', 'carga');
    expect(widgets(container)).toEqual([]);
    emitir<ModoOverlay>('modo', 'oculto');
    expect(widgets(container)).toEqual([]);
  });

  describe('pantalla de carga (Track B) dentro del overlay', () => {
    const carga: EstadoCarga = {
      version: '16.20.1',
      jugadores: [
        { equipo: 'aliado', riotId: 'Ana#EUW', campeonId: 103, campeon: 'Ahri', nombre: 'Ahri', rol: 'MIDDLE', rango: null, maestria: null, campeonWinrate: null, etiquetas: [] },
        { equipo: 'enemigo', riotId: 'Leo#EUW', campeonId: 62, campeon: 'MonkeyKing', nombre: 'Wukong', rol: 'TOP', rango: null, maestria: null, campeonWinrate: null, etiquetas: [] },
      ],
    };
    const pantallaCarga = () => screen.queryByRole('region', { name: t('carga.titulo') });

    it('en el modo carga pinta la pantalla de carga y oculta los widgets', async () => {
      const { container } = await montar();
      emitir('estado', estado);
      // Main manda overlay:carga antes que overlay:modo 'carga'.
      emitir('carga', carga);
      emitir<ModoOverlay>('modo', 'carga');
      expect(pantallaCarga()).toBeTruthy();
      expect(screen.getByRole('listitem', { name: 'Ana#EUW' })).toBeTruthy();
      expect(widgets(container)).toEqual([]);
    });

    it('al pasar a partida se quita la pantalla de carga y vuelven los widgets', async () => {
      const { container } = await montar();
      emitir('carga', carga);
      emitir<ModoOverlay>('modo', 'carga');
      emitir<ModoOverlay>('modo', 'partida');
      emitir('estado', estado);
      expect(pantallaCarga()).toBeNull();
      expect(widgets(container)).toEqual(['objetivos', 'habilidad', 'cs', 'compra', 'avisos']);
    });

    it('la pantalla de carga sale aunque llegue antes que la configuración del overlay', async () => {
      api.obtenerConfig = vi.fn(() => new Promise<AjustesOverlay>(() => {}));
      await montar();
      emitir('carga', carga);
      emitir<ModoOverlay>('modo', 'carga');
      expect(pantallaCarga()).toBeTruthy();
    });

    it('en el modo mover se ve la muestra de los widgets, no la pantalla de carga', async () => {
      const { container } = await montar();
      emitir('carga', carga);
      emitir<ModoOverlay>('modo', 'carga');
      emitir('mover', true);
      expect(pantallaCarga()).toBeNull();
      expect(widgets(container)).toContain('objetivos');
      emitir('mover', false);
      expect(pantallaCarga()).toBeTruthy();
    });
  });

  it('la flecha se queda montada para animar su salida al gastar el punto', async () => {
    await montar();
    emitir('estado', estado);
    expect(screen.getByRole('img', { name: 'Habilidad W' })).toBeTruthy();
    emitir('estado', { ...estado, proximaHabilidad: null });
    expect(screen.getByRole('img', { name: 'Habilidad W' }).className).toContain('saliendo');
    await vi.waitFor(() => expect(screen.queryByRole('img', { name: 'Habilidad W' })).toBeNull());
  });

  it('al salir de la partida se olvida el estado: al volver no reaparecen datos viejos', async () => {
    const { container } = await montar();
    emitir('estado', estado);
    emitir('jungla', estadoJungla({}, 400, 'ORDER'));
    emitir<ModoOverlay>('modo', 'oculto');
    emitir<ModoOverlay>('modo', 'partida');
    expect(widgets(container)).not.toContain('objetivos');
    expect(widgets(container)).not.toContain('cs');
    expect(widgets(container)).not.toContain('jungla');
  });

  it('modo mover: muestra todos los widgets activos con muestra y etiqueta, arrastra y guarda la posición', async () => {
    const { container } = await montar();
    emitir('mover', true);
    expect(widgets(container)).toEqual(['objetivos', 'habilidad', 'cs', 'compra', 'avisos']);
    expect(screen.getByText(t('overlay.widget.habilidad'))).toBeTruthy();
    const cs = container.querySelector('[data-widget="cs"]') as HTMLElement;
    fireEvent.mouseEnter(cs);
    expect(api.capturarRaton).toHaveBeenLastCalledWith(true);
    const x0 = parseFloat(cs.style.left);
    const y0 = parseFloat(cs.style.top);
    fireEvent.pointerDown(cs, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 10 - 300, clientY: 10 + 200 });
    fireEvent.pointerUp(window);
    expect(api.guardarWidget).toHaveBeenCalledWith('cs', Math.max(0, x0 - 300), y0 + 200);
    fireEvent.click(screen.getByRole('button', { name: t('overlay.fijarAqui') }));
    expect(api.fijar).toHaveBeenCalled();
  });

  it('fuera del modo mover los widgets no piden el ratón (el juego recibe los clics)', async () => {
    const { container } = await montar();
    emitir('estado', estado);
    fireEvent.mouseEnter(container.querySelector('[data-widget="cs"]')!);
    expect(api.capturarRaton).not.toHaveBeenCalled();
    expect(api.capturarRatonJungla).not.toHaveBeenCalled();
  });

  it('los avisos llegan como toasts al widget de avisos', async () => {
    await montar();
    emitir<AvisoOverlay>('aviso', { texto: t('aviso.vision'), voz: false, tipo: 'vision' });
    expect(screen.getByText(t('aviso.vision'))).toBeTruthy();
  });

  it('las frases de voz pasan por la cola con el volumen de los ajustes, y no suenan con la voz apagada', async () => {
    class Frase {
      voice: unknown;
      lang = '';
      volume = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    const speak = vi.fn();
    vi.stubGlobal('SpeechSynthesisUtterance', Frase);
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [{ lang: 'es-ES', name: 'Helena', voiceURI: 'Helena' }],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      cancel: vi.fn(),
      speak,
    });
    try {
      await montar();
      const voz = { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true, volumen: 0.5 };
      emitir('config', { ...AJUSTES_POR_DEFECTO.overlay, voz });
      emitir('voz', { tipo: 'compra', clave: 'compra:1', texto: 'Puedes comprar Códice demoníaco', prioridad: 4, caducaMs: 10000 });
      await vi.waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
      expect(speak.mock.calls[0]![0]).toMatchObject({ text: 'Puedes comprar Códice demoníaco', volume: 0.5 });
      // Voz apagada: corta y vacía la cola.
      emitir('config', { ...AJUSTES_POR_DEFECTO.overlay, voz: { ...voz, activa: false } });
      expect((globalThis.speechSynthesis as unknown as { cancel: ReturnType<typeof vi.fn> }).cancel).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  describe('widget de la jungla', () => {
    const conJungla: AjustesOverlay = {
      ...AJUSTES_POR_DEFECTO.overlay,
      widgets: { ...AJUSTES_POR_DEFECTO.overlay.widgets, jungla: { activo: true, x: null, y: null, escala: 1 } },
    };

    it('apagado por defecto: no se pinta', async () => {
      const { container } = await montar();
      emitir('estado', estado);
      emitir('jungla', estadoJungla({}, 400, 'ORDER'));
      expect(widgets(container)).not.toContain('jungla');
    });

    it('activo: agrupa tus campamentos por mitad del mapa, pide el ratón al pasar por encima y marca al hacer clic', async () => {
      const { container } = await montar();
      emitir('config', conJungla);
      emitir('estado', estado);
      emitir('jungla', estadoJungla({ rojo: 300 }, 400, 'ORDER'));
      const caja = container.querySelector('[data-widget="jungla"]') as HTMLElement;
      const arriba = within(screen.getByRole('group', { name: 'Arriba' })).getAllByRole('button');
      expect(arriba.map((b) => b.getAttribute('data-campamento'))).toEqual(['azul', 'gromp', 'lobos', 'escarabajoArriba']);
      const rojo = container.querySelector('[data-campamento="rojo"]') as HTMLElement;
      expect(rojo.textContent).toBe('Rojo3:20');
      expect(rojo.className).toContain('marcado');
      fireEvent.mouseEnter(caja);
      expect(api.capturarRatonJungla).toHaveBeenLastCalledWith(true);
      expect(api.capturarRaton).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: /^Azul: marcar como limpiado/ }));
      expect(api.marcarJungla).toHaveBeenCalledWith('azul');
      fireEvent.mouseLeave(caja);
      expect(api.capturarRatonJungla).toHaveBeenLastCalledWith(false);
    });

    it('si el widget desaparece con el cursor encima, suelta el ratón', async () => {
      const { container } = await montar();
      emitir('config', conJungla);
      emitir('estado', estado);
      emitir('jungla', estadoJungla({}, 400, 'ORDER'));
      fireEvent.mouseEnter(container.querySelector('[data-widget="jungla"]')!);
      expect(api.capturarRatonJungla).toHaveBeenLastCalledWith(true);
      emitir('config', AJUSTES_POR_DEFECTO.overlay);
      expect(widgets(container)).not.toContain('jungla');
      expect(api.capturarRatonJungla).toHaveBeenLastCalledWith(false);
    });

    it('al terminar el modo mover con el cursor sobre la jungla, vuelve a pedir el ratón para sus botones', async () => {
      const { container } = await montar();
      emitir('config', conJungla);
      emitir('estado', estado);
      emitir('jungla', estadoJungla({}, 400, 'ORDER'));
      emitir('mover', true);
      fireEvent.mouseEnter(container.querySelector('[data-widget="jungla"]')!);
      expect(api.capturarRaton).toHaveBeenLastCalledWith(true);
      emitir('mover', false);
      expect(api.capturarRatonJungla).toHaveBeenLastCalledWith(true);
    });

    it('en el modo mover los botones no marcan (se arrastra el widget)', async () => {
      const { container } = await montar();
      emitir('config', conJungla);
      emitir('mover', true);
      fireEvent.click(container.querySelector('[data-campamento="azul"]')!);
      expect(api.marcarJungla).not.toHaveBeenCalled();
    });
  });
});
