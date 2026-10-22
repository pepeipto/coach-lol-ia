import { Agent, request } from 'node:https';
import WebSocket from 'ws';
import type { CredencialesLcu } from './lockfile';

export class ErrorLcu extends Error {
  constructor(
    public estado: number,
    mensaje: string,
    /** 3.6: segundos de `Retry-After` en un 429 (null si no los dice). */
    public reintentarEn: number | null = null,
  ) {
    super(mensaje);
    this.name = 'ErrorLcu';
  }
}

/** 3.6: como mucho estas peticiones a la vez a la LCU (Riot limita las peticiones al cliente). */
export const MAX_PETICIONES_A_LA_VEZ = 3;
/** Reintentos ante un 429 de la LCU, esperando lo que diga `Retry-After` (o 1 s, 2 s…). */
export const REINTENTOS_429 = 2;

/** Cola sencilla: deja pasar `max` tareas a la vez y el resto espera su turno, en orden. */
export function crearCola(max: number) {
  let activas = 0;
  const esperando: (() => void)[] = [];
  return async function enCola<T>(tarea: () => Promise<T>): Promise<T> {
    if (activas >= max) await new Promise<void>((r) => esperando.push(r));
    activas++;
    try {
      return await tarea();
    } finally {
      activas--;
      esperando.shift()?.();
    }
  };
}

/** Repite una petición que responde 429, esperando lo que pida el cliente. */
export async function conReintentos<T>(pedir: () => Promise<T>, esperar: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<T> {
  for (let intento = 0; ; intento++) {
    try {
      return await pedir();
    } catch (e) {
      if (!(e instanceof ErrorLcu) || e.estado !== 429 || intento >= REINTENTOS_429) throw e;
      await esperar(Math.min(10_000, (e.reintentarEn ?? 2 ** intento) * 1000));
    }
  }
}

export interface EventoLcu {
  uri: string;
  eventType: string;
  data: unknown;
}

export interface ClienteLcu {
  peticion<T = unknown>(metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<T>;
  suscribir(evento: string, cb: (datos: EventoLcu) => void): void;
  /** Registra un callback para cuando se cierre el WebSocket. */
  alCerrar?(cb: () => void): void;
  cerrar(): void;
}

// Certificado autofirmado de Riot: se acepta solo en estas conexiones locales a 127.0.0.1.
const TIEMPO_LIMITE_MS = 5000;
const agente = new Agent({ rejectUnauthorized: false });

export async function crearClienteLcu(c: CredencialesLcu): Promise<ClienteLcu> {
  const auth = 'Basic ' + Buffer.from(`riot:${c.password}`).toString('base64');
  const oyentes = new Map<string, Array<(d: EventoLcu) => void>>();
  const alCerrar: Array<() => void> = [];

  const ws = new WebSocket(`wss://127.0.0.1:${c.puerto}/`, {
    headers: { Authorization: auth },
    agent: agente,
    rejectUnauthorized: false,
    handshakeTimeout: TIEMPO_LIMITE_MS,
  });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  ws.on('error', () => undefined);
  ws.on('close', () => alCerrar.forEach((cb) => cb()));
  ws.on('message', (crudo) => {
    try {
      const msg = JSON.parse(crudo.toString()) as unknown;
      if (!Array.isArray(msg) || msg[0] !== 8) return;
      const lista = oyentes.get(String(msg[1]));
      if (lista && msg[2]) lista.forEach((cb) => cb(msg[2] as EventoLcu));
    } catch {
      // mensaje no JSON: ignorar
    }
  });

  function peticionUna<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const datos = cuerpo === undefined ? null : JSON.stringify(cuerpo);
        const req = request(
          {
            host: '127.0.0.1',
            port: c.puerto,
            path: ruta,
            method: metodo,
            agent: agente,
            headers: {
              Authorization: auth,
              Accept: 'application/json',
              ...(datos ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(datos) } : {}),
            },
          },
          (res) => {
            const trozos: Buffer[] = [];
            res.on('data', (t: Buffer) => trozos.push(t));
            res.on('end', () => {
              const texto = Buffer.concat(trozos).toString('utf8');
              const estado = res.statusCode ?? 0;
              if (estado < 200 || estado >= 300) {
                const espera = Number(res.headers['retry-after']);
                reject(new ErrorLcu(estado, `LCU ${metodo} ${ruta} respondió ${estado}`, Number.isFinite(espera) && espera >= 0 ? espera : null));
                return;
              }
              if (!texto) return resolve(undefined as T);
              try {
                resolve(JSON.parse(texto) as T);
              } catch {
                resolve(texto as T);
              }
            });
          },
        );
        req.setTimeout(TIEMPO_LIMITE_MS, () => {
          const e = new ErrorLcu(0, `LCU ${metodo} ${ruta}: tiempo de espera agotado`);
          req.destroy(e);
          reject(e);
        });
        req.on('error', reject);
        if (datos) req.write(datos);
        req.end();
      });
  }

  // 3.6: todas las peticiones pasan por la cola (como mucho 3 a la vez) y se reintentan ante un 429.
  const enCola = crearCola(MAX_PETICIONES_A_LA_VEZ);
  return {
    peticion<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
      return enCola(() => conReintentos(() => peticionUna<T>(metodo, ruta, cuerpo)));
    },
    suscribir(evento, cb) {
      const lista = oyentes.get(evento) ?? [];
      lista.push(cb);
      oyentes.set(evento, lista);
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify([5, evento]));
    },
    alCerrar(cb) {
      alCerrar.push(cb);
    },
    cerrar() {
      try {
        ws.close();
      } catch {
        // ignorar
      }
    },
  };
}
