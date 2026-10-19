// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Build, OpcionRunas } from '@coach/shared';
import { BannerPremium } from '../src/renderer/principal/vistas/BannerPremium';
import { RejillaHabilidades } from '../src/renderer/principal/vistas/RejillaHabilidades';
import { VistaCampeon } from '../src/renderer/principal/vistas/VistaCampeon';
import { t } from '../src/shared/i18n';
import type { EstadoPrincipal } from '../src/shared/tiposApp';

afterEach(cleanup);

const orden: Build['ordenHabilidades'] = ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'W', 'Q', 'W', 'R', 'W', 'W', 'E', 'E', 'R', 'E', 'E'];

const build: Build = {
  campeon: 'Ahri',
  rol: 'MIDDLE',
  parche: '15.20',
  partidas: 1234,
  tasaVictoria: 0.5234,
  mezclaParches: false,
  runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112, 8126, 8138, 8135, 8304, 8313, 5008, 5008, 5001] },
  hechizos: [4, 14],
  objetosIniciales: [1056],
  nucleo: [6655, 3157],
  botas: 3020,
  situacionales: [3135],
  ordenHabilidades: orden,
  calculadoEn: '2026-10-18T00:00:00Z',
};

function estado(over: Partial<EstadoPrincipal> = {}): EstadoPrincipal {
  return {
    cliente: 'conectado',
    version: '15.20.1',
    error: null,
    importacion: null,
    aviso: null,
    recursos: {
      objetos: { 1056: 'Anillo de Doran', 6655: 'Tormento de Luden', 3157: 'Reloj de arena', 3020: 'Botas', 3135: 'Bastón' },
      runas: { 8100: { nombre: 'Dominación', icono: 'perk-images/Styles/7200_Domination.png' } },
      hechizos: { 4: { nombre: 'Destello', imagen: 'SummonerFlash.png' } },
    },
    seleccion: {
      campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 },
      rol: 'MIDDLE',
      rolesDisponibles: ['MIDDLE', 'BOTTOM'],
      resultado: { estado: 'ok', build },
      opcion: 0,
    },
    ...over,
  };
}

const base = {
  importacion: null,
  onImportar: vi.fn(),
  onCambiarRol: vi.fn(),
  onCambiarOpcion: vi.fn(),
  plan: 'premium' as const,
  bannerCerrado: false,
  alCerrarBanner: vi.fn(),
  alVerPremium: vi.fn(),
};

describe('RejillaHabilidades', () => {
  it('tiene 18 celdas y la del nivel 6 está marcada como R', () => {
    render(<RejillaHabilidades orden={orden} />);
    const lista = screen.getByRole('list', { name: t('ui.habilidades') });
    const celdas = within(lista).getAllByRole('listitem');
    expect(celdas).toHaveLength(18);
    expect(celdas[5].getAttribute('data-habilidad')).toBe('R');
    expect(celdas[5].getAttribute('aria-label')).toBe('Nivel 6: R');
    expect(celdas[0].getAttribute('data-habilidad')).toBe('Q');
  });
});

describe('BannerPremium', () => {
  it('aparece con plan gratis, no con premium, y se cierra con su botón', async () => {
    const alCerrar = vi.fn();
    const { rerender } = render(<BannerPremium plan="gratis" cerrado={false} alCerrar={alCerrar} alVer={vi.fn()} />);
    expect(screen.getByText(t('banner.texto'))).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t('banner.cerrar') }));
    expect(alCerrar).toHaveBeenCalledOnce();
    rerender(<BannerPremium plan="gratis" cerrado alCerrar={alCerrar} alVer={vi.fn()} />);
    expect(screen.queryByText(t('banner.texto'))).toBeNull();
    rerender(<BannerPremium plan="premium" cerrado={false} alCerrar={alCerrar} alVer={vi.fn()} />);
    expect(screen.queryByText(t('banner.texto'))).toBeNull();
  });

  it('en la vista Campeón aparece con gratis y se puede cerrar', async () => {
    const alCerrarBanner = vi.fn();
    const { rerender } = render(<VistaCampeon estado={estado()} {...base} plan="gratis" alCerrarBanner={alCerrarBanner} />);
    expect(screen.getByText(t('banner.texto'))).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t('banner.cerrar') }));
    expect(alCerrarBanner).toHaveBeenCalledOnce();
    rerender(<VistaCampeon estado={estado()} {...base} plan="premium" />);
    expect(screen.queryByText(t('banner.texto'))).toBeNull();
  });
});

describe('VistaCampeon', () => {
  it('con cliente esperando muestra el estado vacío', () => {
    render(<VistaCampeon estado={estado({ cliente: 'esperando', seleccion: null })} {...base} />);
    expect(screen.getByText('Esperando al cliente de League of Legends…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Importar' })).toBeNull();
  });

  it('sin selección pide elegir un campeón', () => {
    render(<VistaCampeon estado={estado({ seleccion: null })} {...base} />);
    expect(screen.getByText(t('vacio.eligeTitulo'))).toBeTruthy();
  });

  it('con importación completa el botón Importar muestra el estado de éxito', () => {
    const importacion = { runas: { ok: true as const }, hechizos: { ok: true as const }, objetos: { ok: true as const } };
    render(<VistaCampeon estado={estado()} {...base} importacion={importacion} />);
    const boton = screen.getByRole('button', { name: t('ui.importadoBoton') });
    expect(boton.className).toContain('exito');
    expect(screen.getByText(t('ui.importado'))).toBeTruthy();
  });

  it('muestra el splash del campeón, las insignias y las piezas de la build', () => {
    const { container } = render(<VistaCampeon estado={estado()} {...base} />);
    const splash = container.querySelector('.cabecera-splash') as HTMLImageElement;
    expect(splash.getAttribute('src')).toBe('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg');
    expect(screen.getByText(/52,3 % de victorias/).closest('.insignia')?.className).toContain('insignia-exito');
    expect(screen.getByRole('img', { name: 'Tormento de Luden' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Destello' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Dominación' })).toBeTruthy();
  });

  it('con menos del 50 % la insignia de victorias es ámbar', () => {
    const e = estado();
    e.seleccion!.resultado = { estado: 'ok', build: { ...build, tasaVictoria: 0.481 } };
    render(<VistaCampeon estado={e} {...base} />);
    expect(screen.getByText(/48,1 % de victorias/).closest('.insignia')?.className).toContain('insignia-aviso');
  });
});

describe('VistaCampeon: opciones de build', () => {
  const op = (nucleo: number[], partidas: number, tasaVictoria: number, popularidad: number): Build => ({
    ...build,
    nucleo,
    partidas,
    tasaVictoria,
    popularidad,
  });
  const a = op([6655, 3157, 3089], 600, 0.51, 0.5);
  const b = op([3135, 3165, 3102], 360, 0.55, 0.3);
  const c = op([3003, 3040, 6655], 240, 0.48, 0.2);
  const conOpciones = (opcion: number) =>
    estado({
      recursos: {
        ...estado().recursos,
        objetos: { ...estado().recursos.objetos, 3089: 'Sombrero', 3165: 'Morello', 3102: 'Velo', 3003: 'Báculo', 3040: 'Seráfico' },
      },
      seleccion: { ...estado().seleccion!, opcion, resultado: { estado: 'ok', build: { ...a, opciones: [a, b, c] } } },
    });

  it('muestra una pestaña por opción con su núcleo, % de uso y % de victorias; la de más victorias lleva «Más ganadora»', () => {
    render(<VistaCampeon estado={conOpciones(0)} {...base} />);
    const lista = screen.getByRole('tablist', { name: t('opciones.titulo') });
    const pestanas = within(lista).getAllByRole('tab');
    expect(pestanas).toHaveLength(3);
    expect(pestanas[0]!.textContent).toContain('Opción 1');
    expect(pestanas[0]!.textContent).toContain('50 % de uso');
    expect(pestanas[0]!.textContent).toContain('51 % victorias');
    expect(pestanas[0]!.getAttribute('aria-selected')).toBe('true');
    expect(within(pestanas[1]!).getAllByRole('img')).toHaveLength(3);
    expect(within(pestanas[1]!).getByText('Más ganadora')).toBeTruthy();
    expect(within(pestanas[0]!).queryByText('Más ganadora')).toBeNull();
  });

  it('elegir una pestaña llama a onCambiarOpcion y las tarjetas muestran la opción elegida', async () => {
    const onCambiarOpcion = vi.fn();
    const { rerender } = render(<VistaCampeon estado={conOpciones(0)} {...base} onCambiarOpcion={onCambiarOpcion} />);
    await userEvent.click(screen.getByRole('tab', { name: /Opción 2/ }));
    expect(onCambiarOpcion).toHaveBeenCalledWith(1);
    rerender(<VistaCampeon estado={conOpciones(1)} {...base} onCambiarOpcion={onCambiarOpcion} />);
    expect(screen.getByRole('tab', { name: /Opción 2/ }).getAttribute('aria-selected')).toBe('true');
    const tarjeta = document.querySelector('.tarjeta-build') as HTMLElement;
    expect(within(tarjeta).getByTitle('Morello')).toBeTruthy();
    expect(within(tarjeta).queryByTitle('Reloj de arena')).toBeNull();
    // La cabecera muestra los datos de la opción elegida.
    expect(screen.getByText('55 % de victorias')).toBeTruthy();
    expect(screen.getByText('360 partidas')).toBeTruthy();
  });

  it('con una sola opción (o una build de v1) no hay selector', () => {
    render(<VistaCampeon estado={estado()} {...base} />);
    expect(screen.queryByRole('tablist', { name: t('opciones.titulo') })).toBeNull();
  });
});

describe('VistaCampeon: páginas de runas elegibles (3.0.1)', () => {
  const pagina = (clave: number, secundario: number) => ({ estiloPrincipal: 8100, estiloSecundario: secundario, runas: [clave, 8126, 8138, 8135, 8304, 8313, 5008, 5008, 5001] });
  const paginas: OpcionRunas[] = [
    { runas: pagina(8112, 8300), partidas: 800, tasaVictoria: 0.52, popularidad: 0.65, datosLimitados: false },
    { runas: pagina(8128, 8200), partidas: 25, tasaVictoria: 0.56, popularidad: 0.02, datosLimitados: true },
  ];
  const recursos = {
    ...estado().recursos,
    runas: {
      ...estado().recursos.runas,
      8112: { nombre: 'Electrocutar', icono: 'e.png' },
      8128: { nombre: 'Cosecha oscura', icono: 'c.png' },
      8300: { nombre: 'Inspiración', icono: 'i.png' },
      8200: { nombre: 'Brujería', icono: 'b.png' },
    },
  };
  const conPaginas = (opcionRunas: number, conCampo = true) =>
    estado({
      recursos,
      seleccion: {
        ...estado().seleccion!,
        opcionRunas,
        resultado: { estado: 'ok', build: conCampo ? { ...build, opcionesRunas: paginas } : build },
      },
    });

  it('una pestaña por página con runa clave, rama secundaria, % de victorias, partidas y «Datos limitados»', () => {
    render(<VistaCampeon estado={conPaginas(0)} {...base} onCambiarRunas={vi.fn()} />);
    const lista = screen.getByRole('tablist', { name: t('runas.paginas') });
    const pestanas = within(lista).getAllByRole('tab');
    expect(pestanas).toHaveLength(2);
    expect(pestanas[0]!.textContent).toContain('Electrocutar');
    expect(pestanas[0]!.textContent).toContain('52 % victorias');
    expect(pestanas[0]!.textContent).toContain('800 partidas');
    expect(within(pestanas[0]!).getByTitle('Inspiración')).toBeTruthy();
    expect(within(pestanas[0]!).queryByText(t('datos.limitados'))).toBeNull();
    expect(within(pestanas[1]!).getByText(t('datos.limitados'))).toBeTruthy();
    expect(pestanas[0]!.getAttribute('aria-selected')).toBe('true');
  });

  it('elegir una página llama a onCambiarRunas y la tarjeta enseña esa página', async () => {
    const onCambiarRunas = vi.fn();
    const { rerender } = render(<VistaCampeon estado={conPaginas(0)} {...base} onCambiarRunas={onCambiarRunas} />);
    await userEvent.click(screen.getByRole('tab', { name: /Cosecha oscura/ }));
    expect(onCambiarRunas).toHaveBeenCalledWith(1);
    rerender(<VistaCampeon estado={conPaginas(1)} {...base} onCambiarRunas={onCambiarRunas} />);
    const ramas = document.querySelector('.tarjeta-runas .runas') as HTMLElement;
    expect(within(ramas).getByTitle('Cosecha oscura')).toBeTruthy();
    expect(within(ramas).queryByTitle('Electrocutar')).toBeNull();
  });

  it('sin opcionesRunas (servidor anterior) no hay selector y se ven las runas de la build', () => {
    render(<VistaCampeon estado={conPaginas(0, false)} {...base} onCambiarRunas={vi.fn()} />);
    expect(screen.queryByRole('tablist', { name: t('runas.paginas') })).toBeNull();
    expect(within(document.querySelector('.tarjeta-runas') as HTMLElement).getByTitle('Electrocutar')).toBeTruthy();
  });
});
