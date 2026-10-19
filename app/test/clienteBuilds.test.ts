import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Build } from '@coach/shared';
import { crearClienteBuilds } from '../src/main/builds/clienteBuilds';

const BUILD: Build = {
  campeon: 'Ahri',
  rol: 'MIDDLE',
  parche: '15.20',
  partidas: 500,
  tasaVictoria: 0.52,
  mezclaParches: false,
  runas: {} as Build['runas'],
  hechizos: [4, 14],
  objetosIniciales: [1056],
  nucleo: [6655],
  botas: 3020,
  situacionales: [3157],
  ordenHabilidades: [] as Build['ordenHabilidades'],
  calculadoEn: '2026-10-18T00:00:00.000Z',
};

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });
const fetchCaido = (async () => {
  throw new Error('sin red');
}) as typeof fetch;

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'coach-builds-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const cliente = (f: typeof fetch, tiempoEsperaMs?: number) =>
  crearClienteBuilds({ urlServidor: 'http://srv', dirCache: dir, fetch: f, tiempoEsperaMs });

describe('cliente de builds', () => {
  it('200 → estado ok y la guarda en caché', async () => {
    const urls: string[] = [];
    const ok = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return json(BUILD);
    }) as typeof fetch;
    expect(await cliente(ok).obtenerBuild('Ahri', 'MIDDLE')).toEqual({ estado: 'ok', build: BUILD });
    expect(urls).toEqual(['http://srv/builds/Ahri/MIDDLE']);
    expect(await cliente(fetchCaido).obtenerBuild('Ahri', 'MIDDLE')).toEqual({ estado: 'sin_conexion', build: BUILD });
  });

  it('servidor caído con caché → sin_conexion con la build en caché', async () => {
    await cliente((async () => json(BUILD)) as typeof fetch).obtenerBuild('Ahri', 'MIDDLE');
    expect(await cliente(fetchCaido).obtenerBuild('Ahri', 'MIDDLE')).toEqual({ estado: 'sin_conexion', build: BUILD });
  });

  it('404 sin caché (campeón recién lanzado) → no_disponible', async () => {
    const f = (async () => json({ error: 'sin_datos' }, 404)) as typeof fetch;
    expect(await cliente(f).obtenerBuild('Ahri', 'MIDDLE')).toEqual({ estado: 'no_disponible' });
  });

  it('404 con caché → sin_conexion con la caché', async () => {
    await cliente((async () => json(BUILD)) as typeof fetch).obtenerBuild('Ahri', 'MIDDLE');
    const f = (async () => json({ error: 'sin_datos' }, 404)) as typeof fetch;
    expect(await cliente(f).obtenerBuild('Ahri', 'MIDDLE')).toEqual({ estado: 'sin_conexion', build: BUILD });
  });

  it('servidor caído sin caché → no_disponible', async () => {
    expect(await cliente(fetchCaido).obtenerBuild('Ahri', 'MIDDLE')).toEqual({ estado: 'no_disponible' });
  });

  it('respuesta más lenta que tiempoEsperaMs → se trata como caída', async () => {
    const lento = ((_u: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const t = setTimeout(() => resolve(json(BUILD)), 500);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(t);
          reject(init.signal!.reason);
        });
      })) as typeof fetch;
    expect(await cliente(lento, 20).obtenerBuild('Ahri', 'MIDDLE')).toEqual({ estado: 'no_disponible' });
  });

  it('obtenerRoles devuelve los roles y [] ante error', async () => {
    const f = (async () =>
      json({ campeon: 'Ahri', roles: [{ rol: 'MIDDLE', partidas: 900 }, { rol: 'UTILITY', partidas: 20 }] })) as typeof fetch;
    expect(await cliente(f).obtenerRoles('Ahri')).toEqual(['MIDDLE', 'UTILITY']);
    expect(await cliente(fetchCaido).obtenerRoles('Ahri')).toEqual([]);
    expect(await cliente((async () => json({}, 404)) as typeof fetch).obtenerRoles('Ahri')).toEqual([]);
  });
  describe('obtenerCampeones', () => {
    const LISTA = {
      parche: '15.20',
      campeones: [{ campeon: 'Ahri', rol: 'MIDDLE', partidas: 300, tasaVictoria: 0.52, uso: 0.1, tier: 'A', datosLimitados: false }],
    };

    it('pide /campeones con el modo y guarda la lista en caché', async () => {
      const urls: string[] = [];
      const ok = (async (u: RequestInfo | URL) => {
        urls.push(String(u));
        return json(LISTA);
      }) as typeof fetch;
      expect(await cliente(ok).obtenerCampeones('clasificatoria')).toEqual({ estado: 'ok', lista: LISTA });
      expect(urls).toEqual(['http://srv/campeones?modo=clasificatoria']);
      expect(await cliente(fetchCaido).obtenerCampeones('clasificatoria')).toEqual({ estado: 'sin_conexion', lista: LISTA });
    });

    it('sin servidor ni caché → no_disponible', async () => {
      expect(await cliente(fetchCaido).obtenerCampeones('clasificatoria')).toEqual({ estado: 'no_disponible' });
      const f = (async () => json({ error: 'x' }, 500)) as typeof fetch;
      expect(await cliente(f).obtenerCampeones('clasificatoria')).toEqual({ estado: 'no_disponible' });
    });

    it('descarta las entradas no válidas y conserva las buenas', async () => {
      const buena = LISTA.campeones[0];
      const malas = [
        null,
        'Ahri',
        { ...buena, rol: 'MID' },
        { ...buena, tier: 'Z' },
        { ...buena, partidas: -1 },
        { ...buena, tasaVictoria: 2 },
        { ...buena, uso: Number.NaN },
        { ...buena, campeon: '' },
        { ...buena, datosLimitados: 'no' },
      ];
      const f = (async () => json({ parche: '15.20', campeones: [buena, ...malas] })) as typeof fetch;
      expect(await cliente(f).obtenerCampeones('clasificatoria')).toEqual({ estado: 'ok', lista: LISTA });
    });

    it('una respuesta con forma inesperada se trata como caída', async () => {
      const raro = (async () => json({ hola: 1 })) as typeof fetch;
      expect(await cliente(raro).obtenerCampeones('clasificatoria')).toEqual({ estado: 'no_disponible' });
    });
  });
});

describe('cliente de builds por modo', () => {
  const ARAM: Build = { ...BUILD, rol: null, modo: 'aram', partidas: 80 };

  it('fuera de clasificatoria pide ?modo= sin rol y guarda una caché aparte', async () => {
    const urls: string[] = [];
    const f = (async (u: RequestInfo | URL) => {
      urls.push(String(u));
      return json(String(u).includes('modo=aram') ? ARAM : BUILD);
    }) as typeof fetch;
    expect(await cliente(f).obtenerBuild('Ahri', null, 'aram')).toEqual({ estado: 'ok', build: ARAM });
    expect(urls).toEqual(['http://srv/builds/Ahri/ninguno?modo=aram']);
    await cliente(f).obtenerBuild('Ahri', 'MIDDLE');
    expect(await cliente(fetchCaido).obtenerBuild('Ahri', 'TOP', 'aram')).toEqual({ estado: 'sin_conexion', build: ARAM });
    expect(await cliente(fetchCaido).obtenerBuild('Ahri', 'MIDDLE')).toEqual({ estado: 'sin_conexion', build: BUILD });
  });

  it('clasificatoria sin rol: no_disponible sin pedir nada', async () => {
    expect(await cliente(fetchCaido).obtenerBuild('Ahri', null)).toEqual({ estado: 'no_disponible' });
  });

  it('la lista de un modo sin rol acepta rol null (y posición media en Arena) y descarta las entradas con rol', async () => {
    const lista = {
      parche: '15.20',
      campeones: [
        { campeon: 'Ahri', rol: null, partidas: 50, tasaVictoria: 0.2, uso: 0.5, tier: 'A', datosLimitados: false, posicionMedia: 3.5, top4: 0.6 },
        { campeon: 'Zed', rol: 'MIDDLE', partidas: 50, tasaVictoria: 0.2, uso: 0.5, tier: 'A', datosLimitados: false },
        { campeon: 'Lux', rol: null, partidas: 50, tasaVictoria: 0.2, uso: 0.5, tier: 'A', datosLimitados: false, posicionMedia: 12 },
      ],
    };
    const r = await cliente((async () => json(lista)) as typeof fetch).obtenerCampeones('arena');
    expect(r.estado === 'ok' && r.lista.campeones.map((e) => e.campeon)).toEqual(['Ahri']);
  });
});

