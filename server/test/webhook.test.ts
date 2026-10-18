import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abrirDb, type Db } from '../src/db';
import { crearRepoLicencias, type RepoLicencias } from '../src/premium/licencias';
import type { ClienteStripe } from '../src/premium/stripe';
import { procesarEvento } from '../src/premium/webhook';

const PERIODO = 1_800_000_000;
const ITEMS = { items: { data: [{ price: { id: 'price_1' } }] } };
const LINEAS = { lines: { data: [{ price: { id: 'price_1' } }] } };
let estadoSub = 'active';
let priceId: string | null = 'price_1';
const stripeFalso: ClienteStripe = {
  crearCheckout: async () => ({ url: '', id: '' }),
  obtenerSesion: async () => {
    throw new Error('no usado');
  },
  obtenerSuscripcion: async (id) => ({ id, status: estadoSub, current_period_end: PERIODO, priceId }),
  crearPortal: async () => ({ url: '' }),
};

const completado = {
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_1', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1' } },
};

describe('procesarEvento', () => {
  let db: Db;
  let repo: RepoLicencias;
  beforeEach(() => {
    estadoSub = 'active';
    priceId = 'price_1';
    db = abrirDb(':memory:');
    repo = crearRepoLicencias(db);
  });
  afterEach(() => db.cerrar());

  it('checkout.session.completed crea la licencia con la fecha de renovación', async () => {
    await procesarEvento(completado, repo, stripeFalso, 'price_1');
    const l = repo.porSesion('cs_1');
    expect(l?.estado).toBe('activa');
    expect(l?.stripeSubscription).toBe('sub_1');
    expect(l?.renuevaEn).toBe(new Date(PERIODO * 1000).toISOString());
  });

  it('un checkout.session.completed repetido no duplica la licencia', async () => {
    await procesarEvento(completado, repo, stripeFalso, 'price_1');
    const a = repo.porSesion('cs_1')!.clave;
    await procesarEvento(completado, repo, stripeFalso, 'price_1');
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
    await procesarEvento(completado, repo, stripeFalso, 'price_1');
    await procesarEvento(
      { type: 'customer.subscription.updated', data: { object: { id: 'sub_1', ...ITEMS, status: stripeEstado, current_period_end: PERIODO + 100 } } },
      repo,
      stripeFalso,
      'price_1',
    );
    const l = repo.porSuscripcion('sub_1')!;
    expect(l.estado).toBe(esperado);
    expect(l.renuevaEn).toBe(new Date((PERIODO + 100) * 1000).toISOString());
  });

  it('customer.subscription.deleted cancela', async () => {
    await procesarEvento(completado, repo, stripeFalso, 'price_1');
    await procesarEvento({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', ...ITEMS } } }, repo, stripeFalso, 'price_1');
    expect(repo.porSuscripcion('sub_1')?.estado).toBe('cancelada');
  });

  it('invoice.payment_failed marca impagada', async () => {
    await procesarEvento(completado, repo, stripeFalso, 'price_1');
    await procesarEvento({ type: 'invoice.payment_failed', data: { object: { subscription: 'sub_1', ...LINEAS } } }, repo, stripeFalso, 'price_1');
    expect(repo.porSuscripcion('sub_1')?.estado).toBe('impagada');
  });

  it('una suscripción desconocida lanza (500 para que Stripe reintente) y un tipo ignorado no', async () => {
    await expect(
      procesarEvento({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_x', ...ITEMS } } }, repo, stripeFalso, 'price_1'),
    ).rejects.toThrow(/desconocida/);
    await expect(
      procesarEvento({ type: 'customer.subscription.updated', data: { object: { id: 'sub_x', ...ITEMS, status: 'active' } } }, repo, stripeFalso, 'price_1'),
    ).rejects.toThrow(/desconocida/);
    await expect(
      procesarEvento({ type: 'invoice.payment_failed', data: { object: { subscription: 'sub_x', ...LINEAS } } }, repo, stripeFalso, 'price_1'),
    ).rejects.toThrow(/desconocida/);
    await expect(procesarEvento({ type: 'otra.cosa', data: { object: {} } }, repo, stripeFalso, 'price_1')).resolves.toBeUndefined();
  });

  it('eventos de suscripciones de otro precio (o factura sin precio) se ignoran sin error', async () => {
    await procesarEvento(completado, repo, stripeFalso, 'price_1');
    const ajeno = { items: { data: [{ price: { id: 'price_otro' } }] } };
    const antes = repo.porSuscripcion('sub_1')!.estado;
    for (const e of [
      { type: 'customer.subscription.updated', data: { object: { id: 'sub_1', ...ajeno, status: 'canceled' } } },
      { type: 'customer.subscription.deleted', data: { object: { id: 'sub_otra', ...ajeno } } },
      { type: 'customer.subscription.deleted', data: { object: { id: 'sub_otra' } } },
      { type: 'invoice.payment_failed', data: { object: { subscription: 'sub_1', lines: { data: [{ price: { id: 'price_otro' } }] } } } },
      { type: 'invoice.payment_failed', data: { object: { subscription: 'sub_1' } } },
    ]) {
      await expect(procesarEvento(e, repo, stripeFalso, 'price_1')).resolves.toBeUndefined();
    }
    expect(repo.porSuscripcion('sub_1')?.estado).toBe(antes);
  });

  it('checkout.session.async_payment_succeeded crea la licencia igual que completed', async () => {
    await procesarEvento({ ...completado, type: 'checkout.session.async_payment_succeeded' }, repo, stripeFalso, 'price_1');
    const a = repo.porSesion('cs_1')!;
    expect(a.estado).toBe('activa');
    await procesarEvento(completado, repo, stripeFalso, 'price_1');
    expect(repo.porSesion('cs_1')!.clave).toBe(a.clave);
  });

  it('crea la licencia con el estado actual de la suscripción, no siempre activa', async () => {
    estadoSub = 'past_due';
    await procesarEvento(completado, repo, stripeFalso, 'price_1');
    expect(repo.porSesion('cs_1')?.estado).toBe('impagada');
  });

  it('ignora sesiones que no son suscripciones pagadas de nuestro precio', async () => {
    const o = completado.data.object;
    const casos = [
      { ...o, mode: 'payment' },
      { ...o, payment_status: 'unpaid' },
      { ...o, subscription: null },
    ];
    for (const obj of casos) await procesarEvento({ type: completado.type, data: { object: obj } }, repo, stripeFalso, 'price_1');
    priceId = 'price_ajeno';
    await procesarEvento(completado, repo, stripeFalso, 'price_1');
    expect(repo.porSesion('cs_1')).toBeNull();
  });

  it('un evento con forma no válida se ignora sin lanzar', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const e of [{ type: 'customer.subscription.deleted' }, { type: 'x', data: {} }, { type: 'x', data: { object: null } }, null, {}]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(procesarEvento(e as any, repo, stripeFalso, 'price_1')).resolves.toBeUndefined();
    }
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});
