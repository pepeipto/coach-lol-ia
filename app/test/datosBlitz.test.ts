import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CountersCampeon, SinergiasCampeon } from '@coach/shared';
import { crearClienteBuilds, normalizarCounters, normalizarSinergias } from '../src/main/builds/clienteBuilds';
import { buenasEleccionesContra, countersVista, indiceCampeones, sinergiasVista } from '../src/main/builds/counters';
import { registrarIpcCampeones } from '../src/main/campeones';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import es from '../src/shared/i18n/es.json';
import en from '../src/shared/i18n/en.json';
import ptBR from '../src/shared/i18n/pt-BR.json';
import fr from '../src/shared/i18n/fr.json';
import de from '../src/shared/i18n/de.json';

/*
 * 3.9.1: datos tipo Blitz en la app: fase de líneas y puntuación de los cruces, tasas de bloqueo y de selección en la
 * lista de campeones y sinergias (cliente con caché, vista e IPC).
 */

const COUNTERS: CountersCampeon = {
  campeon: 'Darius', rol: 'TOP', parche: '15.20', partidas: 300,
  enfrentamientos: [
    { rival: 'Garen', partidas: 120, tasaVictoria: 0.58, datosLimitados: false, tasaFaseLineas: 0.62, partidasFaseLineas: 100, puntuacion: 18.4 },
    { rival: 'Teemo', partidas: 170, tasaVictoria: 0.44, datosLimitados: false },
  ],
  faciles: [{ rival: 'Garen', partidas: 120, tasaVictoria: 0.58, datosLimitados: false, tasaFaseLineas: 0.62, partidasFaseLineas: 100, puntuacion: 18.4 }],
  dificiles: [{ rival: 'Teemo', partidas: 170, tasaVictoria: 0.44, datosLimitados: false }],
};

const SINERGIAS: SinergiasCampeon = {
  campeon: 'Jinx', rol: 'BOTTOM', parche: '15.20',
  porRol: [
    { rol: 'JUNGLE', aliados: [{ aliado: 'LeeSin', partidas: 40, tasaVictoria: 0.6, datosLimitados: false }] },
    { rol: 'UTILITY', aliados: [{ aliado: 'Lulu', partidas: 12, tasaVictoria: 0.75, datosLimitados: true }, { aliado: 'Nadie', partidas: 9, tasaVictoria: 0.7, datosLimitados: true }] },
  ],
};

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });
const fetchCaido = (async () => {
  throw new Error('sin red');
}) as typeof fetch;

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'coach-blitz-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
const cliente = (f: typeof fetch) => crearClienteBuilds({ urlServidor: 'http://srv/', dirCache: dir, fetch: f });

describe('fase de líneas en los counters', () => {
  it('conserva la fase y la puntuación válidas y descarta las raras (sin tirar el cruce)', () => {
    const raro = {
      ...COUNTERS,
      enfrentamientos: [
        ...COUNTERS.enfrentamientos,
        { rival: 'Sett', partidas: 20, tasaVictoria: 0.5, datosLimitados: true, tasaFaseLineas: 3, partidasFaseLineas: 10, puntuacion: 5 },
        { rival: 'Quinn', partidas: 20, tasaVictoria: 0.5, datosLimitados: true, tasaFaseLineas: 0.4, partidasFaseLineas: 10, puntuacion: 400, extra: 'x' },
      ],
    };
    const c = normalizarCounters(raro)!;
    expect(c.enfrentamientos[0]).toEqual(COUNTERS.enfrentamientos[0]);
    expect(c.enfrentamientos[1]).toEqual(COUNTERS.enfrentamientos[1]);
    expect(c.enfrentamientos[2]).toEqual({ rival: 'Sett', partidas: 20, tasaVictoria: 0.5, datosLimitados: true });
    expect(c.enfrentamientos[3]).toEqual({ rival: 'Quinn', partidas: 20, tasaVictoria: 0.5, datosLimitados: true, tasaFaseLineas: 0.4, partidasFaseLineas: 10 });
  });

  it('la vista lleva la fase; desde el otro lado (buenas elecciones) se invierte y la puntuación cambia de signo', () => {
    const d = { campeones: new Map([[86, { id: 'Garen', nombre: 'Garen' }], [17, { id: 'Teemo', nombre: 'Teemo' }]]) };
    const v = countersVista(COUNTERS, indiceCampeones(d), false);
    expect(v.faciles[0]).toMatchObject({ tasaFaseLineas: 0.62, partidasFaseLineas: 100, puntuacion: 18.4 });
    expect(v.dificiles[0]).not.toHaveProperty('tasaFaseLineas');
    const delRival: CountersCampeon = { ...COUNTERS, campeon: 'Teemo', dificiles: COUNTERS.faciles };
    const [b] = buenasEleccionesContra(delRival, indiceCampeones(d));
    expect(b!.tasaFaseLineas).toBeCloseTo(0.38);
    expect(b!.puntuacion).toBe(-18.4);
  });
});

describe('tasas de bloqueo y de selección en la lista de campeones', () => {
  const entrada = { campeon: 'Ahri', rol: 'MIDDLE', partidas: 100, tasaVictoria: 0.5, uso: 0.1, tier: 'B', datosLimitados: false };
  it('las conserva si son fracciones y descarta la entrada si no', async () => {
    const lista = { parche: '15.20', campeones: [{ ...entrada, tasaBloqueo: 0.12, tasaSeleccion: 0.08 }, { ...entrada, campeon: 'Zed', tasaBloqueo: 2 }, { ...entrada, campeon: 'Lux' }] };
    const r = await cliente((async () => json(lista)) as typeof fetch).obtenerCampeones('clasificatoria');
    expect(r.estado === 'ok' && r.lista.campeones.map((c) => [c.campeon, c.tasaBloqueo, c.tasaSeleccion])).toEqual([
      ['Ahri', 0.12, 0.08],
      ['Lux', undefined, undefined],
    ]);
  });
});

describe('sinergias', () => {
  it('pide /sinergias/:campeon/:rol, lo guarda en caché y sin red usa la caché', async () => {
    const urls: string[] = [];
    const ok = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return json(SINERGIAS);
    }) as typeof fetch;
    expect(await cliente(ok).obtenerSinergias('Jinx', 'BOTTOM')).toEqual({ estado: 'ok', sinergias: SINERGIAS });
    expect(urls).toEqual(['http://srv/sinergias/Jinx/BOTTOM']);
    expect(await cliente(fetchCaido).obtenerSinergias('Jinx', 'BOTTOM')).toEqual({ estado: 'sin_conexion', sinergias: SINERGIAS });
  });

  it('404 sin caché → no_disponible; un id raro ni se pide', async () => {
    const f = vi.fn(async () => json({ error: 'sin_datos' }, 404));
    expect(await cliente(f as never).obtenerSinergias('Jinx', 'BOTTOM')).toEqual({ estado: 'no_disponible' });
    expect(await cliente(f as never).obtenerSinergias('../x', 'BOTTOM')).toEqual({ estado: 'no_disponible' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('normaliza: fuera los grupos del propio rol, repetidos o raros y los compañeros no válidos', () => {
    const s = normalizarSinergias({
      ...SINERGIAS,
      porRol: [
        ...SINERGIAS.porRol,
        { rol: 'BOTTOM', aliados: [{ aliado: 'Ezreal', partidas: 9, tasaVictoria: 0.5, datosLimitados: true }] },
        { rol: 'UTILITY', aliados: [{ aliado: 'Nami', partidas: 9, tasaVictoria: 0.5, datosLimitados: true }] },
        { rol: 'TOP', aliados: [{ aliado: 'Garen', partidas: 0, tasaVictoria: 0.5, datosLimitados: true }] },
        { rol: 'ADC', aliados: [] },
      ],
    })!;
    expect(s.porRol).toEqual(SINERGIAS.porRol);
    expect(normalizarSinergias({ campeon: 'Jinx' })).toBeNull();
  });

  it('la vista resuelve los compañeros en Data Dragon y descarta los desconocidos', () => {
    const d = { campeones: new Map([[64, { id: 'LeeSin', nombre: 'Lee Sin' }], [117, { id: 'Lulu', nombre: 'Lulu' }]]) };
    const v = sinergiasVista(SINERGIAS, indiceCampeones(d), true);
    expect(v.sinConexion).toBe(true);
    expect(v.porRol.map((g) => [g.rol, g.aliados.map((a) => a.campeon.nombre)])).toEqual([
      ['JUNGLE', ['Lee Sin']],
      ['UTILITY', ['Lulu']],
    ]);
  });

  it("IPC 'coach:sinergias': solo a la ventana principal y con argumentos válidos", async () => {
    const manejadores = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
    const ipc = { handle: (c: string, h: (e: { sender: unknown }, ...a: unknown[]) => unknown) => void manejadores.set(c, h) };
    const principal = {};
    const d = { version: '15.20.1', parche: '15.20', campeones: new Map([[117, { id: 'Lulu', nombre: 'Lulu' }]]), objetos: {}, runas: new Map(), hechizos: new Map() } as unknown as DatosEstaticos;
    const obtenerSinergias = vi.fn(async () => ({ estado: 'ok', sinergias: SINERGIAS }));
    registrarIpcCampeones(ipc, {
      esPrincipal: (s) => s === principal,
      cargarDatos: async () => d,
      builds: () => ({ obtenerCampeones: vi.fn(), obtenerBuild: vi.fn(), obtenerRoles: vi.fn(), obtenerSinergias }) as never,
    });
    const invocar = (sender: unknown, ...args: unknown[]) => Promise.resolve().then(() => manejadores.get('coach:sinergias')!({ sender }, ...args));
    expect(await invocar(principal, 'Jinx', 'BOTTOM')).toMatchObject({ ok: true, version: '15.20.1', sinergias: { parche: '15.20', porRol: [{ rol: 'UTILITY' }] } });
    expect(obtenerSinergias).toHaveBeenCalledWith('Jinx', 'BOTTOM');
    await expect(invocar({}, 'Jinx', 'BOTTOM')).rejects.toThrow();
    await expect(invocar(principal, 'Jinx', 'ADC')).rejects.toThrow();
    obtenerSinergias.mockResolvedValueOnce({ estado: 'no_disponible' } as never);
    expect(await invocar(principal, 'Jinx', 'BOTTOM')).toEqual({ ok: false });
  });
});

describe('textos nuevos en los 5 idiomas', () => {
  const claves = [
    'enfrentamientos.fase', 'enfrentamientos.faseAyuda', 'enfrentamientos.puntuacion', 'enfrentamientos.puntuacionAyuda',
    'enfrentamientos.orden.fase', 'enfrentamientos.orden.puntuacion', 'sinergias.titulo', 'sinergias.conRol', 'sinergias.pie',
    'tasas.seleccion', 'tasas.seleccionAyuda', 'tasas.bloqueo', 'tasas.bloqueoAyuda',
  ];
  it.each([['es', es], ['en', en], ['pt-BR', ptBR], ['fr', fr], ['de', de]] as const)('%s', (_idioma, textos) => {
    for (const c of claves) expect((textos as Record<string, string>)[c], c).toBeTruthy();
  });
});
