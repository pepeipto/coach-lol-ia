import type { FastifyInstance } from 'fastify';
import { ROLES, type Rol } from '@coach/shared';
import { claveIp } from '../ip';
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
  if (j.riotId !== undefined && (typeof j.riotId !== 'string' || j.riotId.length > MAX_RIOT_ID)) return null;
  return {
    puuid: j.puuid,
    campeonId: j.campeonId,
    rol: j.rol as Rol | null,
    equipo: j.equipo,
    ...(typeof j.riotId === 'string' ? { riotId: j.riotId } : {}),
  };
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

/**
 * `POST /api/partida/jugadores`: rango oficial, maestría, winrate del campeón y etiquetas de los
 * jugadores de la pantalla de carga. Sin cliente de Riot responde 503; 6 peticiones por minuto y por IP.
 */
export function registrarJugadores(
  app: FastifyInstance,
  servicio: ServicioJugadores | null,
  ahora: () => number = Date.now,
): void {
  const peticiones = new Map<string, number[]>();
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
      return { jugadores: await servicio.consultar(peticion.region, peticion.jugadores) };
    });
  });
}
