import { EventEmitter } from 'node:events';
import { Agent, get } from 'node:https';
import { registrar } from '../log';
import type { EstadoPartida } from '../../shared/tiposApp';
import { normalizarDatosPartida } from './normalizar';

// El certificado de Riot es autofirmado: se acepta solo para 127.0.0.1 y solo en este agente.
const agente = new Agent({ rejectUnauthorized: false });

type Respuesta = Pick<Response, 'ok' | 'status' | 'json'>;
type Obtener = (url: string) => Promise<Respuesta>;

function obtenerHttps(url: string): Promise<Respuesta> {
  return new Promise((resolve, reject) => {
    const req = get(url, { agent: agente, timeout: 5000 }, (res) => {
      const trozos: Buffer[] = [];
      res.on('data', (t: Buffer) => trozos.push(t));
      res.on('error', reject);
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          json: async () => JSON.parse(Buffer.concat(trozos).toString('utf8')),
        });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function elegirObtener(url: string, inyectado?: typeof fetch): Obtener {
  if (inyectado) return (u) => inyectado(u, { signal: AbortSignal.timeout(5000) });
  if (url.startsWith('https:')) {
    const host = new URL(url).hostname;
    if (host !== '127.0.0.1') throw new Error('El conector solo acepta https hacia 127.0.0.1');
    return obtenerHttps;
  }
  return (u) => fetch(u, { signal: AbortSignal.timeout(5000) });
}

export interface ConectorPartida extends EventEmitter {
  iniciar(): void;
  detener(): void;
}

export function crearConectorPartida(
  o: { url?: string; fetch?: typeof fetch; intervaloMs?: number } = {},
): ConectorPartida {
  const base = (o.url ?? process.env.COACH_LIVE_URL ?? 'https://127.0.0.1:2999').replace(/\/+$/, '');
  const intervaloMs = o.intervaloMs ?? 1000;
  const obtener = elegirObtener(base, o.fetch);
  const emisor = new EventEmitter() as ConectorPartida;
  let temporizador: ReturnType<typeof setInterval> | null = null;
  let enCurso = false;
  let activo = false;
  let ultimoFallo: string | null = null;

  // Solo se registra un fallo cuando cambia, para no inundar coach.log con un sondeo por segundo.
  function fallo(msg: string): void {
    if (msg === ultimoFallo) return;
    ultimoFallo = msg;
    registrar('info', msg);
  }

  async function sondear(): Promise<void> {
    if (enCurso) return;
    enCurso = true;
    try {
      const r = await obtener(`${base}/liveclientdata/allgamedata`);
      if (!r.ok) {
        fallo(`Live Client Data: HTTP ${r.status}`);
        return;
      }
      const estado: EstadoPartida | null = normalizarDatosPartida(await r.json());
      if (!estado) {
        fallo('Live Client Data: datos de partida incompletos o no válidos');
        return;
      }
      if (ultimoFallo !== null) {
        ultimoFallo = null;
        registrar('info', 'Live Client Data: conexión recuperada');
      }
      if (activo) emisor.emit('estado', estado);
    } catch (e) {
      fallo(`Live Client Data: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      enCurso = false;
    }
  }

  emisor.iniciar = () => {
    if (temporizador) return;
    activo = true;
    void sondear();
    temporizador = setInterval(() => void sondear(), intervaloMs);
  };
  emisor.detener = () => {
    activo = false;
    if (temporizador) clearInterval(temporizador);
    temporizador = null;
  };
  return emisor;
}
