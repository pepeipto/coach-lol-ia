import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';

describe('seguridad (hallazgo 10): errores genéricos y cabeceras', () => {
  let db: Db;
  let app: FastifyInstance;
  let consola: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    db = abrirDb(':memory:');
    consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    app = crearServidor(db);
    app.get('/explota', async () => {
      throw new Error('SQLITE_CORRUPT: /datos/coach.db fila 42');
    });
    app.get('/explota-con-codigo', async () => {
      throw Object.assign(new Error('detalle interno 503'), { statusCode: 503 });
    });
  });
  afterEach(async () => {
    await app.close();
    db.cerrar();
    vi.restoreAllMocks();
  });

  it('un error inesperado da 500 { error: interno } sin el mensaje, y se registra', async () => {
    const r = await app.inject({ method: 'GET', url: '/explota' });
    expect(r.statusCode).toBe(500);
    expect(r.json()).toEqual({ error: 'interno' });
    expect(r.body).not.toContain('SQLITE');
    expect(consola).toHaveBeenCalledWith(expect.stringContaining('GET /explota'), 'SQLITE_CORRUPT: /datos/coach.db fila 42');
  });

  it('cualquier 5xx sale como 500 genérico', async () => {
    const r = await app.inject({ method: 'GET', url: '/explota-con-codigo' });
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toContain('detalle');
  });

  it('un 4xx de Fastify (JSON mal formado) conserva su código', async () => {
    app.post('/eco', async (req) => req.body);
    const r = await app.inject({ method: 'POST', url: '/eco', headers: { 'content-type': 'application/json' }, payload: '{mal' });
    expect(r.statusCode).toBe(400);
  });

  it('todas las respuestas llevan HSTS y nosniff', async () => {
    for (const url of ['/salud', '/no-existe', '/explota']) {
      const r = await app.inject({ method: 'GET', url });
      expect(r.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
      expect(r.headers['x-content-type-options']).toBe('nosniff');
    }
  });
});
