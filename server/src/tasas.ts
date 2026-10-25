import type Database from 'better-sqlite3';
import type { BansPartida } from './extraer';

/*
 * 3.9.1: tasa de bloqueo (ban rate) y tasa de selección (pick rate) de clasificatoria, por parche.
 *
 * - Tasa de bloqueo = partidas en las que el campeón fue bloqueado (por cualquiera de los dos equipos) / partidas con
 *   sus bloqueos guardados. Solo cuentan las partidas guardadas desde la 3.9.1 (las anteriores no guardaron los
 *   bloqueos): nada se inventa para las viejas.
 * - Tasa de selección = partidas jugadas por el campeón (en cualquier rol) / partidas de clasificatoria del parche.
 *   Sale de `participaciones`, así que vale también para las partidas antiguas.
 *
 * Cada tasa usa el parche actual si tiene `MIN_PARTIDAS_TASAS` partidas o más; si no, el actual y el anterior juntos;
 * y si ni así llega, no se publica. Solo datos agregados de partidas terminadas.
 */

/** Partidas mínimas (del parche o de los dos) para publicar una tasa de bloqueo o de selección. */
export const MIN_PARTIDAS_TASAS = 100;

export function asegurarTablasTasas(sql: Database.Database): void {
  sql.exec(`
    -- Bloqueos de cada partida de clasificatoria (JSON con las claves numéricas, sin repetir).
    CREATE TABLE IF NOT EXISTS bans_partidas (
      match_id TEXT PRIMARY KEY,
      parche TEXT NOT NULL,
      bans TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bans_partidas_parche ON bans_partidas (parche);
    -- Clave numérica de Match-v5 → campeón (en minúsculas, como en participaciones), aprendida de las partidas.
    CREATE TABLE IF NOT EXISTS campeones_ids (
      id INTEGER PRIMARY KEY,
      campeon TEXT NOT NULL
    );
  `);
}

/** Guarda los bloqueos de una partida y las claves numéricas de sus campeones. */
export function guardarBans(sql: Database.Database, b: BansPartida): void {
  asegurarTablasTasas(sql);
  const insBans = sql.prepare('INSERT OR REPLACE INTO bans_partidas (match_id, parche, bans) VALUES (?, ?, ?)');
  const insId = sql.prepare('INSERT OR REPLACE INTO campeones_ids (id, campeon) VALUES (?, ?)');
  sql.transaction(() => {
    insBans.run(b.matchId, b.parche, JSON.stringify(b.bans));
    for (const c of b.campeones) insId.run(c.id, c.nombre.toLowerCase());
  })();
}

/** Borra los bloqueos de los parches que no se conservan (como `borrarParchesAntiguos`). */
export function borrarBansAntiguos(sql: Database.Database, conservar: string[]): void {
  asegurarTablasTasas(sql);
  if (conservar.length === 0) {
    sql.exec('DELETE FROM bans_partidas');
    return;
  }
  sql.prepare(`DELETE FROM bans_partidas WHERE parche NOT IN (${conservar.map(() => '?').join(',')})`).run(...conservar);
}

export interface TasasCampeon {
  tasaBloqueo?: number;
  tasaSeleccion?: number;
}

const marcadores = (n: number) => Array(n).fill('?').join(',');

/** Parches para una tasa: el actual si llega al mínimo; si no, los dos; null si ni así. */
function elegirParches(total: (parches: string[]) => number, actual: string, anterior: string): { parches: string[]; total: number } | null {
  const soloActual = total([actual]);
  if (soloActual >= MIN_PARTIDAS_TASAS) return { parches: [actual], total: soloActual };
  if (anterior === actual) return null;
  const ambos = total([actual, anterior]);
  return ambos >= MIN_PARTIDAS_TASAS ? { parches: [actual, anterior], total: ambos } : null;
}

/** Tasas de bloqueo y de selección de clasificatoria de cada campeón (clave en minúsculas). */
export function tasasCampeones(sql: Database.Database, parcheActual: string, parcheAnterior: string): Map<string, TasasCampeon> {
  asegurarTablasTasas(sql);
  const tasas = new Map<string, TasasCampeon>();
  const de = (campeon: string) => {
    let t = tasas.get(campeon);
    if (!t) tasas.set(campeon, (t = {}));
    return t;
  };

  const seleccion = elegirParches(
    (ps) =>
      (sql
        .prepare(`SELECT COUNT(DISTINCT match_id) AS n FROM participaciones WHERE modo = 'clasificatoria' AND parche IN (${marcadores(ps.length)})`)
        .get(...ps) as { n: number }).n,
    parcheActual,
    parcheAnterior,
  );
  if (seleccion) {
    const filas = sql
      .prepare(
        `SELECT campeon, COUNT(DISTINCT match_id) AS n FROM participaciones
         WHERE modo = 'clasificatoria' AND parche IN (${marcadores(seleccion.parches.length)}) GROUP BY campeon`,
      )
      .all(...seleccion.parches) as { campeon: string; n: number }[];
    for (const f of filas) de(f.campeon).tasaSeleccion = f.n / seleccion.total;
  }

  const bloqueo = elegirParches(
    (ps) => (sql.prepare(`SELECT COUNT(*) AS n FROM bans_partidas WHERE parche IN (${marcadores(ps.length)})`).get(...ps) as { n: number }).n,
    parcheActual,
    parcheAnterior,
  );
  if (bloqueo) {
    const filas = sql
      .prepare(
        `SELECT c.campeon AS campeon, COUNT(*) AS n
         FROM bans_partidas b, json_each(b.bans) j JOIN campeones_ids c ON c.id = j.value
         WHERE b.parche IN (${marcadores(bloqueo.parches.length)}) GROUP BY c.campeon`,
      )
      .all(...bloqueo.parches) as { campeon: string; n: number }[];
    for (const f of filas) de(f.campeon).tasaBloqueo = f.n / bloqueo.total;
    // Los campeones jugados en esos parches que nadie bloqueó tienen un 0 %, no «sin datos».
    for (const [, t] of tasas) if (t.tasaSeleccion !== undefined && t.tasaBloqueo === undefined) t.tasaBloqueo = 0;
  }
  return tasas;
}
