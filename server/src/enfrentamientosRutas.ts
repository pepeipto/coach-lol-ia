import type { FastifyInstance } from 'fastify';
import { ROLES, type Rol } from '@coach/shared';
import type { Db } from './db';
import { crearConsultasEnfrentamientos } from './enfrentamientos';

/** Nombres de campeón aceptados en la URL: letras y números (ids de Data Dragon y `championName` de Match-v5). */
const REGEX_CAMPEON = /^[A-Za-z0-9]{1,40}$/;

/**
 * 3.9 «Counters»: rutas de `RUTAS_COUNTERS` (shared/src/counters.ts).
 * - `GET /counters/:campeon/:rol` → `CountersCampeon`.
 * - `GET /enfrentamiento/:campeon/:rival/:rol` → `Enfrentamiento`.
 * 400 `campeon_invalido` / `rol_invalido` con parámetros no válidos; 404 `sin_datos` si no hay datos. El campeón se
 * busca sin distinguir mayúsculas (Data Dragon y Match-v5 no siempre coinciden).
 */
export function registrarCounters(app: FastifyInstance, db: Db): void {
  const consultas = crearConsultasEnfrentamientos(db.sql);

  app.get<{ Params: { campeon: string; rol: string } }>('/counters/:campeon/:rol', async (req, reply) => {
    const { campeon, rol } = req.params;
    if (!REGEX_CAMPEON.test(campeon)) return reply.code(400).send({ error: 'campeon_invalido' });
    if (!ROLES.includes(rol as Rol)) return reply.code(400).send({ error: 'rol_invalido' });
    const counters = consultas.counters(campeon, rol as Rol);
    if (!counters) return reply.code(404).send({ error: 'sin_datos' });
    return counters;
  });

  app.get<{ Params: { campeon: string; rival: string; rol: string } }>(
    '/enfrentamiento/:campeon/:rival/:rol',
    async (req, reply) => {
      const { campeon, rival, rol } = req.params;
      if (!REGEX_CAMPEON.test(campeon) || !REGEX_CAMPEON.test(rival)) return reply.code(400).send({ error: 'campeon_invalido' });
      if (!ROLES.includes(rol as Rol)) return reply.code(400).send({ error: 'rol_invalido' });
      const cruce = consultas.enfrentamiento(campeon, rival, rol as Rol);
      if (!cruce) return reply.code(404).send({ error: 'sin_datos' });
      return cruce;
    },
  );
}
