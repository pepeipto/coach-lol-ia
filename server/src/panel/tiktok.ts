import type { Db } from '../db';

/*
 * Vídeos de TikTok apuntados a mano desde el panel (la API de TikTok pide una app aprobada por TikTok).
 * Cada vídeo se identifica por su enlace; volver a guardarlo actualiza sus cifras.
 */

export interface VideoTiktok {
  url: string;
  titulo: string;
  /** AAAA-MM-DD. */
  publicado: string;
  vistas: number;
  megusta: number;
  comentarios: number;
  compartidos: number;
  /** ISO de la última vez que se actualizaron las cifras. */
  actualizado: string;
}

export interface RepoTiktok {
  lista(): VideoTiktok[];
  guardar(v: Omit<VideoTiktok, 'actualizado'>, ahora: Date): void;
  borrar(url: string): void;
  /** Seguidores de la cuenta (apuntados a mano) por día. */
  seguidores(): { dia: string; n: number }[];
  guardarSeguidores(dia: string, n: number): void;
}

export function crearRepoTiktok(db: Db): RepoTiktok {
  db.sql.exec(`
    CREATE TABLE IF NOT EXISTS tiktok_videos (
      url TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      publicado TEXT NOT NULL,
      vistas INTEGER NOT NULL,
      megusta INTEGER NOT NULL,
      comentarios INTEGER NOT NULL,
      compartidos INTEGER NOT NULL,
      actualizado TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tiktok_seguidores (
      dia TEXT PRIMARY KEY,
      n INTEGER NOT NULL
    );
  `);
  const lista = db.sql.prepare('SELECT * FROM tiktok_videos ORDER BY publicado DESC, url');
  const guardar = db.sql.prepare(`
    INSERT INTO tiktok_videos (url, titulo, publicado, vistas, megusta, comentarios, compartidos, actualizado)
    VALUES (@url, @titulo, @publicado, @vistas, @megusta, @comentarios, @compartidos, @actualizado)
    ON CONFLICT(url) DO UPDATE SET titulo = excluded.titulo, publicado = excluded.publicado, vistas = excluded.vistas,
      megusta = excluded.megusta, comentarios = excluded.comentarios, compartidos = excluded.compartidos,
      actualizado = excluded.actualizado`);
  const borrar = db.sql.prepare('DELETE FROM tiktok_videos WHERE url = ?');
  const seguidores = db.sql.prepare('SELECT dia, n FROM tiktok_seguidores ORDER BY dia');
  const guardarSeguidores = db.sql.prepare('INSERT INTO tiktok_seguidores (dia, n) VALUES (?, ?) ON CONFLICT(dia) DO UPDATE SET n = excluded.n');
  return {
    lista: () => lista.all() as VideoTiktok[],
    guardar: (v, ahora) => void guardar.run({ ...v, actualizado: ahora.toISOString() }),
    borrar: (url) => void borrar.run(url),
    seguidores: () => seguidores.all() as { dia: string; n: number }[],
    guardarSeguidores: (dia, n) => void guardarSeguidores.run(dia, n),
  };
}

/** Enlace de un vídeo de TikTok (https, dominio tiktok.com), sin consulta; null si no lo es. */
export function limpiarUrlTiktok(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== 'https:' || !/(^|\.)tiktok\.com$/i.test(u.hostname)) return null;
    return `https://${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

/** Cifra entera no negativa; acepta «12.345», «12,3 mil», «1,2K» o «3M» tal como las muestra TikTok. */
export function leerCifra(v: unknown): number | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const t = String(v).trim().toLowerCase().replace(/\s+/g, '');
  if (t === '') return 0;
  const m = /^(\d+(?:[.,]\d+)?)(k|mil|m|mill)?$/.exec(t);
  if (m) {
    const [, num, sufijo] = m;
    if (!sufijo) {
      // Sin sufijo, el punto o la coma son separadores de miles («12.345»).
      const entero = Number(num!.replace(/[.,]/g, ''));
      return Number.isSafeInteger(entero) ? entero : null;
    }
    const base = Number(num!.replace(',', '.'));
    return Math.round(base * (sufijo === 'k' || sufijo === 'mil' ? 1_000 : 1_000_000));
  }
  const entero = /^\d{1,3}([.,]\d{3})+$/.test(t) ? Number(t.replace(/[.,]/g, '')) : NaN;
  return Number.isSafeInteger(entero) ? entero : null;
}
