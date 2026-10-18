import Fastify, { type FastifyInstance } from 'fastify';
import { ROLES, type Rol, type RolesCampeon } from '@coach/shared';
import type { Db } from './db';
import { registrarPremium, URL_WEB_POR_DEFECTO, type OpcionesPremium } from './premium/rutas';

export function crearServidor(db: Db, premium: Partial<OpcionesPremium> = {}): FastifyInstance {
  const app = Fastify();

  app.get('/salud', async () => ({ ok: true }));

  app.get<{ Params: { campeon: string; rol: string } }>(
    '/builds/:campeon/:rol',
    async (req, reply) => {
      const { rol } = req.params;
      // Data Dragon y Match-v5 no siempre coinciden en mayúsculas: el campeón se busca sin distinguirlas.
      const campeon = req.params.campeon.toLowerCase();
      if (!ROLES.includes(rol as Rol)) return reply.code(400).send({ error: 'rol_invalido' });
      const build = db.build(campeon, rol as Rol);
      if (!build) return reply.code(404).send({ error: 'sin_datos' });
      return build;
    },
  );

  app.get<{ Params: { campeon: string } }>('/roles/:campeon', async (req) => {
    const { campeon } = req.params;
    const claveCampeon = campeon.toLowerCase();
    // El parche vigente de un campeón es el de cualquiera de sus builds guardadas.
    let parche: string | undefined;
    for (const rol of ROLES) {
      parche = db.build(claveCampeon, rol)?.parche;
      if (parche) break;
    }
    const respuesta: RolesCampeon = {
      campeon,
      roles: parche ? db.roles(claveCampeon, parche) : [],
    };
    return respuesta;
  });

  registrarPremium(app, db, { urlWeb: URL_WEB_POR_DEFECTO, ...premium });

  return app;
}
