// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ModoCarga } from '../src/renderer/overlay/carga/ModoCarga';
import { PantallaCarga } from '../src/renderer/overlay/carga/PantallaCarga';
import { TarjetaJugador } from '../src/renderer/overlay/carga/TarjetaJugador';
import { nombreCampeon, textoMaestria, textoRango, textoWinrate } from '../src/renderer/overlay/carga/formato';
import type { EstadoCarga, JugadorCarga } from '../src/shared/tiposApp';
import es from '../src/shared/i18n/es.json';

afterEach(cleanup);

const jugador = (j: Partial<JugadorCarga> = {}): JugadorCarga => ({
  equipo: 'aliado',
  riotId: 'Ana#EUW',
  campeonId: 103,
  campeon: 'Ahri',
  rol: 'MIDDLE',
  rango: { tier: 'EMERALD', division: 'II', lp: 42, victorias: 30, derrotas: 20 },
  maestria: { nivel: 12, puntos: 250_000 },
  campeonWinrate: 0.523,
  etiquetas: [
    { tipo: 'positivo', texto: 'Especialista en Ahri' },
    { tipo: 'neutro', texto: 'Daño mágico en área' },
  ],
  ...j,
});

const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const;
const estado = (): EstadoCarga => ({
  version: '16.20.1',
  jugadores: [
    ...ROLES.map((rol, i) => jugador({ rol, riotId: `Aliado${i}#1` })),
    ...ROLES.map((rol, i) => jugador({ rol, equipo: 'enemigo', riotId: `Enemigo${i}#2`, campeon: 'MonkeyKing', campeonId: 62 })),
  ],
});

describe('formato de la pantalla de carga', () => {
  it('rango oficial en español, sin división en las ligas de ápice', () => {
    expect(textoRango({ tier: 'EMERALD', division: 'II', lp: 42, victorias: 1, derrotas: 1 })).toBe('Esmeralda II · 42 LP');
    expect(textoRango({ tier: 'CHALLENGER', division: 'I', lp: 1200, victorias: 1, derrotas: 1 })).toBe('Retador · 1200 LP');
    expect(textoRango(null)).toBe('Sin clasificar');
  });

  it('maestría y winrate', () => {
    expect(textoMaestria({ nivel: 12, puntos: 250_000 })).toBe('Maestría 12 · 250 mil pts');
    expect(textoMaestria({ nivel: 4, puntos: 1500 })).toBe('Maestría 4 · 1500 pts');
    expect(textoMaestria({ nivel: 41, puntos: 1_250_000 })).toBe('Maestría 41 · 1,3 M pts');
    expect(textoMaestria(null)).toBeNull();
    expect(textoWinrate(0.523)).toBe('52,3 %');
    expect(textoWinrate(null)).toBeNull();
  });

  it('nombre del campeón a partir de su id de Data Dragon', () => {
    expect(nombreCampeon('MonkeyKing')).toBe('Wukong');
    expect(nombreCampeon('LeeSin')).toBe('Lee Sin');
    expect(nombreCampeon('Chogath')).toBe("Cho'Gath");
    expect(nombreCampeon('Ahri')).toBe('Ahri');
    expect(nombreCampeon('')).toBe('');
  });
});

describe('TarjetaJugador', () => {
  it('muestra icono, Riot ID, rango oficial, maestría, winrate del campeón y etiquetas', () => {
    render(<TarjetaJugador jugador={jugador()} version="16.20.1" />);
    const tarjeta = screen.getByRole('listitem', { name: 'Ana#EUW, Ahri' });
    const icono = within(tarjeta).getByRole('img', { name: 'Ahri' }) as HTMLImageElement;
    expect(icono.src).toBe('https://ddragon.leagueoflegends.com/cdn/16.20.1/img/champion/Ahri.png');
    expect(within(tarjeta).getByText('Ana')).toBeTruthy();
    expect(within(tarjeta).getByText('#EUW')).toBeTruthy();
    expect(within(tarjeta).getByText('Esmeralda II · 42 LP')).toBeTruthy();
    expect(within(tarjeta).getByText('60 % · 30 V 20 D')).toBeTruthy();
    expect(within(tarjeta).getByText('Maestría 12 · 250 mil pts')).toBeTruthy();
    expect(within(tarjeta).getByText('52,3 %')).toBeTruthy();
    expect(within(tarjeta).getByText('Central')).toBeTruthy();
    expect(within(tarjeta).getByText('Especialista en Ahri').closest('li')!.className).toContain('positivo');
    expect(within(tarjeta).getByText('Daño mágico en área').closest('li')!.className).toContain('neutro');
  });

  it('sin datos del servidor muestra solo lo local, sin huecos rotos', () => {
    render(
      <TarjetaJugador
        jugador={jugador({ riotId: '', rango: null, maestria: null, campeonWinrate: null, etiquetas: [], rol: null })}
        version="16.20.1"
      />,
    );
    const tarjeta = screen.getByRole('listitem', { name: 'Ahri' });
    expect(within(tarjeta).getByText(es['carga.sinNombre'])).toBeTruthy();
    expect(within(tarjeta).getByText('Sin clasificar')).toBeTruthy();
    expect(within(tarjeta).queryByText(/Maestría/)).toBeNull();
    expect(within(tarjeta).queryByRole('list', { name: es['carga.etiquetas'] })).toBeNull();
  });

  it('el borde de la tarjeta indica el equipo', () => {
    render(<TarjetaJugador jugador={jugador({ equipo: 'enemigo' })} version="" />);
    expect(screen.getByRole('listitem', { name: /Ahri/ }).className).toContain('enemigo');
  });
});

describe('PantallaCarga', () => {
  it('dos filas de 5: enemigos arriba y aliados abajo, como en el juego', () => {
    const { container } = render(<PantallaCarga estado={estado()} />);
    const filas = screen.getAllByRole('list', { name: /equipo/i });
    expect(filas.map((f) => f.getAttribute('aria-label'))).toEqual([es['carga.enemigos'], es['carga.aliados']]);
    expect(within(filas[0]!).getAllByRole('listitem', { name: /Enemigo/ })).toHaveLength(5);
    expect(within(filas[1]!).getAllByRole('listitem', { name: /Aliado/ })).toHaveLength(5);
    // La fila de enemigos va antes en el DOM (arriba).
    const orden = [...container.querySelectorAll('.cg-fila')].map((f) => f.className);
    expect(orden[0]).toContain('enemigo');
    expect(orden[1]).toContain('aliado');
  });

  it('sin estado no pinta nada', () => {
    const { container } = render(<PantallaCarga estado={null} />);
    expect(container.textContent).toBe('');
  });

  it('políticas de Riot: no hay textos de vergüenza ni MMR en la interfaz', () => {
    const { container } = render(<PantallaCarga estado={estado()} />);
    const texto = container.textContent!.toLowerCase();
    for (const p of ['malo', 'troll', 'inting', 'noob', 'manco', 'feeder', 'peor', 'mmr', 'elo ']) expect(texto).not.toContain(p);
    const claves = Object.entries(es).filter(([k]) => k.startsWith('carga.'));
    expect(claves.length).toBeGreaterThan(0);
    for (const [, v] of claves) {
      const palabras = v.toLowerCase().split(/[^a-záéíóúüñ]+/);
      for (const p of ['malo', 'troll', 'inting', 'noob', 'manco', 'feeder', 'peor', 'mmr', 'elo']) expect(palabras).not.toContain(p);
    }
  });
});

describe('ModoCarga', () => {
  it('se muestra solo en modo carga y con los datos de overlay:carga', () => {
    let alModo!: (m: 'carga' | 'partida' | 'oculto') => void;
    let alCarga!: (e: EstadoCarga) => void;
    render(<ModoCarga alModo={(cb) => (alModo = cb)} alCarga={(cb) => (alCarga = cb)} />);
    expect(screen.queryByRole('region')).toBeNull();
    act(() => alCarga(estado()));
    expect(screen.queryByRole('region')).toBeNull();
    act(() => alModo('carga'));
    expect(screen.getByRole('region', { name: es['carga.titulo'] })).toBeTruthy();
    act(() => alModo('partida'));
    expect(screen.queryByRole('region')).toBeNull();
  });
});
