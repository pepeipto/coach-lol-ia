import Anthropic from '@anthropic-ai/sdk';
import type { FastifyInstance } from 'fastify';
import { esIdCampeonFicha, IDIOMAS_IA, normalizarFicha, type FichaCampeon, type IdiomaIa } from '@coach/shared';
import type { Db } from '../db';
import { claveIp } from '../ip';
import type { CrearMensajeIa } from '../coachIa/rutas';
import { asegurarTablaDanio, leerDanio } from './danio';
import { crearFuenteDDragonFicha, type FuenteDDragonFicha } from './ddragon';
import { generarFicha } from './generar';

/*
 * GET /ficha/:campeon?idioma=es (RUTAS_FICHA de shared/src/ficha.ts).
 *
 * La ficha se genera con la IA la primera vez que alguien la pide y se guarda en SQLite por (campeón, idioma,
 * versión de Data Dragon): dentro del mismo parche no se vuelve a generar nunca. Un tope global diario de
 * generaciones (FICHA_MAX_DIA, 400 por defecto) y otro por IP (FICHA_IP_DIA) acotan el gasto; servir una ficha ya
 * guardada no cuenta. El desglose de daño se añade al servir (cambia con cada recálculo de las builds).
 * Sin ANTHROPIC_API_KEY la ruta responde 503. No usa la API de Riot.
 */

export const LIMITES_FICHA_SERVIDOR = { maxDia: 400, ipDia: 30 } as const;

export interface OpcionesFicha {
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

export function asegurarTablaFichas(db: Db): void {
  db.sql.exec(`
    CREATE TABLE IF NOT EXISTS fichas_campeon (
      campeon TEXT NOT NULL,
      idioma TEXT NOT NULL,
      version TEXT NOT NULL,
      datos TEXT NOT NULL,
      PRIMARY KEY (campeon, idioma, version)
    );
  `);
  asegurarTablaDanio(db.sql);
}

/** Tope global diario de generaciones, en `coach_ia_uso` ('ficha:d:AAAA-MM-DD'). False si ya se llegó. */
export function consumirTopeFicha(db: Db, ahora: number, maxDia: number): boolean {
  const cubo = `ficha:d:${new Date(ahora).toISOString().slice(0, 10)}`;
  return db.sql.transaction(() => {
    const n = (db.sql.prepare('SELECT n FROM coach_ia_uso WHERE cubo = ?').get(cubo) as { n: number } | undefined)?.n ?? 0;
    if (n >= maxDia) return false;
    db.sql.prepare('INSERT INTO coach_ia_uso (cubo, n) VALUES (?, 1) ON CONFLICT(cubo) DO UPDATE SET n = n + 1').run(cubo);
    const limite = new Date(ahora - 2 * 86_400_000).toISOString().slice(0, 10);
    db.sql.prepare("DELETE FROM coach_ia_uso WHERE cubo LIKE 'ficha:d:%' AND substr(cubo, 9, 10) < ?").run(limite);
    return true;
  })();
}

/** Segundos hasta la medianoche UTC (Retry-After del tope diario). */
const segundosHastaManana = (ahora: number) => Math.max(60, Math.ceil((86_400_000 - (ahora % 86_400_000)) / 1000));

export function registrarFicha(app: FastifyInstance, opciones: OpcionesFicha | null, db: Db): void {
  asegurarTablaFichas(db);
  const ahora = opciones?.ahora ?? Date.now;
  const fuente = opciones?.fuente ?? crearFuenteDDragonFicha();
  const maxDia = opciones?.maxDia ?? LIMITES_FICHA_SERVIDOR.maxDia;
  const ipDia = opciones?.ipDia ?? LIMITES_FICHA_SERVIDOR.ipDia;
  const porIp = new Map<string, { dia: string; n: number }>();
  const enCurso = new Map<string, Promise<Omit<FichaCampeon, 'danio'> | null>>();

  const leer = db.sql.prepare('SELECT datos FROM fichas_campeon WHERE campeon = ? AND idioma = ? AND version = ?');
  const guardar = db.sql.prepare('INSERT OR REPLACE INTO fichas_campeon (campeon, idioma, version, datos) VALUES (?, ?, ?, ?)');
  // Las fichas de versiones anteriores ya no se sirven: se borran al guardar la nueva.
  const borrarViejas = db.sql.prepare('DELETE FROM fichas_campeon WHERE campeon = ? AND idioma = ? AND version <> ?');

  function consumirIp(ip: string): boolean {
    const dia = new Date(ahora()).toISOString().slice(0, 10);
    const previo = porIp.get(ip);
    const n = previo && previo.dia === dia ? previo.n : 0;
    if (n >= ipDia) return false;
    porIp.set(ip, { dia, n: n + 1 });
    if (porIp.size > 50_000) for (const [k, v] of porIp) if (v.dia !== dia) porIp.delete(k);
    return true;
  }

  const conDanio = (f: Omit<FichaCampeon, 'danio'>): FichaCampeon => {
    const danio = leerDanio(db.sql, f.campeon);
    return danio ? { ...f, danio } : f;
  };

  app.get<{ Params: { campeon: string }; Querystring: { idioma?: string } }>('/ficha/:campeon', async (req, reply) => {
    if (!opciones) return reply.code(503).send({ error: 'ia_no_configurada' });
    const idioma = (req.query.idioma ?? 'es') as IdiomaIa;
    if (!IDIOMAS_IA.includes(idioma)) return reply.code(400).send({ error: 'idioma_invalido' });
    if (!esIdCampeonFicha(req.params.campeon)) return reply.code(400).send({ error: 'campeon_invalido' });

    let version: string;
    let campeones: Awaited<ReturnType<FuenteDDragonFicha['campeones']>>;
    try {
      version = await fuente.version();
      campeones = await fuente.campeones(version);
    } catch (e) {
      console.error('[ficha] Data Dragon no responde:', e instanceof Error ? e.message : String(e));
      return reply.code(502).send({ error: 'ddragon_no_disponible' });
    }
    const campeon = campeones.get(req.params.campeon.toLowerCase());
    if (!campeon) return reply.code(404).send({ error: 'campeon_desconocido' });
    const clave = campeon.id.toLowerCase();

    const guardada = leer.get(clave, idioma, version) as { datos: string } | undefined;
    if (guardada) {
      const f = normalizarFicha(JSON.parse(guardada.datos));
      if (f) return conDanio(f);
    }

    const llave = `${clave}|${idioma}|${version}`;
    let promesa = enCurso.get(llave);
    if (!promesa) {
      if (!consumirIp(claveIp(req.ip))) return reply.code(429).send({ error: 'limite_diario' });
      if (!consumirTopeFicha(db, ahora(), maxDia)) {
        console.warn('[ficha] Se alcanzó el tope global diario de fichas (FICHA_MAX_DIA).');
        return reply.code(429).header('Retry-After', String(segundosHastaManana(ahora()))).send({ error: 'limite_global' });
      }
      promesa = (async () => {
        const datos = await fuente.detalle(version, campeon.id, idioma);
        if (!datos) return null;
        const ficha = await generarFicha({ crear: opciones.crear, modelo: opciones.modelo, ahora }, datos, idioma, campeones);
        if (ficha) {
          db.sql.transaction(() => {
            guardar.run(clave, idioma, version, JSON.stringify(ficha));
            borrarViejas.run(clave, idioma, version);
          })();
        }
        return ficha;
      })().finally(() => enCurso.delete(llave));
      enCurso.set(llave, promesa);
    }
    try {
      const ficha = await promesa;
      if (!ficha) return reply.code(502).send({ error: 'ficha_no_disponible' });
      return conDanio(ficha);
    } catch (e) {
      if (e instanceof Anthropic.APIError) console.error(`[ficha] Error de la API de Anthropic (${e.status ?? '?'})`);
      else console.error('[ficha] Error inesperado:', e instanceof Error ? e.message : String(e));
      return reply.code(502).send({ error: 'ficha_no_disponible' });
    }
  });
}
