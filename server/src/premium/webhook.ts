import { esIdPaquete, PLANES, type IdPaquete, type IdPlan } from '@coach/shared';
import type { Db } from '../db';
import { sumarPaquete } from './cuotas';
import type { EstadoLicencia, Licencia, RepoLicencias } from './licencias';
import type { ClienteStripe } from './stripe';

type PlanDePago = Exclude<IdPlan, 'gratis'>;

/**
 * Precios de Stripe. Una cadena es el precio único de antes de los planes (el plan Coach); con planes,
 * cada plan y cada paquete tiene su precio.
 */
export type PreciosStripe = string | { planes: Partial<Record<PlanDePago, string>>; paquetes?: Partial<Record<IdPaquete, string>> };

/** Plan de un precio de Stripe; null si no es de ninguno de nuestros planes. */
export function planDePrecio(precios: PreciosStripe, priceId: unknown): PlanDePago | null {
  if (typeof priceId !== 'string' || !priceId) return null;
  if (typeof precios === 'string') return priceId === precios ? 'coach' : null;
  for (const [plan, id] of Object.entries(precios.planes)) if (id === priceId) return plan as PlanDePago;
  return null;
}

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
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
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
  precios: PreciosStripe,
): Promise<Licencia | null> {
  const { id, customer, subscription } = sesion;
  if (!id || !customer || !subscription) return null;
  if (sesion.mode !== 'subscription' || sesion.payment_status !== 'paid') return null;
  const existente = repo.porSesion(id);
  if (existente) return existente;
  const sub = await stripe.obtenerSuscripcion(subscription);
  const plan = planDePrecio(precios, sub.priceId);
  if (!plan) return null;
  return repo.crearSiNoExiste({
    plan,
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
  precios: PreciosStripe,
  /** Base para sumar los paquetes de partidas; sin ella, los pagos de paquetes se ignoran. */
  db?: Db,
): Promise<void> {
  if (!evento || typeof evento.type !== 'string' || !evento.data || typeof evento.data.object !== 'object' || evento.data.object === null) {
    console.warn('[stripe] Evento con forma no válida; se ignora.');
    return;
  }
  const obj = evento.data.object;
  /**
   * Una suscripción conocida siempre se actualiza, cambie el precio que cambie (p. ej. un cambio de plan
   * en el portal). Si es desconocida: de nuestro precio, se lanza (500, Stripe reintenta tras el checkout);
   * de otro precio o sin precio, no es nuestra y se ignora con 200.
   */
  const actualizar = (
    sub: unknown,
    cambios: Parameters<RepoLicencias['actualizarPorSuscripcion']>[1],
    precio: unknown,
  ) => {
    if (typeof sub !== 'string' || !sub) return;
    // Un cambio de plan en el portal cambia el precio: la licencia pasa al plan nuevo.
    const plan = planDePrecio(precios, precio);
    if (repo.actualizarPorSuscripcion(sub, plan ? { ...cambios, plan } : cambios)) return;
    if (plan) throw new SuscripcionDesconocida(sub);
    console.warn('[stripe] Evento de una suscripción desconocida que no es de nuestro precio; se ignora.');
  };
  switch (evento.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      if (obj.mode === 'payment') {
        sumarPaqueteDeSesion(obj, repo, db);
        return;
      }
      await licenciaDesdeSesion(obj, repo, stripe, precios);
      return;
    case 'customer.subscription.updated': {
      if (!ESTADOS[obj.status]) return;
      const cambios: { estado: EstadoLicencia; renuevaEn?: string | null } = { estado: ESTADOS[obj.status]! };
      const renueva = aIso(obj.current_period_end);
      if (renueva) cambios.renuevaEn = renueva;
      actualizar(obj.id, cambios, obj.items?.data?.[0]?.price?.id);
      return;
    }
    case 'customer.subscription.deleted':
      actualizar(obj.id, { estado: 'cancelada' }, obj.items?.data?.[0]?.price?.id);
      return;
    case 'invoice.payment_failed': {
      // El precio de la factura cambia de sitio según la versión de la API: se usa solo la suscripción
      // (`subscription`, o `parent.subscription_details.subscription` en versiones nuevas).
      const sub = obj.subscription || obj.parent?.subscription_details?.subscription;
      if (typeof sub !== 'string' || !repo.actualizarPorSuscripcion(sub, { estado: 'impagada' })) {
        console.warn('[stripe] invoice.payment_failed sin licencia conocida; se ignora.');
      }
      return;
    }
    default:
      return;
  }
}

/**
 * Pago único de un paquete de partidas: suma las partidas a la licencia de `client_reference_id` si está
 * pagado, el paquete es válido y el plan de la licencia admite paquetes. Idempotente por sesión.
 */
export function sumarPaqueteDeSesion(sesion: SesionCheckout, repo: RepoLicencias, db: Db | undefined, ahora: number = Date.now()): boolean {
  const paquete = sesion.metadata?.paquete;
  const clave = sesion.client_reference_id;
  if (!db || !sesion.id || sesion.payment_status !== 'paid' || !esIdPaquete(paquete) || !clave) return false;
  const l = repo.porClave(clave);
  if (!l || !PLANES[l.plan].paquetes) {
    console.warn('[stripe] Pago de un paquete sin licencia válida; lo resuelve el soporte.');
    return false;
  }
  return sumarPaquete(db, { sesion: sesion.id, clave, paquete, ahora });
}
