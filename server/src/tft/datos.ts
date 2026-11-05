import type Database from 'better-sqlite3';
import type { Region } from '../riot/riotApi';

/** Tablero final de un jugador en una partida clasificatoria de TFT (lo que se guarda; sin aumentos ni puuid). */
export interface TableroTft {
  matchId: string;
  parche: string;
  set: number | null;
  /** Puesto final (1-8). */
  puesto: number;
  nivel: number;
  /** Rasgos activos: nombre interno, unidades y nivel de estilo (1 bronce … 5 prismático). */
  rasgos: { nombre: string; unidades: number; estilo: number }[];
  /** Unidades: id interno (`TFT<set>_<campeón>`), estrellas y objetos (nombres internos). */
  unidades: { id: string; estrellas: number; objetos: string[] }[];
}

export interface AlmacenTft {
  partidaVista(matchId: string): boolean;
  /** Marca la partida como vista (también las que no son clasificatorias, para no volver a pedirlas). */
  marcarVista(matchId: string): void;
  guardarTableros(region: Region, tableros: TableroTft[]): void;
  tableros(parches: string[]): TableroTft[];
  /** Partidas distintas guardadas de un parche. */
  partidas(parche: string): number;
  guardarEstadistica(tipo: string, clave: string, parche: string, datos: unknown): void;
  /** Borra las estadísticas de un tipo (antes de recalcularlas). */
  borrarEstadisticas(tipo: string): void;
  estadistica<T>(tipo: string, clave: string): T | null;
  borrarParchesAntiguos(conservar: string[]): void;
}

const marcadores = (n: number) => Array.from({ length: n }, () => '?').join(', ');

export function crearAlmacenTft(db: Database.Database): AlmacenTft {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tft_partidas_vistas (match_id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS tft_tableros (
      match_id TEXT NOT NULL,
      jugador INTEGER NOT NULL,
      parche TEXT NOT NULL,
      region TEXT NOT NULL,
      datos TEXT NOT NULL,
      PRIMARY KEY (match_id, jugador)
    );
    CREATE INDEX IF NOT EXISTS idx_tft_tableros_parche ON tft_tableros (parche);
    CREATE TABLE IF NOT EXISTS tft_estadisticas (
      tipo TEXT NOT NULL,
      clave TEXT NOT NULL,
      parche TEXT NOT NULL,
      datos TEXT NOT NULL,
      PRIMARY KEY (tipo, clave)
    );
  `);
  // Una vez: el primer ciclo en producción descartó todas las partidas del cliente nuevo de TFT (versión sin número) y
  // las marcó como vistas. Se olvidan las vistas sin tablero para poder pedirlas otra vez.
  db.transaction(() => {
    const hecha = db.prepare("SELECT 1 FROM tft_estadisticas WHERE tipo = 'migracion' AND clave = 'version-unreal'").get();
    if (hecha) return;
    db.exec('DELETE FROM tft_partidas_vistas WHERE match_id NOT IN (SELECT match_id FROM tft_tableros)');
    db.prepare("INSERT INTO tft_estadisticas (tipo, clave, parche, datos) VALUES ('migracion', 'version-unreal', '*', '1')").run();
  })();
  const vista = db.prepare('SELECT 1 FROM tft_partidas_vistas WHERE match_id = ?');
  const insVista = db.prepare('INSERT OR IGNORE INTO tft_partidas_vistas (match_id) VALUES (?)');
  const insTablero = db.prepare(
    'INSERT OR REPLACE INTO tft_tableros (match_id, jugador, parche, region, datos) VALUES (?, ?, ?, ?, ?)',
  );
  const insEst = db.prepare('INSERT OR REPLACE INTO tft_estadisticas (tipo, clave, parche, datos) VALUES (?, ?, ?, ?)');
  const delEst = db.prepare('DELETE FROM tft_estadisticas WHERE tipo = ?');
  const selEst = db.prepare('SELECT datos FROM tft_estadisticas WHERE tipo = ? AND clave = ?');
  const selPartidas = db.prepare('SELECT COUNT(DISTINCT match_id) AS n FROM tft_tableros WHERE parche = ?');

  const guardar = db.transaction((region: Region, tableros: TableroTft[]) => {
    const porPartida = new Map<string, number>();
    for (const t of tableros) {
      const jugador = porPartida.get(t.matchId) ?? 0;
      porPartida.set(t.matchId, jugador + 1);
      insTablero.run(t.matchId, jugador, t.parche, region, JSON.stringify(t));
      insVista.run(t.matchId);
    }
  });

  return {
    partidaVista: (id) => vista.get(id) !== undefined,
    marcarVista: (id) => void insVista.run(id),
    guardarTableros: (region, tableros) => guardar(region, tableros),
    tableros(parches) {
      if (parches.length === 0) return [];
      const filas = db
        .prepare(`SELECT datos FROM tft_tableros WHERE parche IN (${marcadores(parches.length)})`)
        .all(...parches) as { datos: string }[];
      return filas.map((f) => JSON.parse(f.datos) as TableroTft);
    },
    partidas: (parche) => (selPartidas.get(parche) as { n: number }).n,
    guardarEstadistica: (tipo, clave, parche, datos) => void insEst.run(tipo, clave, parche, JSON.stringify(datos)),
    borrarEstadisticas: (tipo) => void delEst.run(tipo),
    estadistica<T>(tipo: string, clave: string): T | null {
      const f = selEst.get(tipo, clave) as { datos: string } | undefined;
      return f ? (JSON.parse(f.datos) as T) : null;
    },
    borrarParchesAntiguos(conservar) {
      if (conservar.length === 0) return;
      const m = marcadores(conservar.length);
      db.prepare(`DELETE FROM tft_tableros WHERE parche NOT IN (${m})`).run(...conservar);
      db.prepare(`DELETE FROM tft_estadisticas WHERE tipo <> 'migracion' AND parche NOT IN (${m})`).run(...conservar);
    },
  };
}
