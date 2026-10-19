import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PREMIUM_HABILITADO } from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';
import { leerConfiguracion } from '../src/config';

const RUTAS_PREMIUM = [
  ['POST', '/api/premium/checkout'],
  ['GET', '/api/premium/licencia?session_id=x'],
  ['GET', '/api/premium/estado/CLIA-AAAA-AAAA-AAAA-AAAA'],
  ['POST', '/api/premium/portal'],
  ['POST', '/api/premium/prueba'],
  ['OPTIONS', '/api/premium/checkout'],
  ['POST', '/api/stripe/webhook'],
] as const;

describe('interruptor PREMIUM_HABILITADO', () => {
  let db: Db;
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
    db?.cerrar();
  });

  it('la constante compartida está apagada por defecto', () => {
    expect(PREMIUM_HABILITADO).toBe(false);
  });

  it('servidor: PREMIUM_HABILITADO=1 lo enciende; sin la variable (o con otro valor) está apagado', () => {
    expect(leerConfiguracion({ RIOT_API_KEY: 'k' }).premiumHabilitado).toBe(false);
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', PREMIUM_HABILITADO: '' }).premiumHabilitado).toBe(false);
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', PREMIUM_HABILITADO: '0' }).premiumHabilitado).toBe(false);
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', PREMIUM_HABILITADO: '1' }).premiumHabilitado).toBe(true);
  });

  it('apagado, PRUEBA_SAL deja de ser obligatoria en producción (no hay pruebas gratuitas)', () => {
    expect(() => leerConfiguracion({ RIOT_API_KEY: 'k', NODE_ENV: 'production' })).not.toThrow();
    expect(() => leerConfiguracion({ RIOT_API_KEY: 'k', NODE_ENV: 'production', PREMIUM_HABILITADO: '1' })).toThrow(/PRUEBA_SAL/);
  });

  it('apagado (por defecto): todas las rutas de premium y el webhook de Stripe responden 404 no_disponible', async () => {
    db = abrirDb(':memory:');
    app = crearServidor(db);
    for (const [method, url] of RUTAS_PREMIUM) {
      const r = await app.inject({ method, url });
      expect(r.statusCode, `${method} ${url}`).toBe(404);
      expect(r.json(), `${method} ${url}`).toEqual({ error: 'no_disponible' });
    }
  });

  it('apagado: /salud, /builds, /roles y /api/asistente siguen funcionando', async () => {
    db = abrirDb(':memory:');
    app = crearServidor(db, { premiumHabilitado: false });
    expect((await app.inject({ method: 'GET', url: '/salud' })).json()).toEqual({ ok: true });
    expect((await app.inject({ method: 'GET', url: '/builds/ahri/MIDDLE' })).json()).toEqual({ error: 'sin_datos' });
    expect((await app.inject({ method: 'GET', url: '/roles/Ahri' })).json()).toEqual({ campeon: 'Ahri', roles: [] });
    const a = await app.inject({ method: 'POST', url: '/api/asistente', payload: { mensajes: [{ rol: 'usuario', texto: 'hola' }] } });
    expect(a.statusCode).toBe(503); // sin ANTHROPIC_API_KEY, como siempre
  });

  it('encendido: las rutas de premium vuelven a estar registradas', async () => {
    db = abrirDb(':memory:');
    app = crearServidor(db, { premiumHabilitado: true });
    const c = await app.inject({ method: 'POST', url: '/api/premium/checkout' });
    expect(c.statusCode).toBe(503);
    expect(c.json()).toEqual({ error: 'premium_no_configurado' });
    const e = await app.inject({ method: 'GET', url: '/api/premium/estado/CLIA-AAAA-AAAA-AAAA-AAAA' });
    expect(e.json()).toEqual({ error: 'licencia_desconocida' });
  });
});
