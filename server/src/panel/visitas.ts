import type { FastifyInstance } from 'fastify';
import type { Db } from '../db';
import { claveIp } from '../ip';

/*
 * Contador anónimo de visitas de la web (coachlolia.com está en GitHub Pages y no tiene registros propios).
 * La web avisa al cargar cada página con la ruta, el dominio de procedencia y el `utm_source` si lo hay; no usa
 * cookies ni guarda nada en el navegador. En la base solo quedan contadores por día (tabla `metricas_dia` de
 * metricas.ts): páginas vistas, visitantes y de dónde llegan. La IP se mira solo en memoria y solo durante el día
 * en curso, para contar visitantes distintos y para que un mismo cliente no infle las cifras.
 */

/** Como mucho estas páginas vistas cuentan por IP y día. */
export const MAX_VISITAS_IP_DIA = 200;
/** Como mucho estas descargas cuentan por IP y día. */
export const MAX_DESCARGAS_IP_DIA = 3;
/** Rutas distintas que se apuntan al día; a partir de ahí, «otra» (para que nadie llene la tabla de basura). */
export const MAX_RUTAS_DIA = 300;

/** Procedencias que se distinguen en el panel. */
export const ORIGENES = ['tiktok', 'youtube', 'google', 'bing', 'instagram', 'x', 'discord', 'reddit', 'twitch', 'interna', 'directo', 'otros'] as const;
export type Origen = (typeof ORIGENES)[number];

const POR_DOMINIO: [RegExp, Origen][] = [
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'x'],
  [/(^|\.)(discord\.com|discord\.gg|discordapp\.com)$/, 'discord'],
  [/(^|\.)reddit\.com$/, 'reddit'],
  [/(^|\.)twitch\.tv$/, 'twitch'],
  [/(^|\.)coachlolia\.com$/, 'interna'],
];

/** De dónde llega la visita: primero el `utm_source` (los enlaces de la bio de TikTok), luego el dominio que la manda. */
export function clasificarOrigen(ref: unknown, utm: unknown): Origen {
  if (typeof utm === 'string' && utm) {
    const u = utm.toLowerCase().trim();
    if (u === 'twitter') return 'x';
    if ((ORIGENES as readonly string[]).includes(u) && u !== 'interna' && u !== 'directo') return u as Origen;
    return 'otros';
  }
  if (typeof ref !== 'string' || !ref) return 'directo';
  let host: string;
  try {
    host = new URL(ref).hostname.toLowerCase();
  } catch {
    return 'otros';
  }
  for (const [patron, origen] of POR_DOMINIO) if (patron.test(host)) return origen;
  return 'otros';
}

/** Ruta limpia (sin consulta ni fragmento, en minúsculas); null si no parece una ruta de la web. */
export function limpiarRuta(ruta: unknown): string | null {
  if (typeof ruta !== 'string') return null;
  const r = ruta.split(/[?#]/)[0]!.toLowerCase().replace(/\/+$/, '') || '/';
  return /^\/[a-z0-9\-_/.]{0,80}$/.test(r) ? r : null;
}

const dia = (ahora: Date) => ahora.toISOString().slice(0, 10);

/** Las peticiones de robots conocidos no cuentan. */
const ROBOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit/i;

export function registrarVisitas(app: FastifyInstance, db: Db, reloj: () => Date = () => new Date()): void {
  // Misma tabla que el contador de tarjetas (metricas.ts), por si este módulo se registra antes.
  db.sql.exec('CREATE TABLE IF NOT EXISTS metricas_dia (dia TEXT NOT NULL, evento TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (dia, evento));');
  const sumar = db.sql.prepare('INSERT INTO metricas_dia (dia, evento, n) VALUES (?, ?, 1) ON CONFLICT(dia, evento) DO UPDATE SET n = n + 1');
  const existe = db.sql.prepare('SELECT 1 FROM metricas_dia WHERE dia = ? AND evento = ?');
  const rutasHoy = db.sql.prepare("SELECT COUNT(*) AS n FROM metricas_dia WHERE dia = ? AND evento LIKE 'visita:p:%'");

  // Solo en memoria y solo del día en curso.
  let diaActual = '';
  const vistasPorIp = new Map<string, number>();
  const descargasPorIp = new Map<string, number>();
  const alDia = (hoy: string) => {
    if (hoy === diaActual) return;
    vistasPorIp.clear();
    descargasPorIp.clear();
    diaActual = hoy;
  };

  // Llega con navigator.sendBeacon en text/plain (sin petición previa de CORS); se acepta también JSON.
  app.post('/api/metricas/visita', { bodyLimit: 2048 }, async (req, reply) => {
    reply.code(204);
    if (ROBOT.test(String(req.headers['user-agent'] ?? ''))) return reply.send();
    let cuerpo: Record<string, unknown> = {};
    try {
      cuerpo = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as Record<string, unknown>;
    } catch {
      return reply.send();
    }
    const ruta = limpiarRuta(cuerpo.ruta);
    if (!ruta) return reply.send();
    const hoy = dia(reloj());
    alDia(hoy);
    const ip = claveIp(req.ip);
    const n = (vistasPorIp.get(ip) ?? 0) + 1;
    vistasPorIp.set(ip, n);
    if (n > MAX_VISITAS_IP_DIA) return reply.send();
    const origen = clasificarOrigen(cuerpo.ref, cuerpo.utm);
    const evRuta = `visita:p:${ruta}`;
    const rutaFinal = existe.get(hoy, evRuta) || (rutasHoy.get(hoy) as { n: number }).n < MAX_RUTAS_DIA ? evRuta : 'visita:p:otra';
    db.sql.transaction(() => {
      sumar.run(hoy, 'visita');
      sumar.run(hoy, rutaFinal);
      // Visitante nuevo del día: su procedencia es la de su primera página.
      if (n === 1) {
        sumar.run(hoy, 'visitante');
        sumar.run(hoy, `visitante:o:${origen}`);
      }
    })();
    return reply.send();
  });

  // Clic en «Descargar» de la web (las descargas reales de GitHub se leen aparte en el panel).
  app.post('/api/metricas/descarga', async (req, reply) => {
    const hoy = dia(reloj());
    alDia(hoy);
    const ip = claveIp(req.ip);
    const n = (descargasPorIp.get(ip) ?? 0) + 1;
    descargasPorIp.set(ip, n);
    if (n <= MAX_DESCARGAS_IP_DIA && !ROBOT.test(String(req.headers['user-agent'] ?? ''))) sumar.run(hoy, 'descarga');
    return reply.code(204).send();
  });
}
