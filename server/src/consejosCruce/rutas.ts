import Anthropic from '@anthropic-ai/sdk';
import type { FastifyInstance } from 'fastify';
import {
  esIdCampeonFicha,
  IDIOMAS_IA,
  normalizarConsejosEnfrentamiento,
  PARTIDAS_ENFRENTAMIENTO_FIABLE,
  ROLES,
  type ConsejosEnfrentamiento,
  type IdiomaIa,
  type Rol,
} from '@coach/shared';
import type { Db } from '../db';
import { crearConsultasEnfrentamientos } from '../enfrentamientos';
import { claveIp } from '../ip';
import type { CrearMensajeIa } from '../coachIa/rutas';
import { crearFuenteDDragonFicha, type FuenteDDragonFicha } from '../ficha/ddragon';
import { generarConsejosCruce } from './generar';
import type { CifrasCruce } from './prompts';

/*
 * GET /enfrentamiento-consejos/:campeon/:rival/:rol?idioma=es (RUTAS_CONSEJOS_ENFRENTAMIENTO de
 * shared/src/consejosEnfrentamiento.ts), mejora 12 del estudio de la competencia.
 *
 * Como la ficha del campeón: los consejos se generan con la IA la primera vez que alguien los pide y se guardan en
 * SQLite por (campeón, rival, rol, idioma, versión de Data Dragon); dentro del mismo parche no se vuelven a generar.
 * Un tope global diario de generaciones (CRUCE_CONSEJOS_MAX_DIA, 600 por defecto) y otro por IP
 * (CRUCE_CONSEJOS_IP_DIA, 40) acotan el gasto; servir unos consejos ya guardados no cuenta. Sin ANTHROPIC_API_KEY la
 * ruta responde 503. No usa la API de Riot: Data Dragon y la tabla de enfrentamientos que ya calcula el recolector.
 */

export const LIMITES_CONSEJOS_CRUCE_SERVIDOR = { maxDia: 600, ipDia: 40 } as const;

export interface OpcionesConsejosCruce {
  crear: CrearMensajeIa;
  modelo: string;
  /** Generaciones nuevas al día en todo el servidor. */
  maxDia?: number;
  /** Generaciones nuevas al día por IP. */
  ipDia?: number;
  /** Data Dragon (sustituible en las pruebas). */
  fuente?: FuenteDDragonFicha;
  ahora?: () => number;
}

export function asegurarTablaConsejosCruce(db: Db): void {
  db.sql.exec(`
    CREATE TABLE IF NOT EXISTS consejos_cruce (
      campeon TEXT NOT NULL,
      rival TEXT NOT NULL,
      rol TEXT NOT NULL,
      idioma TEXT NOT NULL,
      version TEXT NOT NULL,
      datos TEXT NOT NULL,
      PRIMARY KEY (campeon, rival, rol, idioma, version)
    );
  `);
}

const PREFIJO_TOPE = 'cruce:d:';

/** Tope global diario de generaciones, en `coach_ia_uso` ('cruce:d:AAAA-MM-DD'). False si ya se llegó. */
export function consumirTopeConsejosCruce(db: Db, ahora: number, maxDia: number): boolean {
  const cubo = `${PREFIJO_TOPE}${new Date(ahora).toISOString().slice(0, 10)}`;
  return db.sql.transaction(() => {
    const n = (db.sql.prepare('SELECT n FROM coach_ia_uso WHERE cubo = ?').get(cubo) as { n: number } | undefined)?.n ?? 0;
    if (n >= maxDia) return false;
    db.sql.prepare('INSERT INTO coach_ia_uso (cubo, n) VALUES (?, 1) ON CONFLICT(cubo) DO UPDATE SET n = n + 1').run(cubo);
    const limite = new Date(ahora - 2 * 86_400_000).toISOString().slice(0, 10);
    db.sql.prepare(`DELETE FROM coach_ia_uso WHERE cubo LIKE '${PREFIJO_TOPE}%' AND substr(cubo, ${PREFIJO_TOPE.length + 1}, 10) < ?`).run(limite);
    return true;
  })();
}

/** Segundos hasta la medianoche UTC (Retry-After del tope diario). */
const segundosHastaManana = (ahora: number) => Math.max(60, Math.ceil((86_400_000 - (ahora % 86_400_000)) / 1000));

export function registrarConsejosCruce(app: FastifyInstance, opciones: OpcionesConsejosCruce | null, db: Db): void {
  asegurarTablaConsejosCruce(db);
  const ahora = opciones?.ahora ?? Date.now;
  const fuente = opciones?.fuente ?? crearFuenteDDragonFicha();
  const maxDia = opciones?.maxDia ?? LIMITES_CONSEJOS_CRUCE_SERVIDOR.maxDia;
  const ipDia = opciones?.ipDia ?? LIMITES_CONSEJOS_CRUCE_SERVIDOR.ipDia;
  const porIp = new Map<string, { dia: string; n: number }>();
  const enCurso = new Map<string, Promise<ConsejosEnfrentamiento | null>>();
  const consultas = crearConsultasEnfrentamientos(db.sql);

  const leer = db.sql.prepare('SELECT datos FROM consejos_cruce WHERE campeon = ? AND rival = ? AND rol = ? AND idioma = ? AND version = ?');
  const guardar = db.sql.prepare('INSERT OR REPLACE INTO consejos_cruce (campeon, rival, rol, idioma, version, datos) VALUES (?, ?, ?, ?, ?, ?)');
  // Los de versiones anteriores ya no se sirven: se borran al guardar los nuevos.
  const borrarViejos = db.sql.prepare('DELETE FROM consejos_cruce WHERE campeon = ? AND rival = ? AND rol = ? AND idioma = ? AND version <> ?');

  function consumirIp(ip: string): boolean {
    const dia = new Date(ahora()).toISOString().slice(0, 10);
    const previo = porIp.get(ip);
    const n = previo && previo.dia === dia ? previo.n : 0;
    if (n >= ipDia) return false;
    porIp.set(ip, { dia, n: n + 1 });
    if (porIp.size > 50_000) for (const [k, v] of porIp) if (v.dia !== dia) porIp.delete(k);
    return true;
  }

  /** Cifras agregadas del cruce, solo si son fiables (con pocas partidas la valoración sería ruido). */
  function cifrasDe(campeon: string, rival: string, rol: Rol): CifrasCruce | null {
    try {
      const e = consultas.enfrentamiento(campeon, rival, rol);
      if (!e || e.partidas < PARTIDAS_ENFRENTAMIENTO_FIABLE) return null;
      return { partidas: e.partidas, tasaVictoria: e.tasaVictoria, ...(e.tasaFaseLineas !== undefined ? { tasaFaseLineas: e.tasaFaseLineas } : {}) };
    } catch {
      return null;
    }
  }

  app.get<{ Params: { campeon: string; rival: string; rol: string }; Querystring: { idioma?: string } }>(
    '/enfrentamiento-consejos/:campeon/:rival/:rol',
    async (req, reply) => {
      if (!opciones) return reply.code(503).send({ error: 'ia_no_configurada' });
      const idioma = (req.query.idioma ?? 'es') as IdiomaIa;
      if (!IDIOMAS_IA.includes(idioma)) return reply.code(400).send({ error: 'idioma_invalido' });
      const { rol } = req.params;
      if (!ROLES.includes(rol as Rol)) return reply.code(400).send({ error: 'rol_invalido' });
      if (!esIdCampeonFicha(req.params.campeon) || !esIdCampeonFicha(req.params.rival) || req.params.campeon.toLowerCase() === req.params.rival.toLowerCase()) {
        return reply.code(400).send({ error: 'campeon_invalido' });
      }

      let version: string;
      let campeones: Awaited<ReturnType<FuenteDDragonFicha['campeones']>>;
      try {
        version = await fuente.version();
        campeones = await fuente.campeones(version);
      } catch (e) {
        console.error('[consejos-cruce] Data Dragon no responde:', e instanceof Error ? e.message : String(e));
        return reply.code(502).send({ error: 'ddragon_no_disponible' });
      }
      const campeon = campeones.get(req.params.campeon.toLowerCase());
      const rival = campeones.get(req.params.rival.toLowerCase());
      if (!campeon || !rival) return reply.code(404).send({ error: 'campeon_desconocido' });
      const clave = [campeon.id.toLowerCase(), rival.id.toLowerCase(), rol, idioma] as const;

      const guardados = leer.get(...clave, version) as { datos: string } | undefined;
      if (guardados) {
        const c = normalizarConsejosEnfrentamiento(JSON.parse(guardados.datos));
        if (c) return c;
      }

      const llave = `${clave.join('|')}|${version}`;
      let promesa = enCurso.get(llave);
      if (!promesa) {
        if (!consumirIp(claveIp(req.ip))) return reply.code(429).send({ error: 'limite_diario' });
        if (!consumirTopeConsejosCruce(db, ahora(), maxDia)) {
          console.warn('[consejos-cruce] Se alcanzó el tope global diario (CRUCE_CONSEJOS_MAX_DIA).');
          return reply.code(429).header('Retry-After', String(segundosHastaManana(ahora()))).send({ error: 'limite_global' });
        }
        promesa = (async () => {
          const [datosCampeon, datosRival] = await Promise.all([fuente.detalle(version, campeon.id, idioma), fuente.detalle(version, rival.id, idioma)]);
          if (!datosCampeon || !datosRival) return null;
          const cifras = cifrasDe(campeon.id, rival.id, rol as Rol);
          const consejos = await generarConsejosCruce({ crear: opciones.crear, modelo: opciones.modelo, ahora }, datosCampeon, datosRival, rol as Rol, idioma, cifras);
          if (consejos) {
            db.sql.transaction(() => {
              guardar.run(...clave, version, JSON.stringify(consejos));
              borrarViejos.run(...clave, version);
            })();
          }
          return consejos;
        })().finally(() => enCurso.delete(llave));
        enCurso.set(llave, promesa);
      }
      try {
        const consejos = await promesa;
        if (!consejos) return reply.code(502).send({ error: 'consejos_no_disponibles' });
        return consejos;
      } catch (e) {
        if (e instanceof Anthropic.APIError) console.error(`[consejos-cruce] Error de la API de Anthropic (${e.status ?? '?'})`);
        else console.error('[consejos-cruce] Error inesperado:', e instanceof Error ? e.message : String(e));
        return reply.code(502).send({ error: 'consejos_no_disponibles' });
      }
    },
  );
}
