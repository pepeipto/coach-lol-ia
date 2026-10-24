import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db';
import { claveIp } from '../ip';

/*
 * 3.9.1: renovar la clave de Riot desde el móvil. La clave de desarrollo caduca cada 24 h y Riot exige regenerarla a
 * mano en su portal (con CAPTCHA), así que no se puede automatizar. Esta página privada evita encender el PC: el dueño
 * pega la clave nueva en https://api.coachlolia.com/admin/clave con su contraseña de administrador (ADMIN_TOKEN, un
 * secreto de Fly) y el servidor la usa al momento, sin redesplegar.
 *
 * - Sin ADMIN_TOKEN (o con uno de menos de 24 caracteres) las rutas no existen (404).
 * - La clave se guarda cifrada (AES-256-GCM, con una llave derivada de ADMIN_TOKEN) en `ajustes_servidor`; si no se
 *   puede descifrar (otro ADMIN_TOKEN), se usa RIOT_API_KEY.
 * - Nunca se escribe la clave ni la contraseña en los registros ni se devuelven en una respuesta.
 * - 5 intentos fallidos por IP cada 15 min; la contraseña se compara en tiempo constante.
 */

export const MIN_LARGO_ADMIN = 24;
const CLAVE_GUARDADA = 'riot_api_key_cifrada';
const MAX_FALLOS = 5;
const VENTANA_FALLOS_MS = 15 * 60_000;
/** Forma de una clave de Riot: RGAPI- y un UUID. */
export const FORMA_CLAVE = /^RGAPI-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const llave = (admin: string) => createHash('sha256').update(`coachlolia:clave-riot:${admin}`).digest();

export function cifrar(texto: string, admin: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', llave(admin), iv);
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), datos].map((b) => b.toString('base64')).join('.');
}

export function descifrar(guardado: string, admin: string): string | null {
  try {
    const [iv, tag, datos] = guardado.split('.').map((p) => Buffer.from(p, 'base64'));
    const d = createDecipheriv('aes-256-gcm', llave(admin), iv!);
    d.setAuthTag(tag!);
    return Buffer.concat([d.update(datos!), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export interface AlmacenClave {
  /** La clave en uso: la guardada desde la página si la hay, si no la de RIOT_API_KEY. */
  actual(): string;
  guardar(clave: string): void;
  /** Origen de la clave en uso (para /salud no se usa: solo registros y pruebas). */
  origen(): 'pagina' | 'entorno';
}

export function crearAlmacenClave(db: Db, claveEntorno: string, admin: string | null): AlmacenClave {
  const leer = db.sql.prepare('SELECT valor FROM ajustes_servidor WHERE clave = ?');
  const escribir = db.sql.prepare(
    'INSERT INTO ajustes_servidor (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
  );
  let enMemoria: string | null = null;
  if (admin) {
    const fila = leer.get(CLAVE_GUARDADA) as { valor: string } | undefined;
    enMemoria = fila ? descifrar(fila.valor, admin) : null;
  }
  return {
    actual: () => enMemoria ?? claveEntorno,
    guardar(clave) {
      if (!admin) throw new Error('Sin ADMIN_TOKEN no se puede guardar la clave');
      escribir.run(CLAVE_GUARDADA, cifrar(clave, admin));
      enMemoria = clave;
    },
    origen: () => (enMemoria ? 'pagina' : 'entorno'),
  };
}

function iguales(a: string, b: string): boolean {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

const PAGINA = (mensaje = '', ok = false) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Clave de Riot · Coach LoL IA</title>
<style>
body{margin:0;font-family:system-ui,sans-serif;background:#0a0e1a;color:#e8ecf5;display:grid;place-items:center;min-height:100vh}
main{width:min(92vw,420px);padding:24px;border:1px solid #785a28;border-radius:12px;background:#121a33}
h1{font-size:20px;margin:0 0 6px;color:#c8aa6e}p{color:#8b97b8;font-size:14px;line-height:1.5}
label{display:block;font-size:13px;margin:14px 0 6px}
input{width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid #26314d;background:#0a0e1a;color:#e8ecf5;font-size:16px}
button{margin-top:18px;width:100%;padding:13px;border:0;border-radius:8px;background:#c8aa6e;color:#1a1406;font-weight:700;font-size:16px}
.m{margin-top:14px;padding:10px;border-radius:8px;font-size:14px}.ok{background:rgba(47,191,113,.15);color:#2fbf71}.mal{background:rgba(239,91,91,.15);color:#ef5b5b}
a{color:#c8aa6e}
</style></head><body><main>
<h1>Renovar la clave de Riot</h1>
<p>1. Abre <a href="https://developer.riotgames.com" rel="noreferrer">developer.riotgames.com</a>, pulsa «Regenerate API Key» y copia la clave.<br>2. Pégala aquí con tu contraseña de administrador.</p>
<form method="post" action="/admin/clave" autocomplete="off">
<label for="clave">Clave de Riot (RGAPI-…)</label><input id="clave" name="clave" required autocapitalize="off" spellcheck="false">
<label for="token">Contraseña de administrador</label><input id="token" name="token" type="password" required autocomplete="current-password">
<button type="submit">Guardar clave</button>
</form>
${mensaje ? `<div class="m ${ok ? 'ok' : 'mal'}" role="status">${mensaje}</div>` : ''}
</main></body></html>`;

export interface OpcionesAdminClave {
  almacen: AlmacenClave;
  /** ADMIN_TOKEN; null desactiva las rutas. */
  admin: string | null;
  /** Comprueba una clave con Riot (petición barata): código HTTP o null si no hubo respuesta. */
  comprobar: (clave: string) => Promise<number | null>;
  /** Tras guardar: el estado de la clave pasa a ok. */
  alGuardar?: () => void;
  ahora?: () => number;
}

export function registrarAdminClave(app: FastifyInstance, o: OpcionesAdminClave): void {
  if (!o.admin || o.admin.length < MIN_LARGO_ADMIN) return;
  const admin = o.admin;
  const ahora = o.ahora ?? Date.now;
  const fallos = new Map<string, number[]>();

  app.register(async (rutas) => {
    // Solo estas rutas aceptan formularios (application/x-www-form-urlencoded), como mucho 2 KB.
    rutas.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 2048 }, (_req, cuerpo, hecho) => {
      hecho(null, Object.fromEntries(new URLSearchParams(String(cuerpo))));
    });
    rutas.addHook('onSend', async (_req, reply) => {
      reply.header('Cache-Control', 'no-store');
      reply.header('X-Robots-Tag', 'noindex, nofollow');
      reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
      reply.header('Referrer-Policy', 'no-referrer');
      reply.header('X-Content-Type-Options', 'nosniff');
    });

    rutas.get('/admin/clave', async (_req, reply) => reply.type('text/html; charset=utf-8').send(PAGINA()));

    rutas.post<{ Body: { clave?: unknown; token?: unknown } }>('/admin/clave', async (req, reply) => {
      const html = (codigo: number, mensaje: string, ok = false) =>
        reply.code(codigo).type('text/html; charset=utf-8').send(PAGINA(mensaje, ok));
      const ip = claveIp(req.ip);
      const t = ahora();
      const recientes = (fallos.get(ip) ?? []).filter((f) => t - f < VENTANA_FALLOS_MS);
      if (recientes.length >= MAX_FALLOS) return html(429, 'Demasiados intentos. Espera 15 minutos.');
      const cuerpo = (req.body ?? {}) as { clave?: unknown; token?: unknown };
      const token = typeof cuerpo.token === 'string' ? cuerpo.token : '';
      if (!token || !iguales(token, admin)) {
        recientes.push(t);
        fallos.set(ip, recientes);
        console.warn(`[admin] contraseña incorrecta al renovar la clave (intento ${recientes.length} de ${MAX_FALLOS})`);
        return html(401, 'Contraseña de administrador incorrecta.');
      }
      const clave = typeof cuerpo.clave === 'string' ? cuerpo.clave.trim().replace(/^["']|["']$/g, '') : '';
      if (!FORMA_CLAVE.test(clave)) return html(400, 'Eso no parece una clave de Riot (empieza por RGAPI- y lleva 36 caracteres más).');
      const estado = await o.comprobar(clave);
      if (estado === 401 || estado === 403) return html(400, 'Riot no acepta esa clave. Copia la que aparece ahora en el portal y vuelve a probar.');
      if (estado === null || estado >= 500) return html(502, 'No se ha podido hablar con Riot. Prueba otra vez en un minuto.');
      o.almacen.guardar(clave);
      o.alGuardar?.();
      fallos.delete(ip);
      console.info('[admin] clave de Riot renovada desde la página de administración');
      return html(200, 'Clave guardada. El servidor ya la está usando.', true);
    });
  });
}
