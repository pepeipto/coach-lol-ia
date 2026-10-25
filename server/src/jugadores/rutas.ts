import type { FastifyInstance } from 'fastify';
import { ROLES, type Rol } from '@coach/shared';
import { claveIp } from '../ip';
import { JUGADORES_MAX_HORA, JUGADORES_MAX_MINUTO } from '../topes';
import { REGIONES, type Region } from '../riot/riotApi';
import type { ServicioJugadores } from './servicio';
import type { JugadorPedido, PeticionJugadores } from './tipos';

export const LIMITE_POR_MINUTO = 6;
const VENTANA_MS = 60_000;
const MAX_JUGADORES = 10;
const MAX_RIOT_ID = 40;
/** Un PUUID de Riot tiene exactamente 78 caracteres de [A-Za-z0-9_-]; vacío para los bots. Nada más. */
export const REGEX_PUUID = /^(?:[A-Za-z0-9_-]{78})?$/;

function validarJugador(x: unknown): JugadorPedido | null {
  if (typeof x !== 'object' || x === null) return null;
  const j = x as Record<string, unknown>;
  if (typeof j.puuid !== 'string' || !REGEX_PUUID.test(j.puuid)) return null;
  if (typeof j.campeonId !== 'number' || !Number.isInteger(j.campeonId) || j.campeonId <= 0 || j.campeonId > 100_000) return null;
  if (j.rol !== null && !ROLES.includes(j.rol as Rol)) return null;
  if (j.equipo !== 'aliado' && j.equipo !== 'enemigo') return null;
  // La app 3.0 ya no manda el Riot ID; si llega (versión de prueba antigua), se valida y se descarta.
  if (j.riotId !== undefined && (typeof j.riotId !== 'string' || j.riotId.length > MAX_RIOT_ID)) return null;
  return { puuid: j.puuid, campeonId: j.campeonId, rol: j.rol as Rol | null, equipo: j.equipo };
}

export function validarPeticion(cuerpo: unknown): PeticionJugadores | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null;
  const c = cuerpo as Record<string, unknown>;
  if (typeof c.region !== 'string' || !Object.hasOwn(REGIONES, c.region)) return null;
  if (!Array.isArray(c.jugadores) || c.jugadores.length === 0 || c.jugadores.length > MAX_JUGADORES) return null;
  const jugadores: JugadorPedido[] = [];
  for (const x of c.jugadores) {
    const j = validarJugador(x);
    if (!j) return null;
    jugadores.push(j);
  }
  return { region: c.region as Region, jugadores };
}

/** Topes globales de la ruta (entre todas las IP). */
export interface TopesJugadores {
  maxMinuto: number;
  maxHora: number;
}

/**
 * `POST /api/partida/jugadores`: rango oficial, maestría, winrate del campeón y etiquetas de los
 * jugadores de la pantalla de carga. Sin cliente de Riot responde 503; 6 peticiones por minuto y por IP y, entre
 * todas las IP, `maxMinuto` por minuto y `maxHora` por hora (429 limite_global con Retry-After).
 */
export function registrarJugadores(
  app: FastifyInstance,
  servicio: ServicioJugadores | null,
  ahora: () => number = Date.now,
  topes: Partial<TopesJugadores> = {},
): void {
  const maxMinuto = topes.maxMinuto ?? JUGADORES_MAX_MINUTO;
  const maxHora = topes.maxHora ?? JUGADORES_MAX_HORA;
  const peticiones = new Map<string, number[]>();
  // Cubos fijos de minuto y de hora (en memoria: un reinicio los vacía, que no importa para un tope de minutos).
  const global = { minuto: -1, nMinuto: 0, hora: -1, nHora: 0 };
  /** Suma una petición al tope global; devuelve los segundos que faltan si ya se llegó a él. */
  function consumirGlobal(t: number): number | null {
    const minuto = Math.floor(t / 60_000);
    const hora = Math.floor(t / 3_600_000);
    if (global.minuto !== minuto) Object.assign(global, { minuto, nMinuto: 0 });
    if (global.hora !== hora) Object.assign(global, { hora, nHora: 0 });
    if (global.nHora >= maxHora) return Math.max(1, Math.ceil(((hora + 1) * 3_600_000 - t) / 1000));
    if (global.nMinuto >= maxMinuto) return Math.max(1, Math.ceil(((minuto + 1) * 60_000 - t) / 1000));
    global.nMinuto++;
    global.nHora++;
    return null;
  }
  if (servicio) app.addHook('onClose', async () => servicio.detener());

  app.register(async (jugadores) => {
    // Un JSON mal formado o un cuerpo vacío también es un 400 de validación.
    jugadores.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, cuerpo, hecho) => {
      try {
        hecho(null, String(cuerpo).trim() ? JSON.parse(String(cuerpo)) : null);
      } catch {
        hecho(null, null);
      }
    });

    jugadores.post('/api/partida/jugadores', async (req, reply) => {
      if (!servicio) return reply.code(503).send({ error: 'no_disponible' });
      const t = ahora();
      const ip = claveIp(req.ip);
      const recientes = (peticiones.get(ip) ?? []).filter((x) => t - x < VENTANA_MS);
      recientes.push(t);
      peticiones.set(ip, recientes);
      if (peticiones.size > 10_000) {
        for (const [clave, ts] of peticiones) if (ts.every((x) => t - x >= VENTANA_MS)) peticiones.delete(clave);
      }
      if (recientes.length > LIMITE_POR_MINUTO) return reply.code(429).send({ error: 'limite' });

      const peticion = validarPeticion(req.body);
      if (!peticion) return reply.code(400).send({ error: 'peticion_no_valida' });
      const espera = consumirGlobal(t);
      if (espera !== null) {
        console.warn('[jugadores] Se alcanzó el tope global de la pantalla de carga (JUGADORES_MAX_MINUTO / _HORA).');
        return reply.code(429).header('Retry-After', String(espera)).send({ error: 'limite_global' });
      }
      return { jugadores: await servicio.consultar(peticion.region, peticion.jugadores) };
    });
  });
}
