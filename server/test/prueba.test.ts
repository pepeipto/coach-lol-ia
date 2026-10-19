import Database from 'better-sqlite3';
import { createHmac } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';
import { crearLicencia, leerArgumentos } from '../src/herramientas/crear-licencia';
import { crearRepoLicencias, estadoEfectivo } from '../src/premium/licencias';
import type { ClienteStripe } from '../src/premium/stripe';
import { procesarEvento } from '../src/premium/webhook';
import { claveIp } from '../src/ip';
import { purgarPruebasIp } from '../src/premium/pruebas';
import { leerConfiguracion } from '../src/config';

const FORMATO = /^CLIA(-[A-HJ-NP-Z2-9]{4}){4}$/;
const HORA = 3600 * 1000;
const T0 = Date.UTC(2026, 9, 19, 12);
const DISP_A = 'a'.repeat(64);
const DISP_B = 'b'.repeat(64);
const rutaTemporal = () => join(mkdtempSync(join(tmpdir(), 'coach-prueba-')), 'coach.db');

const stripeFalso: ClienteStripe = {
  crearCheckout: async () => ({ url: 'https://checkout.stripe.test/c', id: 'cs_x' }),
  obtenerSesion: async (id) => ({ id, status: 'complete', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1' }),
  obtenerSuscripcion: async (id) => ({ id, status: 'active', current_period_end: 1_800_000_000, priceId: 'price_1' }),
  crearPortal: async () => ({ url: 'https://portal.stripe.test/p' }),
};

describe('licencias de prueba: caducidad', () => {
  let db: Db;
  beforeEach(() => {
    db = abrirDb(':memory:');
  });
  afterEach(() => db.cerrar());

  it('activa antes de caducar, «caducada» desde ese momento (reloj inyectado)', () => {
    const repo = crearRepoLicencias(db);
    const l = repo.crearPrueba({ horas: 72, nota: 'Tester', ahora: T0 });
    expect(l).toMatchObject({ tipo: 'prueba', estado: 'activa', caducaEn: new Date(T0 + 72 * HORA).toISOString(), nota: 'Tester' });
    expect(l.clave).toMatch(FORMATO);
    expect(estadoEfectivo(l, T0 + 72 * HORA - 1)).toBe('activa');
    expect(estadoEfectivo(l, T0 + 72 * HORA)).toBe('caducada');
    expect(estadoEfectivo(l, T0 + 100 * HORA)).toBe('caducada');
  });

  it('Stripe nunca toca una licencia de prueba', async () => {
    const repo = crearRepoLicencias(db);
    const l = repo.crearPrueba({ horas: 24, nota: 'web', ahora: T0 });
    const antes = repo.porClave(l.clave);
    for (const e of [
      { type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', items: { data: [{ price: { id: 'otro' } }] } } } },
      { type: 'invoice.payment_failed', data: { object: { subscription: 'sub_1' } } },
    ]) {
      await procesarEvento(e, repo, stripeFalso, 'price_1');
    }
    expect(repo.porClave(l.clave)).toEqual(antes);
  });

  it('migra una base de C2-6 (con tipo y nota, sin caduca_en ni dispositivo) conservando las filas', () => {
    const ruta = rutaTemporal();
    const vieja = new Database(ruta);
    vieja.exec(`
      CREATE TABLE licencias (
        clave TEXT PRIMARY KEY, tipo TEXT NOT NULL DEFAULT 'suscripcion', stripe_customer TEXT,
        stripe_subscription TEXT UNIQUE, checkout_session TEXT UNIQUE, estado TEXT NOT NULL,
        renueva_en TEXT, actualizada TEXT NOT NULL, nota TEXT
      );
      INSERT INTO licencias (clave, tipo, estado, actualizada, nota) VALUES ('CLIA-AAAA-BBBB-CCCC-DDDD', 'vitalicia', 'activa', '2026-10-01', 'Dev');
    `);
    vieja.close();
    const d = abrirDb(ruta);
    expect(crearRepoLicencias(d).porClave('CLIA-AAAA-BBBB-CCCC-DDDD')).toMatchObject({ tipo: 'vitalicia', nota: 'Dev', caducaEn: null, dispositivo: null });
    d.cerrar();
  });
});

describe('herramienta crear-licencia: --horas y --vitalicia', () => {
  it('exige exactamente una de las dos opciones', () => {
    expect(leerArgumentos(['--horas', '72', '--nota', 'Tester'], {})).toEqual({ tipo: 'prueba', horas: 72, nota: 'Tester', db: './coach.db' });
    expect(leerArgumentos(['--vitalicia', '--nota', 'Desarrollador', '--db', 'x.db'], {})).toEqual({ tipo: 'vitalicia', nota: 'Desarrollador', db: 'x.db' });
    expect(() => leerArgumentos(['--nota', 'X'], {})).toThrow(/--horas|--vitalicia/);
    expect(() => leerArgumentos(['--vitalicia', '--horas', '5', '--nota', 'X'], {})).toThrow(/--horas|--vitalicia/);
    for (const malo of ['0', '-3', '1.5', 'abc']) expect(() => leerArgumentos(['--horas', malo, '--nota', 'X'], {})).toThrow('--horas');
  });

  it('crea una prueba que caduca a las n horas y devuelve la clave y la fecha', () => {
    const ruta = rutaTemporal();
    const r = crearLicencia(ruta, { tipo: 'prueba', horas: 72, nota: 'Tester' }, T0);
    expect(r.clave).toMatch(FORMATO);
    expect(r.caducaEn).toBe(new Date(T0 + 72 * HORA).toISOString());
    const v = crearLicencia(ruta, { tipo: 'vitalicia', nota: 'Desarrollador' }, T0);
    expect(v.caducaEn).toBeNull();
    const d = abrirDb(ruta);
    const repo = crearRepoLicencias(d);
    expect(repo.porClave(r.clave)).toMatchObject({ tipo: 'prueba', nota: 'Tester' });
    expect(repo.porClave(v.clave)).toMatchObject({ tipo: 'vitalicia' });
    d.cerrar();
  });
});

describe('rutas de prueba', () => {
  let db: Db;
  let app: FastifyInstance;
  let ahora: number;
  const montar = (conStripe: boolean, extra: Record<string, unknown> = {}) =>
    crearServidor(db, {
      ...(conStripe ? { stripe: { cliente: stripeFalso, secretoWebhook: 'whsec', precioId: 'price_1' } } : {}),
      urlWeb: 'https://www.coachlolia.com',
      ahora: () => ahora,
      salPrueba: 'sal-de-prueba',
      trustProxy: 1,
      ...extra,
    });
  const pedir = (ip: string) =>
    app.inject({ method: 'POST', url: '/api/premium/prueba', headers: { 'x-forwarded-for': ip, origin: 'https://www.coachlolia.com' } });
  const estado = (clave: string, dispositivo?: string) =>
    app.inject({ method: 'GET', url: `/api/premium/estado/${clave}${dispositivo ? `?dispositivo=${dispositivo}` : ''}` });

  beforeEach(() => {
    ahora = T0;
    db = abrirDb(':memory:');
  });
  afterEach(async () => {
    await app.close();
    db.cerrar();
  });

  it('POST /api/premium/prueba crea una prueba de 24 h, con CORS y sin necesitar Stripe', async () => {
    app = montar(false);
    const r = await pedir('10.0.0.1');
    expect(r.statusCode).toBe(200);
    expect(r.headers['access-control-allow-origin']).toBe('https://www.coachlolia.com');
    const { clave, caducaEn } = r.json();
    expect(clave).toMatch(FORMATO);
    expect(caducaEn).toBe(new Date(T0 + 24 * HORA).toISOString());
    expect(crearRepoLicencias(db).porClave(clave)).toMatchObject({ tipo: 'prueba', nota: 'web' });
  });

  it('una segunda petición desde la misma IP en 30 días → 429; otra IP sí puede; pasados 30 días, también', async () => {
    app = montar(true);
    expect((await pedir('10.0.0.1')).statusCode).toBe(200);
    const otra = await pedir('10.0.0.1');
    expect(otra.statusCode).toBe(429);
    expect(otra.json()).toEqual({ error: 'prueba_ya_solicitada' });
    expect((await pedir('10.0.0.2')).statusCode).toBe(200);
    ahora = T0 + 30 * 24 * HORA + 1;
    expect((await pedir('10.0.0.1')).statusCode).toBe(200);
  });

  it('solo se guarda un SHA-256 con sal de la IP, nunca la IP', async () => {
    app = montar(true);
    await pedir('10.0.0.1');
    const filas = db.sql.prepare('SELECT * FROM pruebas_ip').all() as Record<string, string>[];
    expect(filas).toHaveLength(1);
    expect(JSON.stringify(filas)).not.toContain('10.0.0.1');
    expect(filas[0]!.hash).toBe(createHmac('sha256', 'sal-de-prueba').update('10.0.0.1').digest('hex'));
  });

  it('con un Origin que no es la web → 403 origen_no_permitido; sin Origin (curl) sigue el límite por IP', async () => {
    app = montar(true);
    const ajena = await app.inject({ method: 'POST', url: '/api/premium/prueba', remoteAddress: '10.0.0.1', headers: { origin: 'https://malo.example' } });
    expect(ajena.statusCode).toBe(403);
    expect(ajena.json()).toEqual({ error: 'origen_no_permitido' });
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM pruebas_ip').get()).toEqual({ n: 0 });
    const sinOrigen = () => app.inject({ method: 'POST', url: '/api/premium/prueba', remoteAddress: '10.0.0.1' });
    expect((await sinOrigen()).statusCode).toBe(200);
    expect((await sinOrigen()).statusCode).toBe(429);
  });

  it('las filas de pruebas_ip de hace más de 30 días se purgan', async () => {
    app = montar(true);
    await pedir('10.0.0.1');
    ahora = T0 + 31 * 24 * HORA;
    expect(purgarPruebasIp(db, ahora)).toBe(1);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM pruebas_ip').get()).toEqual({ n: 0 });
    // Pedir otra prueba también purga las viejas.
    await pedir('10.0.0.2');
    ahora = T0 + 62 * 24 * HORA;
    await pedir('10.0.0.3');
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM pruebas_ip').get()).toEqual({ n: 1 });
  });

  it('sin PRUEBA_SAL usa una sal aleatoria guardada en la base (la misma en cada arranque)', async () => {
    app = montar(true, { salPrueba: undefined });
    await pedir('10.0.0.1');
    const sal = (db.sql.prepare("SELECT valor FROM ajustes_servidor WHERE clave = 'sal_prueba'").get() as { valor: string }).valor;
    expect(sal).toMatch(/^[0-9a-f]{64}$/);
    await app.close();
    app = montar(true, { salPrueba: undefined });
    expect((await pedir('10.0.0.1')).statusCode).toBe(429);
  });

  it('estado de una prueba: tipo y caducaEn; caducada tras 24 h', async () => {
    app = montar(true);
    const { clave, caducaEn } = (await pedir('10.0.0.1')).json();
    expect((await estado(clave)).json()).toEqual({ premium: true, estado: 'activa', renuevaEn: null, caducaEn, tipo: 'prueba' });
    ahora = T0 + 24 * HORA;
    expect((await estado(clave)).json()).toEqual({ premium: false, estado: 'caducada', renuevaEn: null, caducaEn, tipo: 'prueba' });
  });

  it('dispositivo: la primera consulta vincula la prueba; otro dispositivo → otro_dispositivo', async () => {
    app = montar(true);
    const { clave } = (await pedir('10.0.0.1')).json();
    expect((await estado(clave, DISP_A)).json()).toMatchObject({ premium: true, estado: 'activa' });
    expect((await estado(clave, DISP_A)).json()).toMatchObject({ premium: true, estado: 'activa' });
    expect((await estado(clave, DISP_B)).json()).toMatchObject({ premium: false, estado: 'otro_dispositivo' });
  });

  it('un dispositivo que ya usó una prueba no puede usar otra → prueba_ya_usada', async () => {
    app = montar(true);
    const primera = (await pedir('10.0.0.1')).json().clave;
    const segunda = (await pedir('10.0.0.2')).json().clave;
    await estado(primera, DISP_A);
    expect((await estado(segunda, DISP_A)).json()).toMatchObject({ premium: false, estado: 'prueba_ya_usada' });
    // La segunda sigue libre para otro dispositivo.
    expect((await estado(segunda, DISP_B)).json()).toMatchObject({ premium: true, estado: 'activa' });
  });

  it('suscripciones y vitalicias ignoran el dispositivo; el portal rechaza las pruebas', async () => {
    app = montar(true);
    const repo = crearRepoLicencias(db);
    const v = repo.crearVitalicia({ nota: 'Dev' });
    const s = repo.crearSiNoExiste({ checkoutSession: 'cs_1', stripeCustomer: 'cus_1', stripeSubscription: 'sub_1', renuevaEn: null });
    for (const clave of [v.clave, s.clave]) {
      expect((await estado(clave, DISP_A)).json()).toMatchObject({ premium: true, estado: 'activa' });
      expect((await estado(clave, DISP_B)).json()).toMatchObject({ premium: true, estado: 'activa' });
    }
    expect((await estado(v.clave)).json()).toEqual({ premium: true, estado: 'activa', renuevaEn: null, caducaEn: null, tipo: 'vitalicia', vitalicia: true });
    const p = repo.crearPrueba({ horas: 1, nota: 'x', ahora: T0 });
    const portal = await app.inject({
      method: 'POST',
      url: '/api/premium/portal',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ clave: p.clave }),
    });
    expect(portal.statusCode).toBe(400);
    expect(portal.json()).toEqual({ error: 'licencia_prueba' });
  });

  it('un dispositivo con formato incorrecto no vincula nada', async () => {
    app = montar(true);
    const { clave } = (await pedir('10.0.0.1')).json();
    expect((await estado(clave, 'xyz')).json()).toMatchObject({ premium: true });
    expect(crearRepoLicencias(db).porClave(clave)?.dispositivo).toBeNull();
  });
});

describe('IP de los límites (I2)', () => {
  let db: Db;
  let app: FastifyInstance;
  beforeEach(() => {
    db = abrirDb(':memory:');
    app = crearServidor(db, { urlWeb: 'https://www.coachlolia.com', salPrueba: 'sal', trustProxy: 1 });
  });
  afterEach(async () => {
    await app.close();
    db.cerrar();
  });
  const prueba = (o: { xff?: string; ip?: string }) =>
    app.inject({
      method: 'POST',
      url: '/api/premium/prueba',
      remoteAddress: o.ip ?? '10.0.0.9',
      headers: o.xff ? { 'x-forwarded-for': o.xff } : {},
    });

  it('con 1 salto, un X-Forwarded-For falsificado no cambia la IP: cuenta la que añade el proxy', async () => {
    expect((await prueba({ xff: '1.1.1.1, 203.0.113.7' })).statusCode).toBe(200);
    expect((await prueba({ xff: '2.2.2.2, 203.0.113.7' })).statusCode).toBe(429);
    expect((await prueba({ xff: '9.9.9.9, 203.0.113.8' })).statusCode).toBe(200);
  });

  it('las IPv6 se agrupan por su prefijo /64', async () => {
    expect((await prueba({ ip: '2001:db8:aaaa:bbbb::1' })).statusCode).toBe(200);
    expect((await prueba({ ip: '2001:db8:aaaa:bbbb:ffff:1:2:3' })).statusCode).toBe(429);
    expect((await prueba({ ip: '2001:db8:aaaa:cccc::1' })).statusCode).toBe(200);
  });

  it('una IPv4 mapeada en IPv6 (::ffff:a.b.c.d) cuenta como la IPv4', async () => {
    expect((await prueba({ ip: '198.51.100.4' })).statusCode).toBe(200);
    expect((await prueba({ ip: '::ffff:198.51.100.4' })).statusCode).toBe(429);
  });

  it('claveIp normaliza las direcciones', () => {
    expect(claveIp('::ffff:10.0.0.1')).toBe('10.0.0.1');
    expect(claveIp('10.0.0.1')).toBe('10.0.0.1');
    expect(claveIp('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(claveIp('2001:0DB8:0000:0000:1:2:3:4')).toBe('2001:db8:0:0::/64');
    expect(claveIp('::1')).toBe('0:0:0:0::/64');
  });
});

describe('PRUEBA_SAL en producción', () => {
  it('con NODE_ENV=production es obligatoria (error claro en español); en desarrollo no', () => {
    expect(() => leerConfiguracion({ RIOT_API_KEY: 'k', NODE_ENV: 'production' })).toThrow(/PRUEBA_SAL/);
    expect(leerConfiguracion({ RIOT_API_KEY: 'k', NODE_ENV: 'production', PRUEBA_SAL: 'secreta' }).salPrueba).toBe('secreta');
    expect(leerConfiguracion({ RIOT_API_KEY: 'k' }).salPrueba).toBeNull();
  });
});
