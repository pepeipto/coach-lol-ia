// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Build, EntradaCampeon } from '@coach/shared';
import { CabeceraCampeon, textoCambio } from '../src/renderer/principal/vistas/CabeceraCampeon';
import { TarjetaContraRival, TarjetaIdeasBaneo } from '../src/renderer/principal/vistas/TarjetasEnfrentamientos';
import { CuerpoArena } from '../src/renderer/principal/vistas/TarjetasModo';
import { VistaCampeones } from '../src/renderer/principal/vistas/VistaCampeones';
import { t } from '../src/shared/i18n';
import type { ApiCoach, EstadoEnfrentamientos, EstadoPrincipal, IdeasBaneoVista, RespuestaCampeones } from '../src/shared/tiposApp';

afterEach(() => {
  cleanup();
  delete (window as unknown as { coach?: unknown }).coach;
});

const c = (id: string, key = 1) => ({ id, nombre: id, key });

const BUILD: Build = {
  campeon: 'Darius', rol: 'TOP', parche: '15.20', partidas: 900, tasaVictoria: 0.52, mezclaParches: false,
  runas: { estiloPrincipal: 8000, estiloSecundario: 8400, runas: [8010] }, hechizos: [4, 12], objetosIniciales: [], nucleo: [], botas: null,
  situacionales: [], ordenHabilidades: [], calculadoEn: '',
};

describe('ideas para banear', () => {
  const ideas: IdeasBaneoVista = {
    campeon: c('Darius'),
    ideas: [
      { campeon: c('Teemo', 17), motivo: 'counter', tasaVictoria: 0.41, partidas: 80, tasaBloqueo: 0.2 },
      { campeon: c('Jax', 24), motivo: 'fuerte', tasaVictoria: 0.53, partidas: 500, seleccionRol: 0.12 },
      { campeon: c('Garen', 86), motivo: 'fuerte', tasaVictoria: 0.51, partidas: 400, seleccionRol: 0.1, tasaBloqueo: 0.05 },
    ],
  };

  it('varias opciones con su motivo y su tasa de bloqueo; nunca un «banea X»', () => {
    render(<TarjetaIdeasBaneo ideas={ideas} rol="TOP" version="15.20.1" />);
    const tarjeta = screen.getByRole('heading', { name: t('baneos.titulo') }).closest('section')!;
    expect(within(tarjeta).getAllByRole('listitem')).toHaveLength(3);
    expect(within(tarjeta).getByText(t('baneos.motivoCounter', { campeon: 'Darius', porcentaje: '41', partidas: 80 }))).toBeTruthy();
    expect(within(tarjeta).getByText(t('baneos.motivoFuerte', { rol: t('rol.TOP'), porcentaje: '53', seleccion: '12' }))).toBeTruthy();
    expect(within(tarjeta).getByText(t('tasas.bloqueo', { porcentaje: '20' }))).toBeTruthy();
    expect(within(tarjeta).getByText(t('baneos.opciones'))).toBeTruthy();
    expect(tarjeta.textContent).not.toMatch(/banea /i);
  });
});

describe('«Contra {rival}» con la fase de líneas', () => {
  it('pinta la fase de líneas y la puntuación del cruce', () => {
    const e: EstadoEnfrentamientos = {
      rol: 'TOP', rival: { ...c('Garen', 86), inferido: false }, counters: null, buenasElecciones: [],
      contra: { partidas: 120, tasaVictoria: 0.58, datosLimitados: false, tasaFaseLineas: 0.62, partidasFaseLineas: 100, puntuacion: 14.2 },
    };
    render(<TarjetaContraRival enfrentamientos={e} version="15.20.1" />);
    expect(screen.getByText(t('enfrentamientos.fase', { porcentaje: '62' }))).toBeTruthy();
    expect(screen.getByText(t('enfrentamientos.puntuacion', { puntuacion: '+14,2' }))).toBeTruthy();
  });

  it('sin esos datos (servidor antiguo) no pinta nada de fase', () => {
    const e: EstadoEnfrentamientos = {
      rol: 'TOP', rival: { ...c('Garen', 86), inferido: false }, counters: null, buenasElecciones: [],
      contra: { partidas: 120, tasaVictoria: 0.58, datosLimitados: false },
    };
    render(<TarjetaContraRival enfrentamientos={e} version="15.20.1" />);
    expect(screen.queryByText(/Fase de líneas/)).toBeNull();
  });
});

describe('cambio frente al parche anterior', () => {
  it('formato con signo y un decimal', () => {
    expect(textoCambio(0.4)).toBe(t('formato.porcentaje', { n: '+0,4' }));
    expect(textoCambio(-1.25)).toMatch(/^−1,3/);
  });

  it('flecha verde en la cabecera junto al % de victorias, con las cifras del campeón (no de la opción)', () => {
    const seleccion = {
      campeon: { id: 'Darius', nombre: 'Darius', key: 122 }, rol: 'TOP' as const, rolesDisponibles: ['TOP' as const],
      resultado: { estado: 'ok' as const, build: BUILD }, opcion: 0,
    };
    render(<CabeceraCampeon seleccion={seleccion} version="15.20.1" onCambiarRol={vi.fn()} cifras={{ cambioTasaVictoria: 0.4, tasaBloqueo: 0.1 }} />);
    const flecha = screen.getByLabelText(t('cambio.ayuda', { cambio: textoCambio(0.4) }));
    expect(flecha.className).toContain('sube');
    expect(screen.getByText(t('tasas.bloqueo', { porcentaje: '10' }))).toBeTruthy();
  });
});

describe('tier list: columnas Selección y Bloqueo, y cambio', () => {
  const entrada = (o: Partial<EntradaCampeon> & Pick<EntradaCampeon, 'campeon'>): EntradaCampeon => ({
    rol: 'MIDDLE', partidas: 500, tasaVictoria: 0.5, uso: 0.1, tier: 'B', datosLimitados: false, ...o,
  });
  const LISTA: RespuestaCampeones = {
    ok: true, modo: 'clasificatoria', version: '15.20.1',
    campeones: [c('Ahri', 103), c('Zed', 238), c('Lux', 99)],
    resultado: {
      estado: 'ok',
      lista: {
        parche: '15.20',
        campeones: [
          entrada({ campeon: 'Ahri', tier: 'S', tasaSeleccion: 0.08, tasaBloqueo: 0.02, cambioTasaVictoria: -0.8 }),
          entrada({ campeon: 'Zed', tier: 'A', tasaSeleccion: 0.12, tasaBloqueo: 0.3 }),
          entrada({ campeon: 'Lux', tier: 'B' }),
        ],
      },
    },
  };
  const filas = () => within(screen.getByRole('table', { name: t('campeones.tabla') })).getAllByRole('row').slice(1).map((r) => r.getAttribute('data-campeon'));

  it('se ordena por bloqueo y por selección (sin dato, al final) y enseña la flecha roja', async () => {
    window.coach = { campeones: vi.fn().mockResolvedValue(LISTA) } as unknown as ApiCoach;
    render(<VistaCampeones estado={null as EstadoPrincipal | null} importacion={null} onImportar={vi.fn()} onCambiarOpcion={vi.fn()} />);
    await screen.findByRole('table', { name: t('campeones.tabla') });
    await userEvent.click(screen.getByRole('button', { name: t('campeones.col.bloqueo') }));
    expect(filas()).toEqual(['Zed', 'Ahri', 'Lux']);
    await userEvent.click(screen.getByRole('button', { name: t('campeones.col.seleccion') }));
    expect(filas()).toEqual(['Zed', 'Ahri', 'Lux']);
    await userEvent.click(screen.getByRole('button', { name: t('campeones.col.seleccion') }));
    expect(filas()).toEqual(['Lux', 'Ahri', 'Zed']);
    const ahri = screen.getAllByRole('row').find((r) => r.getAttribute('data-campeon') === 'Ahri')!;
    expect(within(ahri).getByLabelText(t('cambio.ayuda', { cambio: textoCambio(-0.8) })).className).toContain('baja');
    expect(within(ahri).getByText('2 %')).toBeTruthy();
  });
});

describe('Arena: cifras del campeón y solo % de uso en aumentos y objetos', () => {
  it('posición media, top 4 y 1.er puesto del campeón en su tarjeta', () => {
    const arena: Build = {
      ...BUILD, campeon: 'Ahri', rol: null, modo: 'arena', tasaVictoria: 0.19,
      arena: { posicionMedia: 3.3, top4: 0.71, victorias: 0.19 },
      aumentosPopulares: [{ id: 1205, partidas: 30, uso: 0.3 }],
      objetosArenaPopulares: [{ id: 3089, partidas: 70, uso: 0.7 }],
    };
    render(<CuerpoArena build={arena} recursos={{ objetos: {}, runas: {}, hechizos: {}, aumentos: {} }} version="15.20.1" />);
    const tarjeta = screen.getByRole('heading', { name: t('modos.cifrasArena') }).closest('section')!;
    expect(within(tarjeta).getByText('3,3')).toBeTruthy();
    expect(within(tarjeta).getByText(t('formato.porcentaje', { n: '71' }))).toBeTruthy();
    expect(within(tarjeta).getByText(t('formato.porcentaje', { n: '19' }))).toBeTruthy();
    const aumentos = screen.getByRole('heading', { name: t('modos.aumentos') }).closest('section')!;
    expect(within(aumentos).getByText(t('opciones.uso', { porcentaje: '30' }))).toBeTruthy();
    expect(aumentos.textContent).not.toMatch(/3,3|71|19 %/);
  });
});
