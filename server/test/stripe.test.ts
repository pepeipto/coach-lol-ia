import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { crearClienteStripe, verificarFirmaWebhook } from '../src/premium/stripe';

function fetchFalso(respuesta: unknown, estado = 200) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return new Response(JSON.stringify(respuesta), { status: estado });
  }) as unknown as typeof fetch;
  return { f, llamadas };
}

describe('clienteStripe', () => {
  it('crearCheckout envía el cuerpo form-urlencoded con Bearer', async () => {
    const { f, llamadas } = fetchFalso({ url: 'https://checkout/x', id: 'cs_1' });
    const c = crearClienteStripe({ clave: 'sk_test_falsa', fetch: f });
    const r = await c.crearCheckout({ priceId: 'price_1', urlExito: 'https://w/ok?session_id={CHECKOUT_SESSION_ID}', urlCancelar: 'https://w/premium' });
    expect(r).toEqual({ url: 'https://checkout/x', id: 'cs_1' });
    const { url, init } = llamadas[0]!;
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(init.method).toBe('POST');
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer sk_test_falsa');
    expect(h['Content-Type']).toBe('application/x-www-form-urlencoded');
    const p = new URLSearchParams(init.body as string);
    expect(p.get('mode')).toBe('subscription');
    expect(p.get('line_items[0][price]')).toBe('price_1');
    expect(p.get('line_items[0][quantity]')).toBe('1');
    expect(p.get('success_url')).toBe('https://w/ok?session_id={CHECKOUT_SESSION_ID}');
    expect(p.get('cancel_url')).toBe('https://w/premium');
  });

  it('obtenerSesion, obtenerSuscripcion y crearPortal usan GET/POST correctos', async () => {
    const { f, llamadas } = fetchFalso({ id: 'x', url: 'https://portal' });
    const c = crearClienteStripe({ clave: 'k', fetch: f });
    await c.obtenerSesion('cs_9');
    await c.obtenerSuscripcion('sub_9');
    await c.crearPortal({ customer: 'cus_9', urlVuelta: 'https://w/premium' });
    expect(llamadas[0]!.url).toBe('https://api.stripe.com/v1/checkout/sessions/cs_9');
    expect(llamadas[0]!.init.method).toBe('GET');
    expect(llamadas[1]!.url).toBe('https://api.stripe.com/v1/subscriptions/sub_9');
    expect(llamadas[2]!.url).toBe('https://api.stripe.com/v1/billing_portal/sessions');
    const p = new URLSearchParams(llamadas[2]!.init.body as string);
    expect(p.get('customer')).toBe('cus_9');
    expect(p.get('return_url')).toBe('https://w/premium');
  });

  it('obtenerSuscripcion extrae el precio del primer ítem', async () => {
    const { f } = fetchFalso({ id: 'sub_1', status: 'active', current_period_end: 5, items: { data: [{ price: { id: 'price_7' } }] } });
    expect(await crearClienteStripe({ clave: 'k', fetch: f }).obtenerSuscripcion('sub_1')).toEqual({ id: 'sub_1', status: 'active', current_period_end: 5, priceId: 'price_7' });
  });

  it('un error de Stripe lanza una excepción', async () => {
    const { f } = fetchFalso({ error: { message: 'no' } }, 400);
    await expect(crearClienteStripe({ clave: 'k', fetch: f }).obtenerSesion('x')).rejects.toThrow(/Stripe/);
  });
});

describe('verificarFirmaWebhook', () => {
  const secreto = 'whsec_falso';
  const cuerpo = '{"id":"evt_1"}';
  const ahora = 1_800_000_000;
  const firmar = (t: number, c = cuerpo, s = secreto) => createHmac('sha256', s).update(`${t}.${c}`).digest('hex');

  it('acepta una firma correcta', () => {
    expect(verificarFirmaWebhook(cuerpo, `t=${ahora},v1=${firmar(ahora)}`, secreto, ahora)).toBe(true);
  });
  it('acepta si alguna de varias v1 es válida', () => {
    expect(verificarFirmaWebhook(cuerpo, `t=${ahora},v1=${'0'.repeat(64)},v1=${firmar(ahora)}`, secreto, ahora)).toBe(true);
  });
  it('rechaza un cuerpo alterado', () => {
    expect(verificarFirmaWebhook(cuerpo + ' ', `t=${ahora},v1=${firmar(ahora)}`, secreto, ahora)).toBe(false);
  });
  it('rechaza la firma de otro secreto', () => {
    expect(verificarFirmaWebhook(cuerpo, `t=${ahora},v1=${firmar(ahora, cuerpo, 'otro')}`, secreto, ahora)).toBe(false);
  });
  it('rechaza un timestamp con más de 300 s', () => {
    const t = ahora - 301;
    expect(verificarFirmaWebhook(cuerpo, `t=${t},v1=${firmar(t)}`, secreto, ahora)).toBe(false);
    const t2 = ahora - 299;
    expect(verificarFirmaWebhook(cuerpo, `t=${t2},v1=${firmar(t2)}`, secreto, ahora)).toBe(true);
  });
  it('acepta un Buffer y firma los bytes exactos', () => {
    const buf = Buffer.from('{ "n": "Ñandú" }\n', 'utf8');
    const v1 = createHmac('sha256', secreto).update(`${ahora}.`).update(buf).digest('hex');
    expect(verificarFirmaWebhook(buf, `t=${ahora},v1=${v1}`, secreto, ahora)).toBe(true);
  });
  it('rechaza cabeceras ausentes o mal formadas', () => {
    expect(verificarFirmaWebhook(cuerpo, undefined, secreto, ahora)).toBe(false);
    expect(verificarFirmaWebhook(cuerpo, '', secreto, ahora)).toBe(false);
    expect(verificarFirmaWebhook(cuerpo, 'basura', secreto, ahora)).toBe(false);
    expect(verificarFirmaWebhook(cuerpo, `t=${ahora},v1=zz`, secreto, ahora)).toBe(false);
  });

  it('las llamadas a Stripe llevan un tiempo máximo (señal de cancelación)', async () => {
    const { f, llamadas } = fetchFalso({ id: 'cs_1', url: 'https://x' });
    await crearClienteStripe({ clave: 'sk_test_falsa', fetch: f }).obtenerSesion('cs_1');
    expect(llamadas[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });
});
