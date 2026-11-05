import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db';
import { claveIp } from '../ip';
import { MIN_LARGO_ADMIN } from '../riot/claveAdmin';
import { contarDescargasGithub, datosPanel } from './datos';
import { paginaEntrar, paginaPanel } from './pagina';
import { crearRepoTiktok, leerCifra, limpiarUrlTiktok } from './tiktok';
import type { CrearMensajeIa } from '../coachIa/rutas';
import { generarIdeas, IDEAS_MAX_DIA } from './ideas';
import { crearRepoPublicaciones, esEstado, ESTADOS, leerPublicacion, limpiarEnlace } from './publicaciones';
import { crearTwitch, type PanelTwitch } from './twitch';

/*
 * Panel privado (/admin/panel): suscripciones, uso de la IA, visitas de la web, vídeos de TikTok, canal de Twitch y
 * cola de reels y publicaciones (con ideas propuestas por la IA).
 * - Se entra con la contraseña de administrador (ADMIN_TOKEN, la misma de /admin/clave) o con la del panel
 *   (PANEL_TOKEN, que solo sirve aquí y no deja tocar la clave de Riot); sin ninguna, las rutas no existen.
 * - GET /admin/panel/datos (JSON), POST /admin/panel/api/tiktok, GET y POST /admin/panel/api/publicaciones aceptan
 *   `Authorization: Bearer <contraseña>`, para pedir las cifras, apuntar vídeos, dejar ideas en la cola o recoger las
 *   aprobadas desde fuera del navegador (p. ej. desde Claude o desde el script de reels del PC). Por la API una
 *   publicación solo entra como «idea» o «preparado»: aprobarla es cosa del panel.
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
  /** ADMIN_TOKEN. */
  admin: string | null;
  /** PANEL_TOKEN: contraseña solo del panel. */
  panel?: string | null;
  ahora?: () => number;
  /** Descargas del instalador; por defecto, la API pública de GitHub. */
  descargas?: () => Promise<number | null>;
  /** Canal de Twitch; sin él, la sección dice cómo configurarlo. */
  twitch?: { consultar(): Promise<PanelTwitch> };
  /** IA para el botón «Proponer ideas»; null o sin ella, el botón no sale. */
  ia?: { crear: CrearMensajeIa; modelo: string } | null;
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
  const claves = [o.admin, o.panel].filter((c): c is string => !!c && c.length >= MIN_LARGO_ADMIN);
  if (!claves.length) return;
  // Llave de las cookies de sesión: cambia si cambia cualquiera de las contraseñas.
  const admin = claves.join('|');
  const valida = (t: string) => claves.some((c) => iguales(t, c));
  const ahora = o.ahora ?? Date.now;
  const tiktok = crearRepoTiktok(o.db);
  const publicaciones = crearRepoPublicaciones(o.db);
  const twitch = o.twitch ?? crearTwitch(null, '');
  // La tabla de contadores la crean metricas.ts y visitas.ts; por si el panel se registra sin ellos.
  o.db.sql.exec('CREATE TABLE IF NOT EXISTS metricas_dia (dia TEXT NOT NULL, evento TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (dia, evento));');
  const ideasUsadas = o.db.sql.prepare("SELECT COALESCE(SUM(n), 0) AS n FROM metricas_dia WHERE dia = ? AND evento = 'panel:ideas'");
  const sumarIdeas = o.db.sql.prepare("INSERT INTO metricas_dia (dia, evento, n) VALUES (?, 'panel:ideas', 1) ON CONFLICT(dia, evento) DO UPDATE SET n = n + 1");
  const quedanIdeas = () => (o.ia ? Math.max(0, IDEAS_MAX_DIA - (ideasUsadas.get(new Date(ahora()).toISOString().slice(0, 10)) as { n: number }).n) : 0);
  let generando = false;
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
    // Con Referrer-Policy: no-referrer, Chrome manda «Origin: null» incluso desde la propia página; entonces vale
    // Sec-Fetch-Site, que pone el navegador y una web no puede falsificar.
    if (origen === 'null') return req.headers['sec-fetch-site'] === 'same-origin';
    try {
      return new URL(origen).host === req.headers.host;
    } catch {
      return false;
    }
  };
  const volver = (reply: FastifyReply, aviso?: string) =>
    reply.code(303).header('Location', aviso ? `/admin/panel?aviso=${encodeURIComponent(aviso)}` : '/admin/panel').send();

  app.register(async (rutas) => {
    rutas.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 16_384 }, (_req, cuerpo, hecho) => {
      hecho(null, Object.fromEntries(new URLSearchParams(String(cuerpo))));
    });
    rutas.addHook('onSend', async (_req, reply) => {
      reply.header('Cache-Control', 'no-store');
      reply.header('X-Robots-Tag', 'noindex, nofollow');
      reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
      // same-origin (y no no-referrer) para que el navegador mande el Origin de verdad al enviar los formularios.
      reply.header('Referrer-Policy', 'same-origin');
      reply.header('X-Content-Type-Options', 'nosniff');
    });
    /** `Authorization: Bearer <contraseña>`: true si vale; con 5 fallos por IP en 15 min, bloqueado. */
    const portador = (req: FastifyRequest): 'ok' | 'mal' | 'bloqueado' => {
      const ip = claveIp(req.ip);
      const t = ahora();
      const recientes = (fallos.get(ip) ?? []).filter((f) => t - f < VENTANA_FALLOS_MS);
      if (recientes.length >= MAX_FALLOS) return 'bloqueado';
      const m = /^Bearer\s+(\S+)$/i.exec(String(req.headers.authorization ?? ''));
      if (m && valida(m[1]!)) return 'ok';
      recientes.push(t);
      fallos.set(ip, recientes);
      return 'mal';
    };
    const datosAhora = async () => {
      const t = ahora();
      if (!cacheDescargas || t - cacheDescargas.t > CACHE_DESCARGAS_MS) cacheDescargas = { t, n: await descargas() };
      return datosPanel(o.db, tiktok, t, cacheDescargas.n, {
        twitch: await twitch.consultar(),
        publicaciones: publicaciones.lista(),
        ideas: { disponible: !!o.ia, quedanHoy: quedanIdeas() },
      });
    };
    const noAutorizado = (reply: FastifyReply, r: 'mal' | 'bloqueado') =>
      reply.code(r === 'bloqueado' ? 429 : 401).send({ error: r === 'bloqueado' ? 'demasiados_intentos' : 'no_autorizado' });

    // Las cifras en JSON, con sesión o con la contraseña como Bearer.
    rutas.get('/admin/panel/datos', async (req, reply) => {
      if (!sesionValida(req)) {
        const r = portador(req);
        if (r !== 'ok') return reply.code(r === 'bloqueado' ? 429 : 401).send({ error: r === 'bloqueado' ? 'demasiados_intentos' : 'no_autorizado' });
      }
      return reply.send(await datosAhora());
    });

    // Apuntar o actualizar un vídeo de TikTok en JSON, con la contraseña como Bearer.
    rutas.post<{ Body: Record<string, unknown> }>('/admin/panel/api/tiktok', async (req, reply) => {
      const r = portador(req);
      if (r !== 'ok') return reply.code(r === 'bloqueado' ? 429 : 401).send({ error: r === 'bloqueado' ? 'demasiados_intentos' : 'no_autorizado' });
      const b = req.body ?? {};
      const url = limpiarUrlTiktok(b.url);
      const publicado = typeof b.publicado === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.publicado) ? b.publicado : null;
      const cifras = { vistas: leerCifra(b.vistas), megusta: leerCifra(b.megusta ?? 0), comentarios: leerCifra(b.comentarios ?? 0), compartidos: leerCifra(b.compartidos ?? 0) };
      if (!url || !publicado || Object.values(cifras).some((c) => c === null)) return reply.code(400).send({ error: 'datos_no_validos' });
      const titulo = typeof b.titulo === 'string' ? b.titulo.trim().slice(0, 120) : '';
      tiktok.guardar({ url, titulo, publicado, ...(cifras as Record<keyof typeof cifras, number>) }, new Date(ahora()));
      if (typeof b.seguidores === 'number' || typeof b.seguidores === 'string') {
        const n = leerCifra(b.seguidores);
        if (n !== null) tiktok.guardarSeguidores(new Date(ahora()).toISOString().slice(0, 10), n);
      }
      return reply.code(204).send();
    });

    // La cola en JSON (?estado=aprobado para recoger lo que hay que preparar), con la contraseña como Bearer.
    rutas.get<{ Querystring: { estado?: string } }>('/admin/panel/api/publicaciones', async (req, reply) => {
      const r = portador(req);
      if (r !== 'ok') return noAutorizado(reply, r);
      const estado = req.query.estado;
      const lista = publicaciones.lista();
      return reply.send({ publicaciones: esEstado(estado) ? lista.filter((p) => p.estado === estado) : lista });
    });

    // Dejar una idea (o un reel ya preparado) en la cola; nunca entra aprobada.
    rutas.post<{ Body: Record<string, unknown> }>('/admin/panel/api/publicaciones', async (req, reply) => {
      const r = portador(req);
      if (r !== 'ok') return noAutorizado(reply, r);
      const p = leerPublicacion(req.body ?? {}, 'api');
      if (typeof p === 'string') return reply.code(400).send({ error: 'datos_no_validos', mensaje: p });
      const id = publicaciones.crear(p, new Date(ahora()));
      if (id === null) return reply.code(409).send({ error: 'cola_llena' });
      return reply.code(201).send({ id });
    });

    // El script de reels avisa de que ha dejado listo el vídeo de una publicación aprobada.
    rutas.post<{ Body: Record<string, unknown> }>('/admin/panel/api/publicaciones/preparado', async (req, reply) => {
      const r = portador(req);
      if (r !== 'ok') return noAutorizado(reply, r);
      const id = Number(req.body?.id);
      const p = Number.isInteger(id) ? publicaciones.obtener(id) : null;
      if (!p) return reply.code(404).send({ error: 'no_existe' });
      // Sigue «aprobado»: solo se apunta en la nota dónde quedó el vídeo, para que el dueño lo suba.
      const archivo = typeof req.body?.archivo === 'string' ? req.body.archivo.trim().slice(0, 200) : '';
      o.db.sql.prepare('UPDATE publicaciones SET nota = ?, actualizada = ? WHERE id = ?').run(archivo ? `Vídeo listo: ${archivo}` : 'Vídeo listo', new Date(ahora()).toISOString(), id);
      return reply.code(204).send();
    });

    // Las rutas del formulario que cambian algo exigen sesión y mismo origen.
    rutas.addHook('preHandler', async (req, reply) => {
      if (req.method !== 'POST' || req.url === '/admin/panel/entrar' || req.url.startsWith('/admin/panel/api/')) return;
      if (!mismoOrigen(req) || !sesionValida(req)) return reply.code(401).type('text/html; charset=utf-8').send(paginaEntrar('La sesión ha caducado. Vuelve a entrar.'));
    });

    rutas.get<{ Querystring: { aviso?: string; auto?: string } }>('/admin/panel', async (req, reply) => {
      reply.type('text/html; charset=utf-8');
      if (!sesionValida(req)) return reply.send(paginaEntrar());
      const aviso = typeof req.query.aviso === 'string' ? req.query.aviso.slice(0, 200) : '';
      return reply.send(paginaPanel(await datosAhora(), aviso, req.query.auto !== '0'));
    });

    rutas.post<{ Body: { token?: unknown } }>('/admin/panel/entrar', async (req, reply) => {
      const html = (codigo: number, mensaje: string) => reply.code(codigo).type('text/html; charset=utf-8').send(paginaEntrar(mensaje));
      if (!mismoOrigen(req)) return html(403, 'Petición no válida.');
      const ip = claveIp(req.ip);
      const t = ahora();
      const recientes = (fallos.get(ip) ?? []).filter((f) => t - f < VENTANA_FALLOS_MS);
      if (recientes.length >= MAX_FALLOS) return html(429, 'Demasiados intentos. Espera 15 minutos.');
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      if (!token || !valida(token)) {
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

    rutas.post<{ Body: Record<string, unknown> }>('/admin/panel/publicaciones', async (req, reply) => {
      const p = leerPublicacion(req.body ?? {}, 'panel');
      if (typeof p === 'string') return volver(reply, p);
      const id = publicaciones.crear(p, new Date(ahora()));
      return volver(reply, id === null ? 'La cola está llena: borra publicaciones antiguas.' : 'Publicación añadida a la cola.');
    });

    rutas.post<{ Body: Record<string, unknown> }>('/admin/panel/publicaciones/estado', async (req, reply) => {
      const id = Number(req.body?.id);
      const estado = req.body?.estado;
      if (!Number.isInteger(id) || !esEstado(estado)) return volver(reply, `Estado no válido (${ESTADOS.join(', ')}).`);
      const enlace = limpiarEnlace(req.body?.enlace);
      if (estado === 'publicado' && !enlace && !publicaciones.obtener(id)?.enlace) return volver(reply, 'Para marcarla como publicada, pega el enlace del post.');
      return volver(reply, publicaciones.cambiarEstado(id, estado, new Date(ahora()), enlace) ? 'Estado cambiado.' : 'Esa publicación ya no existe.');
    });

    rutas.post<{ Body: Record<string, unknown> }>('/admin/panel/publicaciones/borrar', async (req, reply) => {
      const id = Number(req.body?.id);
      if (Number.isInteger(id)) publicaciones.borrar(id);
      return volver(reply, 'Publicación borrada.');
    });

    rutas.post('/admin/panel/ideas', async (_req, reply) => {
      if (!o.ia) return volver(reply, 'La IA no está configurada en el servidor (falta ANTHROPIC_API_KEY).');
      if (quedanIdeas() <= 0) return volver(reply, `Ya se han pedido ${IDEAS_MAX_DIA} tandas de ideas hoy. Mañana más.`);
      if (generando) return volver(reply, 'Ya se están generando ideas; recarga en un momento.');
      generando = true;
      try {
        sumarIdeas.run(new Date(ahora()).toISOString().slice(0, 10));
        const tw = await twitch.consultar();
        const ideas = await generarIdeas(o.ia, { clips: tw.estado === 'ok' ? tw.clips : [], tiktok: tiktok.lista(), cola: publicaciones.lista() });
        let n = 0;
        for (const p of ideas) if (publicaciones.crear(p, new Date(ahora())) !== null) n++;
        return volver(reply, n ? `${n} ideas nuevas en la cola. Revísalas y aprueba las que te gusten.` : 'La IA no devolvió ideas válidas. Prueba otra vez.');
      } catch (e) {
        console.warn('[panel] Fallo al generar ideas:', e instanceof Error ? e.message : e);
        return volver(reply, 'No se pudieron generar ideas ahora. Prueba en un rato.');
      } finally {
        generando = false;
      }
    });
  });
}
