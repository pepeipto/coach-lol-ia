import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ClienteStripe {
  crearCheckout(o: { priceId: string; urlExito: string; urlCancelar: string }): Promise<{ url: string; id: string }>;
  obtenerSesion(id: string): Promise<{
    id: string;
    mode: string;
    status: string;
    payment_status: string;
    customer: string | null;
    subscription: string | null;
  }>;
  /** `priceId` es el precio del primer ítem de la suscripción (null si no viene). */
  obtenerSuscripcion(id: string): Promise<{ id: string; status: string; current_period_end: number; priceId: string | null }>;
  crearPortal(o: { customer: string; urlVuelta: string }): Promise<{ url: string }>;
}

const BASE = 'https://api.stripe.com/v1';

/** Cliente mínimo de la API REST de Stripe (sin SDK): form-urlencoded y autenticación Bearer. */
export function crearClienteStripe(o: { clave: string; fetch?: typeof fetch }): ClienteStripe {
  const f = o.fetch ?? fetch;

  async function llamar<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: Record<string, string>): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${o.clave}` };
    const init: RequestInit = { method: metodo, headers };
    if (cuerpo) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      init.body = new URLSearchParams(cuerpo).toString();
    }
    const r = await f(`${BASE}${ruta}`, init);
    if (!r.ok) throw new Error(`Stripe respondió con el estado ${r.status} en ${metodo} ${ruta}.`);
    return (await r.json()) as T;
  }

  return {
    crearCheckout: (p) =>
      llamar('POST', '/checkout/sessions', {
        mode: 'subscription',
        'line_items[0][price]': p.priceId,
        'line_items[0][quantity]': '1',
        success_url: p.urlExito,
        cancel_url: p.urlCancelar,
      }),
    obtenerSesion: (id) => llamar('GET', `/checkout/sessions/${encodeURIComponent(id)}`),
    obtenerSuscripcion: async (id) => {
      const s = await llamar<{
        id: string;
        status: string;
        current_period_end: number;
        items?: { data?: { price?: { id?: string } }[] };
      }>('GET', `/subscriptions/${encodeURIComponent(id)}`);
      return { id: s.id, status: s.status, current_period_end: s.current_period_end, priceId: s.items?.data?.[0]?.price?.id ?? null };
    },
    crearPortal: (p) => llamar('POST', '/billing_portal/sessions', { customer: p.customer, return_url: p.urlVuelta }),
  };
}

const TOLERANCIA_S = 300;

/**
 * Verifica la cabecera `Stripe-Signature` (`t=<unix>,v1=<hmac>[,v1=...]`): HMAC-SHA256 de
 * `${t}.${cuerpo}` con el secreto del webhook y tolerancia de 300 s.
 */
export function verificarFirmaWebhook(
  cuerpo: string | Buffer,
  cabecera: string | undefined,
  secreto: string,
  ahora: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!cabecera || !secreto) return false;
  let t: string | undefined;
  const firmas: string[] = [];
  for (const parte of cabecera.split(',')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const k = parte.slice(0, i).trim();
    const v = parte.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') firmas.push(v);
  }
  if (!t || !/^\d+$/.test(t) || firmas.length === 0) return false;
  if (Math.abs(ahora - Number(t)) > TOLERANCIA_S) return false;
  // HMAC sobre los bytes exactos recibidos: `${t}.` seguido del cuerpo.
  const esperada = createHmac('sha256', secreto).update(`${t}.`).update(cuerpo).digest();
  return firmas.some((fm) => {
    if (!/^[0-9a-f]{64}$/i.test(fm)) return false;
    const b = Buffer.from(fm, 'hex');
    return b.length === esperada.length && timingSafeEqual(b, esperada);
  });
}
