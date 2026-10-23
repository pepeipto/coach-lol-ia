import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { CSS_OBS, HTML_OBS, JS_OBS } from './paginaObs';
import type { VistaObs } from './fuenteObs';

/*
 * 3.8: servidor HTTP local de solo lectura para la fuente de OBS.
 * - Solo escucha en 127.0.0.1 (nunca en la red local ni en internet).
 * - Todas las rutas cuelgan de un token aleatorio: /<token>/ (página), /<token>/app.js, /<token>/estilo.css,
 *   /<token>/estado (JSON) y /<token>/eventos (SSE). Sin token, o con otro, 404.
 * - Solo GET y HEAD; la cabecera Host tiene que ser 127.0.0.1 o localhost con este puerto (contra el DNS rebinding).
 * - Sin CORS (ninguna cabecera Access-Control-*), con CSP estricta y cabeceras de seguridad básicas.
 * - Lo que sirve es la VistaObs ya preparada: sin claves, rutas de disco ni datos de otros jugadores.
 */

export const HOST_OBS = '127.0.0.1';
/** Conexiones SSE abiertas a la vez como mucho (OBS abre una por fuente). */
export const MAX_CLIENTES_SSE = 8;
const LATIDO_MS = 15_000;

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' https://raw.communitydragon.org",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const CABECERAS_SEGURIDAD: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), clipboard-read=(), clipboard-write=()',
  'Cache-Control': 'no-store',
};

export interface DependenciasServidorObs {
  /** Token actual (se lee en cada petición: regenerarlo corta la URL anterior al momento). */
  token: () => string;
  vista: () => VistaObs;
  /** Avisa de cada cambio de la vista; devuelve la función para dejar de escuchar. */
  alCambiar: (cb: (v: VistaObs) => void) => () => void;
  crear?: typeof createServer;
}

export type ResultadoArranque = { ok: true; puerto: number } | { ok: false; error: 'puerto_ocupado' | 'error' };

function mismoToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** Host permitido: 127.0.0.1 o localhost con el puerto en el que escuchamos. */
export function hostPermitido(host: string | undefined, puerto: number): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  return h === `127.0.0.1:${puerto}` || h === `localhost:${puerto}`;
}

export function crearServidorObs(dep: DependenciasServidorObs) {
  let servidor: Server | null = null;
  let puertoActual: number | null = null;
  const clientes = new Set<ServerResponse>();

  function responder(res: ServerResponse, estado: number, tipo: string | null, cuerpo: string, cabecera = false): void {
    const cabeceras: Record<string, string> = { ...CABECERAS_SEGURIDAD };
    if (tipo) cabeceras['Content-Type'] = tipo;
    cabeceras['Content-Length'] = String(Buffer.byteLength(cuerpo));
    res.writeHead(estado, cabeceras);
    res.end(cabecera ? undefined : cuerpo);
  }
  const noEncontrado = (res: ServerResponse) => responder(res, 404, 'text/plain; charset=utf-8', 'Not found');

  function eventos(req: IncomingMessage, res: ServerResponse): void {
    if (clientes.size >= MAX_CLIENTES_SSE) return responder(res, 503, 'text/plain; charset=utf-8', 'Busy');
    res.writeHead(200, { ...CABECERAS_SEGURIDAD, 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive' });
    const mandar = (v: VistaObs) => res.write(`data: ${JSON.stringify(v)}\n\n`);
    mandar(dep.vista());
    const dejar = dep.alCambiar(mandar);
    const latido = setInterval(() => res.write(': latido\n\n'), LATIDO_MS);
    clientes.add(res);
    const cerrar = () => {
      clearInterval(latido);
      dejar();
      clientes.delete(res);
    };
    req.on('close', cerrar);
    res.on('close', cerrar);
  }

  function atender(req: IncomingMessage, res: ServerResponse): void {
    try {
      if (puertoActual === null || !hostPermitido(req.headers.host, puertoActual)) return noEncontrado(res);
      if (req.method !== 'GET' && req.method !== 'HEAD') return noEncontrado(res);
      const ruta = (req.url ?? '/').split('?')[0]!;
      const partes = ruta.split('/');
      // ['', token, recurso]
      if (partes.length < 2 || partes.length > 3 || !mismoToken(partes[1] ?? '', dep.token())) return noEncontrado(res);
      const recurso = partes.length === 3 ? partes[2] : null;
      const cabecera = req.method === 'HEAD';
      switch (recurso) {
        case null:
          // /<token> sin barra: a /<token>/ para que las rutas relativas de la página funcionen.
          res.writeHead(301, { ...CABECERAS_SEGURIDAD, Location: `/${partes[1]}/`, 'Content-Length': '0' });
          return void res.end();
        case '':
          return responder(res, 200, 'text/html; charset=utf-8', HTML_OBS, cabecera);
        case 'app.js':
          return responder(res, 200, 'text/javascript; charset=utf-8', JS_OBS, cabecera);
        case 'estilo.css':
          return responder(res, 200, 'text/css; charset=utf-8', CSS_OBS, cabecera);
        case 'estado':
          return responder(res, 200, 'application/json; charset=utf-8', JSON.stringify(dep.vista()), cabecera);
        case 'eventos':
          return cabecera ? responder(res, 200, 'text/event-stream; charset=utf-8', '', true) : eventos(req, res);
        default:
          return noEncontrado(res);
      }
    } catch {
      if (!res.headersSent) noEncontrado(res);
      else res.end();
    }
  }

  async function detener(): Promise<void> {
    const s = servidor;
    servidor = null;
    puertoActual = null;
    for (const c of clientes) c.destroy();
    clientes.clear();
    if (!s) return;
    await new Promise<void>((listo) => {
      s.close(() => listo());
      s.closeAllConnections?.();
    });
  }

  return {
    /** Arranca (o rearranca) en ese puerto, solo en 127.0.0.1. Con `puerto` 0, uno libre cualquiera (pruebas). */
    async arrancar(puerto: number): Promise<ResultadoArranque> {
      await detener();
      const s = (dep.crear ?? createServer)(atender);
      // Sin tiempo de espera de las peticiones: el SSE queda abierto mientras OBS tenga la fuente.
      s.requestTimeout = 0;
      s.headersTimeout = 10_000;
      return new Promise<ResultadoArranque>((resolver) => {
        const alError = (e: NodeJS.ErrnoException) => {
          s.close();
          resolver({ ok: false, error: e.code === 'EADDRINUSE' || e.code === 'EACCES' ? 'puerto_ocupado' : 'error' });
        };
        s.once('error', alError);
        s.listen({ port: puerto, host: HOST_OBS, exclusive: true }, () => {
          s.off('error', alError);
          const direccion = s.address();
          servidor = s;
          puertoActual = typeof direccion === 'object' && direccion ? direccion.port : puerto;
          resolver({ ok: true, puerto: puertoActual });
        });
      });
    },
    detener,
    /** Corta las conexiones SSE abiertas (al cambiar el token: la URL anterior deja de recibir datos al momento). */
    cortarClientes(): void {
      for (const c of clientes) c.destroy();
      clientes.clear();
    },
    puerto: () => puertoActual,
    escuchando: () => servidor !== null,
  };
}

export type ServidorObs = ReturnType<typeof crearServidorObs>;
