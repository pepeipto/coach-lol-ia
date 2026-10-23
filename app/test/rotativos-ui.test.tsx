// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Build } from '@coach/shared';
import { VistaCampeon } from '../src/renderer/principal/vistas/VistaCampeon';
import { VistaPerfil } from '../src/renderer/principal/vistas/VistaPerfil';
import { etiquetaModo } from '../src/renderer/principal/vistas/CabeceraCampeon';
import { interpretarPartida } from '../src/main/perfil/lcuPerfil';
import { tendencias } from '../src/main/perfil/puntuaciones';
import { tendenciasPorCola } from '../src/main/perfil/servicio';
import type { Perfil } from '../src/shared/perfil';
import type { EstadoPrincipal } from '../src/shared/tiposApp';
import { partidaLcu } from './partidaLcu';

afterEach(() => {
  cleanup();
  delete (window as { coach?: unknown }).coach;
});

const build: Build = {
  campeon: 'Ahri',
  rol: null,
  parche: '15.20',
  partidas: 90,
  tasaVictoria: 0.55,
  mezclaParches: false,
  runas: { estiloPrincipal: 8100, estiloSecundario: 8300, runas: [8112, 8126, 8138, 8135, 8304, 8313, 5008, 5008, 5001] },
  hechizos: [4, 14],
  objetosIniciales: [1056],
  nucleo: [6655],
  botas: 3020,
  situacionales: [],
  ordenHabilidades: [],
  calculadoEn: '2026-10-18T00:00:00Z',
};

type Sel = NonNullable<EstadoPrincipal['seleccion']>;
const estado = (sel: Partial<Sel>): EstadoPrincipal => ({
  cliente: 'conectado',
  version: '15.20.1',
  error: null,
  importacion: null,
  aviso: null,
  recursos: { objetos: {}, runas: {}, hechizos: {} },
  seleccion: {
    campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 },
    rol: null,
    rolesDisponibles: [],
    resultado: { estado: 'ok', build },
    opcion: 0,
    ...sel,
  },
});

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

describe('vista Campeón: normales y modos rotativos (3.8)', () => {
  it('etiqueta de la cabecera: «Normal», «Partida rápida», «Flex» en vez de clasificatoria', () => {
    expect(etiquetaModo({ rol: 'MIDDLE', cola: 400 })).toBe('Normal · Rol: Central');
    expect(etiquetaModo({ rol: 'TOP', cola: 490 })).toBe('Partida rápida · Rol: Superior');
    expect(etiquetaModo({ rol: 'TOP', cola: 440 })).toBe('Clasificatoria Flex · Rol: Superior');
    expect(etiquetaModo({ rol: 'TOP' })).toBe('Rol: Superior');
    expect(etiquetaModo({ rol: null, modo: 'aram' })).toBe('Modo: ARAM');
  });

  it('normal de la Grieta: la cabecera dice «Normal»', () => {
    render(<VistaCampeon {...props} estado={estado({ rol: 'MIDDLE', rolesDisponibles: ['MIDDLE'], cola: 400 })} />);
    expect(screen.getByText('Normal · Rol: Central')).toBeTruthy();
    expect(screen.queryByText(/Clasificatoria/)).toBeNull();
  });

  it('rotativo con datos: el nombre del modo, la build y el botón de importar, sin aviso de respaldo', () => {
    render(
      <VistaCampeon
        {...props}
        estado={estado({ rotativo: { cola: 900, nombre: 'ARURF', gameMode: 'URF', base: 'clasificatoria', estado: 'datos' } })}
      />,
    );
    expect(screen.getByText('Modo: URF')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Importar/ })).toBeTruthy();
    expect(screen.queryByText(/Aún no hay datos de/)).toBeNull();
  });

  it('rotativo sin datos: aviso genérico con el modo y la build base', () => {
    render(
      <VistaCampeon
        {...props}
        estado={estado({
          rol: 'MIDDLE',
          rolesDisponibles: ['MIDDLE'],
          rotativo: { cola: 1020, nombre: 'One for All', gameMode: 'ONEFORALL', base: 'clasificatoria', estado: 'respaldo' },
        })}
      />,
    );
    expect(screen.getByText('Modo: Uno para todos · Rol: Central')).toBeTruthy();
    expect(screen.getByText('Aún no hay datos de Uno para todos: se muestra la build de la Grieta del Invocador.')).toBeTruthy();
  });

  it('PvE: no hay build y lo dice', () => {
    render(
      <VistaCampeon
        {...props}
        estado={estado({
          resultado: { estado: 'no_disponible' },
          rotativo: { cola: 1830, nombre: 'Swarm', gameMode: 'STRAWBERRY', base: 'clasificatoria', estado: 'pve' },
        })}
      />,
    );
    expect(screen.getByText('Enjambre no tiene builds')).toBeTruthy();
    expect(screen.queryByText('Build no disponible')).toBeNull();
    expect(screen.queryByRole('button', { name: /Importar/ })).toBeNull();
  });
});

describe('Perfil: filtro por tipo de cola (3.8)', () => {
  const YO = 'puuid-yo';
  const partidas = [
    interpretarPartida(partidaLcu(1, { cola: 420 }), YO)!,
    interpretarPartida(partidaLcu(2, { cola: 450 }), YO)!,
    interpretarPartida(partidaLcu(3, { cola: 480 }), YO)!,
    interpretarPartida(partidaLcu(4, { cola: 900 }), YO)!,
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const perfil: Perfil = {
    invocador: { nombre: 'AKIRA88', tag: 'EUW', nivel: 300, icono: 29 },
    rangos: [],
    pl: [],
    partidas,
    campeones: [],
    tendencias: tendencias(partidas),
    tendenciasPorCola: tendenciasPorCola(partidas),
    reto: null,
    retoSugerido: 'muertes4',
    actualizado: null,
    conectado: true,
    version: '',
    campeonesDD: {},
  };

  it('por defecto enseña todas; cada pestaña filtra el historial y las tendencias', async () => {
    (window as unknown as { coach: unknown }).coach = { perfil: vi.fn(async () => perfil), historialAnalisis: vi.fn(async () => []) };
    render(<VistaPerfil />);
    const pestanas = await screen.findByRole('tablist', { name: 'Filtrar por tipo de cola' });
    const nombres = within(pestanas).getAllByRole('tab').map((b) => b.textContent);
    expect(nombres).toEqual(['Todas', 'Clasificatoria', 'Normales', 'ARAM', 'ARAM: Caos', 'Arena', 'Otros modos']);
    const historial = () => screen.getByText('Historial de partidas').closest('section, .tarjeta, div')!.parentElement!;
    const filas = () => historial().querySelectorAll('.perfil-partida').length;
    expect(filas()).toBe(4);
    // La partida rápida se nombra como tal.
    expect(screen.getByText('Partida rápida')).toBeTruthy();

    await userEvent.click(within(pestanas).getByRole('tab', { name: 'Normales' }));
    expect(filas()).toBe(1);
    expect(screen.getByText('Tendencias')).toBeTruthy();

    await userEvent.click(within(pestanas).getByRole('tab', { name: 'Arena' }));
    expect(filas()).toBe(0);
    expect(screen.getByText('No hay partidas de este tipo de cola en tu historial reciente.')).toBeTruthy();

    await userEvent.click(within(pestanas).getByRole('tab', { name: 'Todas' }));
    expect(filas()).toBe(4);
  });
});
