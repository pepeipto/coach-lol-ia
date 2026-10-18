import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';
import { crearRepoLicencias } from '../src/premium/licencias';
import type { ClienteStripe } from '../src/premium/stripe';

const SECRETO = 'whsec_falso';
const PERIODO = 1_800_000_000;
const URL_WEB = 'https://web.ejemplo.test/coach';

let sesiones: Record<string, { payment_status: string; customer: string | null; subscription: string | null }>;
let llamadasCheckout: { priceId: string; urlExito: string; urlCancelar: string }[];
let llamadasPortal: { customer: string; urlVuelta: string }[];

const stripe: ClienteStripe = {
  crearCheckout: async (o) => {
    llamadasCheckout.push(o);
    return { url: 'https://checkout.stripe.test/c1', id: 'cs_1' };
  },
  obtenerSesion: async (id) => {
    const s = sesiones[id];
    if (!s) throw new Error('sesión desconocida');
    return { id, status: 'complete', ...s };
  },
  obtenerSuscripcion: async (id) => ({ id, status: 'active', current_period_end: PERIODO }),
  crearPortal: async (o) => {
    llamadasPortal.push(o);
    return { url: 'https://portal.stripe.test/p1' };
  },
};

function firmado(evento: unknown, secreto = SECRETO) {
  const cuerpo = JSON.stringify(evento);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', secreto).update(`${t}.${cuerpo}`).digest('hex');
  return { cuerpo, cabecera: `t=${t},v1=${v1}` };
}

const eventoCompletado = {
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_1', customer: 'cus_1', subscription: 'sub_1' } },
};

describe('rutas de premium', () => {
  let db: Db;
  let app: FastifyInstance;

  const cuenta = () => (db.sql.prepare('SELECT COUNT(*) AS n FROM licencias').get() as { n: number }).n;
  const webhook = (w: { cuerpo: string; cabecera?: string }) =>
    app.inject({
      method: 'POST',
      url: '/api/stripe/webhook',
      headers: { 'content-type': 'application/json', ...(w.cabecera ? { 'stripe-signature': w.cabecera } : {}) },
      payload: w.cuerpo,
    });

  beforeEach(() => {
    sesiones = { cs_1: { payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1' } };
    llamadasCheckout = [];
    llamadasPortal = [];
    db = abrirDb(':memory:');
    app = crearServidor(db, { stripe: { cliente: stripe, secretoWebhook: SECRETO, precioId: 'price_1' }, urlWeb: URL_WEB });
  });
  afterEach(async () => {
    await app.close();
    db.cerrar();
  });

  it('POST /api/premium/checkout devuelve la URL de Stripe con las URL de la web', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/premium/checkout' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ url: 'https://checkout.stripe.test/c1' });
    expect(llamadasCheckout[0]).toEqual({
      priceId: 'price_1',
      urlExito: `${URL_WEB}/premium/gracias?session_id={CHECKOUT_SESSION_ID}`,
      urlCancelar: `${URL_WEB}/premium`,
    });
  });

  it('el checkout acepta content-type JSON con cuerpo vacío', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/premium/checkout', headers: { 'content-type': 'application/json' } });
    expect(r.statusCode).toBe(200);
  });

  it('licencia: pendiente si no está pagada, 400 sin session_id', async () => {
    sesiones.cs_2 = { payment_status: 'unpaid', customer: null, subscription: null };
    const r = await app.inject({ method: 'GET', url: '/api/premium/licencia?session_id=cs_2' });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ error: 'pendiente' });
    expect(cuenta()).toBe(0);
    expect((await app.inject({ method: 'GET', url: '/api/premium/licencia' })).statusCode).toBe(400);
  });

  it('licencia: se crea al consultar antes del webhook y es la misma que deja el webhook', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/premium/licencia?session_id=cs_1' });
    expect(r.statusCode).toBe(200);
    const { clave, estado } = r.json();
    expect(clave).toMatch(/^CLIA(-[A-HJ-NP-Z2-9]{4}){4}$/);
    expect(estado).toBe('activa');
    expect((await webhook(firmado(eventoCompletado))).statusCode).toBe(200);
    const otra = await app.inject({ method: 'GET', url: '/api/premium/licencia?session_id=cs_1' });
    expect(otra.json().clave).toBe(clave);
    expect(cuenta()).toBe(1);
  });

  it('estado: activo frente a cancelado, y 404 si es desconocida', async () => {
    const clave = (await app.inject({ method: 'GET', url: '/api/premium/licencia?session_id=cs_1' })).json().clave;
    const act = await app.inject({ method: 'GET', url: `/api/premium/estado/${clave}` });
    expect(act.json()).toEqual({ premium: true, estado: 'activa', renuevaEn: new Date(PERIODO * 1000).toISOString() });
    crearRepoLicencias(db).actualizarPorSuscripcion('sub_1', { estado: 'cancelada' });
    const can = await app.inject({ method: 'GET', url: `/api/premium/estado/${clave}` });
    expect(can.json()).toMatchObject({ premium: false, estado: 'cancelada' });
    const des = await app.inject({ method: 'GET', url: '/api/premium/estado/CLIA-AAAA-AAAA-AAAA-AAAA' });
    expect(des.statusCode).toBe(404);
    expect(des.json()).toEqual({ error: 'licencia_desconocida' });
  });

  it('portal: devuelve la URL o 404', async () => {
    const clave = (await app.inject({ method: 'GET', url: '/api/premium/licencia?session_id=cs_1' })).json().clave;
    const r = await app.inject({ method: 'POST', url: '/api/premium/portal', payload: { clave } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ url: 'https://portal.stripe.test/p1' });
    expect(llamadasPortal[0]).toEqual({ customer: 'cus_1', urlVuelta: `${URL_WEB}/premium` });
    const d = await app.inject({ method: 'POST', url: '/api/premium/portal', payload: { clave: 'CLIA-NADA' } });
    expect(d.statusCode).toBe(404);
    expect(d.json()).toEqual({ error: 'licencia_desconocida' });
  });

  it('webhook: firma inválida o ausente responde 400 sin cambiar nada', async () => {
    expect((await webhook(firmado(eventoCompletado, 'otro_secreto'))).statusCode).toBe(400);
    expect((await webhook({ cuerpo: JSON.stringify(eventoCompletado) })).statusCode).toBe(400);
    expect(cuenta()).toBe(0);
  });

  it('webhook: firma válida responde 200 {recibido:true}, y repetido no duplica', async () => {
    const w = firmado(eventoCompletado);
    const r = await webhook(w);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ recibido: true });
    await webhook(w);
    expect(cuenta()).toBe(1);
  });

  it('CORS: el origen de URL_WEB (solo esquema y host) en /api/premium/*', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/premium/estado/CLIA-X' });
    expect(r.headers['access-control-allow-origin']).toBe('https://web.ejemplo.test');
    const p = await app.inject({ method: 'OPTIONS', url: '/api/premium/checkout' });
    expect(p.statusCode).toBe(204);
    expect(p.headers['access-control-allow-origin']).toBe('https://web.ejemplo.test');
    expect(p.headers['access-control-allow-methods']).toContain('POST');
  });

  it('límite por IP: la petición 31 en un minuto responde 429', async () => {
    for (let i = 0; i < 30; i++) {
      const r = await app.inject({ method: 'GET', url: '/api/premium/estado/CLIA-X' });
      expect(r.statusCode).toBe(404);
    }
    const r = await app.inject({ method: 'GET', url: '/api/premium/estado/CLIA-X' });
    expect(r.statusCode).toBe(429);
    expect(r.json()).toEqual({ error: 'demasiadas_peticiones' });
  });
});

describe('sin Stripe configurado', () => {
  it('premium responde 503 y el resto sigue funcionando', async () => {
    const db = abrirDb(':memory:');
    const app = crearServidor(db);
    for (const [method, url] of [
      ['POST', '/api/premium/checkout'],
      ['GET', '/api/premium/licencia?session_id=x'],
      ['POST', '/api/premium/portal'],
      ['GET', '/api/premium/estado/CLIA-X'],
      ['POST', '/api/stripe/webhook'],
    ] as const) {
      const r = await app.inject({ method, url });
      expect(r.statusCode, `${method} ${url}`).toBe(503);
      expect(r.json()).toEqual({ error: 'premium_no_configurado' });
    }
    expect((await app.inject({ method: 'GET', url: '/salud' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/builds/Ahri/MIDDLE' })).statusCode).toBe(404);
    await app.close();
    db.cerrar();
  });
});
