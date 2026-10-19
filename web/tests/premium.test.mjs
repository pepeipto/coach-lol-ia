// Lógica de cliente de Premium (src/scripts/premium.ts), probada con fetch simulado.
// Node 24 ejecuta TypeScript directamente (eliminación de tipos), sin compilar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearCheckout,
  esperarLicencia,
  abrirPortal,
  pedirPrueba,
  claveValida,
  normalizarClave,
  MENSAJES,
} from '../src/scripts/premium.ts';

const API = 'http://servidor.test';
const respuesta = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });

test('checkout: devuelve la URL de Stripe', async () => {
  const llamadas = [];
  const fetch = async (url, init) => {
    llamadas.push([url, init]);
    return respuesta(200, { url: 'https://checkout.stripe.com/x' });
  };
  const r = await crearCheckout(API, fetch);
  assert.deepEqual(r, { ok: true, url: 'https://checkout.stripe.com/x' });
  assert.equal(llamadas[0][0], 'http://servidor.test/api/premium/checkout');
  assert.equal(llamadas[0][1].method, 'POST');
});

test('checkout: 503 premium_no_configurado → suscripciones no disponibles', async () => {
  const fetch = async () => respuesta(503, { error: 'premium_no_configurado' });
  assert.deepEqual(await crearCheckout(API, fetch), { ok: false, error: MENSAJES.noDisponible });
  assert.equal(MENSAJES.noDisponible, 'Las suscripciones aún no están disponibles');
});

test('checkout: error de red → mensaje de conexión', async () => {
  const fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  assert.deepEqual(await crearCheckout(API, fetch), { ok: false, error: MENSAJES.sinConexion });
});

test('checkout: respuesta sin url → error genérico', async () => {
  const fetch = async () => respuesta(200, {});
  assert.deepEqual(await crearCheckout(API, fetch), { ok: false, error: MENSAJES.inesperado });
});

test('licencia: reintenta cada 2 s mientras esté pendiente', async () => {
  let n = 0;
  const esperas = [];
  const fetch = async (url) => {
    assert.equal(url, 'http://servidor.test/api/premium/licencia?session_id=cs_test_%2F1');
    n++;
    return n < 3
      ? respuesta(404, { error: 'pendiente' })
      : respuesta(200, { clave: 'CLIA-AAAA-BBBB-CCCC-DDDD', estado: 'activa' });
  };
  const r = await esperarLicencia(API, 'cs_test_/1', { fetch, esperar: async (ms) => esperas.push(ms) });
  assert.deepEqual(r, { ok: true, clave: 'CLIA-AAAA-BBBB-CCCC-DDDD', estado: 'activa' });
  assert.deepEqual(esperas, [2000, 2000]);
});

test('licencia: se rinde a los 30 s', async () => {
  let reloj = 0;
  let intentos = 0;
  const fetch = async () => {
    intentos++;
    return respuesta(404, { error: 'pendiente' });
  };
  const r = await esperarLicencia(API, 'cs_x', {
    fetch,
    esperar: async (ms) => {
      reloj += ms;
    },
    ahora: () => reloj,
  });
  assert.deepEqual(r, { ok: false, error: MENSAJES.tiempoAgotado, pendiente: true });
  assert.ok(intentos >= 15 && intentos <= 16, `intentos: ${intentos}`);
  assert.ok(reloj <= 30000, `reloj: ${reloj}`);
});

test('licencia: sin session_id no llama al servidor', async () => {
  const fetch = async () => assert.fail('no debe llamar');
  assert.deepEqual(await esperarLicencia(API, '', { fetch }), { ok: false, error: MENSAJES.sinSesion });
});

test('licencia: 503 → no disponible', async () => {
  const fetch = async () => respuesta(503, { error: 'premium_no_configurado' });
  assert.deepEqual(await esperarLicencia(API, 'cs_x', { fetch, esperar: async () => {} }), {
    ok: false,
    error: MENSAJES.noDisponible,
  });
});

test('licencia: un fallo de red puntual se reintenta', async () => {
  let n = 0;
  const fetch = async () => {
    n++;
    if (n === 1) throw new TypeError('Failed to fetch');
    return respuesta(200, { clave: 'CLIA-AAAA-BBBB-CCCC-DDDD', estado: 'activa' });
  };
  const r = await esperarLicencia(API, 'cs_x', { fetch, esperar: async () => {} });
  assert.equal(r.ok, true);
});

test('portal: envía la clave y devuelve la URL', async () => {
  let cuerpo;
  const fetch = async (url, init) => {
    assert.equal(url, 'http://servidor.test/api/premium/portal');
    assert.equal(init.method, 'POST');
    cuerpo = JSON.parse(init.body);
    return respuesta(200, { url: 'https://billing.stripe.com/p' });
  };
  assert.deepEqual(await abrirPortal(API, 'CLIA-AAAA-BBBB-CCCC-DDDD', fetch), {
    ok: true,
    url: 'https://billing.stripe.com/p',
  });
  assert.deepEqual(cuerpo, { clave: 'CLIA-AAAA-BBBB-CCCC-DDDD' });
});

test('portal: licencia desconocida', async () => {
  const fetch = async () => respuesta(404, { error: 'licencia_desconocida' });
  assert.deepEqual(await abrirPortal(API, 'CLIA-AAAA-BBBB-CCCC-DDDD', fetch), {
    ok: false,
    error: MENSAJES.licenciaDesconocida,
  });
});

test('portal: 503 → no disponible', async () => {
  const fetch = async () => respuesta(503, { error: 'premium_no_configurado' });
  assert.deepEqual(await abrirPortal(API, 'CLIA-AAAA-BBBB-CCCC-DDDD', fetch), {
    ok: false,
    error: MENSAJES.noDisponible,
  });
});

test('claves: formato CLIA con el alfabeto sin caracteres ambiguos', () => {
  assert.equal(normalizarClave('  clia-abcd-efgh-jkmn-2345 '), 'CLIA-ABCD-EFGH-JKMN-2345');
  assert.ok(claveValida('CLIA-ABCD-EFGH-JKMN-2345'));
  assert.ok(!claveValida('CLIA-ABCD-EFGH-JKMN-234'));
  assert.ok(!claveValida('CLIA-ABCD-EFGH-JKMN-2340'), 'el 0 no está en el alfabeto');
  assert.ok(!claveValida('CLIA-IBCD-EFGH-JKMN-2345'), 'la I no está en el alfabeto');
  assert.ok(!claveValida('CLIA-OBCD-EFGH-JKMN-2345'), 'la O no está en el alfabeto');
  assert.ok(!claveValida('XLIA-ABCD-EFGH-JKMN-2345'));
});

test('solo se redirige a URLs https', async () => {
  const fetch = async () => respuesta(200, { url: 'http://evil.test/x' });
  assert.deepEqual(await crearCheckout(API, fetch), { ok: false, error: MENSAJES.inesperado });
  assert.deepEqual(await abrirPortal(API, 'CLIA-AAAA-BBBB-CCCC-DDDD', fetch), { ok: false, error: MENSAJES.inesperado });
  const raro = async () => respuesta(200, { url: 'javascript:alert(1)' });
  assert.deepEqual(await crearCheckout(API, raro), { ok: false, error: MENSAJES.inesperado });
});

test('prueba: POST sin cuerpo ni cabeceras (petición CORS simple) → clave y caducidad', async () => {
  const llamadas = [];
  const fetch = async (url, init) => {
    llamadas.push([url, init]);
    return respuesta(200, { clave: 'CLIA-AAAA-BBBB-CCCC-DDDD', caducaEn: '2026-10-20T12:00:00.000Z' });
  };
  const r = await pedirPrueba(API + '/', fetch);
  assert.deepEqual(r, { ok: true, clave: 'CLIA-AAAA-BBBB-CCCC-DDDD', caducaEn: '2026-10-20T12:00:00.000Z' });
  assert.equal(llamadas[0][0], 'http://servidor.test/api/premium/prueba');
  assert.deepEqual(llamadas[0][1], { method: 'POST' });
});

test('prueba: 429 prueba_ya_solicitada → mensaje de los 30 días', async () => {
  const fetch = async () => respuesta(429, { error: 'prueba_ya_solicitada' });
  assert.deepEqual(await pedirPrueba(API, fetch), { ok: false, error: MENSAJES.pruebaYaSolicitada });
  assert.equal(MENSAJES.pruebaYaSolicitada, 'Ya pediste una prueba desde esta conexión en los últimos 30 días.');
});

test('prueba: 503, red o respuesta rara → mensajes genéricos', async () => {
  assert.deepEqual(await pedirPrueba(API, async () => respuesta(503, { error: 'premium_no_configurado' })), { ok: false, error: MENSAJES.inesperado });
  assert.deepEqual(await pedirPrueba(API, async () => { throw new TypeError('Failed to fetch'); }), { ok: false, error: MENSAJES.sinConexion });
  assert.deepEqual(await pedirPrueba(API, async () => respuesta(200, { clave: 'x' })), { ok: false, error: MENSAJES.inesperado });
});

test('portal: las licencias vitalicias y de prueba no tienen suscripción que gestionar', async () => {
  assert.deepEqual(await abrirPortal(API, 'CLIA-AAAA-BBBB-CCCC-DDDD', async () => respuesta(400, { error: 'licencia_vitalicia' })), {
    ok: false,
    error: MENSAJES.licenciaVitalicia,
  });
  assert.deepEqual(await abrirPortal(API, 'CLIA-AAAA-BBBB-CCCC-DDDD', async () => respuesta(400, { error: 'licencia_prueba' })), {
    ok: false,
    error: MENSAJES.licenciaPrueba,
  });
});

test('portal: una suscripción sin cliente de Stripe (409) remite al soporte', async () => {
  const r = await abrirPortal(API, 'CLIA-AAAA-BBBB-CCCC-DDDD', async () => respuesta(409, { error: 'sin_cliente_stripe' }));
  assert.deepEqual(r, { ok: false, error: MENSAJES.sinClienteStripe });
  assert.match(MENSAJES.sinClienteStripe, /support@coachlolia.com/);
});
