import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';
import { crearRepoLicencias } from '../src/premium/licencias';
import type { ClienteStripe } from '../src/premium/stripe';

const SECRETO = 'whsec_falso';
const PERIODO = 1_800_000_000;
const URL_WEB = 'https://web.ejemplo.test/coach';

let sesiones: Record<string, { mode?: string; payment_status: string; customer: string | null; subscription: string | null }>;
let precioSub: string | null;
let fallaStripe: boolean;
let llamadasCheckout: { priceId: string; urlExito: string; urlCancelar: string }[];
let llamadasPortal: { customer: string; urlVuelta: string }[];

const stripe: ClienteStripe = {
  crearCheckout: async (o) => {
    if (fallaStripe) throw new Error('Stripe respondió con el estado 401 en POST /checkout/sessions');
    llamadasCheckout.push(o);
    return { url: 'https://checkout.stripe.test/c1', id: 'cs_1' };
  },
  obtenerSesion: async (id) => {
    const s = sesiones[id];
    if (!s) throw new Error('sesión desconocida');
    return { id, status: 'complete', ...s, mode: s.mode ?? 'subscription' };
  },
  obtenerSuscripcion: async (id) => ({ id, status: 'active', current_period_end: PERIODO, priceId: precioSub }),
  crearPortal: async (o) => {
    if (fallaStripe) throw new Error('Stripe respondió con el estado 401 en POST /billing_portal/sessions');
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
  data: { object: { id: 'cs_1', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1' } },
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
    precioSub = 'price_1';
    fallaStripe = false;
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

  it('checkout y portal: un fallo de Stripe da 502 genérico sin filtrar detalles', async () => {
    const clave = (await app.inject({ method: 'GET', url: '/api/premium/licencia?session_id=cs_1' })).json().clave;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    fallaStripe = true;
    for (const r of [
      await app.inject({ method: 'POST', url: '/api/premium/checkout' }),
      await app.inject({ method: 'POST', url: '/api/premium/portal', payload: { clave } }),
    ]) {
      expect(r.statusCode).toBe(502);
      expect(r.json()).toEqual({ error: 'stripe_no_disponible' });
      expect(r.body).not.toContain('401');
    }
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it('licencia: no se concede si no es suscripción pagada de nuestro precio', async () => {
    sesiones.cs_p = { mode: 'payment', payment_status: 'paid', customer: 'cus_p', subscription: 'sub_p' };
    sesiones.cs_s = { payment_status: 'paid', customer: 'cus_s', subscription: 'sub_s' };
    precioSub = 'price_ajeno';
    for (const id of ['cs_p', 'cs_s']) {
      const r = await app.inject({ method: 'GET', url: `/api/premium/licencia?session_id=${id}` });
      expect(r.statusCode).toBe(404);
      expect(r.json()).toEqual({ error: 'pendiente' });
    }
    expect(cuenta()).toBe(0);
  });

  it('webhook: un cuerpo no canónico (espacios, saltos y no ASCII) firmado byte a byte da 200', async () => {
    const cuerpo =
      '  {\n "type" : "checkout.session.completed",\n\t"data":{ "object": { "id":"cs_1","mode":"subscription","payment_status":"paid",\n "customer":"cus_1", "subscription":"sub_1", "nota":"Ñandú" } } }  \n';
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', SECRETO).update(`${t}.`).update(Buffer.from(cuerpo, 'utf8')).digest('hex');
    const r = await webhook({ cuerpo, cabecera: `t=${t},v1=${v1}` });
    expect(r.statusCode).toBe(200);
    expect(cuenta()).toBe(1);
  });

  it('webhook: un evento de suscripción desconocida responde 500 para que Stripe reintente', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await webhook(firmado({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_zzz', items: { data: [{ price: { id: 'price_1' } }] } } } }));
    expect(r.statusCode).toBe(500);
    log.mockRestore();
  });

  it('webhook: una suscripción desconocida de otro precio responde 200 (no es nuestra)', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await webhook(firmado({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_zzz', items: { data: [{ price: { id: 'price_otro' } }] } } } }));
    expect(r.statusCode).toBe(200);
    aviso.mockRestore();
  });

  it('webhook: un evento sin data.object responde 200 (no se reintenta)', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await webhook(firmado({ type: 'customer.subscription.deleted' }))).statusCode).toBe(200);
    aviso.mockRestore();
  });

  it('trustProxy: con él, el límite es por cliente (X-Forwarded-For); sin él, por IP del socket', async () => {
    const dbp = abrirDb(':memory:');
    const cfg = { stripe: { cliente: stripe, secretoWebhook: SECRETO, precioId: 'price_1' }, urlWeb: URL_WEB };
    const con = crearServidor(dbp, { ...cfg, trustProxy: true });
    const pide = (a: FastifyInstance, ip: string) =>
      a.inject({ method: 'GET', url: '/api/premium/estado/CLIA-X', headers: { 'x-forwarded-for': ip } });
    for (let i = 0; i < 30; i++) await pide(con, '1.1.1.1');
    expect((await pide(con, '1.1.1.1')).statusCode).toBe(429);
    expect((await pide(con, '2.2.2.2')).statusCode).toBe(404);
    await con.close();
    const sin = crearServidor(dbp, cfg);
    for (let i = 0; i < 30; i++) await pide(sin, `10.0.0.${i}`);
    expect((await pide(sin, '10.9.9.9')).statusCode).toBe(429);
    await sin.close();
    dbp.cerrar();
  });

  it('CORS: el origen de URL_WEB (solo esquema y host) en /api/premium/*', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/premium/estado/CLIA-X' });
    expect(r.headers['access-control-allow-origin']).toBe('https://web.ejemplo.test');
    const p = await app.inject({ method: 'OPTIONS', url: '/api/premium/checkout' });
    expect(p.statusCode).toBe(204);
    expect(p.headers['access-control-allow-origin']).toBe('https://web.ejemplo.test');
    expect(p.headers['access-control-allow-methods']).toContain('POST');
  });

  it('CORS: el preflight de POST /api/premium/portal permite content-type y el POST lleva el origen', async () => {
    const p = await app.inject({
      method: 'OPTIONS',
      url: '/api/premium/portal',
      headers: { origin: 'https://web.ejemplo.test', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' },
    });
    expect(p.statusCode).toBe(204);
    expect(p.headers['access-control-allow-origin']).toBe('https://web.ejemplo.test');
    expect(String(p.headers['access-control-allow-methods'])).toContain('POST');
    const permitidas = String(p.headers['access-control-allow-headers']).toLowerCase().split(/\s*,\s*/);
    expect(permitidas).toContain('content-type');
    const r = await app.inject({
      method: 'POST',
      url: '/api/premium/portal',
      headers: { origin: 'https://web.ejemplo.test', 'content-type': 'application/json' },
      payload: JSON.stringify({ clave: 'CLIA-AAAA-AAAA-AAAA-AAAA' }),
    });
    expect(r.statusCode).toBe(404);
    expect(r.headers['access-control-allow-origin']).toBe('https://web.ejemplo.test');
  });

  it('sin URL_WEB explícita, el CORS usa el dominio de la web https://www.coachlolia.com', async () => {
    const dbd = abrirDb(':memory:');
    const porDefecto = crearServidor(dbd, { stripe: { cliente: stripe, secretoWebhook: SECRETO, precioId: 'price_1' } });
    const r = await porDefecto.inject({ method: 'OPTIONS', url: '/api/premium/portal' });
    expect(r.headers['access-control-allow-origin']).toBe('https://www.coachlolia.com');
    const c = await porDefecto.inject({ method: 'POST', url: '/api/premium/checkout' });
    expect(c.json()).toEqual({ url: 'https://checkout.stripe.test/c1' });
    expect(llamadasCheckout.at(-1)).toMatchObject({
      urlExito: 'https://www.coachlolia.com/premium/gracias?session_id={CHECKOUT_SESSION_ID}',
      urlCancelar: 'https://www.coachlolia.com/premium',
    });
    await porDefecto.close();
    dbd.cerrar();
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
