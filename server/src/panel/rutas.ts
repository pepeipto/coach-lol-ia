import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db';
import { claveIp } from '../ip';
import { MIN_LARGO_ADMIN } from '../riot/claveAdmin';
import { contarDescargasGithub, datosPanel } from './datos';
import { paginaEntrar, paginaPanel } from './pagina';
import { crearRepoTiktok, leerCifra, limpiarUrlTiktok } from './tiktok';

/*
 * Panel privado (/admin/panel): suscripciones, uso de la IA, visitas de la web y vídeos de TikTok.
 * - Se entra con la contraseña de administrador (ADMIN_TOKEN, la misma de /admin/clave); sin ella, las rutas no existen.
 * - Al entrar se guarda una cookie firmada (HMAC con ADMIN_TOKEN) que dura 12 horas, solo para /admin/panel,
 *   HttpOnly, Secure y SameSite=Strict (otra web no puede mandar formularios con ella).
 * - Como /admin/clave: 5 contraseñas incorrectas por IP en 15 minutos bloquean la entrada.
 */

export const COOKIE = 'panel';
export const DURACION_SESION_MS = 12 * 60 * 60_000;
const MAX_FALLOS = 5;
const VENTANA_FALLOS_MS = 15 * 60_000;
/** Las descargas de GitHub se consultan como mucho cada 10 minutos. */
const CACHE_DESCARGAS_MS = 10 * 60_000;

export interface OpcionesPanel {
  db: Db;
  /** ADMIN_TOKEN; null desactiva las rutas. */
  admin: string | null;
  ahora?: () => number;
  /** Descargas del instalador; por defecto, la API pública de GitHub. */
  descargas?: () => Promise<number | null>;
}

const firma = (admin: string, caduca: number) => createHmac('sha256', admin).update(`coachlolia:panel:${caduca}`).digest('base64url');

function iguales(a: string, b: string): boolean {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

function leerCookie(req: FastifyRequest, nombre: string): string | null {
  const cabecera = req.headers.cookie;
  if (!cabecera) return null;
  for (const parte of cabecera.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return v.join('=');
  }
  return null;
}

export function registrarPanel(app: FastifyInstance, o: OpcionesPanel): void {
  if (!o.admin || o.admin.length < MIN_LARGO_ADMIN) return;
  const admin = o.admin;
  const ahora = o.ahora ?? Date.now;
  const tiktok = crearRepoTiktok(o.db);
  const fallos = new Map<string, number[]>();
  const descargas = o.descargas ?? (() => contarDescargasGithub());
  let cacheDescargas: { t: number; n: number | null } | null = null;

  const sesionValida = (req: FastifyRequest) => {
    const valor = leerCookie(req, COOKIE);
    const m = valor ? /^(\d{10,16})\.([\w-]{43})$/.exec(valor) : null;
    if (!m) return false;
    const caduca = Number(m[1]);
    return caduca > ahora() && iguales(m[2]!, firma(admin, caduca));
  };
  /** Un formulario de otra web (con Origin distinto) nunca se acepta, aunque la cookie es SameSite=Strict. */
  const mismoOrigen = (req: FastifyRequest) => {
    const origen = req.headers.origin;
    if (!origen) return true;
    try {
      return new URL(origen).host === req.headers.host;
    } catch {
      return false;
    }
  };
  const volver = (reply: FastifyReply, aviso?: string) =>
    reply.code(303).header('Location', aviso ? `/admin/panel?aviso=${encodeURIComponent(aviso)}` : '/admin/panel').send();

  app.register(async (rutas) => {
    rutas.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 4096 }, (_req, cuerpo, hecho) => {
      hecho(null, Object.fromEntries(new URLSearchParams(String(cuerpo))));
    });
    rutas.addHook('onSend', async (_req, reply) => {
      reply.header('Cache-Control', 'no-store');
      reply.header('X-Robots-Tag', 'noindex, nofollow');
      reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
      reply.header('Referrer-Policy', 'no-referrer');
      reply.header('X-Content-Type-Options', 'nosniff');
    });
    // Las rutas que cambian algo exigen sesión y mismo origen.
    rutas.addHook('preHandler', async (req, reply) => {
      if (req.method !== 'POST' || req.url === '/admin/panel/entrar') return;
      if (!mismoOrigen(req) || !sesionValida(req)) return reply.code(401).type('text/html; charset=utf-8').send(paginaEntrar('La sesión ha caducado. Vuelve a entrar.'));
    });

    rutas.get<{ Querystring: { aviso?: string } }>('/admin/panel', async (req, reply) => {
      reply.type('text/html; charset=utf-8');
      if (!sesionValida(req)) return reply.send(paginaEntrar());
      const t = ahora();
      if (!cacheDescargas || t - cacheDescargas.t > CACHE_DESCARGAS_MS) cacheDescargas = { t, n: await descargas() };
      const aviso = typeof req.query.aviso === 'string' ? req.query.aviso.slice(0, 200) : '';
      return reply.send(paginaPanel(datosPanel(o.db, tiktok, t, cacheDescargas.n), aviso));
    });

    rutas.post<{ Body: { token?: unknown } }>('/admin/panel/entrar', async (req, reply) => {
      const html = (codigo: number, mensaje: string) => reply.code(codigo).type('text/html; charset=utf-8').send(paginaEntrar(mensaje));
      if (!mismoOrigen(req)) return html(403, 'Petición no válida.');
      const ip = claveIp(req.ip);
      const t = ahora();
      const recientes = (fallos.get(ip) ?? []).filter((f) => t - f < VENTANA_FALLOS_MS);
      if (recientes.length >= MAX_FALLOS) return html(429, 'Demasiados intentos. Espera 15 minutos.');
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      if (!token || !iguales(token, admin)) {
        recientes.push(t);
        fallos.set(ip, recientes);
        console.warn(`[admin] contraseña incorrecta al entrar en el panel (intento ${recientes.length} de ${MAX_FALLOS})`);
        return html(401, 'Contraseña de administrador incorrecta.');
      }
      fallos.delete(ip);
      const caduca = t + DURACION_SESION_MS;
      reply.header(
        'Set-Cookie',
        `${COOKIE}=${caduca}.${firma(admin, caduca)}; Path=/admin/panel; Max-Age=${DURACION_SESION_MS / 1000}; HttpOnly; Secure; SameSite=Strict`,
      );
      return volver(reply);
    });

    rutas.post('/admin/panel/salir', async (_req, reply) => {
      reply.header('Set-Cookie', `${COOKIE}=; Path=/admin/panel; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
      return reply.code(303).header('Location', '/admin/panel').send();
    });

    rutas.post<{ Body: Record<string, unknown> }>('/admin/panel/tiktok', async (req, reply) => {
      const b = req.body ?? {};
      const url = limpiarUrlTiktok(b.url);
      if (!url) return volver(reply, 'Ese enlace no es de un vídeo de TikTok (https://www.tiktok.com/…).');
      const publicado = typeof b.publicado === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.publicado) ? b.publicado : null;
      if (!publicado) return volver(reply, 'Falta la fecha de publicación.');
      const cifras = { vistas: leerCifra(b.vistas), megusta: leerCifra(b.megusta ?? ''), comentarios: leerCifra(b.comentarios ?? ''), compartidos: leerCifra(b.compartidos ?? '') };
      if (Object.values(cifras).some((c) => c === null)) return volver(reply, 'Alguna cifra no se entiende. Escribe solo números (o «12,3 mil», «1,2K»).');
      const titulo = typeof b.titulo === 'string' ? b.titulo.trim().slice(0, 120) : '';
      tiktok.guardar({ url, titulo, publicado, ...(cifras as Record<keyof typeof cifras, number>) }, new Date(ahora()));
      return volver(reply, 'Vídeo guardado.');
    });

    rutas.post<{ Body: Record<string, unknown> }>('/admin/panel/tiktok/borrar', async (req, reply) => {
      const url = limpiarUrlTiktok(req.body?.url);
      if (url) tiktok.borrar(url);
      return volver(reply, 'Vídeo quitado.');
    });

    rutas.post<{ Body: Record<string, unknown> }>('/admin/panel/seguidores', async (req, reply) => {
      const dia = typeof req.body?.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.dia) ? req.body.dia : null;
      const n = leerCifra(req.body?.seguidores);
      if (!dia || n === null) return volver(reply, 'Escribe el día y los seguidores.');
      tiktok.guardarSeguidores(dia, n);
      return volver(reply, 'Seguidores guardados.');
    });
  });
}
