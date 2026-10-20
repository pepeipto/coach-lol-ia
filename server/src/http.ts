import Fastify, { type FastifyInstance } from 'fastify';
import {
  MODO_POR_DEFECTO,
  MODOS_JUEGO,
  PREMIUM_HABILITADO,
  ROLES,
  type ListaCampeones,
  type ModoJuego,
  type Rol,
  type RolesCampeon,
  tieneRoles,
} from '@coach/shared';
import { listaCampeones } from './campeones';
import type { Db } from './db';
import { registrarPremium, URL_WEB_POR_DEFECTO, type OpcionesPremium } from './premium/rutas';
import { registrarAsistente, type OpcionesAsistente } from './asistente/asistente';
import type { RiotApiJugadores } from './riot/riotApi';
import type { EstadoClaveRiot } from './riot/estadoClave';
import { crearCatalogoCampeones } from './jugadores/catalogo';
import { registrarJugadores } from './jugadores/rutas';
import { crearServicioJugadores, type CatalogoCampeones } from './jugadores/servicio';

export function crearServidor(
  db: Db,
  premium: Partial<OpcionesPremium> & {
    trustProxy?: number | false;
    asistente?: OpcionesAsistente | null;
    /** Pantalla de carga (`POST /api/partida/jugadores`); sin cliente de Riot, la ruta responde 503. */
    jugadores?: { api: RiotApiJugadores; catalogo?: CatalogoCampeones } | null;
    /** Registra las rutas de Premium; por defecto, la constante compartida (apagada). */
    premiumHabilitado?: boolean;
    /** Estado de la clave de Riot para /salud; sin él, `riot: 'desconocida'`. */
    claveRiot?: EstadoClaveRiot | null;
  } = {},
): FastifyInstance {
  const { trustProxy, asistente, jugadores, claveRiot, premiumHabilitado = PREMIUM_HABILITADO, ...opcionesPremium } = premium;
  // Solo se confía en los `trustProxy` últimos saltos (los proxies propios): la IP del cliente es la que
  // añadió el último de ellos, y lo que el cliente escriba antes en X-Forwarded-For se ignora.
  const saltos = typeof trustProxy === 'number' && trustProxy > 0 ? trustProxy : 0;
  const app = Fastify({ trustProxy: saltos > 0 ? (_direccion: string, i: number) => i < saltos : false });

  // Salud del servidor y estado de la clave de Riot (solo 'ok' | 'caducada' | 'desconocida' y desde cuándo; nunca
  // la clave). Fly la pide cada 30 s y el aviso de GitHub Actions cada 30 min: si el servidor lleva un rato sin
  // hablar con Riot, se lanza en segundo plano una comprobación barata (como mucho cada 10 min) y no se espera.
  const arranque = new Date().toISOString();
  app.get('/salud', async () => {
    const { riot, riotDesde } = claveRiot ? claveRiot.consultar() : { riot: 'desconocida' as const, riotDesde: arranque };
    return { ok: true, riot, riotDesde };
  });

  // `?modo=` (clasificatoria por defecto): en ARAM, ARAM: Caos y Arena la build es por campeón y el rol se ignora.
  app.get<{ Params: { campeon: string; rol: string }; Querystring: { modo?: string } }>(
    '/builds/:campeon/:rol',
    async (req, reply) => {
      const { rol } = req.params;
      const modo = (req.query.modo ?? MODO_POR_DEFECTO) as ModoJuego;
      if (!MODOS_JUEGO.includes(modo)) return reply.code(400).send({ error: 'modo_invalido' });
      // Data Dragon y Match-v5 no siempre coinciden en mayúsculas: el campeón se busca sin distinguirlas.
      const campeon = req.params.campeon.toLowerCase();
      if (tieneRoles(modo) && !ROLES.includes(rol as Rol)) return reply.code(400).send({ error: 'rol_invalido' });
      const build = db.build(campeon, tieneRoles(modo) ? (rol as Rol) : null, modo);
      if (!build) return reply.code(404).send({ error: 'sin_datos' });
      return build;
    },
  );

  // Lista de campeones con su tier por rol. Se calcula a partir de las builds guardadas y se guarda en
  // memoria (por modo) hasta que cambian las builds, es decir, hasta el siguiente recálculo del ciclo.
  const cacheCampeones = new Map<ModoJuego, { revision: number; lista: ListaCampeones }>();
  app.get<{ Querystring: { modo?: string } }>('/campeones', async (req, reply) => {
    const modo = (req.query.modo ?? MODO_POR_DEFECTO) as ModoJuego;
    if (!MODOS_JUEGO.includes(modo)) return reply.code(400).send({ error: 'modo_invalido' });
    const revision = db.revisionBuilds();
    const enCache = cacheCampeones.get(modo);
    if (enCache && enCache.revision === revision) return enCache.lista;
    const lista = listaCampeones(db.builds(modo), modo);
    cacheCampeones.set(modo, { revision, lista });
    return lista;
  });

  // Track F2: ruta habitual estimada del jungla (dato agregado de partidas terminadas; nunca de una partida en curso).
  // Solo se publica con 30 partidas o más: si no, 404 sin_datos.
  app.get<{ Params: { campeon: string } }>('/jungla/ruta/:campeon', async (req, reply) => {
    const ruta = db.build(req.params.campeon.toLowerCase(), 'JUNGLE')?.rutaJungla;
    if (!ruta) return reply.code(404).send({ error: 'sin_datos' });
    return ruta;
  });

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

  if (premiumHabilitado) {
    registrarPremium(app, db, { urlWeb: URL_WEB_POR_DEFECTO, ...opcionesPremium });
  } else {
    // Coach LoL IA es gratis (políticas de Riot): las rutas de Premium y de Stripe no se registran y
    // cualquier petición a ellas recibe un 404 explícito; el resto de rutas desconocidas, el 404 normal.
    app.setNotFoundHandler((req, reply) => {
      const ruta = req.url.split('?')[0]!;
      if (ruta.startsWith('/api/premium/') || ruta === '/api/premium' || ruta.startsWith('/api/stripe/')) {
        return reply.code(404).send({ error: 'no_disponible' });
      }
      return reply.code(404).send({ message: `Route ${req.method}:${req.url} not found`, error: 'Not Found', statusCode: 404 });
    });
  }
  // Asistente de soporte con IA: sin ANTHROPIC_API_KEY responde 503.
  registrarAsistente(app, asistente ?? null, opcionesPremium.urlWeb ?? URL_WEB_POR_DEFECTO, db);
  // Pantalla de carga: rango oficial, maestría y winrate de los 10 jugadores de la partida.
  registrarJugadores(
    app,
    jugadores
      ? crearServicioJugadores({ api: jugadores.api, db, catalogo: jugadores.catalogo ?? crearCatalogoCampeones() })
      : null,
  );

  return app;
}
