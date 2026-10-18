import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { abrirDb, type Db } from '../src/db';
import { crearRepoLicencias, type RepoLicencias } from '../src/premium/licencias';
import type { ClienteStripe } from '../src/premium/stripe';
import { procesarEvento } from '../src/premium/webhook';

const PERIODO = 1_800_000_000;
const stripeFalso: ClienteStripe = {
  crearCheckout: async () => ({ url: '', id: '' }),
  obtenerSesion: async () => {
    throw new Error('no usado');
  },
  obtenerSuscripcion: async (id) => ({ id, status: 'active', current_period_end: PERIODO }),
  crearPortal: async () => ({ url: '' }),
};

const completado = {
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_1', customer: 'cus_1', subscription: 'sub_1' } },
};

describe('procesarEvento', () => {
  let db: Db;
  let repo: RepoLicencias;
  beforeEach(() => {
    db = abrirDb(':memory:');
    repo = crearRepoLicencias(db);
  });
  afterEach(() => db.cerrar());

  it('checkout.session.completed crea la licencia con la fecha de renovación', async () => {
    await procesarEvento(completado, repo, stripeFalso);
    const l = repo.porSesion('cs_1');
    expect(l?.estado).toBe('activa');
    expect(l?.stripeSubscription).toBe('sub_1');
    expect(l?.renuevaEn).toBe(new Date(PERIODO * 1000).toISOString());
  });

  it('un checkout.session.completed repetido no duplica la licencia', async () => {
    await procesarEvento(completado, repo, stripeFalso);
    const a = repo.porSesion('cs_1')!.clave;
    await procesarEvento(completado, repo, stripeFalso);
    expect(repo.porSesion('cs_1')!.clave).toBe(a);
    expect((db.sql.prepare('SELECT COUNT(*) AS n FROM licencias').get() as { n: number }).n).toBe(1);
  });

  it.each([
    ['active', 'activa'],
    ['trialing', 'activa'],
    ['past_due', 'impagada'],
    ['unpaid', 'impagada'],
    ['canceled', 'cancelada'],
    ['incomplete_expired', 'cancelada'],
  ])('customer.subscription.updated: %s -> %s', async (stripeEstado, esperado) => {
    await procesarEvento(completado, repo, stripeFalso);
    await procesarEvento(
      { type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: stripeEstado, current_period_end: PERIODO + 100 } } },
      repo,
      stripeFalso,
    );
    const l = repo.porSuscripcion('sub_1')!;
    expect(l.estado).toBe(esperado);
    expect(l.renuevaEn).toBe(new Date((PERIODO + 100) * 1000).toISOString());
  });

  it('customer.subscription.deleted cancela', async () => {
    await procesarEvento(completado, repo, stripeFalso);
    await procesarEvento({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } }, repo, stripeFalso);
    expect(repo.porSuscripcion('sub_1')?.estado).toBe('cancelada');
  });

  it('invoice.payment_failed marca impagada', async () => {
    await procesarEvento(completado, repo, stripeFalso);
    await procesarEvento({ type: 'invoice.payment_failed', data: { object: { subscription: 'sub_1' } } }, repo, stripeFalso);
    expect(repo.porSuscripcion('sub_1')?.estado).toBe('impagada');
  });

  it('una suscripción desconocida o un tipo ignorado no lanzan error', async () => {
    await expect(
      procesarEvento({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_x' } } }, repo, stripeFalso),
    ).resolves.toBeUndefined();
    await expect(
      procesarEvento({ type: 'invoice.payment_failed', data: { object: { subscription: 'sub_x' } } }, repo, stripeFalso),
    ).resolves.toBeUndefined();
    await expect(procesarEvento({ type: 'otra.cosa', data: { object: {} } }, repo, stripeFalso)).resolves.toBeUndefined();
  });
});
