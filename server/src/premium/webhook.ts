import type { EstadoLicencia, RepoLicencias } from './licencias';
import type { ClienteStripe } from './stripe';

const ESTADOS: Record<string, EstadoLicencia> = {
  active: 'activa',
  trialing: 'activa',
  past_due: 'impagada',
  unpaid: 'impagada',
  canceled: 'cancelada',
  incomplete_expired: 'cancelada',
};

const aIso = (segundos: unknown): string | null =>
  typeof segundos === 'number' ? new Date(segundos * 1000).toISOString() : null;

/** Aplica un evento ya verificado de Stripe a las licencias. Es idempotente. */
export async function procesarEvento(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evento: { type: string; data: { object: any } },
  repo: RepoLicencias,
  stripe: ClienteStripe,
): Promise<void> {
  const obj = evento.data.object;
  switch (evento.type) {
    case 'checkout.session.completed': {
      if (!obj.id || !obj.customer) return;
      const sub: string | null = obj.subscription ?? null;
      const renuevaEn = sub ? aIso((await stripe.obtenerSuscripcion(sub)).current_period_end) : null;
      repo.crearSiNoExiste({ checkoutSession: obj.id, stripeCustomer: obj.customer, stripeSubscription: sub, renuevaEn });
      return;
    }
    case 'customer.subscription.updated': {
      const estado = ESTADOS[obj.status];
      if (!obj.id || !estado) return;
      const cambios: { estado: EstadoLicencia; renuevaEn?: string | null } = { estado };
      const renueva = aIso(obj.current_period_end);
      if (renueva) cambios.renuevaEn = renueva;
      repo.actualizarPorSuscripcion(obj.id, cambios);
      return;
    }
    case 'customer.subscription.deleted':
      if (obj.id) repo.actualizarPorSuscripcion(obj.id, { estado: 'cancelada' });
      return;
    case 'invoice.payment_failed':
      if (obj.subscription) repo.actualizarPorSuscripcion(obj.subscription, { estado: 'impagada' });
      return;
    default:
      return;
  }
}
