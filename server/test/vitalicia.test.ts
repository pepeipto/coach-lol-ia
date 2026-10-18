import Database from 'better-sqlite3';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';
import { crearLicenciaVitalicia, leerArgumentos } from '../src/herramientas/crear-licencia';
import { crearRepoLicencias, type RepoLicencias } from '../src/premium/licencias';
import type { ClienteStripe } from '../src/premium/stripe';
import { procesarEvento } from '../src/premium/webhook';

const FORMATO = /^CLIA(-[A-HJ-NP-Z2-9]{4}){4}$/;
const rutaTemporal = () => join(mkdtempSync(join(tmpdir(), 'coach-vitalicia-')), 'coach.db');

const stripeFalso: ClienteStripe = {
  crearCheckout: async () => ({ url: 'https://checkout.stripe.test/c', id: 'cs_x' }),
  obtenerSesion: async (id) => ({ id, status: 'complete', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1' }),
  obtenerSuscripcion: async (id) => ({ id, status: 'active', current_period_end: 1_800_000_000, priceId: 'price_1' }),
  crearPortal: async () => ({ url: 'https://portal.stripe.test/p' }),
};

describe('migración de la tabla licencias', () => {
  it('una base con el esquema antiguo (NOT NULL en Stripe, sin tipo ni nota) se migra conservando las filas', () => {
    const ruta = rutaTemporal();
    const vieja = new Database(ruta);
    vieja.exec(`
      CREATE TABLE licencias (
        clave TEXT PRIMARY KEY,
        stripe_customer TEXT NOT NULL,
        stripe_subscription TEXT UNIQUE,
        checkout_session TEXT NOT NULL UNIQUE,
        estado TEXT NOT NULL,
        renueva_en TEXT,
        actualizada TEXT NOT NULL
      );
      INSERT INTO licencias VALUES ('CLIA-AAAA-BBBB-CCCC-DDDD', 'cus_1', 'sub_1', 'cs_1', 'activa', '2026-11-18T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
    `);
    vieja.close();

    const db = abrirDb(ruta);
    const columnas = db.sql.prepare('PRAGMA table_info(licencias)').all() as { name: string; notnull: number }[];
    const col = (n: string) => columnas.find((c) => c.name === n);
    expect(col('tipo')).toBeTruthy();
    expect(col('nota')).toBeTruthy();
    expect(col('stripe_customer')!.notnull).toBe(0);
    expect(col('checkout_session')!.notnull).toBe(0);
    const repo = crearRepoLicencias(db);
    expect(repo.porClave('CLIA-AAAA-BBBB-CCCC-DDDD')).toMatchObject({
      tipo: 'suscripcion',
      stripeCustomer: 'cus_1',
      stripeSubscription: 'sub_1',
      checkoutSession: 'cs_1',
      estado: 'activa',
      renuevaEn: '2026-11-18T00:00:00.000Z',
      nota: null,
    });
    // Las restricciones UNIQUE siguen: la misma sesión no duplica.
    expect(repo.crearSiNoExiste({ checkoutSession: 'cs_1', stripeCustomer: 'cus_1', stripeSubscription: 'sub_1', renuevaEn: null }).clave).toBe(
      'CLIA-AAAA-BBBB-CCCC-DDDD',
    );
    db.cerrar();
    // Abrirla otra vez no vuelve a migrar ni pierde nada.
    const otra = abrirDb(ruta);
    expect(crearRepoLicencias(otra).porClave('CLIA-AAAA-BBBB-CCCC-DDDD')?.tipo).toBe('suscripcion');
    otra.cerrar();
  });
});

describe('licencias vitalicias', () => {
  let db: Db;
  let repo: RepoLicencias;
  beforeEach(() => {
    db = abrirDb(':memory:');
    repo = crearRepoLicencias(db);
  });
  afterEach(() => db.cerrar());

  it('crearVitalicia: activa, sin renovación ni datos de Stripe, con su nota; caben varias', () => {
    const a = repo.crearVitalicia({ nota: 'Desarrollador' });
    const b = repo.crearVitalicia({ nota: 'Prensa' });
    expect(a.clave).toMatch(FORMATO);
    expect(b.clave).not.toBe(a.clave);
    expect(repo.porClave(a.clave)).toMatchObject({
      tipo: 'vitalicia',
      estado: 'activa',
      renuevaEn: null,
      stripeCustomer: null,
      stripeSubscription: null,
      checkoutSession: null,
      nota: 'Desarrollador',
    });
  });

  it('los eventos de Stripe nunca la modifican', async () => {
    const v = repo.crearVitalicia({ nota: 'Desarrollador' });
    const antes = repo.porClave(v.clave);
    const eventos = [
      { type: 'checkout.session.completed', data: { object: { id: 'cs_1', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1' } } },
      { type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'canceled', current_period_end: 1, items: { data: [{ price: { id: 'price_1' } }] } } } },
      { type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', items: { data: [{ price: { id: 'price_1' } }] } } } },
      { type: 'invoice.payment_failed', data: { object: { subscription: 'sub_1' } } },
    ];
    for (const e of eventos) await procesarEvento(e, repo, stripeFalso, 'price_1');
    expect(repo.porClave(v.clave)).toEqual(antes);
    // Tampoco con una actualización directa por suscripción (no tiene).
    expect(repo.actualizarPorSuscripcion('null', { estado: 'cancelada' })).toBeNull();
    expect(repo.porClave(v.clave)?.estado).toBe('activa');
  });
});

describe('rutas con una licencia vitalicia', () => {
  it('estado → premium, activa, sin renovación y vitalicia; el portal responde 400', async () => {
    const db = abrirDb(':memory:');
    const v = crearRepoLicencias(db).crearVitalicia({ nota: 'Desarrollador' });
    const app = crearServidor(db, { stripe: { cliente: stripeFalso, secretoWebhook: 'whsec', precioId: 'price_1' }, urlWeb: 'https://w.test' });
    const e = await app.inject({ method: 'GET', url: `/api/premium/estado/${v.clave}` });
    expect(e.statusCode).toBe(200);
    expect(e.json()).toEqual({ premium: true, estado: 'activa', renuevaEn: null, vitalicia: true });
    const p = await app.inject({
      method: 'POST',
      url: '/api/premium/portal',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ clave: v.clave }),
    });
    expect(p.statusCode).toBe(400);
    expect(p.json()).toEqual({ error: 'licencia_vitalicia' });
    await app.close();
    db.cerrar();
  });

  it('el estado de las licencias no depende de Stripe: una vitalicia funciona en un servidor sin Stripe', async () => {
    const db = abrirDb(':memory:');
    const v = crearRepoLicencias(db).crearVitalicia({ nota: 'Desarrollador' });
    const app = crearServidor(db);
    const e = await app.inject({ method: 'GET', url: `/api/premium/estado/${v.clave}` });
    expect(e.json()).toEqual({ premium: true, estado: 'activa', renuevaEn: null, vitalicia: true });
    expect((await app.inject({ method: 'GET', url: '/api/premium/estado/CLIA-X' })).statusCode).toBe(404);
    await app.close();
    db.cerrar();
  });
});

describe('herramienta crear-licencia', () => {
  it('crea una licencia vitalicia válida en la base indicada y devuelve la clave', () => {
    const ruta = rutaTemporal();
    const clave = crearLicenciaVitalicia(ruta, 'Licencia de desarrollador');
    expect(clave).toMatch(FORMATO);
    const db = abrirDb(ruta);
    expect(crearRepoLicencias(db).porClave(clave)).toMatchObject({ tipo: 'vitalicia', estado: 'activa', nota: 'Licencia de desarrollador' });
    db.cerrar();
  });

  it('lee --nota y --db; la base por defecto es RUTA_DB o ./coach.db; sin nota es un error', () => {
    expect(leerArgumentos(['--nota', 'Dev', '--db', 'x.db'], {})).toEqual({ nota: 'Dev', db: 'x.db' });
    expect(leerArgumentos(['--nota', 'Dev'], { RUTA_DB: '/datos/coach.db' })).toEqual({ nota: 'Dev', db: '/datos/coach.db' });
    expect(leerArgumentos(['--nota', 'Dev'], {})).toEqual({ nota: 'Dev', db: './coach.db' });
    expect(() => leerArgumentos([], {})).toThrow('--nota');
    expect(() => leerArgumentos(['--nota', '  '], {})).toThrow('--nota');
    expect(() => leerArgumentos(['--nota', 'Dev', '--db'], {})).toThrow('--db');
  });
});
