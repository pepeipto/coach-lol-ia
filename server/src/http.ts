import Fastify, { type FastifyInstance } from 'fastify';
import { ROLES, type Rol, type RolesCampeon } from '@coach/shared';
import type { Db } from './db';

export function crearServidor(db: Db): FastifyInstance {
  const app = Fastify();

  app.get('/salud', async () => ({ ok: true }));

  app.get<{ Params: { campeon: string; rol: string } }>(
    '/builds/:campeon/:rol',
    async (req, reply) => {
      const { campeon, rol } = req.params;
      if (!ROLES.includes(rol as Rol)) return reply.code(400).send({ error: 'rol_invalido' });
      const build = db.build(campeon, rol as Rol);
      if (!build) return reply.code(404).send({ error: 'sin_datos' });
      return build;
    },
  );

  app.get<{ Params: { campeon: string } }>('/roles/:campeon', async (req) => {
    const { campeon } = req.params;
    // El parche vigente de un campeón es el de cualquiera de sus builds guardadas.
    let parche: string | undefined;
    for (const rol of ROLES) {
      parche = db.build(campeon, rol)?.parche;
      if (parche) break;
    }
    const respuesta: RolesCampeon = {
      campeon,
      roles: parche ? db.roles(campeon, parche) : [],
    };
    return respuesta;
  });

  return app;
}
