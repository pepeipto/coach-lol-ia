// @vitest-environment jsdom
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Build, ConsejosEnfrentamiento, CountersCampeon } from '@coach/shared';
import { crearClienteBuilds, VIGENCIA_FICHA_MS, type ResultadoConsejosEnfrentamiento } from '../src/main/builds/clienteBuilds';
import { registrarIpcCampeones } from '../src/main/campeones';
import { crearOrquestadorSeleccion } from '../src/main/orquestador/seleccion';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import type { ClienteLcu } from '../src/main/lcu/cliente';
import { TarjetaContraRival, TarjetaEnfrentamientos } from '../src/renderer/principal/vistas/TarjetasEnfrentamientos';
import { establecerIdioma } from '../src/shared/i18n';
import type { CrucePersonal } from '../src/shared/personal';
import type { CountersVista, EstadoEnfrentamientos, LineaEnfrentamientoVista } from '../src/shared/tiposApp';

const CONSEJOS: ConsejosEnfrentamiento = {
  campeon: 'Darius',
  rival: 'Garen',
  idioma: 'es',
  rol: 'TOP',
  consejos: ['Cuidado con su silencio de la Q.', 'Su ventana de poder llega a nivel 6.', 'Intercambia cuando su E termine.'],
  combos: ['E → AA → W → Q'],
  generadoEn: '2026-10-25T00:00:00.000Z',
};

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

describe('cliente de los consejos del cruce (caché en disco)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'coach-cruce-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('pide los consejos en el idioma, los guarda y los reutiliza mientras son recientes', async () => {
    const f = vi.fn(async (_url: string | URL | Request) => json(CONSEJOS));
    const c = crearClienteBuilds({ urlServidor: 'http://srv/', dirCache: dir, fetch: f as unknown as typeof fetch });
    expect(await c.obtenerConsejosEnfrentamiento('Darius', 'Garen', 'TOP', 'es')).toEqual({ estado: 'ok', consejos: CONSEJOS });
    expect(String(f.mock.calls[0]![0])).toBe('http://srv/enfrentamiento-consejos/Darius/Garen/TOP?idioma=es');
    expect(await c.obtenerConsejosEnfrentamiento('Darius', 'Garen', 'TOP', 'es')).toEqual({ estado: 'ok', consejos: CONSEJOS });
    expect(f).toHaveBeenCalledTimes(1);
    // Una respuesta de otro cruce (o de otro idioma) no vale.
    expect(await c.obtenerConsejosEnfrentamiento('Darius', 'Garen', 'MIDDLE', 'es')).toEqual({ estado: 'no_disponible' });
  });

  it('con la caché vieja vuelve a preguntar y, sin servidor, la usa como «sin conexión»', async () => {
    await mkdir(join(dir, 'cruces'), { recursive: true });
    const archivo = join(dir, 'cruces', 'Darius-vs-Garen-TOP-es.json');
    await writeFile(archivo, JSON.stringify(CONSEJOS));
    const viejo = (Date.now() - VIGENCIA_FICHA_MS - 60_000) / 1000;
    await utimes(archivo, viejo, viejo);
    const caido = vi.fn(async () => {
      throw new Error('sin red');
    });
    const c = crearClienteBuilds({ urlServidor: 'http://srv', dirCache: dir, fetch: caido as unknown as typeof fetch });
    expect(await c.obtenerConsejosEnfrentamiento('Darius', 'Garen', 'TOP', 'es')).toEqual({ estado: 'sin_conexion', consejos: CONSEJOS });
    expect(caido).toHaveBeenCalledTimes(1);
  });

  it('sin caché y con un 503, no disponible; ids raros o el mismo campeón no llegan al servidor', async () => {
    const f = vi.fn(async () => json({ error: 'ia_no_configurada' }, 503));
    const c = crearClienteBuilds({ urlServidor: 'http://srv', dirCache: dir, fetch: f as unknown as typeof fetch });
    expect(await c.obtenerConsejosEnfrentamiento('Darius', 'Garen', 'TOP', 'es')).toEqual({ estado: 'no_disponible' });
    expect(await c.obtenerConsejosEnfrentamiento('../x', 'Garen', 'TOP', 'es')).toEqual({ estado: 'no_disponible' });
    expect(await c.obtenerConsejosEnfrentamiento('Darius', 'darius', 'TOP', 'es')).toEqual({ estado: 'no_disponible' });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

const DATOS = {
  version: '15.20.1',
  parche: '15.20',
  campeones: new Map([
    [122, { id: 'Darius', nombre: 'Darius' }],
    [86, { id: 'Garen', nombre: 'Garen' }],
    [17, { id: 'Teemo', nombre: 'Teemo' }],
  ]),
  objetos: {},
  runas: new Map(),
  hechizos: new Map(),
} as unknown as DatosEstaticos;

describe("IPC 'coach:consejos-enfrentamiento'", () => {
  function montar(resultado: ResultadoConsejosEnfrentamiento) {
    const manejadores = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
    const obtenerConsejosEnfrentamiento = vi.fn(async () => resultado);
    const principal = {};
    registrarIpcCampeones(
      { handle: (c, h) => void manejadores.set(c, h) },
      {
        esPrincipal: (s) => s === principal,
        cargarDatos: async () => DATOS,
        builds: () => ({ obtenerCampeones: vi.fn(), obtenerBuild: vi.fn(), obtenerRoles: vi.fn(), obtenerConsejosEnfrentamiento }) as never,
      },
    );
    const invocar = (sender: unknown, ...a: unknown[]) => Promise.resolve().then(() => manejadores.get('coach:consejos-enfrentamiento')!({ sender }, ...a));
    return { invocar, principal, obtenerConsejosEnfrentamiento };
  }

  it('pide los consejos con los ids de Data Dragon en el idioma de la app', async () => {
    establecerIdioma('de');
    const { invocar, principal, obtenerConsejosEnfrentamiento } = montar({ estado: 'sin_conexion', consejos: CONSEJOS });
    const r = await invocar(principal, 'darius', 'GAREN', 'TOP');
    establecerIdioma('es');
    expect(obtenerConsejosEnfrentamiento).toHaveBeenCalledWith('Darius', 'Garen', 'TOP', 'de');
    expect(r).toEqual({ ok: true, consejos: { consejos: CONSEJOS.consejos, combos: CONSEJOS.combos, sinConexion: true } });
  });

  it('solo para la ventana principal y con argumentos válidos; sin consejos, ok: false', async () => {
    const { invocar, principal } = montar({ estado: 'no_disponible' });
    await expect(invocar({}, 'Darius', 'Garen', 'TOP')).rejects.toThrow();
    await expect(invocar(principal, '../x', 'Garen', 'TOP')).rejects.toThrow();
    await expect(invocar(principal, 'Darius', 'Garen', 'MID')).rejects.toThrow();
    expect(await invocar(principal, 'Darius', 'Garen', 'TOP')).toEqual({ ok: false });
    expect(await invocar(principal, 'Darius', 'Inventado', 'TOP')).toEqual({ ok: false });
    expect(await invocar(principal, 'Darius', 'Darius', 'TOP')).toEqual({ ok: false });
  });
});

const BUILD: Build = {
  campeon: 'Darius', rol: 'TOP', parche: '15.20', partidas: 60, tasaVictoria: 0.6, mezclaParches: false,
  runas: { estiloPrincipal: 8000, estiloSecundario: 8400, runas: [8010, 9111, 9104, 8299, 8444, 8242, 5005, 5008, 5001] },
  hechizos: [4, 12], objetosIniciales: [1054], nucleo: [6631, 3071, 3053], botas: 3047, situacionales: [],
  ordenHabilidades: [], calculadoEn: '2026-10-18T00:00:00Z',
};
const COUNTERS: CountersCampeon = {
  campeon: 'Darius', rol: 'TOP', parche: '15.20', partidas: 300,
  enfrentamientos: [
    { rival: 'Garen', partidas: 120, tasaVictoria: 0.58, datosLimitados: false },
    { rival: 'Teemo', partidas: 170, tasaVictoria: 0.44, datosLimitados: false },
  ],
  faciles: [{ rival: 'Garen', partidas: 120, tasaVictoria: 0.58, datosLimitados: false }],
  dificiles: [{ rival: 'Teemo', partidas: 170, tasaVictoria: 0.44, datosLimitados: false }],
};

const cruce = (rivalId: number, victorias: number, partidas: number, nota: number): CrucePersonal => ({
  campeonId: 122, rivalId, rol: 'TOP', partidas, victorias, winrate: victorias / partidas, nota, kda: 2, pocas: true,
});

describe('orquestador: tu historial en el cruce (solo local)', () => {
  function montar(personal: unknown) {
    const o = crearOrquestadorSeleccion({
      dirCache: 'x',
      cargarDatos: async () => DATOS,
      obtenerAjustes: () => ({ ...AJUSTES_POR_DEFECTO, importacionAutomatica: false }),
      enviar: () => undefined,
      crearBuilds: (() => ({
        obtenerRoles: async () => ['TOP'],
        obtenerBuild: async () => ({ estado: 'ok', build: BUILD }),
        obtenerCampeones: async () => ({ estado: 'no_disponible' }),
        obtenerCounters: async () => ({ estado: 'ok', counters: COUNTERS }),
        obtenerEnfrentamiento: async () => ({ estado: 'no_disponible' }),
      })) as never,
      historialPersonal: personal as never,
    });
    o.conectado({} as ClienteLcu);
    return o;
  }

  it('con 3 partidas o más: «Tú» contra el rival y la marca de los rivales con historial malo', async () => {
    const countersPersonales = vi.fn(() => ({
      campeonId: 122,
      rol: 'TOP',
      partidas: 9,
      peores: [cruce(17, 1, 4, 41), cruce(999, 0, 3, 30)],
      mejores: [cruce(86, 2, 3, 58)],
    }));
    const enfrentamientoPersonal = vi.fn(() => cruce(86, 2, 5, 58));
    const o = montar(() => ({ countersPersonales, enfrentamientoPersonal }));
    await o.alRivales({ rol: 'TOP', rivales: [{ campeonId: 86, rol: 'TOP' }] });
    await o.alSeleccionar({ campeonId: 122, rol: 'TOP' });
    const e = o.estado().enfrentamientos!;
    expect(countersPersonales).toHaveBeenCalledWith(122, 'TOP');
    expect(enfrentamientoPersonal).toHaveBeenCalledWith(122, 86, 'TOP');
    expect(e.historial).toEqual({ partidas: 5, victorias: 2, derrotas: 3, nota: 58 });
    // El rival que Data Dragon no conoce (999) se descarta.
    expect(e.historialMalo).toEqual([{ rival: 'Teemo', victorias: 1, derrotas: 3 }]);
  });

  it('sin historial suficiente, sin servicio o si falla, no se enseña nada (y lo demás sigue)', async () => {
    const vacio = montar(() => ({
      countersPersonales: () => ({ campeonId: 122, rol: 'TOP', partidas: 1, peores: [], mejores: [] }),
      enfrentamientoPersonal: () => null,
    }));
    await vacio.alRivales({ rol: 'TOP', rivales: [{ campeonId: 86, rol: 'TOP' }] });
    await vacio.alSeleccionar({ campeonId: 122, rol: 'TOP' });
    expect(vacio.estado().enfrentamientos?.historial).toBeUndefined();
    expect(vacio.estado().enfrentamientos?.historialMalo).toBeUndefined();

    const roto = montar(() => {
      throw new Error('aún no existe');
    });
    await roto.alSeleccionar({ campeonId: 122, rol: 'TOP' });
    expect(roto.estado().enfrentamientos?.counters).not.toBeNull();
    expect(roto.estado().enfrentamientos?.historial).toBeUndefined();
  });
});

describe('tarjetas del cruce', () => {
  afterEach(() => {
    cleanup();
    delete (window as { coach?: unknown }).coach;
  });

  const enf = (over: Partial<EstadoEnfrentamientos> = {}): EstadoEnfrentamientos => ({
    rol: 'TOP',
    rival: { id: 'Garen', nombre: 'Garen', key: 86, inferido: false },
    counters: null,
    contra: { partidas: 120, tasaVictoria: 0.58, datosLimitados: false },
    buenasElecciones: [],
    ...over,
  });

  it('«Contra {rival}» enseña tu historial y las claves del cruce con sus combos', async () => {
    const consejosEnfrentamiento = vi.fn(async () => ({ ok: true, consejos: { consejos: CONSEJOS.consejos, combos: CONSEJOS.combos!, sinConexion: false } }));
    (window as { coach?: unknown }).coach = { consejosEnfrentamiento };
    render(
      <TarjetaContraRival enfrentamientos={enf({ historial: { partidas: 5, victorias: 2, derrotas: 3, nota: 58 } })} version="15.20.1" campeon="Darius" />,
    );
    expect(screen.getByText('Tú: 2-3 contra Garen (nota media 58)')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Preparando las claves del cruce');
    const lista = await screen.findByRole('list', { name: 'Claves del cruce' });
    expect(within(lista).getAllByRole('listitem').map((li) => li.textContent)).toEqual(CONSEJOS.consejos);
    expect(screen.getByText('E → AA → W → Q')).toBeTruthy();
    expect(consejosEnfrentamiento).toHaveBeenCalledWith('Darius', 'Garen', 'TOP');
  });

  it('sin historial ni consejos, la tarjeta queda como antes', async () => {
    const consejosEnfrentamiento = vi.fn(async () => ({ ok: false }));
    (window as { coach?: unknown }).coach = { consejosEnfrentamiento };
    render(<TarjetaContraRival enfrentamientos={enf()} version="15.20.1" campeon="Darius" />);
    await vi.waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.queryByText(/^Tú:/)).toBeNull();
    expect(screen.queryByRole('list', { name: 'Claves del cruce' })).toBeNull();
  });

  it('«Enfrentamientos» marca los rivales contra los que tu historial es malo', () => {
    let key = 1;
    const linea = (id: string, tasaVictoria: number): LineaEnfrentamientoVista => ({ campeon: { id, nombre: id, key: key++ }, tasaVictoria, partidas: 100, datosLimitados: false });
    const counters: CountersVista = {
      parche: '15.20',
      partidas: 200,
      faciles: [linea('Garen', 0.58)],
      dificiles: [linea('Teemo', 0.44)],
      todos: [linea('Garen', 0.58), linea('Teemo', 0.44)],
      sinConexion: false,
    };
    render(<TarjetaEnfrentamientos counters={counters} version="15.20.1" historialMalo={[{ rival: 'teemo', victorias: 1, derrotas: 3 }]} />);
    const teemo = screen.getByText('Teemo').closest('li')!;
    expect(within(teemo).getByText('Tú 1-3')).toBeTruthy();
    expect(teemo.className).toContain('con-historial-malo');
    const garen = screen.getByText('Garen').closest('li')!;
    expect(within(garen).queryByText(/^Tú/)).toBeNull();
  });
});
