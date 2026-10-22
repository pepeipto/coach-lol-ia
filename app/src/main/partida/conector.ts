import { EventEmitter } from 'node:events';
import { Agent, get } from 'node:https';
import { registrar } from '../log';
import type { EstadoPartida } from '../../shared/tiposApp';
import { normalizarDatosPartida } from './normalizar';

// El certificado de Riot es autofirmado: se acepta solo para 127.0.0.1 y solo en este agente.
const agente = new Agent({ rejectUnauthorized: false });

type Respuesta = Pick<Response, 'ok' | 'status' | 'json'>;
type Obtener = (url: string) => Promise<Respuesta>;

function obtenerHttps(url: string, tiempoMs = 5000): Promise<Respuesta> {
  return new Promise((resolve, reject) => {
    const req = get(url, { agent: agente, timeout: tiempoMs }, (res) => {
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

function elegirObtener(url: string, inyectado?: typeof fetch, tiempoMs = 5000): Obtener {
  if (inyectado) return (u) => inyectado(u, { signal: AbortSignal.timeout(tiempoMs) });
  if (url.startsWith('https:')) {
    const host = new URL(url).hostname;
    if (host !== '127.0.0.1') throw new Error('El conector solo acepta https hacia 127.0.0.1');
    return (u) => obtenerHttps(u, tiempoMs);
  }
  return (u) => fetch(u, { signal: AbortSignal.timeout(tiempoMs) });
}

/**
 * Segundos de partida a partir de los cuales se da por empezada. Durante la pantalla de carga la Live Client
 * Data API ya responde, pero con `gameTime` ≈ 0 (el reloj del juego no corre hasta que todos han cargado);
 * en cuanto la partida empieza, el reloj avanza 1 s por segundo. Con 1,5 s el margen absorbe valores
 * residuales de la carga (0,0x…) y el aviso solo llega ~1-2 s tarde, oculto bajo la cuenta atrás inicial.
 */
export const SEGUNDOS_PARTIDA_EMPEZADA = 1.5;

/**
 * Pregunta una vez a la Live Client Data API (`/liveclientdata/gamestats`) si la partida ya se juega: true si
 * responde con un `gameTime` mayor que SEGUNDOS_PARTIDA_EMPEZADA. Lo usa la pantalla de carga para retirarse
 * en cuanto la partida empieza (y no antes: en la carga la API ya responde con gameTime ≈ 0).
 */
export function crearSondaPartida(o: { url?: string; fetch?: typeof fetch } = {}): () => Promise<boolean> {
  const base = (o.url ?? process.env.COACH_LIVE_URL ?? 'https://127.0.0.1:2999').replace(/\/+$/, '');
  const obtener = elegirObtener(base, o.fetch, 900);
  return async () => {
    try {
      const r = await obtener(`${base}/liveclientdata/gamestats`);
      if (!r.ok) return false;
      const datos = (await r.json()) as { gameTime?: unknown } | null;
      const t = datos?.gameTime;
      return typeof t === 'number' && Number.isFinite(t) && t > SEGUNDOS_PARTIDA_EMPEZADA;
    } catch {
      return false;
    }
  };
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

  // Cada fallo se emite ('fallo'), pero solo se registra cuando cambia, para no inundar coach.log con un sondeo por segundo.
  function fallo(msg: string): void {
    if (activo) emisor.emit('fallo');
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
