import Database from 'better-sqlite3';
import type { Build, Rol } from '@coach/shared';
import type { Participacion } from './extraer';
import type { Region } from './riot/riotApi';

export interface Db {
  /** Conexión de better-sqlite3, para los módulos que gestionan sus propias tablas (licencias). */
  sql: Database.Database;
  partidaVista(matchId: string): boolean;
  marcarVista(matchId: string): void;
  guardarParticipaciones(region: Region, ps: Participacion[]): void;
  participacionesDe(campeon: string, rol: Rol, parches: string[]): Participacion[];
  /** Combinaciones con datos; `campeon` es la clave normalizada (en minúsculas). */
  combinaciones(parches: string[]): { campeon: string; rol: Rol }[];
  guardarBuild(b: Build): void;
  build(campeon: string, rol: Rol): Build | null;
  roles(campeon: string, parche: string): { rol: Rol; partidas: number }[];
  borrarParchesAntiguos(conservar: string[]): void;
  cerrar(): void;
}

/**
 * Clave del campeón en la base de datos: en minúsculas, porque Match-v5 (`championName`) y
 * Data Dragon (`id`) no siempre coinciden en mayúsculas (p. ej. «FiddleSticks» y «Fiddlesticks»).
 * Los datos guardados (JSON) conservan el nombre original.
 */
const clave = (campeon: string) => campeon.toLowerCase();

function marcadores(n: number): string {
  return Array(n).fill('?').join(',');
}

export function abrirDb(ruta: string): Db {
  const db = new Database(ruta);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS partidas_vistas (match_id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS participaciones (
      match_id TEXT NOT NULL,
      campeon TEXT NOT NULL,
      rol TEXT NOT NULL,
      parche TEXT NOT NULL,
      region TEXT NOT NULL,
      datos TEXT NOT NULL,
      PRIMARY KEY (match_id, campeon)
    );
    CREATE INDEX IF NOT EXISTS idx_participaciones ON participaciones (campeon, rol, parche);
    CREATE TABLE IF NOT EXISTS builds (
      campeon TEXT NOT NULL,
      rol TEXT NOT NULL,
      parche TEXT NOT NULL,
      datos TEXT NOT NULL,
      PRIMARY KEY (campeon, rol)
    );
    CREATE TABLE IF NOT EXISTS licencias (
      clave TEXT PRIMARY KEY,
      stripe_customer TEXT NOT NULL,
      stripe_subscription TEXT UNIQUE,
      checkout_session TEXT NOT NULL UNIQUE,
      estado TEXT NOT NULL,
      renueva_en TEXT,
      actualizada TEXT NOT NULL
    );
  `);
  // Bases creadas antes de normalizar el campeón.
  db.exec(`
    UPDATE OR REPLACE participaciones SET campeon = lower(campeon) WHERE campeon <> lower(campeon);
    UPDATE OR REPLACE builds SET campeon = lower(campeon) WHERE campeon <> lower(campeon);
  `);

  const vista = db.prepare('SELECT 1 FROM partidas_vistas WHERE match_id = ?');
  const insVista = db.prepare('INSERT OR IGNORE INTO partidas_vistas (match_id) VALUES (?)');
  const insPart = db.prepare(
    `INSERT OR REPLACE INTO participaciones (match_id, campeon, rol, parche, region, datos)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insBuild = db.prepare(
    'INSERT OR REPLACE INTO builds (campeon, rol, parche, datos) VALUES (?, ?, ?, ?)',
  );
  const selBuild = db.prepare('SELECT datos FROM builds WHERE campeon = ? AND rol = ?');
  const selParches = db.prepare('SELECT DISTINCT parche FROM participaciones');
  const selParchesBuilds = db.prepare('SELECT DISTINCT parche FROM builds');

  const guardar = db.transaction((region: Region, ps: Participacion[]) => {
    for (const p of ps) {
      insPart.run(p.matchId, clave(p.campeon), p.rol, p.parche, region, JSON.stringify(p));
      insVista.run(p.matchId);
    }
  });

  return {
    partidaVista: (id) => vista.get(id) !== undefined,
    marcarVista: (id) => void insVista.run(id),
    guardarParticipaciones: (region, ps) => guardar(region, ps),
    participacionesDe(campeon, rol, parches) {
      if (parches.length === 0) return [];
      const filas = db
        .prepare(
          `SELECT datos FROM participaciones
           WHERE campeon = ? AND rol = ? AND parche IN (${marcadores(parches.length)})`,
        )
        .all(clave(campeon), rol, ...parches) as { datos: string }[];
      return filas.map((f) => JSON.parse(f.datos) as Participacion);
    },
    combinaciones(parches) {
      if (parches.length === 0) return [];
      return db
        .prepare(
          `SELECT DISTINCT campeon, rol FROM participaciones
           WHERE parche IN (${marcadores(parches.length)}) ORDER BY campeon, rol`,
        )
        .all(...parches) as { campeon: string; rol: Rol }[];
    },
    guardarBuild: (b) => void insBuild.run(clave(b.campeon), b.rol, b.parche, JSON.stringify(b)),
    build(campeon, rol) {
      const f = selBuild.get(clave(campeon), rol) as { datos: string } | undefined;
      return f ? (JSON.parse(f.datos) as Build) : null;
    },
    roles(campeon, parche) {
      const filas = db
        .prepare(
          `SELECT rol, COUNT(*) AS partidas FROM participaciones
           WHERE campeon = ? AND parche = ? GROUP BY rol`,
        )
        .all(clave(campeon), parche) as { rol: Rol; partidas: number }[];
      return filas.sort((a, b) => b.partidas - a.partidas || a.rol.localeCompare(b.rol));
    },
    borrarParchesAntiguos(conservar) {
      const conservarSet = new Set(conservar);
      const otros = new Set<string>();
      for (const f of selParches.all() as { parche: string }[]) otros.add(f.parche);
      for (const f of selParchesBuilds.all() as { parche: string }[]) otros.add(f.parche);
      const borrar = [...otros].filter((p) => !conservarSet.has(p));
      if (borrar.length === 0) return;
      const m = marcadores(borrar.length);
      db.transaction(() => {
        db.prepare(`DELETE FROM participaciones WHERE parche IN (${m})`).run(...borrar);
        db.prepare(`DELETE FROM builds WHERE parche IN (${m})`).run(...borrar);
      })();
    },
    cerrar: () => void db.close(),
  };
}
