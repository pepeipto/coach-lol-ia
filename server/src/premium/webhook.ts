import type { EstadoLicencia, Licencia, RepoLicencias } from './licencias';
import type { ClienteStripe } from './stripe';

const ESTADOS: Record<string, EstadoLicencia> = {
  active: 'activa',
  trialing: 'activa',
  past_due: 'impagada',
  unpaid: 'impagada',
  canceled: 'cancelada',
  incomplete_expired: 'cancelada',
};

/** Estado de licencia para un estado de suscripción de Stripe (los desconocidos no dan premium). */
export const estadoDeStripe = (status: string): EstadoLicencia => ESTADOS[status] ?? 'impagada';

const aIso = (segundos: unknown): string | null =>
  typeof segundos === 'number' ? new Date(segundos * 1000).toISOString() : null;

/**
 * Una suscripción de nuestro precio aún no está en la base (el evento llegó antes que
 * checkout.session.completed): se responde 500 para que Stripe reintente.
 */
export class SuscripcionDesconocida extends Error {
  constructor(sub: string) {
    super(`Suscripción desconocida: ${sub}`);
  }
}

export interface SesionCheckout {
  id?: string;
  mode?: string;
  payment_status?: string;
  customer?: string | null;
  subscription?: string | null;
}

/**
 * Crea (de forma idempotente) la licencia de una sesión de Checkout, solo si es una suscripción pagada
 * de nuestro precio. Devuelve null si la sesión no cumple (pendiente o ajena). Compartida por el webhook
 * y por `GET /api/premium/licencia`, para que ambos produzcan la misma licencia.
 */
export async function licenciaDesdeSesion(
  sesion: SesionCheckout,
  repo: RepoLicencias,
  stripe: ClienteStripe,
  precioId: string,
): Promise<Licencia | null> {
  const { id, customer, subscription } = sesion;
  if (!id || !customer || !subscription) return null;
  if (sesion.mode !== 'subscription' || sesion.payment_status !== 'paid') return null;
  const existente = repo.porSesion(id);
  if (existente) return existente;
  const sub = await stripe.obtenerSuscripcion(subscription);
  if (sub.priceId !== precioId) return null;
  return repo.crearSiNoExiste({
    checkoutSession: id,
    stripeCustomer: customer,
    stripeSubscription: subscription,
    renuevaEn: aIso(sub.current_period_end),
    estado: estadoDeStripe(sub.status),
  });
}

/** Aplica un evento ya verificado de Stripe a las licencias. Es idempotente. */
export async function procesarEvento(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evento: { type: string; data: { object: any } },
  repo: RepoLicencias,
  stripe: ClienteStripe,
  precioId: string,
): Promise<void> {
  if (!evento || typeof evento.type !== 'string' || !evento.data || typeof evento.data.object !== 'object' || evento.data.object === null) {
    console.warn('[stripe] Evento con forma no válida; se ignora.');
    return;
  }
  const obj = evento.data.object;
  const actualizar = (sub: unknown, cambios: Parameters<RepoLicencias['actualizarPorSuscripcion']>[1]) => {
    if (typeof sub !== 'string' || !sub) return;
    if (!repo.actualizarPorSuscripcion(sub, cambios)) throw new SuscripcionDesconocida(sub);
  };
  // Suscripciones de otro precio o producto de la misma cuenta de Stripe: no son nuestras, se ignoran con 200.
  const ajena = (precio: unknown) => {
    if (precio === precioId) return false;
    console.warn('[stripe] Evento de una suscripción que no es de nuestro precio; se ignora.');
    return true;
  };
  switch (evento.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await licenciaDesdeSesion(obj, repo, stripe, precioId);
      return;
    case 'customer.subscription.updated': {
      if (ajena(obj.items?.data?.[0]?.price?.id) || !ESTADOS[obj.status]) return;
      const cambios: { estado: EstadoLicencia; renuevaEn?: string | null } = { estado: ESTADOS[obj.status]! };
      const renueva = aIso(obj.current_period_end);
      if (renueva) cambios.renuevaEn = renueva;
      actualizar(obj.id, cambios);
      return;
    }
    case 'customer.subscription.deleted':
      if (ajena(obj.items?.data?.[0]?.price?.id)) return;
      actualizar(obj.id, { estado: 'cancelada' });
      return;
    case 'invoice.payment_failed': {
      // El precio de la factura cambia de sitio según la versión de la API: se usa solo la suscripción
      // (`subscription`, o `parent.subscription_details.subscription` en versiones nuevas).
      const sub = obj.subscription ?? obj.parent?.subscription_details?.subscription;
      if (typeof sub !== 'string' || !repo.actualizarPorSuscripcion(sub, { estado: 'impagada' })) {
        console.warn('[stripe] invoice.payment_failed sin licencia conocida; se ignora.');
      }
      return;
    }
    default:
      return;
  }
}
