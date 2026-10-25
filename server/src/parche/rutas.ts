import Anthropic from '@anthropic-ai/sdk';
import type { FastifyInstance } from 'fastify';
import {
  IDIOMAS_IA,
  normalizarNotasParche,
  parcheDDragonDe,
  parcheDeVersion,
  parcheJuegoDeDDragon,
  urlDatosDDragon,
  type IdiomaIa,
  type NotasParche,
} from '@coach/shared';
import type { Db } from '../db';
import type { CrearMensajeIa } from '../coachIa/rutas';
import { generarResumen } from './generar';
import { descargarNotas, extraerNotas, type ListasDDragon, type NotasExtraidas } from './notas';

/*
 * Novedades del parche: GET /parche/:parche?idioma=es (RUTAS_PARCHE de shared/src/parche.ts).
 *
 * El ciclo del servidor (programacion.ts) llama a `actualizar(version)` con la versión de Data Dragon de cada ciclo: si
 * aún no tiene las notas de ese parche, descarga la página oficial en inglés, lee los cambios de campeones y objetos
 * (notas.ts) y los guarda en SQLite; después pide a la IA el resumen en los idiomas que falten. Si algo falla (notas
 * aún no publicadas, formato que no se puede leer, la IA), lo registra y se reintenta en el siguiente ciclo.
 *
 * La ruta sirve el resumen guardado por (parche, idioma); si las notas están leídas pero falta ese idioma, lo genera
 * en el momento. Un tope global diario (PARCHE_MAX_DIA, 20 por defecto) acota el gasto. Sin ANTHROPIC_API_KEY la ruta
 * responde 503; sin notas legibles del parche, 404 `sin_notas`. No usa la API de Riot.
 */

export const LIMITES_PARCHE_SERVIDOR = { maxDia: 20 } as const;
/** Parches que se conservan en la base de datos. */
const PARCHES_GUARDADOS = 3;
const TIEMPO_DDRAGON_MS = 15_000;

export interface OpcionesParche {
  crear: CrearMensajeIa;
  modelo: string;
  /** Resúmenes nuevos al día en todo el servidor. */
  maxDia?: number;
  ahora?: () => number;
}

export function asegurarTablasParche(db: Db): void {
  db.sql.exec(`
    -- Cambios de campeones y objetos leídos de las notas oficiales en inglés (texto para la IA; no se sirve).
    CREATE TABLE IF NOT EXISTS notas_parche_fuente (
      parche TEXT PRIMARY KEY,
      datos TEXT NOT NULL,
      obtenido TEXT NOT NULL
    );
    -- Resumen ya escrito por la IA, por parche de Data Dragon e idioma.
    CREATE TABLE IF NOT EXISTS notas_parche (
      parche TEXT NOT NULL,
      idioma TEXT NOT NULL,
      datos TEXT NOT NULL,
      PRIMARY KEY (parche, idioma)
    );
  `);
}

/** «16.9» < «16.21»: orden numérico de parches. */
const compararParches = (a: string, b: string) => {
  const [a1, a2] = a.split('.').map(Number);
  const [b1, b2] = b.split('.').map(Number);
  return a1 - b1 || a2 - b2;
};

/** Tope global diario de resúmenes, en `coach_ia_uso` ('parche:d:AAAA-MM-DD'). False si ya se llegó. */
export function consumirTopeParche(db: Db, ahora: number, maxDia: number): boolean {
  const cubo = `parche:d:${new Date(ahora).toISOString().slice(0, 10)}`;
  return db.sql.transaction(() => {
    const n = (db.sql.prepare('SELECT n FROM coach_ia_uso WHERE cubo = ?').get(cubo) as { n: number } | undefined)?.n ?? 0;
    if (n >= maxDia) return false;
    db.sql.prepare('INSERT INTO coach_ia_uso (cubo, n) VALUES (?, 1) ON CONFLICT(cubo) DO UPDATE SET n = n + 1').run(cubo);
    const limite = new Date(ahora - 2 * 86_400_000).toISOString().slice(0, 10);
    db.sql.prepare("DELETE FROM coach_ia_uso WHERE cubo LIKE 'parche:d:%' AND substr(cubo, 10, 10) < ?").run(limite);
    return true;
  })();
}

export type ResultadoNotas = { estado: 'ok'; notas: NotasParche } | { estado: 'sin_notas' | 'sin_ia' | 'limite' | 'error' };

export interface ServicioParche {
  /** Paso del ciclo: lee las notas de la versión de Data Dragon si faltan y escribe los resúmenes que falten. */
  actualizar(version: string): Promise<void>;
  /** Resumen de un parche de Data Dragon («16.21») o del último con notas («actual»). */
  notas(parche: string, idioma: IdiomaIa): Promise<ResultadoNotas>;
}

export function crearServicioParche(db: Db, opciones: OpcionesParche | null, o: { fetch?: typeof fetch } = {}): ServicioParche {
  asegurarTablasParche(db);
  const hacerFetch = o.fetch ?? fetch;
  const ahora = opciones?.ahora ?? Date.now;
  const maxDia = opciones?.maxDia ?? LIMITES_PARCHE_SERVIDOR.maxDia;
  const enCurso = new Map<string, Promise<NotasParche | null>>();

  const leerFuente = db.sql.prepare('SELECT datos FROM notas_parche_fuente WHERE parche = ?');
  const guardarFuente = db.sql.prepare('INSERT OR REPLACE INTO notas_parche_fuente (parche, datos, obtenido) VALUES (?, ?, ?)');
  const parchesFuente = db.sql.prepare('SELECT parche FROM notas_parche_fuente');
  const leerNotas = db.sql.prepare('SELECT datos FROM notas_parche WHERE parche = ? AND idioma = ?');
  const guardarNotas = db.sql.prepare('INSERT OR REPLACE INTO notas_parche (parche, idioma, datos) VALUES (?, ?, ?)');

  function fuente(parche: string): NotasExtraidas | null {
    const fila = leerFuente.get(parche) as { datos: string } | undefined;
    if (!fila) return null;
    try {
      return JSON.parse(fila.datos) as NotasExtraidas;
    } catch {
      return null;
    }
  }

  function guardada(parche: string, idioma: IdiomaIa): NotasParche | null {
    const fila = leerNotas.get(parche, idioma) as { datos: string } | undefined;
    if (!fila) return null;
    try {
      return normalizarNotasParche(JSON.parse(fila.datos));
    } catch {
      return null;
    }
  }

  /** Solo se conservan los últimos PARCHES_GUARDADOS parches. */
  function podar(): void {
    const todos = (parchesFuente.all() as { parche: string }[]).map((f) => f.parche).sort(compararParches);
    const viejos = todos.slice(0, Math.max(0, todos.length - PARCHES_GUARDADOS));
    for (const p of viejos) {
      db.sql.prepare('DELETE FROM notas_parche_fuente WHERE parche = ?').run(p);
      db.sql.prepare('DELETE FROM notas_parche WHERE parche = ?').run(p);
    }
  }

  async function listasDDragon(version: string): Promise<ListasDDragon> {
    const pedir = async <T>(url: string): Promise<T> => {
      const r = await hacerFetch(url, { signal: AbortSignal.timeout(TIEMPO_DDRAGON_MS) });
      if (!r.ok) throw new Error(`Data Dragon respondió ${r.status}`);
      return (await r.json()) as T;
    };
    const [c, i] = await Promise.all([
      pedir<{ data: Record<string, { id: string; name: string }> }>(urlDatosDDragon(version, 'champion', 'en_US')),
      pedir<{ data: Record<string, { name: string }> }>(urlDatosDDragon(version, 'item', 'en_US')),
    ]);
    return {
      campeones: Object.values(c.data).map((x) => ({ id: x.id, nombre: x.name })),
      objetos: Object.entries(i.data).map(([id, x]) => ({ id: Number(id), nombre: x.name })),
    };
  }

  /** Genera (una sola vez a la vez por parche e idioma) y guarda el resumen. Null si no se pudo. */
  function generar(parche: string, idioma: IdiomaIa, extraidas: NotasExtraidas): Promise<NotasParche | null> | 'limite' {
    const llave = `${parche}|${idioma}`;
    const previa = enCurso.get(llave);
    if (previa) return previa;
    if (!opciones) return Promise.resolve(null);
    if (!consumirTopeParche(db, ahora(), maxDia)) {
      console.warn('[parche] Se alcanzó el tope global diario de resúmenes (PARCHE_MAX_DIA).');
      return 'limite';
    }
    const promesa = (async () => {
      const notas = await generarResumen({ crear: opciones.crear, modelo: opciones.modelo, ahora }, extraidas, parche, idioma);
      if (notas) guardarNotas.run(parche, idioma, JSON.stringify(notas));
      return notas;
    })().finally(() => enCurso.delete(llave));
    enCurso.set(llave, promesa);
    return promesa;
  }

  return {
    async actualizar(version) {
      const parche = parcheDeVersion(version);
      const parcheJuego = parcheJuegoDeDDragon(parche);
      if (!parcheJuego) return;
      let extraidas = fuente(parche);
      if (!extraidas) {
        const descarga = await descargarNotas(hacerFetch, parcheJuego);
        if (descarga.estado !== 'ok') {
          console.warn(`[parche] Las notas del parche ${parcheJuego} no están disponibles (HTTP ${descarga.status}); se reintentará en el siguiente ciclo.`);
          return;
        }
        extraidas = extraerNotas(descarga.html, parcheJuego, descarga.url, await listasDDragon(version));
        if (!extraidas) {
          console.error(`[parche] Las notas del parche ${parcheJuego} no tienen el formato esperado: no se resumen (se reintentará en el siguiente ciclo).`);
          return;
        }
        guardarFuente.run(parche, JSON.stringify(extraidas), new Date(ahora()).toISOString());
        podar();
        console.info(`[parche] Notas del parche ${parcheJuego} leídas: ${extraidas.campeones.length} campeones y ${extraidas.objetos.length} objetos.`);
      }
      if (!opciones) return;
      for (const idioma of IDIOMAS_IA) {
        if (guardada(parche, idioma)) continue;
        try {
          const r = generar(parche, idioma, extraidas);
          if (r === 'limite') return;
          await r;
        } catch (e) {
          if (e instanceof Anthropic.APIError) console.error(`[parche] Error de la API de Anthropic (${e.status ?? '?'}) con el parche ${parcheJuego} (${idioma})`);
          else console.error(`[parche] Fallo al resumir el parche ${parcheJuego} (${idioma}):`, e instanceof Error ? e.message : String(e));
        }
      }
    },

    async notas(parchePedido, idioma) {
      if (!opciones) return { estado: 'sin_ia' };
      let parche: string | null;
      if (parchePedido === 'actual') {
        const todos = (parchesFuente.all() as { parche: string }[]).map((f) => f.parche).sort(compararParches);
        parche = todos.at(-1) ?? null;
      } else parche = parcheDDragonDe(parchePedido);
      if (!parche) return { estado: 'sin_notas' };
      const ya = guardada(parche, idioma);
      if (ya) return { estado: 'ok', notas: ya };
      const extraidas = fuente(parche);
      if (!extraidas) return { estado: 'sin_notas' };
      try {
        const r = generar(parche, idioma, extraidas);
        if (r === 'limite') return { estado: 'limite' };
        const notas = await r;
        return notas ? { estado: 'ok', notas } : { estado: 'error' };
      } catch (e) {
        if (e instanceof Anthropic.APIError) console.error(`[parche] Error de la API de Anthropic (${e.status ?? '?'})`);
        else console.error('[parche] Error inesperado:', e instanceof Error ? e.message : String(e));
        return { estado: 'error' };
      }
    },
  };
}

const PARCHE_VALIDO = /^(actual|\d{1,2}\.\d{1,2})$/;

export function registrarParche(app: FastifyInstance, servicio: ServicioParche): void {
  app.get<{ Params: { parche: string }; Querystring: { idioma?: string } }>('/parche/:parche', async (req, reply) => {
    const idioma = (req.query.idioma ?? 'es') as IdiomaIa;
    if (!IDIOMAS_IA.includes(idioma)) return reply.code(400).send({ error: 'idioma_invalido' });
    if (!PARCHE_VALIDO.test(req.params.parche)) return reply.code(400).send({ error: 'parche_invalido' });
    const r = await servicio.notas(req.params.parche, idioma);
    switch (r.estado) {
      case 'ok':
        return r.notas;
      case 'sin_ia':
        return reply.code(503).send({ error: 'ia_no_configurada' });
      case 'sin_notas':
        return reply.code(404).send({ error: 'sin_notas' });
      case 'limite':
        return reply.code(429).header('Retry-After', '3600').send({ error: 'limite_global' });
      default:
        return reply.code(502).send({ error: 'notas_no_disponibles' });
    }
  });
}
