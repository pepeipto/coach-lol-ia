import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { abrirDb, type Db } from '../src/db';
import { MAX_TARJETAS_IP_DIA, registrarMetricas } from '../src/metricas';

describe('3.7: contador anónimo de tarjetas compartidas', () => {
  let db: Db;
  let ahora: Date;
  const app = () => {
    const a = Fastify();
    registrarMetricas(a, db, () => ahora);
    return a;
  };
  beforeEach(() => {
    db = abrirDb(':memory:');
    ahora = new Date('2026-10-23T12:00:00Z');
  });
  afterEach(() => db.cerrar());

  it('cuenta cada tarjeta y no guarda nada de quién la compartió', async () => {
    const a = app();
    expect((await a.inject({ method: 'POST', url: '/api/metricas/tarjeta' })).statusCode).toBe(204);
    await a.inject({ method: 'POST', url: '/api/metricas/tarjeta' });
    expect((await a.inject({ method: 'GET', url: '/api/metricas' })).json()).toEqual({ tarjetas: { total: 2, ultimos7Dias: 2 } });
    const columnas = db.sql.prepare('PRAGMA table_info(metricas_dia)').all().map((c) => (c as { name: string }).name);
    expect(columnas).toEqual(['dia', 'evento', 'n']);
  });

  it('una misma IP no suma más de MAX_TARJETAS_IP_DIA al día', async () => {
    const a = app();
    for (let i = 0; i < MAX_TARJETAS_IP_DIA + 5; i++) await a.inject({ method: 'POST', url: '/api/metricas/tarjeta' });
    expect((await a.inject({ method: 'GET', url: '/api/metricas' })).json().tarjetas.total).toBe(MAX_TARJETAS_IP_DIA);
    ahora = new Date('2026-10-24T12:00:00Z');
    await a.inject({ method: 'POST', url: '/api/metricas/tarjeta' });
    expect((await a.inject({ method: 'GET', url: '/api/metricas' })).json().tarjetas.total).toBe(MAX_TARJETAS_IP_DIA + 1);
  });

  it('los últimos 7 días no incluyen tarjetas más antiguas', async () => {
    const a = app();
    ahora = new Date('2026-10-01T12:00:00Z');
    await a.inject({ method: 'POST', url: '/api/metricas/tarjeta' });
    ahora = new Date('2026-10-23T12:00:00Z');
    await a.inject({ method: 'POST', url: '/api/metricas/tarjeta' });
    expect((await a.inject({ method: 'GET', url: '/api/metricas' })).json()).toEqual({ tarjetas: { total: 2, ultimos7Dias: 1 } });
  });
});
