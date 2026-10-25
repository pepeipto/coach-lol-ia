// @vitest-environment jsdom
import { mkdtemp, rm, utimes, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FichaCampeon } from '@coach/shared';
import { crearClienteBuilds, VIGENCIA_FICHA_MS, type ResultadoFicha } from '../src/main/builds/clienteBuilds';
import { registrarIpcCampeones } from '../src/main/campeones';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import { TarjetaFichaCampeon, TarjetaFichaCampeonDe } from '../src/renderer/principal/vistas/TarjetaFichaCampeon';
import { establecerIdioma, IDIOMAS, t } from '../src/shared/i18n';
import es from '../src/shared/i18n/es.json';
import type { FichaVista } from '../src/shared/tiposApp';

const FICHA: FichaCampeon = {
  campeon: 'Ahri',
  idioma: 'es',
  claves: ['Maga de ráfaga con mucha movilidad.', 'Su definitiva le da tres desplazamientos.', 'El encanto define sus combos.'],
  fortalezas: ['Mucha movilidad', 'Daño de ráfaga', 'Buena para rematar'],
  debilidades: ['Frágil', 'Depende del encanto', 'Sufre contra mucho alcance'],
  parecidos: ['Lux', 'MonkeyKing', 'Desconocido', 'Syndra'],
  danio: { fisico: 0.05, magico: 0.9, verdadero: 0.05 },
  generadoEn: '2026-10-25T00:00:00.000Z',
};

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

describe('cliente de la ficha (caché en disco)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'coach-ficha-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('pide la ficha en el idioma, la guarda y la reutiliza sin preguntar mientras es reciente', async () => {
    const f = vi.fn(async (_url: string | URL | Request) => json(FICHA));
    const c = crearClienteBuilds({ urlServidor: 'http://srv/', dirCache: dir, fetch: f as unknown as typeof fetch });
    expect(await c.obtenerFicha('Ahri', 'es')).toEqual({ estado: 'ok', ficha: FICHA });
    expect(String(f.mock.calls[0]![0])).toBe('http://srv/ficha/Ahri?idioma=es');
    expect(await c.obtenerFicha('Ahri', 'es')).toEqual({ estado: 'ok', ficha: FICHA });
    expect(f).toHaveBeenCalledTimes(1);
    // Otro idioma: otra petición.
    await c.obtenerFicha('Ahri', 'de');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('con la caché vieja vuelve a preguntar y, sin servidor, la usa como «sin conexión»', async () => {
    await mkdir(join(dir, 'fichas'), { recursive: true });
    const archivo = join(dir, 'fichas', 'Ahri-es.json');
    await writeFile(archivo, JSON.stringify(FICHA));
    const viejo = (Date.now() - VIGENCIA_FICHA_MS - 60_000) / 1000;
    await utimes(archivo, viejo, viejo);
    const caido = vi.fn(async () => {
      throw new Error('sin red');
    });
    const c = crearClienteBuilds({ urlServidor: 'http://srv', dirCache: dir, fetch: caido as unknown as typeof fetch });
    expect(await c.obtenerFicha('Ahri', 'es')).toEqual({ estado: 'sin_conexion', ficha: FICHA });
    expect(caido).toHaveBeenCalledTimes(1);
  });

  it('sin caché y con un 503 o una respuesta rara, no disponible; un id raro no llega al servidor', async () => {
    const f = vi.fn(async () => json({ error: 'ia_no_configurada' }, 503));
    const c = crearClienteBuilds({ urlServidor: 'http://srv', dirCache: dir, fetch: f as unknown as typeof fetch });
    expect(await c.obtenerFicha('Ahri', 'es')).toEqual({ estado: 'no_disponible' });
    expect(await c.obtenerFicha('../x', 'es')).toEqual({ estado: 'no_disponible' });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

const DATOS = {
  version: '15.21.1',
  parche: '15.21',
  campeones: new Map([
    [103, { id: 'Ahri', nombre: 'Ahri' }],
    [99, { id: 'Lux', nombre: 'Lux' }],
    [62, { id: 'MonkeyKing', nombre: 'Wukong' }],
    [134, { id: 'Syndra', nombre: 'Syndra' }],
  ]),
} as unknown as DatosEstaticos;

describe("IPC 'coach:ficha-campeon'", () => {
  function montar(resultado: ResultadoFicha) {
    const manejadores = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
    const obtenerFicha = vi.fn(async () => resultado);
    const principal = {};
    registrarIpcCampeones(
      { handle: (c, h) => void manejadores.set(c, h) },
      {
        esPrincipal: (s) => s === principal,
        cargarDatos: async () => DATOS,
        builds: () => ({ obtenerCampeones: vi.fn(), obtenerBuild: vi.fn(), obtenerRoles: vi.fn(), obtenerFicha }) as never,
      },
    );
    const invocar = (sender: unknown, ...a: unknown[]) => Promise.resolve().then(() => manejadores.get('coach:ficha-campeon')!({ sender }, ...a));
    return { invocar, principal, obtenerFicha };
  }

  it('resuelve los parecidos con nombre e icono y pide la ficha en el idioma de la app', async () => {
    establecerIdioma('fr');
    const { invocar, principal, obtenerFicha } = montar({ estado: 'sin_conexion', ficha: FICHA });
    const r = await invocar(principal, 'ahri');
    establecerIdioma('es');
    expect(obtenerFicha).toHaveBeenCalledWith('Ahri', 'fr');
    expect(r).toEqual({
      ok: true,
      version: '15.21.1',
      ficha: {
        campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 },
        claves: FICHA.claves,
        fortalezas: FICHA.fortalezas,
        debilidades: FICHA.debilidades,
        parecidos: [
          { id: 'Lux', nombre: 'Lux', key: 99 },
          { id: 'MonkeyKing', nombre: 'Wukong', key: 62 },
          { id: 'Syndra', nombre: 'Syndra', key: 134 },
        ],
        danio: FICHA.danio,
        sinConexion: true,
      },
    });
  });

  it('solo para la ventana principal y con un id válido; sin ficha, ok: false', async () => {
    const { invocar, principal } = montar({ estado: 'no_disponible' });
    await expect(invocar({}, 'Ahri')).rejects.toThrow();
    await expect(invocar(principal, '../x')).rejects.toThrow();
    expect(await invocar(principal, 'Ahri')).toEqual({ ok: false });
    expect(await invocar(principal, 'Inventado')).toEqual({ ok: false });
  });
});

describe('tarjeta «Ficha del campeón»', () => {
  afterEach(cleanup);

  const VISTA: FichaVista = {
    campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 },
    claves: FICHA.claves,
    fortalezas: FICHA.fortalezas,
    debilidades: FICHA.debilidades,
    parecidos: [
      { id: 'Lux', nombre: 'Lux', key: 99 },
      { id: 'MonkeyKing', nombre: 'Wukong', key: 62 },
    ],
    danio: { fisico: 0.88, magico: 0.09, verdadero: 0.03 },
    sinConexion: false,
  };

  it('pinta los cuatro bloques y la barra de daño; los parecidos abren su vista', async () => {
    const abrir = vi.fn();
    render(<TarjetaFichaCampeon ficha={VISTA} version="15.21.1" alAbrirCampeon={abrir} />);
    for (const clave of ['titulo', 'claves', 'fortalezas', 'debilidades', 'parecidos', 'danio']) {
      expect(screen.getByText(t(`fichaCampeon.${clave}`))).toBeTruthy();
    }
    expect(screen.getByText('Mucha movilidad')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Físico 88\s?%.*Mágico 9\s?%.*Verdadero 3\s?%/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t('fichaCampeon.abrir', { campeon: 'Wukong' }) }));
    expect(abrir).toHaveBeenCalledWith('MonkeyKing');
  });

  it('sin desglose no hay barra; sin callback, los parecidos no son botones', () => {
    render(<TarjetaFichaCampeon ficha={{ ...VISTA, danio: undefined }} version="15.21.1" />);
    expect(screen.queryByText(t('fichaCampeon.danio'))).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Wukong')).toBeTruthy();
  });

  it('pide la ficha por IPC y no pinta nada si no hay', async () => {
    const fichaCampeon = vi.fn(async () => ({ ok: true as const, version: '15.21.1', ficha: VISTA }));
    (window as unknown as { coach: unknown }).coach = { fichaCampeon };
    render(<TarjetaFichaCampeonDe campeon="Ahri" version="15.21.1" />);
    expect(screen.getByText(t('fichaCampeon.cargando'))).toBeTruthy();
    expect(await screen.findByText('Mucha movilidad')).toBeTruthy();
    expect(fichaCampeon).toHaveBeenCalledWith('Ahri');
    cleanup();
    (window as unknown as { coach: unknown }).coach = { fichaCampeon: vi.fn(async () => ({ ok: false })) };
    const { container } = render(<TarjetaFichaCampeonDe campeon="Ahri" version="15.21.1" />);
    await vi.waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('los textos de la tarjeta están en los 5 idiomas', async () => {
    const claves = Object.keys(es).filter((k) => k.startsWith('fichaCampeon.'));
    expect(claves.length).toBeGreaterThanOrEqual(14);
    for (const idioma of IDIOMAS) {
      const textos = (await import(`../src/shared/i18n/${idioma}.json`)).default as Record<string, string>;
      for (const k of claves) expect(textos[k], `${idioma}: ${k}`).toBeTruthy();
    }
  });
});
