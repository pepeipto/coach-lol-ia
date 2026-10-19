import type { FastifyInstance, FastifyReply } from 'fastify';
import { crearRepoLicencias } from './licencias';
import type { ClienteStripe } from './stripe';
import { verificarFirmaWebhook } from './stripe';
import { licenciaDesdeSesion, procesarEvento } from './webhook';
import { estadoParaCliente, pedirPrueba, salDePrueba } from './pruebas';
import { claveIp } from '../ip';
import type { Db } from '../db';

export interface OpcionesPremium {
  stripe?: { cliente: ClienteStripe; secretoWebhook: string; precioId: string };
  /** URL pública de la web, sin barra final ni ruta base: `https://www.coachlolia.com`. */
  urlWeb: string;
  /** Reloj inyectable para el límite por IP (pruebas). */
  ahora?: () => number;
  /** Sal del hash de las IP de las pruebas (PRUEBA_SAL); sin ella se usa una aleatoria guardada en la base. */
  salPrueba?: string | null;
}

export { URL_WEB_POR_DEFECTO } from '../config';

const LIMITE = 30;
const VENTANA_MS = 60_000;

function origenDe(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/** Registra `/api/premium/*` y `/api/stripe/webhook`. */
export function registrarPremium(app: FastifyInstance, db: Db, opciones: OpcionesPremium): void {
  const urlWeb = opciones.urlWeb.replace(/\/+$/, '');
  const origen = origenDe(urlWeb);
  const ahora = opciones.ahora ?? Date.now;
  const peticiones = new Map<string, number[]>();

  const stripeCfg = opciones.stripe;
  const repo = crearRepoLicencias(db);
  const noConfigurado = { error: 'premium_no_configurado' };

  // Rutas JSON de /api/premium/*: CORS, límite por IP y 503 sin configurar, todo en un plugin encapsulado.
  app.register(async (premium) => {
    // Un POST sin cuerpo pero con content-type JSON es válido aquí (el cuerpo vacío cuenta como {}).
    premium.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, cuerpo, hecho) => {
      const texto = String(cuerpo);
      if (texto.trim() === '') return hecho(null, {});
      try {
        hecho(null, JSON.parse(texto));
      } catch {
        const e = new Error('JSON no válido') as Error & { statusCode: number };
        e.statusCode = 400;
        hecho(e, undefined);
      }
    });

    premium.addHook('onRequest', async (req, reply) => {
      if (origen) {
        reply.header('Access-Control-Allow-Origin', origen);
        reply.header('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        return reply
          .header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          .header('Access-Control-Allow-Headers', 'content-type')
          .header('Access-Control-Max-Age', '600')
          .code(204)
          .send();
      }
      const t = ahora();
      const ip = claveIp(req.ip);
      const recientes = (peticiones.get(ip) ?? []).filter((x) => t - x < VENTANA_MS);
      recientes.push(t);
      peticiones.set(ip, recientes);
      // Limpieza ocasional para que el mapa no crezca sin límite.
      if (peticiones.size > 10_000) {
        for (const [ip, ts] of peticiones) if (ts.every((x) => t - x >= VENTANA_MS)) peticiones.delete(ip);
      }
      if (recientes.length > LIMITE) return reply.code(429).send({ error: 'demasiadas_peticiones' });
      // El estado de una licencia y la prueba gratuita no necesitan Stripe (vitalicias y pruebas).
      const ruta = req.url.split('?')[0]!;
      const sinStripe =
        (req.method === 'GET' && ruta.startsWith('/api/premium/estado/')) || (req.method === 'POST' && ruta === '/api/premium/prueba');
      if (!stripeCfg && !sinStripe) return reply.code(503).send(noConfigurado);
    });

    // OPTIONS de cualquier ruta de premium (p. ej. el preflight del POST JSON a /portal que hace la web): el hook responde antes de llegar aquí.
    premium.options('/api/premium/*', async () => undefined);

    // Los errores de Stripe se registran en el servidor y al cliente solo le llega un 502 genérico.
    const stripeCaido = (reply: FastifyReply, e: unknown) => {
      console.error('[stripe]', e instanceof Error ? e.message : String(e));
      return reply.code(502).send({ error: 'stripe_no_disponible' });
    };

    premium.post('/api/premium/checkout', async (_req, reply) => {
      try {
        const { url } = await stripeCfg!.cliente.crearCheckout({
          priceId: stripeCfg!.precioId,
          urlExito: `${urlWeb}/premium/gracias?session_id={CHECKOUT_SESSION_ID}`,
          urlCancelar: `${urlWeb}/premium`,
        });
        return { url };
      } catch (e) {
        return stripeCaido(reply, e);
      }
    });

    premium.get<{ Querystring: { session_id?: string } }>('/api/premium/licencia', async (req, reply) => {
      const sesionId = req.query.session_id;
      if (!sesionId) return reply.code(400).send({ error: 'falta_session_id' });
      const existente = repo.porSesion(sesionId);
      if (existente) return { clave: existente.clave, estado: existente.estado };
      let l;
      try {
        const sesion = await stripeCfg!.cliente.obtenerSesion(sesionId);
        l = await licenciaDesdeSesion(sesion, repo, stripeCfg!.cliente, stripeCfg!.precioId);
      } catch (e) {
        return stripeCaido(reply, e);
      }
      if (!l) return reply.code(404).send({ error: 'pendiente' });
      return { clave: l.clave, estado: l.estado };
    });

    premium.post<{ Body: { clave?: unknown } | null }>('/api/premium/portal', async (req, reply) => {
      const clave = req.body?.clave;
      const licencia = typeof clave === 'string' ? repo.porClave(clave) : null;
      if (!licencia) return reply.code(404).send({ error: 'licencia_desconocida' });
      // Una vitalicia no tiene suscripción que gestionar.
      // Las vitalicias y las pruebas no tienen suscripción que gestionar.
      if (licencia.tipo === 'prueba') return reply.code(400).send({ error: 'licencia_prueba' });
      if (licencia.tipo === 'vitalicia' || !licencia.stripeCustomer) return reply.code(400).send({ error: 'licencia_vitalicia' });
      const customer = licencia.stripeCustomer;
      try {
        const { url } = await stripeCfg!.cliente.crearPortal({ customer, urlVuelta: `${urlWeb}/premium` });
        return { url };
      } catch (e) {
        return stripeCaido(reply, e);
      }
    });

    premium.get<{ Params: { clave: string }; Querystring: { dispositivo?: string } }>('/api/premium/estado/:clave', async (req, reply) => {
      const l = repo.porClave(req.params.clave);
      if (!l) return reply.code(404).send({ error: 'licencia_desconocida' });
      return estadoParaCliente(db, repo, l, req.query.dispositivo, ahora());
    });

    // Prueba gratuita de 24 h desde la web: POST sin cuerpo (petición CORS simple), una por IP cada 30 días.
    premium.post('/api/premium/prueba', async (req, reply) => {
      const sal = salDePrueba(db, opciones.salPrueba);
      const l = pedirPrueba(db, repo, { ip: claveIp(req.ip), sal, ahora: ahora() });
      if (!l) return reply.code(429).send({ error: 'prueba_ya_solicitada' });
      return { clave: l.clave, caducaEn: l.caducaEn };
    });
  });

  // Webhook: cuerpo sin procesar (texto) solo en este plugin, porque la firma se calcula sobre los bytes originales.
  app.register(async (hook) => {
    hook.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, cuerpo, hecho) => hecho(null, cuerpo));
    hook.post<{ Body: Buffer }>('/api/stripe/webhook', async (req, reply) => {
      if (!stripeCfg) return reply.code(503).send(noConfigurado);
      const cuerpo = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const cabecera = req.headers['stripe-signature'];
      if (!verificarFirmaWebhook(cuerpo, typeof cabecera === 'string' ? cabecera : undefined, stripeCfg.secretoWebhook)) {
        return reply.code(400).send({ error: 'firma_invalida' });
      }
      let evento;
      try {
        evento = JSON.parse(cuerpo.toString('utf8'));
      } catch {
        return reply.code(400).send({ error: 'cuerpo_invalido' });
      }
      // Si falla (p. ej. Stripe no responde), el error sube y se responde 500 para que Stripe reintente.
      try {
        await procesarEvento(evento, repo, stripeCfg.cliente, stripeCfg.precioId);
      } catch (e) {
        console.error('[stripe] Fallo al procesar el evento:', e instanceof Error ? e.message : String(e));
        return reply.code(500).send({ error: 'procesamiento_fallido' });
      }
      return { recibido: true };
    });
    // Sin Stripe configurado, un POST sin content-type JSON también debe dar 503, no 415.
    hook.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, cuerpo, hecho) => hecho(null, cuerpo));
  });
}
