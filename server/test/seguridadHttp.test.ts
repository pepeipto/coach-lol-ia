import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../src/db';
import { crearServidor } from '../src/http';

/** Base falsa cuya consulta de builds falla con un mensaje interno (ruta del archivo, SQL...). */
const dbRota = {
  build: () => {
    throw new Error('SQLITE_ERROR: no such table builds (/datos/coach.db)');
  },
} as unknown as Db;

describe('Seguridad de la API HTTP', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
    vi.restoreAllMocks();
  });

  it('un error inesperado responde 500 genérico sin filtrar el mensaje interno, y se registra en el servidor', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    app = crearServidor(dbRota);
    const r = await app.inject({ method: 'GET', url: '/builds/ahri/MIDDLE' });
    expect(r.statusCode).toBe(500);
    expect(r.json()).toEqual({ error: 'error_interno' });
    expect(r.body).not.toContain('SQLITE');
    expect(r.body).not.toContain('/datos');
    expect(consola).toHaveBeenCalled();
    expect(String(consola.mock.calls[0]!.join(' '))).toContain('GET /builds/ahri/MIDDLE');
  });

  it('los errores del cliente (4xx) mantienen su código y su mensaje', async () => {
    app = crearServidor(dbRota);
    // Cuerpo por encima del límite de la ruta de consejos (8 KB): 413 de Fastify, no un 500 genérico.
    const r = await app.inject({ method: 'POST', url: '/api/coach/consejo', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ x: 'a'.repeat(20_000) }) });
    expect(r.statusCode).toBe(413);
    expect(r.json()).toMatchObject({ statusCode: 413, code: 'FST_ERR_CTP_BODY_TOO_LARGE' });
  });

  it('todas las respuestas llevan cabeceras de seguridad (también las de error y los preflight CORS)', async () => {
    app = crearServidor(dbRota);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const peticion of [
      { method: 'GET' as const, url: '/salud' },
      { method: 'GET' as const, url: '/no-existe' },
      { method: 'GET' as const, url: '/builds/ahri/MIDDLE' },
      { method: 'OPTIONS' as const, url: '/api/asistente' },
    ]) {
      const r = await app.inject(peticion);
      expect(r.headers['x-content-type-options'], peticion.url).toBe('nosniff');
      expect(r.headers['x-frame-options'], peticion.url).toBe('DENY');
      expect(r.headers['referrer-policy'], peticion.url).toBe('no-referrer');
      expect(r.headers['content-security-policy'], peticion.url).toBe("default-src 'none'; frame-ancestors 'none'");
      expect(r.headers['strict-transport-security'], peticion.url).toBe('max-age=31536000');
    }
  });

  it('el CORS del asistente sigue funcionando con las cabeceras nuevas', async () => {
    app = crearServidor(dbRota, { urlWeb: 'https://web.ejemplo.test' });
    const r = await app.inject({ method: 'OPTIONS', url: '/api/asistente', headers: { origin: 'https://web.ejemplo.test' } });
    expect(r.statusCode).toBe(204);
    expect(r.headers['access-control-allow-origin']).toBe('https://web.ejemplo.test');
  });
});
