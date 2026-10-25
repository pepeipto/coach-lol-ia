import { MIN_PARTIDAS_DANIO, type DesgloseDanio } from '@coach/shared';
import type Database from 'better-sqlite3';

/*
 * Ficha del campeón: desglose medio del daño a campeones (físico, mágico y verdadero) por campeón, con las
 * partidas de clasificatoria ya guardadas (campo `danio` de cada participación, desde esta versión). Se recalcula
 * con las builds y se guarda en su tabla; sin MIN_PARTIDAS_DANIO partidas con el dato, el campeón no tiene desglose.
 */

export function asegurarTablaDanio(sql: Database.Database): void {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS danio_campeon (
      campeon TEXT PRIMARY KEY,
      parche TEXT NOT NULL,
      partidas INTEGER NOT NULL,
      fisico REAL NOT NULL,
      magico REAL NOT NULL,
      verdadero REAL NOT NULL
    );
  `);
}

interface FilaSuma {
  campeon: string;
  partidas: number;
  fisico: number;
  magico: number;
  verdadero: number;
}

function sumas(sql: Database.Database, parches: string[]): Map<string, FilaSuma> {
  const marcas = parches.map(() => '?').join(',');
  const filas = sql
    .prepare(
      `SELECT campeon, COUNT(*) AS partidas,
              SUM(json_extract(datos, '$.danio.fisico')) AS fisico,
              SUM(json_extract(datos, '$.danio.magico')) AS magico,
              SUM(json_extract(datos, '$.danio.verdadero')) AS verdadero
         FROM participaciones
        WHERE modo = 'clasificatoria' AND parche IN (${marcas}) AND json_extract(datos, '$.danio') IS NOT NULL
        GROUP BY campeon`,
    )
    .all(...parches) as FilaSuma[];
  return new Map(filas.map((f) => [f.campeon, f]));
}

/** Fracciones redondeadas a milésimas; el verdadero se ajusta para que sumen exactamente 1. */
export function fracciones(fisico: number, magico: number, verdadero: number): DesgloseDanio | null {
  const total = fisico + magico + verdadero;
  if (!(total > 0)) return null;
  const f = Math.round((fisico / total) * 1000) / 1000;
  const m = Math.round((magico / total) * 1000) / 1000;
  return { fisico: f, magico: m, verdadero: Math.max(0, Math.round((1 - f - m) * 1000) / 1000) };
}

/**
 * Recalcula el desglose de todos los campeones: con las partidas del parche actual si llegan al mínimo y, si no, con
 * las del actual y el anterior juntas. Devuelve cuántos campeones tienen desglose.
 */
export function calcularDanio(sql: Database.Database, parcheActual: string, parcheAnterior: string): number {
  asegurarTablaDanio(sql);
  const actual = sumas(sql, [parcheActual]);
  const ambos = parcheAnterior !== parcheActual ? sumas(sql, [parcheActual, parcheAnterior]) : actual;
  const insertar = sql.prepare(
    'INSERT INTO danio_campeon (campeon, parche, partidas, fisico, magico, verdadero) VALUES (?, ?, ?, ?, ?, ?)',
  );
  let n = 0;
  sql.transaction(() => {
    sql.exec('DELETE FROM danio_campeon');
    for (const [campeon, todas] of ambos) {
      const fila = (actual.get(campeon)?.partidas ?? 0) >= MIN_PARTIDAS_DANIO ? actual.get(campeon)! : todas;
      if (fila.partidas < MIN_PARTIDAS_DANIO) continue;
      const d = fracciones(fila.fisico, fila.magico, fila.verdadero);
      if (!d) continue;
      insertar.run(campeon, parcheActual, fila.partidas, d.fisico, d.magico, d.verdadero);
      n++;
    }
  })();
  return n;
}

/** Desglose guardado de un campeón (sin distinguir mayúsculas); null si no lo tiene. */
export function leerDanio(sql: Database.Database, campeon: string): DesgloseDanio | null {
  asegurarTablaDanio(sql);
  const f = sql.prepare('SELECT fisico, magico, verdadero FROM danio_campeon WHERE campeon = ?').get(campeon.toLowerCase()) as
    | DesgloseDanio
    | undefined;
  return f ? { fisico: f.fisico, magico: f.magico, verdadero: f.verdadero } : null;
}
