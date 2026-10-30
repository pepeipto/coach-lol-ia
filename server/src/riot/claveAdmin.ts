import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
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
 * - La clave se guarda cifrada (AES-256-GCM, con una llave derivada de ADMIN_TOKEN con scrypt y una sal aleatoria
 *   guardada también en `ajustes_servidor`); si no se puede descifrar (otro ADMIN_TOKEN), se usa RIOT_API_KEY.
 *   Seguridad (hallazgo 8): antes la llave era un SHA-256 de ADMIN_TOKEN sin sal; una clave guardada así se sigue
 *   leyendo y, al arrancar, se vuelve a guardar con el método nuevo (formato «v2.»).
 * - Nunca se escribe la clave ni la contraseña en los registros ni se devuelven en una respuesta.
 * - 5 intentos fallidos por IP cada 15 min; la contraseña se compara en tiempo constante.
 */

export const MIN_LARGO_ADMIN = 24;
const CLAVE_GUARDADA = 'riot_api_key_cifrada';
const SAL_GUARDADA = 'sal_clave_riot';
/** Prefijo del formato con scrypt; lo que no lo lleva es del método antiguo (SHA-256 sin sal). */
const PREFIJO_V2 = 'v2.';
/** Huella de la clave en uso y desde cuándo se usa (para estimar cuándo caduca la de desarrollo). */
const DESDE_GUARDADO = 'clave_riot_desde';
/** Huella de RIOT_API_KEY con la que se guardó la clave de la página: si cambia, la guardada deja de valer. */
const ENTORNO_GUARDADO = 'clave_riot_entorno_huella';
const MAX_FALLOS = 5;
const VENTANA_FALLOS_MS = 15 * 60_000;
/** Forma de una clave de Riot: RGAPI- y un UUID. */
export const FORMA_CLAVE = /^RGAPI-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Método antiguo (solo para leer lo guardado antes): un SHA-256 de ADMIN_TOKEN, sin sal ni coste. */
const llaveAntigua = (admin: string) => createHash('sha256').update(`coachlolia:clave-riot:${admin}`).digest();
/** scrypt (N=16384, r=8, p=1: unos 16 MB y decenas de ms) con la sal de la base: la fuerza bruta sale cara. */
const llaveScrypt = (admin: string, sal: Buffer) => scryptSync(`coachlolia:clave-riot:${admin}`, sal, 32);

function cifrarCon(texto: string, llave: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', llave, iv);
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), datos].map((b) => b.toString('base64')).join('.');
}

function descifrarCon(guardado: string, llave: Buffer): string | null {
  try {
    const [iv, tag, datos, ...resto] = guardado.split('.').map((p) => Buffer.from(p, 'base64'));
    if (resto.length > 0) return null;
    const d = createDecipheriv('aes-256-gcm', llave, iv!);
    d.setAuthTag(tag!);
    return Buffer.concat([d.update(datos!), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Cifra con la llave derivada por scrypt de ADMIN_TOKEN y la sal (formato «v2.iv.tag.datos»). */
export function cifrar(texto: string, admin: string, sal: Buffer): string {
  return PREFIJO_V2 + cifrarCon(texto, llaveScrypt(admin, sal));
}

/** Descifra el formato nuevo (con la sal) o el antiguo (sin prefijo); null si no se puede. */
export function descifrar(guardado: string, admin: string, sal: Buffer | null): string | null {
  if (guardado.startsWith(PREFIJO_V2)) return sal ? descifrarCon(guardado.slice(PREFIJO_V2.length), llaveScrypt(admin, sal)) : null;
  return descifrarCon(guardado, llaveAntigua(admin));
}

/** Sal de la llave, guardada en `ajustes_servidor` (se crea la primera vez: 16 bytes aleatorios). */
function salClave(db: Db): Buffer {
  const leer = db.sql.prepare('SELECT valor FROM ajustes_servidor WHERE clave = ?');
  db.sql.prepare('INSERT OR IGNORE INTO ajustes_servidor (clave, valor) VALUES (?, ?)').run(SAL_GUARDADA, randomBytes(16).toString('base64'));
  return Buffer.from((leer.get(SAL_GUARDADA) as { valor: string }).valor, 'base64');
}

export interface AlmacenClave {
  /** La clave en uso: la guardada desde la página si la hay, si no la de RIOT_API_KEY. */
  actual(): string;
  guardar(clave: string): void;
  /** Origen de la clave en uso (para /salud no se usa: solo registros y pruebas). */
  origen(): 'pagina' | 'entorno';
  /**
   * Desde cuándo (ms) se usa la clave actual: al guardarla en la página o, si llega por RIOT_API_KEY, al arrancar el
   * servidor con una clave distinta de la anterior (`flyctl secrets set` reinicia la máquina). Sirve para estimar
   * cuándo caduca la de desarrollo (24 h después de generarla).
   */
  desde(): number;
}

/** Huella corta (no reversible) para saber si la clave cambió sin guardarla en claro. */
const huella = (clave: string) => createHash('sha256').update(`coachlolia:huella-riot:${clave}`).digest('hex').slice(0, 16);

export function crearAlmacenClave(db: Db, claveEntorno: string, admin: string | null, ahora: () => number = Date.now): AlmacenClave {
  const leer = db.sql.prepare('SELECT valor FROM ajustes_servidor WHERE clave = ?');
  const escribir = db.sql.prepare(
    'INSERT INTO ajustes_servidor (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
  );
  let enMemoria: string | null = null;
  const sal = admin ? salClave(db) : null;
  if (admin) {
    const fila = leer.get(CLAVE_GUARDADA) as { valor: string } | undefined;
    enMemoria = fila ? descifrar(fila.valor, admin, sal) : null;
    // Compatibilidad: una clave guardada con el método antiguo se vuelve a guardar con scrypt y la sal.
    if (fila && enMemoria !== null && !fila.valor.startsWith(PREFIJO_V2)) {
      escribir.run(CLAVE_GUARDADA, cifrar(enMemoria, admin, sal!));
      console.info('[admin] La clave de Riot guardada se ha vuelto a cifrar con el método nuevo (scrypt con sal).');
    }
  }
  // La clave de la página gana a RIOT_API_KEY, pero solo mientras RIOT_API_KEY sea la misma con la que se guardó. Si el
  // dueño cambia el secreto de Fly.io (o la guardada es de antes de esta regla), se descarta: si no, un secreto nuevo
  // no tendría efecto y el servidor seguiría con una clave caducada guardada en la base.
  if (enMemoria !== null) {
    const entornoGuardado = (leer.get(ENTORNO_GUARDADO) as { valor: string } | undefined)?.valor;
    if (entornoGuardado !== huella(claveEntorno)) {
      db.sql.prepare('DELETE FROM ajustes_servidor WHERE clave = ?').run(CLAVE_GUARDADA);
      enMemoria = null;
      console.info('[admin] La clave guardada desde la página se descarta: RIOT_API_KEY ha cambiado. Se usa la del secreto.');
    }
  }
  let desde = ahora();
  /** Apunta desde cuándo se usa `clave`: si es la misma que la guardada, conserva su fecha. */
  function apuntarDesde(clave: string): void {
    const h = huella(clave);
    const fila = leer.get(DESDE_GUARDADO) as { valor: string } | undefined;
    const [hGuardada, msGuardado] = fila?.valor.split('|') ?? [];
    const ms = Number(msGuardado);
    if (hGuardada === h && Number.isFinite(ms)) {
      desde = ms;
      return;
    }
    desde = ahora();
    escribir.run(DESDE_GUARDADO, `${h}|${desde}`);
  }
  apuntarDesde(enMemoria ?? claveEntorno);
  return {
    actual: () => enMemoria ?? claveEntorno,
    guardar(clave) {
      if (!admin) throw new Error('Sin ADMIN_TOKEN no se puede guardar la clave');
      escribir.run(CLAVE_GUARDADA, cifrar(clave, admin, sal!));
      escribir.run(ENTORNO_GUARDADO, huella(claveEntorno));
      enMemoria = clave;
      apuntarDesde(clave);
    },
    origen: () => (enMemoria ? 'pagina' : 'entorno'),
    desde: () => desde,
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
