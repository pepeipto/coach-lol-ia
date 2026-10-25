// @vitest-environment jsdom
import { mkdtemp, rm, utimes, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { urlNotasParche, type NotasParche as Notas } from '@coach/shared';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import {
  crearClienteNotasParche,
  esUrlNotasParche,
  notasParcheVista,
  registrarIpcNotasParche,
  VIGENCIA_NOTAS_PARCHE_MS,
  type ResultadoNotasParche,
} from '../src/main/notasParche';
import { BarraLateral } from '../src/renderer/principal/BarraLateral';
import { NotasParche, VistaNotasParche } from '../src/renderer/principal/vistas/VistaNotasParche';
import { establecerIdioma, IDIOMAS, t } from '../src/shared/i18n';
import es from '../src/shared/i18n/es.json';
import type { NotasParcheVista } from '../src/shared/tiposApp';

const NOTAS: Notas = {
  parche: '16.21',
  parcheJuego: '26.21',
  idioma: 'es',
  url: urlNotasParche('26.21', 'es'),
  general: 'Ajustes a varios campeones de línea y a dos objetos.',
  campeones: [
    { campeon: 'Azir', tipo: 'mejora', resumen: 'Más maná por nivel.' },
    { campeon: 'LeeSin', tipo: 'empeora', resumen: 'Su escudo tarda más en volver.' },
    { campeon: 'MonkeyKing', tipo: 'ajuste', resumen: 'Corrección de un error.' },
    { campeon: 'Ahri', tipo: 'mejora', resumen: 'Algo más de daño.' },
    { campeon: 'Inventado', tipo: 'mejora', resumen: 'Data Dragon no lo conoce.' },
  ],
  objetos: [
    { objeto: 'Dawncore', id: 6621, tipo: 'mejora', resumen: 'Más poder de habilidad.' },
    { objeto: 'Mystery Item', tipo: 'empeora', resumen: 'Cuesta más.' },
  ],
  generadoEn: '2026-10-25T00:00:00.000Z',
};

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

describe('cliente de las novedades del parche (caché en disco)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'coach-parche-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('pide el último parche en el idioma, lo guarda y lo reutiliza mientras es reciente', async () => {
    const f = vi.fn(async (_url: string | URL | Request) => json(NOTAS));
    const c = crearClienteNotasParche({ urlServidor: 'http://srv/', dirCache: dir, fetch: f as unknown as typeof fetch });
    expect(await c.obtener('es')).toEqual({ estado: 'ok', notas: NOTAS });
    expect(String(f.mock.calls[0]![0])).toBe('http://srv/parche/actual?idioma=es');
    expect(await c.obtener('es')).toEqual({ estado: 'ok', notas: NOTAS });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('con la caché vieja vuelve a preguntar y, sin servidor, la usa como «sin conexión»', async () => {
    await mkdir(join(dir, 'parche'), { recursive: true });
    const archivo = join(dir, 'parche', 'actual-es.json');
    await writeFile(archivo, JSON.stringify(NOTAS));
    const viejo = (Date.now() - VIGENCIA_NOTAS_PARCHE_MS - 60_000) / 1000;
    await utimes(archivo, viejo, viejo);
    const caido = vi.fn(async () => {
      throw new Error('sin red');
    });
    const c = crearClienteNotasParche({ urlServidor: 'http://srv', dirCache: dir, fetch: caido as unknown as typeof fetch });
    expect(await c.obtener('es')).toEqual({ estado: 'sin_conexion', notas: NOTAS });
    expect(caido).toHaveBeenCalledTimes(1);
  });

  it('sin caché, un 404 sin_notas, un 503 o un idioma que no cuadra: no disponible', async () => {
    for (const r of [json({ error: 'sin_notas' }, 404), json({ error: 'ia_no_configurada' }, 503), json({ ...NOTAS, idioma: 'de' })]) {
      const c = crearClienteNotasParche({ urlServidor: 'http://srv', dirCache: dir, fetch: (async () => r) as unknown as typeof fetch });
      expect(await c.obtener('es')).toEqual({ estado: 'no_disponible' });
    }
  });
});

const DATOS = {
  version: '16.21.1',
  parche: '16.21',
  campeones: new Map([
    [103, { id: 'Ahri', nombre: 'Ahri' }],
    [268, { id: 'Azir', nombre: 'Azir' }],
    [64, { id: 'LeeSin', nombre: 'Lee Sin' }],
    [62, { id: 'MonkeyKing', nombre: 'Wukong' }],
  ]),
  objetos: { 6621: { name: 'Núcleo del alba' } },
} as unknown as DatosEstaticos;

describe('«Tus campeones» primero', () => {
  it('pone primero los que más juegas (en orden de partidas) y el resto por nombre', () => {
    const v = notasParcheVista(NOTAS, DATOS, [
      { campeonId: 64, partidas: 3 },
      { campeonId: 999, partidas: 50 },
      { campeonId: 103, partidas: 12 },
    ], false);
    expect(v.tuyos.map((c) => [c.campeon.id, c.partidas])).toEqual([
      ['Ahri', 12],
      ['LeeSin', 3],
    ]);
    expect(v.resto.map((c) => c.campeon.nombre)).toEqual(['Azir', 'Wukong']);
    // El objeto conocido, con su nombre en el idioma de la app; el otro, con el de las notas y sin icono.
    expect(v.objetos).toEqual([
      { id: 6621, nombre: 'Núcleo del alba', tipo: 'mejora', resumen: 'Más poder de habilidad.' },
      { nombre: 'Mystery Item', tipo: 'empeora', resumen: 'Cuesta más.' },
    ]);
    expect(v).toMatchObject({ parcheJuego: '26.21', url: NOTAS.url, general: NOTAS.general, hayPerfil: true, sinConexion: false });
  });

  it('sin perfil, todo va al resto', () => {
    const v = notasParcheVista(NOTAS, DATOS, [], true);
    expect(v.tuyos).toEqual([]);
    expect(v.resto).toHaveLength(4);
    expect(v.hayPerfil).toBe(false);
    expect(v.sinConexion).toBe(true);
  });

  it('solo abre las notas de leagueoflegends.com', () => {
    expect(esUrlNotasParche(NOTAS.url)).toBe(true);
    expect(esUrlNotasParche(urlNotasParche('26.9', 'pt-BR'))).toBe(true);
    expect(esUrlNotasParche('https://www.leagueoflegends.com.example.com/es-es/news/game-updates/league-of-legends-patch-26-21-notes/')).toBe(false);
    expect(esUrlNotasParche('https://evil.example/')).toBe(false);
    expect(esUrlNotasParche(42)).toBe(false);
  });
});

describe("IPC 'coach:notas-parche'", () => {
  function montar(resultado: ResultadoNotasParche, tusCampeones = async () => [{ campeonId: 62, partidas: 7 }]) {
    const manejadores = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
    const obtener = vi.fn(async () => resultado);
    const abrir = vi.fn(async () => {});
    const principal = {};
    registrarIpcNotasParche(
      { handle: (c, h) => void manejadores.set(c, h) },
      { esPrincipal: (s) => s === principal, cargarDatos: async () => DATOS, cliente: () => ({ obtener }), tusCampeones, abrir },
    );
    const invocar = (canal: string, sender: unknown, ...a: unknown[]) => Promise.resolve().then(() => manejadores.get(canal)!({ sender }, ...a));
    return { invocar, principal, obtener, abrir };
  }

  it('pide las notas en el idioma de la app y las cruza con el perfil', async () => {
    establecerIdioma('de');
    const { invocar, principal, obtener } = montar({ estado: 'ok', notas: NOTAS });
    const r = (await invocar('coach:notas-parche', principal)) as { ok: true; version: string; notas: NotasParcheVista };
    establecerIdioma('es');
    expect(obtener).toHaveBeenCalledWith('de');
    expect(r.ok).toBe(true);
    expect(r.version).toBe('16.21.1');
    expect(r.notas.tuyos.map((c) => c.campeon.id)).toEqual(['MonkeyKing']);
  });

  it('solo para la ventana principal; sin notas, ok: false; un perfil que falla no rompe nada', async () => {
    const { invocar, principal } = montar({ estado: 'no_disponible' });
    await expect(invocar('coach:notas-parche', {})).rejects.toThrow();
    expect(await invocar('coach:notas-parche', principal)).toEqual({ ok: false });
    const roto = montar({ estado: 'ok', notas: NOTAS }, async () => {
      throw new Error('sin perfil');
    });
    const r = (await roto.invocar('coach:notas-parche', roto.principal)) as { ok: true; notas: NotasParcheVista };
    expect(r.notas.tuyos).toEqual([]);
  });

  it('abre solo la URL de las notas oficiales', async () => {
    const { invocar, principal, abrir } = montar({ estado: 'no_disponible' });
    await invocar('coach:abrir-notas-parche', principal, NOTAS.url);
    expect(abrir).toHaveBeenCalledWith(NOTAS.url);
    await expect(invocar('coach:abrir-notas-parche', principal, 'https://evil.example/')).rejects.toThrow();
    await expect(invocar('coach:abrir-notas-parche', {}, NOTAS.url)).rejects.toThrow();
    expect(abrir).toHaveBeenCalledTimes(1);
  });
});

describe('vista «Novedades del parche»', () => {
  afterEach(() => {
    cleanup();
    delete (window as unknown as { coach?: unknown }).coach;
  });

  const VISTA = notasParcheVista(NOTAS, DATOS, [{ campeonId: 64, partidas: 3 }], false);

  it('pinta tus campeones con su flecha, el resto filtrable, los objetos y el enlace a Riot', async () => {
    const abrirNotasParche = vi.fn(async () => {});
    (window as unknown as { coach: unknown }).coach = { abrirNotasParche };
    render(<NotasParche notas={VISTA} version="16.21.1" />);
    expect(screen.getByText(t('notasParche.parche', { parche: '26.21' }))).toBeTruthy();
    expect(screen.getByText(NOTAS.general!)).toBeTruthy();

    const tuyos = screen.getByText(t('notasParche.tuyos')).closest('section, div.tarjeta, .parche-tuyos') as HTMLElement;
    expect(within(tuyos).getByText('Lee Sin')).toBeTruthy();
    expect(within(tuyos).getByRole('img', { name: t('notasParche.tipo.empeora') })).toBeTruthy();
    expect(within(tuyos).queryByText('Azir')).toBeNull();

    // Filtro por tipo y por nombre en el resto.
    expect(screen.getByText('Azir')).toBeTruthy();
    expect(screen.getByText('Wukong')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: t('notasParche.tipo.mejora') }));
    expect(screen.queryByText('Wukong')).toBeNull();
    expect(screen.getByText('Azir')).toBeTruthy();
    await userEvent.type(screen.getByRole('searchbox', { name: t('notasParche.buscar') }), 'zzz');
    expect(screen.getByText(t('notasParche.ninguno'))).toBeTruthy();

    expect(screen.getByText('Núcleo del alba')).toBeTruthy();
    expect(screen.getByText('Mystery Item')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: t('notasParche.verNotas') }));
    expect(abrirNotasParche).toHaveBeenCalledWith(NOTAS.url);
    expect(screen.getByText(t('notasParche.pie'))).toBeTruthy();
  });

  it('sin perfil o sin cambios en tus campeones, lo explica', () => {
    render(<NotasParche notas={{ ...VISTA, tuyos: [], hayPerfil: false }} version="16.21.1" />);
    expect(screen.getByText(t('notasParche.sinPerfil'))).toBeTruthy();
    cleanup();
    render(<NotasParche notas={{ ...VISTA, tuyos: [], hayPerfil: true }} version="16.21.1" />);
    expect(screen.getByText(t('notasParche.tuyosVacio'))).toBeTruthy();
  });

  it('pide las notas por IPC; sin notas, un estado vacío con reintento', async () => {
    const notasParche = vi.fn(async () => ({ ok: true as const, version: '16.21.1', notas: VISTA }));
    (window as unknown as { coach: unknown }).coach = { notasParche };
    render(<VistaNotasParche />);
    expect(screen.getByText(t('notasParche.cargando'))).toBeTruthy();
    expect(await screen.findByText('Lee Sin')).toBeTruthy();
    cleanup();

    const sinNotas = vi.fn(async () => ({ ok: false as const }));
    (window as unknown as { coach: unknown }).coach = { notasParche: sinNotas };
    render(<VistaNotasParche />);
    expect(await screen.findByText(t('notasParche.sinNotas'))).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: t('notasParche.reintentar') }));
    await vi.waitFor(() => expect(sinNotas).toHaveBeenCalledTimes(2));
  });

  it('la barra lateral tiene la entrada «Parche» junto a las novedades', async () => {
    const alCambiar = vi.fn();
    render(<BarraLateral vista="campeon" alCambiar={alCambiar} cliente="esperando" plan={null} premiumHabilitado={false} />);
    await userEvent.click(screen.getByRole('button', { name: t('nav.parche') }));
    expect(alCambiar).toHaveBeenCalledWith('parche');
  });

  it('los textos están en los 5 idiomas', async () => {
    const claves = Object.keys(es).filter((k) => k.startsWith('notasParche.') || k === 'nav.parche');
    expect(claves.length).toBeGreaterThanOrEqual(24);
    for (const idioma of IDIOMAS) {
      const textos = (await import(`../src/shared/i18n/${idioma}.json`)).default as Record<string, string>;
      for (const k of claves) expect(textos[k], `${idioma}: ${k}`).toBeTruthy();
    }
  });
});
