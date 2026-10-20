// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/renderer/principal/App';
import { GraficoLinea, VistaAnalisis } from '../src/renderer/principal/vistas/VistaAnalisis';
import { TarjetaIa } from '../src/renderer/principal/vistas/TarjetaIa';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { t } from '../src/shared/i18n';
import { VERSION_ACTUAL } from '../src/shared/novedades';
import type { Ajustes, ApiCoach, EntradaAnalisis, EstadoAnalisis } from '../src/shared/tiposApp';

const ajustes: Ajustes = { ...structuredClone(AJUSTES_POR_DEFECTO), bienvenidaVista: true, ultimaVersionVista: VERSION_ACTUAL, idioma: 'es' };

function entrada(id: string, extra: Partial<EntradaAnalisis> = {}): EntradaAnalisis {
  return {
    id,
    fecha: '2026-10-20T21:30:00.000Z',
    modo: 'clasificatoria',
    campeon: 'Ahri',
    nombreCampeon: 'Ahri',
    rol: 'MIDDLE',
    resultado: 'victoria',
    duracion: 1830,
    final: { k: 8, d: 3, a: 11, cs: 231, nivel: 17, objetos: [3165], vision: 27, danoCampeones: 31200 },
    linea: Array.from({ length: 30 }, (_, i) => ({ m: i + 1, cs: (i + 1) * 7, nivel: Math.min(18, 1 + i), k: 0, d: 0, a: 0, oro: 500 + i * 380 })),
    muertes: [612, 1004, 1490],
    objetivos: [
      { t: 640, tipo: 'dragon', equipo: 'enemigo', subtipo: 'Fire' },
      { t: 1250, tipo: 'baron', equipo: 'aliado' },
    ],
    csObjetivoMinuto: 7.5,
    version: '16.20.1',
    analisis: {
      veredicto: 'Buena partida: tu farmeo y tu daño llevaron al equipo.',
      bien: [
        { titulo: 'Farmeo constante', porque: '7,6 CS/min frente a 7,5 de referencia.' },
        { titulo: 'Daño alto', porque: '31.200 de daño a campeones.' },
        { titulo: 'Visión', porque: '27 de puntuación de visión.' },
      ],
      mejorar: [
        { titulo: 'Muerte antes del dragón', porque: 'Moriste a las 10:12 y el rival tomó el dragón a las 10:40.' },
        { titulo: 'Guardianes de control', porque: 'Solo 1 en 30 minutos.' },
        { titulo: 'Primer objeto', porque: 'Terminado a las 14:30.' },
      ],
      momentos: [
        { t: 612, texto: 'Moriste justo antes del primer dragón.' },
        { t: 1250, texto: 'Tu equipo tomó el Barón.' },
      ],
      enfoque: 'Antes de cada dragón, asegúrate de estar vivo y con visión.',
    },
    ...extra,
  };
}

let emitirAnalisis: (e: { estado: EstadoAnalisis; entrada?: EntradaAnalisis; hablar?: boolean }) => void = () => {};
let navegar: (v: string) => void = () => {};

function api(historial: EntradaAnalisis[] = []): ApiCoach {
  return {
    alCambiarEstado: () => {},
    importar: vi.fn(),
    cambiarRol: vi.fn(),
    cambiarOpcion: vi.fn().mockResolvedValue(undefined),
    cambiarRunas: vi.fn().mockResolvedValue(undefined),
    asistente: vi.fn(),
    obtenerAjustes: vi.fn().mockResolvedValue(ajustes),
    guardarAjustes: vi.fn().mockResolvedValue(undefined),
    moverOverlay: vi.fn().mockResolvedValue(false),
    overlayMoviendo: vi.fn().mockResolvedValue(false),
    alCambiarMover: () => () => {},
    ventana: vi.fn(),
    licencia: vi.fn().mockRejectedValue(new Error('no')),
    activarLicencia: vi.fn(),
    quitarLicencia: vi.fn(),
    abrirWeb: vi.fn().mockResolvedValue(undefined),
    alCambiarLicencia: () => () => {},
    campeones: vi.fn().mockResolvedValue({ ok: false, error: 'datos' }),
    buildDe: vi.fn().mockResolvedValue({ ok: false, error: 'datos' }),
    historialAnalisis: vi.fn().mockResolvedValue(historial),
    estadoAnalisis: vi.fn().mockResolvedValue({ estado: 'inactivo' }),
    alAnalisis: (cb) => {
      emitirAnalisis = cb;
      return () => {};
    },
    alNavegar: (cb) => {
      navegar = cb;
      return () => {};
    },
  };
}

beforeEach(() => {
  window.coach = api();
});
afterEach(cleanup);

describe('vista Análisis', () => {
  it('sin análisis enseña el estado vacío y la nota de privacidad', async () => {
    render(<VistaAnalisis />);
    expect(await screen.findByText(t('analisis.vacio.titulo'))).toBeTruthy();
    expect(screen.getByText(t('analisis.privacidad'))).toBeTruthy();
  });

  it('enseña el último análisis: veredicto, 3 + 3 puntos, momentos con su minuto, enfoque y cifras', async () => {
    window.coach = api([entrada('b'), entrada('a', { campeon: 'Lux', nombreCampeon: 'Lux', resultado: 'derrota' })]);
    render(<VistaAnalisis />);
    expect(await screen.findByText('Buena partida: tu farmeo y tu daño llevaron al equipo.')).toBeTruthy();
    expect(screen.getByText('Farmeo constante')).toBeTruthy();
    expect(screen.getByText('Muerte antes del dragón')).toBeTruthy();
    expect(screen.getByText('10:12')).toBeTruthy();
    expect(screen.getByText('20:50')).toBeTruthy();
    expect(screen.getByText('Antes de cada dragón, asegúrate de estar vivo y con visión.')).toBeTruthy();
    expect(screen.getByText('8/3/11')).toBeTruthy();
    // Gráfico en SVG con la referencia de CS y las marcas.
    expect(screen.getByRole('img', { name: t('analisis.grafico.desc', { serie: 'CS' }) })).toBeTruthy();
    expect(screen.getByText(t('analisis.grafico.referencia', { valor: '7,5' }))).toBeTruthy();
    // Historial: al elegir otra partida se enseña la suya.
    const historial = screen.getByText(t('analisis.historial')).closest('section, div')!.parentElement!;
    await userEvent.click(within(historial).getByText('Lux'));
    expect(screen.getAllByText(t('analisis.derrota')).length).toBeGreaterThan(0);
  });

  it('cambia al gráfico de oro y avisa de errores y del análisis en curso', async () => {
    window.coach = api([entrada('b')]);
    render(<VistaAnalisis />);
    await screen.findByText('Farmeo constante');
    await userEvent.click(screen.getByRole('button', { name: t('analisis.grafico.oro') }));
    expect(screen.getByRole('img', { name: t('analisis.grafico.desc', { serie: t('analisis.grafico.oro') }) })).toBeTruthy();
    act(() => emitirAnalisis({ estado: { estado: 'analizando' } }));
    expect(screen.getByText(t('analisis.analizando'))).toBeTruthy();
    act(() => emitirAnalisis({ estado: { estado: 'error', error: 'limite' } }));
    expect(screen.getByText(t('analisis.error.limite'))).toBeTruthy();
  });

  it('en ARAM no hay CS de referencia, visión ni rol', async () => {
    window.coach = api([entrada('c', { modo: 'aram', rol: null, csObjetivoMinuto: null })]);
    const { container } = render(<VistaAnalisis />);
    await screen.findByText('Farmeo constante');
    expect(container.querySelector('.analisis-cifras')!.textContent).not.toContain(t('analisis.stat.vision'));
    expect(container.querySelector('.analisis-campeon')!.textContent).not.toContain(t('rol.MIDDLE'));
    expect(screen.queryByText(/Referencia/)).toBeNull();
  });

  it('GraficoLinea dibuja la serie, la referencia y una marca por muerte u objetivo', () => {
    const { container } = render(
      <GraficoLinea
        titulo="CS"
        serie={[{ m: 1, v: 7 }, { m: 2, v: 15 }]}
        referencia={[{ m: 1, v: 7.5 }, { m: 2, v: 15 }]}
        etiquetaReferencia="Ref"
        marcas={[{ t: 70, tono: 'muerte', etiqueta: 'Muerte' }, { t: 100, tono: 'enemigo', etiqueta: 'Dragón' }]}
        duracion={120}
      />,
    );
    expect(container.querySelector('.grafico-serie')).toBeTruthy();
    expect(container.querySelector('.grafico-referencia')).toBeTruthy();
    expect(container.querySelectorAll('.grafico-marca')).toHaveLength(2);
  });
});

describe('insignia y navegación', () => {
  it('un análisis nuevo pone la insignia en la barra lateral; al abrir la vista se quita', async () => {
    render(<App />);
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByText(t('nav.analisis'))).toBeTruthy();
    act(() => emitirAnalisis({ estado: { estado: 'listo', id: 'x' }, entrada: entrada('x') }));
    expect(within(nav).getByLabelText(t('analisis.nuevos', { n: 1 }))).toBeTruthy();
    await userEvent.click(within(nav).getByText(t('nav.analisis')));
    expect(within(nav).queryByLabelText(t('analisis.nuevos', { n: 1 }))).toBeNull();
  });

  it('la notificación pide abrir la vista Análisis', async () => {
    render(<App />);
    act(() => navegar('analisis'));
    expect(await screen.findByText(t('analisis.titulo'))).toBeTruthy();
  });
});

describe('ajustes del coach con IA', () => {
  it('interruptores, máximo de consejos y explicación de privacidad', async () => {
    const cambiar = vi.fn();
    render(<TarjetaIa ajustes={ajustes} cambiar={cambiar} />);
    expect(screen.getByText(t('ajustes.ia.privacidad'))).toBeTruthy();
    await userEvent.click(screen.getByRole('switch', { name: t('ajustes.ia.consejos') }));
    expect(cambiar).toHaveBeenLastCalledWith({ ...ajustes, ia: { ...ajustes.ia, consejos: false } });
    await userEvent.selectOptions(screen.getByLabelText(t('ajustes.ia.maxConsejos')), '8');
    expect(cambiar).toHaveBeenLastCalledWith({ ...ajustes, ia: { ...ajustes.ia, maxConsejos: 8 } });
  });
});
