// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Build } from '@coach/shared';
import { TarjetaEnfrentamientos, TarjetaSinergias, TarjetaSinergiasDe } from '../src/renderer/principal/vistas/TarjetasEnfrentamientos';
import { VistaCampeon } from '../src/renderer/principal/vistas/VistaCampeon';
import { t } from '../src/shared/i18n';
import type { CountersVista, EstadoPrincipal, LineaEnfrentamientoVista, SinergiasVista } from '../src/shared/tiposApp';

afterEach(() => {
  cleanup();
  delete (window as unknown as { coach?: unknown }).coach;
});

const c = (id: string) => ({ id, nombre: id, key: 1 });
const linea = (id: string, tasa: number, extra: Partial<LineaEnfrentamientoVista> = {}): LineaEnfrentamientoVista => ({
  campeon: c(id), partidas: 50, tasaVictoria: tasa, datosLimitados: false, ...extra,
});

describe('fase de líneas en la tarjeta Enfrentamientos', () => {
  const garen = linea('Garen', 0.58, { tasaFaseLineas: 0.62, partidasFaseLineas: 40, puntuacion: 18.4 });
  const teemo = linea('Teemo', 0.44);
  const sett = linea('Sett', 0.52, { tasaFaseLineas: 0.3, partidasFaseLineas: 20, puntuacion: -4 });
  const counters: CountersVista = { parche: '15.20', partidas: 150, todos: [garen, sett, teemo], faciles: [garen], dificiles: [teemo], sinConexion: false };

  it('enseña la fase de líneas y la puntuación solo en los cruces que las tienen', () => {
    render(<TarjetaEnfrentamientos counters={counters} version="15.20.1" />);
    expect(screen.getByText(t('enfrentamientos.fase', { porcentaje: '62' }))).toBeTruthy();
    expect(screen.getByText(t('enfrentamientos.puntuacion', { puntuacion: '+18,4' }))).toBeTruthy();
    const filaTeemo = screen.getByText('Teemo').closest('li')!;
    expect(within(filaTeemo).queryByText(/Fase de líneas/)).toBeNull();
  });

  it('la lista completa se puede ordenar por fase de líneas y por puntuación', async () => {
    render(<TarjetaEnfrentamientos counters={counters} version="15.20.1" />);
    await userEvent.click(screen.getByRole('button', { name: t('enfrentamientos.verTodos', { n: 3 }) }));
    await userEvent.click(screen.getByRole('button', { name: t('enfrentamientos.orden.puntuacion') }));
    const nombres = () => within(screen.getByRole('list', { name: t('enfrentamientos.todos') })).getAllByRole('listitem').map((li) => li.querySelector('.enfrentamiento-nombre')!.textContent);
    expect(nombres()).toEqual(['Garen', 'Sett', 'Teemo']);
    await userEvent.click(screen.getByRole('button', { name: t('enfrentamientos.orden.fase') }));
    expect(nombres()).toEqual(['Garen', 'Sett', 'Teemo']);
    await userEvent.click(screen.getByRole('button', { name: t('enfrentamientos.orden.fase') }));
    expect(nombres()).toEqual(['Sett', 'Garen', 'Teemo']); // ascendente: los que no tienen el dato, al final
  });

  it('sin datos de fase, no aparecen sus botones de orden', async () => {
    const sinFase: CountersVista = { ...counters, todos: [teemo, linea('Quinn', 0.6)], faciles: [], dificiles: [] };
    render(<TarjetaEnfrentamientos counters={sinFase} version="15.20.1" />);
    await userEvent.click(screen.getByRole('button', { name: t('enfrentamientos.verTodos', { n: 2 }) }));
    expect(screen.queryByRole('button', { name: t('enfrentamientos.orden.fase') })).toBeNull();
  });
});

describe('tarjeta Sinergias', () => {
  const sinergias: SinergiasVista = {
    parche: '15.20',
    sinConexion: false,
    porRol: [{ rol: 'UTILITY', aliados: [{ campeon: c('Lulu'), partidas: 12, tasaVictoria: 0.75, datosLimitados: true }] }],
  };

  it('pinta los mejores compañeros por rol con su %', () => {
    render(<TarjetaSinergias sinergias={sinergias} version="15.20.1" />);
    expect(screen.getByText(t('sinergias.titulo'))).toBeTruthy();
    const lista = screen.getByRole('list', { name: t('sinergias.conRol', { rol: t('rol.UTILITY') }) });
    expect(within(lista).getByText('Lulu')).toBeTruthy();
    expect(within(lista).getByText('75 %')).toBeTruthy();
  });

  it('la pide por IPC y no pinta nada sin datos o sin la API', async () => {
    const pedir = vi.fn(async () => ({ ok: true as const, version: '15.20.1', sinergias }));
    (window as unknown as { coach: unknown }).coach = { sinergias: pedir };
    const { unmount } = render(<TarjetaSinergiasDe campeon="Jinx" rol="BOTTOM" version="15.20.1" />);
    await waitFor(() => expect(screen.getByText('Lulu')).toBeTruthy());
    expect(pedir).toHaveBeenCalledWith('Jinx', 'BOTTOM');
    unmount();
    (window as unknown as { coach: unknown }).coach = { sinergias: async () => ({ ok: false }) };
    const { container } = render(<TarjetaSinergiasDe campeon="Jinx" rol="BOTTOM" version="15.20.1" />);
    await Promise.resolve();
    expect(container.textContent).toBe('');
  });
});

describe('tasas de bloqueo y selección en la vista Campeón', () => {
  const build: Build = {
    campeon: 'Ahri', rol: 'MIDDLE', parche: '15.20', partidas: 1234, tasaVictoria: 0.52, mezclaParches: false,
    runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112, 8126, 8138, 8135, 8304, 8313, 5008, 5008, 5001] },
    hechizos: [4, 14], objetosIniciales: [1056], nucleo: [6655, 3157], botas: 3020, situacionales: [], ordenHabilidades: [],
    calculadoEn: '2026-10-18T00:00:00Z',
  };
  const estado = (b: Build): EstadoPrincipal => ({
    cliente: 'conectado', version: '15.20.1', error: null, importacion: null, aviso: null,
    recursos: { objetos: {}, runas: {}, hechizos: {} },
    seleccion: { campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 }, rol: 'MIDDLE', rolesDisponibles: ['MIDDLE'], resultado: { estado: 'ok', build: b }, opcion: 0 },
  });
  const props = {
    importacion: null, onImportar: vi.fn(), onCambiarRol: vi.fn(), onCambiarOpcion: vi.fn(), plan: 'premium' as const,
    bannerCerrado: false, alCerrarBanner: vi.fn(), alVerPremium: vi.fn(),
  };

  it('junto al % de victorias, si la build las trae', () => {
    render(<VistaCampeon estado={estado({ ...build, tasaBloqueo: 0.125, tasaSeleccion: 0.08 })} {...props} />);
    expect(screen.getByText(t('tasas.bloqueo', { porcentaje: '12,5' }))).toBeTruthy();
    expect(screen.getByText(t('tasas.seleccion', { porcentaje: '8' }))).toBeTruthy();
  });

  it('nada si no las trae (servidor anterior o pocos datos)', () => {
    render(<VistaCampeon estado={estado(build)} {...props} />);
    expect(screen.queryByText(/de bloqueo/)).toBeNull();
    expect(screen.queryByText(/de selección/)).toBeNull();
  });
});
