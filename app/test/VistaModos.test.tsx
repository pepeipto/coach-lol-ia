// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Build, ElementoPopular } from '@coach/shared';
import { ordenarPorUso } from '../src/renderer/principal/vistas/elementosModo';
import { VistaCampeon } from '../src/renderer/principal/vistas/VistaCampeon';
import { VistaCampeones } from '../src/renderer/principal/vistas/VistaCampeones';
import { t } from '../src/shared/i18n';
import type { ApiCoach, EstadoPrincipal, RespuestaCampeones } from '../src/shared/tiposApp';

afterEach(cleanup);

const el = (id: number, uso: number, partidas = 20): ElementoPopular => ({ id, partidas, uso });

describe('ordenarPorUso', () => {
  it('de más a menos elegidos', () => {
    expect(ordenarPorUso([el(1, 0.2), el(2, 0.6), el(3, 0.4)]).map((e) => e.id)).toEqual([2, 3, 1]);
  });
});

/** Texto de victorias o de posición media de un aumento u objeto (prohibido por la política de Riot). */
const RENDIMIENTO = /victoria|posici|winrate|win rate/i;

const base: Build = {
  campeon: 'Ahri',
  rol: null,
  parche: '15.20',
  partidas: 300,
  tasaVictoria: 0.25,
  mezclaParches: false,
  runas: { estiloPrincipal: 0, estiloSecundario: 0, runas: [] },
  hechizos: [4, 14],
  objetosIniciales: [],
  nucleo: [],
  botas: null,
  situacionales: [],
  ordenHabilidades: [],
  calculadoEn: '',
};

const ARENA: Build = {
  ...base,
  modo: 'arena',
  arena: { posicionMedia: 3.4, top4: 0.62, victorias: 0.25 },
  aumentosPopulares: [el(1205, 0.3), el(1327, 0.5)],
  objetosArenaPopulares: [el(3089, 0.7)],
};

function estado(build: Build, modo: 'arena' | 'caos'): EstadoPrincipal {
  return {
    cliente: 'conectado',
    version: '15.20.1',
    error: null,
    importacion: null,
    aviso: null,
    recursos: {
      objetos: { 3089: 'Sombrero mortal de Rabadon' },
      runas: {},
      hechizos: { 4: { nombre: 'Destello', imagen: 'SummonerFlash.png' } },
      aumentos: {
        1205: { nombre: 'Daño Habilidoso', icono: 'https://raw.communitydragon.org/latest/x/adapt_small.png' },
        1327: { nombre: 'Insistente', icono: null },
      },
    },
    seleccion: { campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 }, rol: null, modo, rolesDisponibles: [], resultado: { estado: 'ok', build }, opcion: 0 },
  };
}

const props = {
  importacion: null,
  onImportar: vi.fn(),
  onCambiarRol: vi.fn(),
  onCambiarOpcion: vi.fn(),
  plan: 'premium' as const,
  bannerCerrado: true,
  alCerrarBanner: vi.fn(),
  alVerPremium: vi.fn(),
};

describe('VistaCampeon en Arena y ARAM: Caos', () => {
  it('Arena: posición media, top 4 y 1.er puesto del campeón; aumentos con nombre e icono; sin roles ni «Importar»', () => {
    render(<VistaCampeon {...props} estado={estado(ARENA, 'arena')} />);
    expect(screen.getByText(t('campeon.modoActual', { modo: t('modo.arena') }))).toBeTruthy();
    expect(screen.getByText(t('modos.posicionMedia', { posicion: '3,4' }))).toBeTruthy();
    expect(screen.getByText(t('modos.top4', { porcentaje: '62' }))).toBeTruthy();
    expect(screen.queryByRole('group', { name: t('ui.rol') })).toBeNull();
    expect(screen.queryByText(t('ui.importar'))).toBeNull();
    const aumentos = screen.getByRole('heading', { name: t('modos.aumentos') }).closest('section')!;
    expect(within(aumentos).getByRole('img', { name: 'Daño Habilidoso' }).getAttribute('src')).toContain('raw.communitydragon.org');
    // Solo por uso: Insistente (50 %) va primero.
    const nombres = within(aumentos).getAllByText(/Daño Habilidoso|Insistente/).map((n) => n.textContent);
    expect(nombres).toEqual(['Insistente', 'Daño Habilidoso']);
    expect(screen.getByText('Sombrero mortal de Rabadon')).toBeTruthy();
    expect(screen.queryByText(t('ui.habilidades'))).toBeNull();
  });

  it('ARAM: Caos: la build normal más la tarjeta de aumentos', () => {
    const caos: Build = {
      ...base,
      modo: 'caos',
      runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112] },
      ordenHabilidades: ['Q', 'W', 'E'],
      aumentosPopulares: [el(1205, 0.3)],
    };
    render(<VistaCampeon {...props} estado={estado(caos, 'caos')} />);
    expect(screen.getByText(t('ui.habilidades'))).toBeTruthy();
    expect(screen.getByRole('heading', { name: t('modos.aumentos') })).toBeTruthy();
    expect(screen.getByText(t('ui.importar'))).toBeTruthy();
  });
});

describe('VistaCampeones: selector de modo', () => {
  const ARENA_LISTA: RespuestaCampeones = {
    ok: true,
    modo: 'arena',
    version: '15.20.1',
    campeones: [{ id: 'Ahri', nombre: 'Ahri', key: 103 }],
    resultado: {
      estado: 'ok',
      lista: {
        parche: '15.20',
        campeones: [{ campeon: 'Ahri', rol: null, partidas: 300, tasaVictoria: 0.25, uso: 0.1, tier: 'A', datosLimitados: false, posicionMedia: 3.4, top4: 0.62 }],
      },
    },
  };
  let campeones: ReturnType<typeof vi.fn>;
  let buildDe: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    campeones = vi.fn(async (f?: { modo?: string }) =>
      f?.modo === 'arena' ? ARENA_LISTA : { ...ARENA_LISTA, modo: 'clasificatoria', resultado: { estado: 'ok', lista: { parche: '15.20', campeones: [] } } },
    );
    buildDe = vi.fn(async () => ({ ok: false, error: 'datos' }));
    window.coach = { campeones, buildDe } as unknown as ApiCoach;
  });

  it('cambiar a Arena pide la lista del modo, quita los roles y muestra posición media y top 4', async () => {
    render(<VistaCampeones estado={null} importacion={null} onImportar={vi.fn()} onCambiarOpcion={vi.fn()} />);
    await screen.findByRole('table', { name: t('campeones.tabla') });
    expect(screen.getByRole('tablist', { name: t('campeones.roles') })).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: t('modo.arena') }));
    expect(campeones).toHaveBeenLastCalledWith({ modo: 'arena' });
    await screen.findByText('3,4');
    expect(screen.queryByRole('tablist', { name: t('campeones.roles') })).toBeNull();
    expect(screen.getByRole('columnheader', { name: new RegExp(t('campeones.col.posicionMedia')) })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: t('campeones.col.rol') })).toBeNull();
    expect(screen.getByText('62 %')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t('campeones.verBuildModo', { campeon: 'Ahri' }) }));
    expect(buildDe).toHaveBeenCalledWith('Ahri', null, 'arena');
  });
});

describe('ARAM: Caos con opciones de build', () => {
  const opcion = (n: number): Build => ({
    ...base,
    modo: 'caos',
    runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112] },
    ordenHabilidades: ['Q', 'W', 'E'],
    nucleo: [3089 + n],
    popularidad: 0.5,
  });
  const conOpciones = (aumentosEnOpciones: boolean): Build => {
    const aumentosPopulares = [el(1205, 0.3)];
    const opciones = [opcion(0), opcion(1)].map((o) => (aumentosEnOpciones ? { ...o, aumentosPopulares } : o));
    return { ...opcion(0), aumentosPopulares, opciones };
  };

  for (const enOpciones of [true, false]) {
    it(`la tarjeta de aumentos sale con la opción elegida (aumentos ${enOpciones ? 'en cada opción' : 'solo arriba'})`, () => {
      render(<VistaCampeon {...props} estado={estado(conOpciones(enOpciones), 'caos')} />);
      const tarjeta = screen.getByRole('heading', { name: t('modos.aumentos') }).closest('section')!;
      expect(within(tarjeta).getByText('Daño Habilidoso')).toBeTruthy();
      expect(within(tarjeta).queryByRole('tab')).toBeNull();
    });
  }
});

describe('política de Riot: sin % de victorias de aumentos ni de objetos de Arena', () => {
  for (const modo of ['arena', 'caos'] as const) {
    it(`${modo}: las tarjetas de aumentos${modo === 'arena' ? ' y objetos' : ''} solo enseñan el % de uso, sin pestañas de «mejores»`, () => {
      const build: Build =
        modo === 'arena'
          ? ARENA
          : { ...base, modo: 'caos', runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112] }, aumentosPopulares: [el(1205, 0.3)] };
      render(<VistaCampeon {...props} estado={estado(build, modo)} />);
      const titulos = modo === 'arena' ? [t('modos.aumentos'), t('modos.objetosArena')] : [t('modos.aumentos')];
      for (const titulo of titulos) {
        const tarjeta = screen.getByRole('heading', { name: titulo }).closest('section')!;
        expect(tarjeta.textContent).not.toMatch(RENDIMIENTO);
        expect(within(tarjeta).queryByRole('tab')).toBeNull();
        expect(within(tarjeta).getAllByText(/%/).length).toBeGreaterThan(0);
      }
    });
  }

  it('aunque la build traiga los campos de la 3.1 (sin sanear), no se pinta ninguna cifra de rendimiento', () => {
    const vieja = {
      ...ARENA,
      aumentosPopulares: undefined,
      objetosArenaPopulares: undefined,
      aumentos: [{ id: 1205, partidas: 30, uso: 0.6, tasaVictoria: 0.55, posicionMedia: 3.2 }],
      aumentosMejores: [{ id: 1327, partidas: 30, uso: 0.6, tasaVictoria: 0.9, posicionMedia: 1.2 }],
    } as unknown as Build;
    render(<VistaCampeon {...props} estado={estado(vieja, 'arena')} />);
    expect(screen.queryByText(/55 %|90 %|3,2|1,2/)).toBeNull();
  });
});
