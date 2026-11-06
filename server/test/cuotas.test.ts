import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PeticionAnalisis } from '@coach/shared';
import { abrirDb, type Db } from '../src/db';
import { crearServidor } from '../src/http';
import type { CrearMensajeIa } from '../src/coachIa/rutas';
import { consumirCuota, CUOTA_GRATIS_POR_IP, devolverCuota, estadoCuota, resolverSujeto, sumarPaquete } from '../src/premium/cuotas';
import { crearRepoLicencias, type RepoLicencias } from '../src/premium/licencias';
import type { ClienteStripe } from '../src/premium/stripe';
import { planDePrecio, procesarEvento } from '../src/premium/webhook';

const DISPOSITIVO = 'a'.repeat(64);
const OTRO = 'b'.repeat(64);
const ALTA = Date.UTC(2026, 10, 4, 12);

describe('cuotas', () => {
  let db: Db;
  let repo: RepoLicencias;
  beforeEach(() => {
    db = abrirDb(':memory:');
    repo = crearRepoLicencias(db);
  });
  afterEach(() => db.cerrar());

  const suscripcion = (plan: 'aliado' | 'estratega' | 'mariscal' | 'leyenda' = 'estratega') =>
    repo.crearSiNoExiste({ checkoutSession: `cs_${plan}`, stripeCustomer: 'cus', stripeSubscription: `sub_${plan}`, renuevaEn: null, plan });

  it('sin licencia, el dispositivo usa el plan Gratis: 3 partidas al mes', () => {
    const s = resolverSujeto(db, repo, { dispositivo: DISPOSITIVO, ahora: ALTA })!;
    expect(s.plan).toBe('gratis');
    for (let i = 0; i < 3; i++) expect(consumirCuota(db, s, 'partida', ALTA + i).ok).toBe(true);
    const agotada = consumirCuota(db, s, 'partida', ALTA + 10);
    expect(agotada).toEqual({ ok: false, renueva: '2026-12-04T12:00:00.000Z' });
    // Las preguntas tienen su propia cuota.
    expect(consumirCuota(db, s, 'pregunta', ALTA).ok).toBe(true);
  });

  it('la cuota se renueva el mismo día del mes siguiente y no se acumula', () => {
    const s = resolverSujeto(db, repo, { dispositivo: DISPOSITIVO, ahora: ALTA })!;
    for (let i = 0; i < 3; i++) consumirCuota(db, s, 'partida', ALTA);
    const mesSiguiente = Date.UTC(2026, 11, 4, 12);
    // El alta se guarda la primera vez: volver a resolverlo no la mueve.
    const s2 = resolverSujeto(db, repo, { dispositivo: DISPOSITIVO, ahora: mesSiguiente })!;
    expect(s2.alta).toBe(new Date(ALTA).toISOString());
    expect(estadoCuota(db, s2, mesSiguiente).usadas.partida).toBe(0);
    expect(estadoCuota(db, s2, mesSiguiente).cuota.partida).toBe(3);
  });

  it('sin dispositivo válido ni licencia no hay sujeto', () => {
    expect(resolverSujeto(db, repo, { dispositivo: 'xyz', ahora: ALTA })).toBeNull();
    expect(resolverSujeto(db, repo, { clave: 'CLIA-NOPE', ahora: ALTA })).toBeNull();
  });

  it('una licencia activa usa la cuota de su plan; cancelada, vuelve al Gratis del dispositivo', () => {
    const l = suscripcion('mariscal');
    expect(resolverSujeto(db, repo, { clave: l.clave, dispositivo: DISPOSITIVO, ahora: ALTA })).toMatchObject({ plan: 'mariscal', clave: l.clave });
    repo.actualizarPorSuscripcion('sub_mariscal', { estado: 'cancelada' });
    expect(resolverSujeto(db, repo, { clave: l.clave, dispositivo: DISPOSITIVO, ahora: ALTA })).toMatchObject({ plan: 'gratis', clave: null });
  });

  it('una prueba vinculada a otro dispositivo no presta su cuota', () => {
    const p = repo.crearPrueba({ horas: 24, nota: 'tester', ahora: ALTA });
    repo.vincularDispositivo(p.clave, OTRO, ALTA);
    expect(resolverSujeto(db, repo, { clave: p.clave, dispositivo: DISPOSITIVO, ahora: ALTA })!.plan).toBe('gratis');
    expect(resolverSujeto(db, repo, { clave: p.clave, dispositivo: OTRO, ahora: ALTA })!.plan).toBe('estratega');
  });

  it('con la cuota agotada se gastan las partidas extra de los paquetes (solo planes Estratega, Mariscal y Leyenda)', () => {
    const l = suscripcion('estratega');
    const s = resolverSujeto(db, repo, { clave: l.clave, ahora: Date.parse(l.alta) })!;
    const t = Date.parse(l.alta) + 1000;
    for (let i = 0; i < 30; i++) consumirCuota(db, s, 'partida', t);
    expect(consumirCuota(db, s, 'partida', t).ok).toBe(false);
    expect(sumarPaquete(db, { sesion: 'cs_p', clave: l.clave, paquete: 'partidas25', ahora: t })).toBe(true);
    expect(sumarPaquete(db, { sesion: 'cs_p', clave: l.clave, paquete: 'partidas25', ahora: t })).toBe(false);
    const gasto = consumirCuota(db, s, 'partida', t);
    expect(gasto).toMatchObject({ ok: true, origen: 'extra' });
    expect(estadoCuota(db, s, t).extra).toBe(24);
    if (gasto.ok) devolverCuota(db, s, 'partida', gasto);
    expect(estadoCuota(db, s, t).extra).toBe(25);
  });

  it('inventar dispositivos no da cuota gratis sin fin: la IP tiene su propio tope mensual (el doble del Gratis)', () => {
    expect(CUOTA_GRATIS_POR_IP.partida).toBe(6);
    const ids = Array.from({ length: 10 }, (_, i) => i.toString(16).repeat(64));
    let ok = 0;
    for (const id of ids) {
      const s = resolverSujeto(db, repo, { dispositivo: id, ahora: ALTA })!;
      if (consumirCuota(db, s, 'partida', ALTA, '203.0.113.7').ok) ok++;
    }
    expect(ok).toBe(6);
    const agotada = consumirCuota(db, resolverSujeto(db, repo, { dispositivo: 'f'.repeat(64), ahora: ALTA })!, 'partida', ALTA, '203.0.113.7');
    expect(agotada).toEqual({ ok: false, renueva: '2026-12-01T00:00:00.000Z' });
    // Otra IP sigue teniendo lo suyo, y el mes siguiente se renueva.
    expect(consumirCuota(db, resolverSujeto(db, repo, { dispositivo: 'f'.repeat(64), ahora: ALTA })!, 'partida', ALTA, '198.51.100.1').ok).toBe(true);
    const diciembre = Date.UTC(2026, 11, 1, 1);
    expect(consumirCuota(db, resolverSujeto(db, repo, { dispositivo: 'e'.repeat(64), ahora: diciembre })!, 'partida', diciembre, '203.0.113.7').ok).toBe(true);
  });

  it('el tope por IP no se aplica a las licencias y se devuelve si la IA falla', () => {
    const l = suscripcion('aliado');
    const s = resolverSujeto(db, repo, { clave: l.clave, ahora: ALTA })!;
    expect(s.pago).toBe(true);
    for (let i = 0; i < 10; i++) expect(consumirCuota(db, s, 'partida', ALTA, '203.0.113.7').ok).toBe(true);
    const d = resolverSujeto(db, repo, { dispositivo: DISPOSITIVO, ahora: ALTA })!;
    const gasto = consumirCuota(db, d, 'partida', ALTA, '203.0.113.7');
    if (!gasto.ok) throw new Error('debería poder');
    expect(gasto.ip).toEqual({ sujeto: 'i:203.0.113.7', periodo: '2026-11-01T00:00:00.000Z' });
    devolverCuota(db, d, 'partida', gasto);
    const n = db.sql.prepare("SELECT n FROM cuotas_uso WHERE sujeto = 'i:203.0.113.7'").get() as { n: number };
    expect(n.n).toBe(0);
  });

  it('devolver la cuota deshace el gasto del periodo', () => {
    const s = resolverSujeto(db, repo, { dispositivo: DISPOSITIVO, ahora: ALTA })!;
    const gasto = consumirCuota(db, s, 'pregunta', ALTA);
    if (gasto.ok) devolverCuota(db, s, 'pregunta', gasto);
    expect(estadoCuota(db, s, ALTA).usadas.pregunta).toBe(0);
  });
});

describe('webhook con planes', () => {
  let db: Db;
  let repo: RepoLicencias;
  let priceSub = 'price_aliado';
  const precios = { planes: { estratega: 'price_estratega', aliado: 'price_aliado' }, paquetes: { partidas50: 'price_p50' } };
  const stripe: ClienteStripe = {
    crearCheckout: async () => ({ url: '', id: '' }),
    obtenerSesion: async () => {
      throw new Error('no usado');
    },
    obtenerSuscripcion: async (id) => ({ id, status: 'active', current_period_end: 1_800_000_000, priceId: priceSub }),
    crearPortal: async () => ({ url: '' }),
  };
  beforeEach(() => {
    priceSub = 'price_aliado';
    db = abrirDb(':memory:');
    repo = crearRepoLicencias(db);
  });
  afterEach(() => db.cerrar());

  it('planDePrecio reconoce el precio único de antes y los de cada plan', () => {
    expect(planDePrecio('price_x', 'price_x')).toBe('estratega');
    expect(planDePrecio('price_x', 'otro')).toBeNull();
    expect(planDePrecio(precios, 'price_aliado')).toBe('aliado');
    expect(planDePrecio(precios, 'price_p50')).toBeNull();
  });

  it('crea la licencia con el plan del precio y la cambia de plan desde el portal', async () => {
    await procesarEvento(
      { type: 'checkout.session.completed', data: { object: { id: 'cs_1', mode: 'subscription', payment_status: 'paid', customer: 'c', subscription: 'sub_1' } } },
      repo,
      stripe,
      precios,
      db,
    );
    expect(repo.porSesion('cs_1')!.plan).toBe('aliado');
    await procesarEvento(
      { type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active', items: { data: [{ price: { id: 'price_estratega' } }] } } } },
      repo,
      stripe,
      precios,
      db,
    );
    expect(repo.porSesion('cs_1')!.plan).toBe('estratega');
  });

  it('un pago de paquete suma partidas a una licencia Estratega una sola vez', async () => {
    priceSub = 'price_estratega';
    const l = repo.crearSiNoExiste({ checkoutSession: 'cs_s', stripeCustomer: 'c', stripeSubscription: 'sub_s', renuevaEn: null, plan: 'estratega' });
    const evento = {
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_pago', mode: 'payment', payment_status: 'paid', client_reference_id: l.clave, metadata: { paquete: 'partidas50' } } },
    };
    await procesarEvento(evento, repo, stripe, precios, db);
    await procesarEvento(evento, repo, stripe, precios, db);
    expect((db.sql.prepare('SELECT partidas FROM saldo_partidas WHERE clave = ?').get(l.clave) as { partidas: number }).partidas).toBe(50);
  });

  it('un pago de paquete a una licencia Aliado no suma nada', async () => {
    const l = repo.crearSiNoExiste({ checkoutSession: 'cs_s', stripeCustomer: 'c', stripeSubscription: 'sub_s', renuevaEn: null, plan: 'aliado' });
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await procesarEvento(
      { type: 'checkout.session.completed', data: { object: { id: 'cs_pago', mode: 'payment', payment_status: 'paid', client_reference_id: l.clave, metadata: { paquete: 'partidas50' } } } },
      repo,
      stripe,
      precios,
      db,
    );
    aviso.mockRestore();
    expect(db.sql.prepare('SELECT * FROM saldo_partidas').all()).toEqual([]);
  });
});

describe('rutas con cuotas', () => {
  let db: Db;
  let app: FastifyInstance;
  let checkouts: Parameters<ClienteStripe['crearCheckout']>[0][];
  let crear: ReturnType<typeof vi.fn<CrearMensajeIa>>;
  const stripe: ClienteStripe = {
    crearCheckout: async (o) => {
      checkouts.push(o);
      return { url: 'https://checkout.stripe.test/c', id: 'cs' };
    },
    obtenerSesion: async () => {
      throw new Error('no usado');
    },
    obtenerSuscripcion: async () => {
      throw new Error('no usado');
    },
    crearPortal: async () => ({ url: '' }),
  };
  const ANALISIS = JSON.stringify({
    veredicto: 'Bien.',
    bien: [{ titulo: 'a', porque: 'b' }],
    mejorar: [{ titulo: 'c', porque: 'd' }],
    momentos: [],
    enfoque: 'Sigue así.',
  });
  const peticion: PeticionAnalisis = {
    idioma: 'es',
    modo: 'clasificatoria',
    campeon: 'Ahri',
    rol: 'MIDDLE',
    resultado: 'derrota',
    duracion: 1800,
    final: { k: 5, d: 6, a: 7, cs: 222, nivel: 16, objetos: [3165], vision: 28, danoCampeones: 24000, oro: 11000 },
    equipos: { aliados: 20, enemigos: 30 },
    linea: [{ m: 1, cs: 0, nivel: 1, k: 0, d: 0, a: 0, oro: 500 }],
    muertes: [700],
    compras: [],
    objetivos: [],
    build: { nucleo: [3165], botas: 3020, situacionales: [] },
    csObjetivoMinuto: 7.5,
    nombresObjetos: { '3165': 'Morellonomicón' },
    nombreCampeon: 'Ahri',
  };

  const montar = (premiumHabilitado: boolean, topes: { analisisIpDia?: number; analisisMaxDia?: number } = {}) =>
    crearServidor(db, {
      premiumHabilitado,
      stripe: { cliente: stripe, secretoWebhook: 'whsec', precioId: 'price_estratega', precios: { planes: { aliado: 'price_aliado' }, paquetes: { partidas25: 'price_p25' } } },
      urlWeb: 'https://web.test',
      coachIa: { crear, modeloAnalisis: 'claude-sonnet-5-5', modeloConsejo: 'claude-haiku-5-5', analisisIpDia: 100, ...topes },
    });
  const analizar = (headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url: '/api/coach/analisis', headers: { 'content-type': 'application/json', ...headers }, payload: JSON.stringify(peticion) });

  beforeEach(() => {
    checkouts = [];
    db = abrirDb(':memory:');
    crear = vi.fn<CrearMensajeIa>(
      async () =>
        ({ content: [{ type: 'text', text: ANALISIS }], stop_reason: 'end_turn' }) as unknown as Awaited<ReturnType<CrearMensajeIa>>,
    );
    app = montar(true);
  });
  afterEach(async () => {
    await app.close();
    db.cerrar();
  });

  it('con Premium apagado el análisis no gasta cuota ni pide dispositivo', async () => {
    await app.close();
    app = montar(false);
    for (let i = 0; i < 5; i++) expect((await analizar()).statusCode).toBe(200);
  });

  it('con Premium, el plan Gratis da 3 análisis al mes y luego 402', async () => {
    expect((await analizar()).json()).toEqual({ error: 'falta_dispositivo' });
    for (let i = 0; i < 3; i++) expect((await analizar({ 'x-coach-dispositivo': DISPOSITIVO })).statusCode).toBe(200);
    const r = await analizar({ 'x-coach-dispositivo': DISPOSITIVO });
    expect(r.statusCode).toBe(402);
    expect(r.json()).toMatchObject({ error: 'cuota_agotada', tipo: 'partida', plan: 'gratis' });
    const cuota = await app.inject({ method: 'GET', url: `/api/premium/cuota?dispositivo=${DISPOSITIVO}` });
    expect(cuota.json()).toMatchObject({ plan: 'gratis', usadas: { partida: 3, pregunta: 0 }, cuota: { partida: 3 }, extra: 0 });
  });

  it('una licencia de pago no gasta los topes diarios de los gratuitos: solo su cuota mensual', async () => {
    await app.close();
    app = montar(true, { analisisIpDia: 1, analisisMaxDia: 1 });
    const repo = crearRepoLicencias(db);
    const leyenda = repo.crearSiNoExiste({ checkoutSession: 'cs_l', stripeCustomer: 'cus', stripeSubscription: 'sub_l', renuevaEn: null, plan: 'leyenda' });
    // Un gratuito agota el tope global del día...
    expect((await analizar({ 'x-coach-dispositivo': DISPOSITIVO })).statusCode).toBe(200);
    expect((await analizar({ 'x-coach-dispositivo': OTRO })).statusCode).toBe(429);
    // ...y el cliente Leyenda sigue teniendo sus análisis.
    for (let i = 0; i < 5; i++) expect((await analizar({ 'x-coach-licencia': leyenda.clave, 'x-coach-dispositivo': DISPOSITIVO })).statusCode).toBe(200);
    const cuota = await app.inject({ method: 'GET', url: `/api/premium/cuota?clave=${leyenda.clave}` });
    expect(cuota.json()).toMatchObject({ plan: 'leyenda', usadas: { partida: 5 } });
  });

  it('si la IA falla, la partida no se descuenta', async () => {
    crear.mockRejectedValueOnce(new Error('caída'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await analizar({ 'x-coach-dispositivo': DISPOSITIVO })).statusCode).toBe(502);
    error.mockRestore();
    const cuota = await app.inject({ method: 'GET', url: `/api/premium/cuota?dispositivo=${DISPOSITIVO}` });
    expect(cuota.json().usadas.partida).toBe(0);
  });

  it('checkout por plan: sin cuerpo es Estratega; Aliado usa su precio; uno sin precio da 400', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/premium/checkout' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/premium/checkout', payload: { plan: 'aliado' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/premium/checkout?plan=aliado' })).statusCode).toBe(200);
    expect(checkouts.map((c) => c.priceId)).toEqual(['price_estratega', 'price_aliado', 'price_aliado']);
    expect((await app.inject({ method: 'POST', url: '/api/premium/checkout', payload: { plan: 'leyenda' } })).json()).toEqual({ error: 'plan_no_disponible' });
    expect((await app.inject({ method: 'POST', url: '/api/premium/checkout', payload: { plan: 'gratis' } })).json()).toEqual({ error: 'plan_desconocido' });
  });

  it('paquete: pago único con la clave como referencia, solo para licencias Estratega activas', async () => {
    const repo = crearRepoLicencias(db);
    const coach = repo.crearSiNoExiste({ checkoutSession: 'cs_c', stripeCustomer: 'c', stripeSubscription: 'sub_c', renuevaEn: null, plan: 'estratega' });
    const apoyo = repo.crearSiNoExiste({ checkoutSession: 'cs_a', stripeCustomer: 'c', stripeSubscription: 'sub_a', renuevaEn: null, plan: 'aliado' });
    const r = await app.inject({ method: 'POST', url: '/api/premium/paquete', payload: { clave: coach.clave, paquete: 'partidas25' } });
    expect(r.statusCode).toBe(200);
    expect(checkouts[0]).toMatchObject({ priceId: 'price_p25', modo: 'payment', referencia: coach.clave, metadatos: { paquete: 'partidas25' } });
    expect((await app.inject({ method: 'POST', url: '/api/premium/paquete', payload: { clave: apoyo.clave, paquete: 'partidas25' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/premium/paquete', payload: { clave: coach.clave, paquete: 'partidas50' } })).json()).toEqual({
      error: 'paquete_no_disponible',
    });
  });
});
