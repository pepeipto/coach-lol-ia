import type { FastifyInstance } from 'fastify';
import type { Db } from '../db';
import { crearAlmacenTft } from './datos';
import type { EstadoTft, ObjetosCampeonTft, ResultadoTft } from './estadisticas';

/** Id interno de una unidad de TFT («TFT15_Ahri»). */
const REGEX_UNIDAD = /^TFT\d{1,2}_[A-Za-z0-9]{1,40}$/i;

/**
 * TFT (fuera de partida):
 * - `GET /tft/comps` → `ResultadoTft` (composiciones del parche con su tier).
 * - `GET /tft/campeon/:id` → `ObjetosCampeonTft` (mejores juegos de objetos de la unidad).
 * - `GET /tft/estado` → `EstadoTft` del último ciclo (`{ activo: false }` si el recolector aún no ha corrido).
 * 404 `sin_datos` hasta que el recolector de TFT tenga partidas; 400 `campeon_invalido` con un id raro.
 */
export function registrarTft(app: FastifyInstance, db: Db): void {
  const almacen = crearAlmacenTft(db.sql);
  app.get('/tft/comps', async (_req, reply) => {
    const r = almacen.estadistica<ResultadoTft>('comps', 'todas');
    if (!r) return reply.code(404).send({ error: 'sin_datos' });
    return r;
  });
  app.get('/tft/estado', async () => almacen.estadistica<EstadoTft>('estado', 'ultimo') ?? { activo: false });
  app.get<{ Params: { id: string } }>('/tft/campeon/:id', async (req, reply) => {
    const { id } = req.params;
    if (!REGEX_UNIDAD.test(id)) return reply.code(400).send({ error: 'campeon_invalido' });
    const r = almacen.estadistica<ObjetosCampeonTft>('objetos', id.toLowerCase());
    if (!r) return reply.code(404).send({ error: 'sin_datos' });
    return r;
  });
}
