import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';
import { crearRiotApi } from '../src/riot/riotApi';
import { crearEstadoClaveRiot } from '../src/riot/estadoClave';

const CLAVE = 'RGAPI-00000000-secreta';

describe('GET /salud con el estado de la clave de Riot', () => {
  let db: Db;
  let app: FastifyInstance;
  afterEach(async () => {
    await app.close();
    db.cerrar();
    vi.restoreAllMocks();
  });

  function montar(estados: number[]) {
    let i = 0;
    const urls: string[] = [];
    const fetchFalso = (async (url: string) => {
      urls.push(String(url));
      return new Response('{}', { status: estados[Math.min(i++, estados.length - 1)] });
    }) as unknown as typeof fetch;
    const logs: string[] = [];
    const espia = (...a: unknown[]) => logs.push(a.map(String).join(' '));
    vi.spyOn(console, 'info').mockImplementation(espia);
    vi.spyOn(console, 'warn').mockImplementation(espia);
    vi.spyOn(console, 'error').mockImplementation(espia);
    vi.spyOn(console, 'log').mockImplementation(espia);
    const claveRiot = crearEstadoClaveRiot({ comprobar: () => api.comprobarClave() });
    const api = crearRiotApi({ clave: CLAVE, fetch: fetchFalso, alResponder: (s) => claveRiot.observar(s) });
    db = abrirDb(':memory:');
    app = crearServidor(db, { claveRiot });
    return { claveRiot, api, urls, logs };
  }

  it('la primera /salud lanza la comprobación barata; con 401 la siguiente dice caducada', async () => {
    const { claveRiot, urls } = montar([401]);
    const r1 = await app.inject({ method: 'GET', url: '/salud' });
    expect(r1.json()).toMatchObject({ ok: true, riot: 'desconocida' });
    await claveRiot.enCurso();
    expect(urls).toEqual(['https://euw1.api.riotgames.com/lol/status/v4/platform-data']);
    const r2 = await app.inject({ method: 'GET', url: '/salud' });
    expect(r2.statusCode).toBe(200);
    expect(r2.json()).toEqual({ ok: true, riot: 'caducada', riotDesde: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) });
    expect(urls).toHaveLength(1); // no vuelve a comprobar antes de 10 min
  });

  it('una llamada normal que funciona la devuelve a ok', async () => {
    const { claveRiot, api } = montar([403, 200]);
    await app.inject({ method: 'GET', url: '/salud' });
    await claveRiot.enCurso();
    await api.comprobarClave();
    expect((await app.inject({ method: 'GET', url: '/salud' })).json()).toMatchObject({ riot: 'ok' });
  });

  it('ni la respuesta ni el registro llevan la clave ni la cabecera', async () => {
    const { claveRiot, logs } = montar([401]);
    await app.inject({ method: 'GET', url: '/salud' });
    await claveRiot.enCurso();
    const r = await app.inject({ method: 'GET', url: '/salud' });
    expect(r.body).not.toContain('RGAPI');
    expect(r.body.toLowerCase()).not.toContain('x-riot-token');
    expect(Object.keys(r.json()).sort()).toEqual(['ok', 'riot', 'riotDesde']);
    expect(logs.join('\n')).toMatch(/caducad/);
    expect(logs.join('\n')).not.toContain('RGAPI');
    expect(logs.join('\n').toLowerCase()).not.toContain('x-riot-token');
  });
});
