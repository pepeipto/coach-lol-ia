// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Build } from '@coach/shared';
import { VistaCampeon } from '../src/renderer/principal/vistas/VistaCampeon';
import { TarjetaEnfrentamientos } from '../src/renderer/principal/vistas/TarjetasEnfrentamientos';
import { t } from '../src/shared/i18n';
import type { CountersVista, EstadoEnfrentamientos, EstadoPrincipal, LineaEnfrentamientoVista } from '../src/shared/tiposApp';

afterEach(cleanup);

const build: Build = {
  campeon: 'Darius', rol: 'TOP', parche: '15.20', partidas: 900, tasaVictoria: 0.51, mezclaParches: false,
  runas: { estiloPrincipal: 8000, estiloSecundario: 8400, runas: [8010, 9111, 9104, 8299, 8444, 8242, 5005, 5008, 5001] },
  hechizos: [4, 12], objetosIniciales: [1054], nucleo: [6631, 3071, 3053], botas: 3047, situacionales: [],
  ordenHabilidades: [], calculadoEn: '2026-10-18T00:00:00Z',
};

let key = 1;
const linea = (id: string, tasaVictoria: number, partidas: number, datosLimitados = false): LineaEnfrentamientoVista => ({
  campeon: { id, nombre: id, key: key++ }, tasaVictoria, partidas, datosLimitados,
});

const COUNTERS: CountersVista = {
  parche: '15.20',
  partidas: 640,
  faciles: [linea('Garen', 0.58, 120), linea('Nasus', 0.56, 90)],
  dificiles: [linea('Teemo', 0.42, 170), linea('Quinn', 0.44, 12, true)],
  todos: [
    linea('Garen', 0.58, 120), linea('Nasus', 0.56, 90), linea('Sett', 0.5, 200), linea('Quinn', 0.44, 12, true), linea('Teemo', 0.42, 170),
  ],
  sinConexion: false,
};

function estado(over: Partial<EstadoPrincipal> = {}): EstadoPrincipal {
  return {
    cliente: 'conectado',
    version: '15.20.1',
    error: null,
    importacion: null,
    aviso: null,
    recursos: { objetos: {}, runas: {}, hechizos: {} },
    seleccion: {
      campeon: { id: 'Darius', nombre: 'Darius', key: 122 },
      rol: 'TOP',
      rolesDisponibles: ['TOP'],
      resultado: { estado: 'ok', build },
      opcion: 0,
    },
    ...over,
  };
}

const enf = (over: Partial<EstadoEnfrentamientos> = {}): EstadoEnfrentamientos => ({
  rol: 'TOP', rival: null, counters: COUNTERS, contra: null, buenasElecciones: [], ...over,
});

const base = {
  importacion: null,
  onImportar: vi.fn(),
  onCambiarRol: vi.fn(),
  onCambiarOpcion: vi.fn(),
  plan: 'premium' as const,
  bannerCerrado: true,
  alCerrarBanner: vi.fn(),
  alVerPremium: vi.fn(),
};

describe('tarjeta «Enfrentamientos»', () => {
  it('dos columnas, «Te cuesta» y «Te va bien», con icono, % y partidas', () => {
    render(<VistaCampeon {...base} estado={estado({ enfrentamientos: enf() })} />);
    const cuesta = screen.getByRole('list', { name: t('enfrentamientos.teCuesta') });
    const bien = screen.getByRole('list', { name: t('enfrentamientos.teVaBien') });
    expect(within(cuesta).getAllByRole('listitem').map((li) => li.querySelector('.enfrentamiento-nombre')?.textContent)).toEqual(['Teemo', 'Quinn']);
    expect(within(bien).getByText('Garen')).toBeTruthy();
    expect(within(bien).getByText('58 %')).toBeTruthy();
    expect(within(bien).getByText(t('enfrentamientos.partidas', { partidas: 120 }))).toBeTruthy();
    expect(within(bien).getByAltText('Garen').getAttribute('src')).toBe('https://ddragon.leagueoflegends.com/cdn/15.20.1/img/champion/Garen.png');
    expect(within(cuesta).getByText(new RegExp(t('enfrentamientos.datosLimitados')))).toBeTruthy();
  });

  it('no sale sin counters (fuera de la Grieta o sin datos)', () => {
    render(<VistaCampeon {...base} estado={estado()} />);
    expect(screen.queryByText(t('enfrentamientos.titulo'))).toBeNull();
  });

  it('«Ver todos» abre la lista completa, ordenable por % de victorias o por partidas', async () => {
    const user = userEvent.setup();
    render(<TarjetaEnfrentamientos counters={COUNTERS} version="15.20.1" />);
    await user.click(screen.getByRole('button', { name: t('enfrentamientos.verTodos', { n: 5 }) }));
    const nombres = () =>
      within(screen.getByRole('list', { name: t('enfrentamientos.todos') }))
        .getAllByRole('listitem')
        .map((li) => li.querySelector('.enfrentamiento-nombre')?.textContent);
    expect(nombres()).toEqual(['Garen', 'Nasus', 'Sett', 'Quinn', 'Teemo']);
    await user.click(screen.getByRole('button', { name: t('enfrentamientos.orden.partidas') }));
    expect(nombres()).toEqual(['Sett', 'Teemo', 'Garen', 'Nasus', 'Quinn']);
    // Otra vez en el mismo orden: al revés.
    await user.click(screen.getByRole('button', { name: t('enfrentamientos.orden.partidas') }));
    expect(nombres()).toEqual(['Quinn', 'Nasus', 'Garen', 'Teemo', 'Sett']);
    await user.click(screen.getByRole('button', { name: t('enfrentamientos.verMenos') }));
    expect(screen.getByRole('list', { name: t('enfrentamientos.teCuesta') })).toBeTruthy();
  });
});

describe('tarjeta «Contra {rival}»', () => {
  const rival = { id: 'Garen', nombre: 'Garen', key: 86, inferido: true };

  it('tu % en el cruce, las partidas y la build del cruce, que se importa con su botón', async () => {
    const user = userEvent.setup();
    const importar = vi.fn(async () => ({ runas: { ok: true }, hechizos: { ok: true }, objetos: { ok: true } }) as const);
    const contra = {
      partidas: 120, tasaVictoria: 0.58, datosLimitados: false,
      build: { ...build, partidas: 50, tasaVictoria: 0.62 },
      recursos: { objetos: { 6631: 'Hidra', 3071: 'Cleaver', 3053: 'Sterak' }, runas: { 8010: { nombre: 'Conquistador', icono: 'perk.png' } }, hechizos: {} },
    };
    render(<VistaCampeon {...base} onImportarEnfrentamiento={importar} estado={estado({ enfrentamientos: enf({ rival, contra }) })} />);
    const tarjeta = screen.getByText(t('enfrentamientos.contra', { rival: 'Garen' })).closest('section')!;
    expect(within(tarjeta).getByText('58 %')).toBeTruthy();
    expect(within(tarjeta).getByText(t('enfrentamientos.tuTasa', { partidas: 120 }))).toBeTruthy();
    expect(within(tarjeta).getByText(t('enfrentamientos.inferido'))).toBeTruthy();
    expect(within(tarjeta).getByAltText('Hidra')).toBeTruthy();
    expect(within(tarjeta).getByAltText('Conquistador')).toBeTruthy();
    expect(within(tarjeta).getByText(t('enfrentamientos.buildCifras', { porcentaje: '62', partidas: 50 }))).toBeTruthy();
    await user.click(within(tarjeta).getByRole('button', { name: t('enfrentamientos.importarCruce') }));
    expect(importar).toHaveBeenCalledTimes(1);
    expect(await within(tarjeta).findByText(t('ui.importado'))).toBeTruthy();
  });

  it('sin datos del cruce lo dice, y sin build no hay botón', () => {
    render(<VistaCampeon {...base} onImportarEnfrentamiento={vi.fn()} estado={estado({ enfrentamientos: enf({ rival: { ...rival, inferido: false } }) })} />);
    expect(screen.getByText(t('enfrentamientos.sinDatosCruce'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('enfrentamientos.importarCruce') })).toBeNull();
    expect(screen.queryByText(t('enfrentamientos.inferido'))).toBeNull();
  });
});

describe('«Buenas elecciones contra {rival}»', () => {
  it('sin campeón elegido y con el rival de tu línea elegido: la lista sobre el estado vacío', () => {
    const e = enf({
      counters: null,
      rival: { id: 'Garen', nombre: 'Garen', key: 86, inferido: false },
      buenasElecciones: [linea('Teemo', 0.58, 170), linea('Vayne', 0.56, 80)],
    });
    render(<VistaCampeon {...base} estado={estado({ seleccion: null, enfrentamientos: e })} />);
    const lista = screen.getByRole('list', { name: t('enfrentamientos.buenasContra', { rival: 'Garen' }) });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(t('vacio.eligeTitulo'))).toBeTruthy();
  });

  it('sin rival elegido, solo el estado vacío de siempre', () => {
    render(<VistaCampeon {...base} estado={estado({ seleccion: null, enfrentamientos: enf({ counters: null }) })} />);
    expect(screen.queryByText(/Garen/)).toBeNull();
    expect(screen.getByText(t('vacio.eligeTitulo'))).toBeTruthy();
  });
});
