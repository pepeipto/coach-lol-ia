import type { Db } from '../db';

/*
 * Cola de publicaciones del panel: cada reel o post que se quiere sacar en TikTok, Twitch, YouTube Shorts, Instagram,
 * la web o Discord, con su gancho, su texto, sus hashtags y un estado. El servidor no publica nada por su cuenta: el
 * estado «aprobado» lo pone el dueño desde el panel y es la señal para que el script de reels del PC (o una persona)
 * lo prepare y lo suba; «publicado» se marca a mano con el enlace del post.
 */

export const PLATAFORMAS = ['tiktok', 'twitch', 'youtube', 'instagram', 'web', 'discord'] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];
export const NOMBRE_PLATAFORMA: Record<Plataforma, string> = {
  tiktok: 'TikTok',
  twitch: 'Twitch',
  youtube: 'YouTube Shorts',
  instagram: 'Instagram Reels',
  web: 'Web',
  discord: 'Discord',
};

export const ESTADOS = ['idea', 'preparado', 'aprobado', 'publicado', 'descartado'] as const;
export type EstadoPublicacion = (typeof ESTADOS)[number];

export const LIMITES = { gancho: 150, texto: 2200, guion: 3000, hashtags: 200, nota: 300 } as const;
/** Como mucho tantas publicaciones guardadas (las descartadas y publicadas más antiguas se pueden borrar). */
export const MAX_PUBLICACIONES = 500;

export interface Publicacion {
  id: number;
  plataforma: Plataforma;
  estado: EstadoPublicacion;
  /** AAAA-MM-DD en que se quiere publicar; null si aún no tiene día. */
  fecha: string | null;
  /** Hora local HH:MM; null si no tiene. */
  hora: string | null;
  /** Primera frase o texto en pantalla del primer segundo. */
  gancho: string;
  /** Caption o texto del post. */
  texto: string;
  /** Guion del vídeo (planos, texto en pantalla, voz), si lo tiene. */
  guion: string;
  hashtags: string;
  /** Material de partida: clip de Twitch, vídeo del PC, etc. (enlace https). */
  origen: string | null;
  /** Enlace del post ya publicado. */
  enlace: string | null;
  /** De dónde salió: «panel», «ia» o «api». */
  autor: string;
  nota: string;
  creada: string;
  actualizada: string;
}

export type NuevaPublicacion = Omit<Publicacion, 'id' | 'creada' | 'actualizada' | 'enlace'> & { enlace?: string | null };

export interface RepoPublicaciones {
  lista(): Publicacion[];
  obtener(id: number): Publicacion | null;
  crear(p: NuevaPublicacion, ahora: Date): number | null;
  cambiarEstado(id: number, estado: EstadoPublicacion, ahora: Date, enlace?: string | null): boolean;
  borrar(id: number): void;
}

export function crearRepoPublicaciones(db: Db): RepoPublicaciones {
  db.sql.exec(`
    CREATE TABLE IF NOT EXISTS publicaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plataforma TEXT NOT NULL,
      estado TEXT NOT NULL,
      fecha TEXT,
      hora TEXT,
      gancho TEXT NOT NULL,
      texto TEXT NOT NULL,
      guion TEXT NOT NULL DEFAULT '',
      hashtags TEXT NOT NULL,
      origen TEXT,
      enlace TEXT,
      autor TEXT NOT NULL,
      nota TEXT NOT NULL DEFAULT '',
      creada TEXT NOT NULL,
      actualizada TEXT NOT NULL
    );
  `);
  // Primero lo que tiene día (el más cercano antes), luego las ideas sin día, de la más nueva a la más antigua.
  const lista = db.sql.prepare(`SELECT * FROM publicaciones ORDER BY
    CASE estado WHEN 'aprobado' THEN 0 WHEN 'preparado' THEN 1 WHEN 'idea' THEN 2 WHEN 'publicado' THEN 3 ELSE 4 END,
    fecha IS NULL, fecha, hora, id DESC`);
  const obtener = db.sql.prepare('SELECT * FROM publicaciones WHERE id = ?');
  const contar = db.sql.prepare('SELECT COUNT(*) AS n FROM publicaciones');
  const crear = db.sql.prepare(`INSERT INTO publicaciones (plataforma, estado, fecha, hora, gancho, texto, guion, hashtags, origen, enlace, autor, nota, creada, actualizada)
    VALUES (@plataforma, @estado, @fecha, @hora, @gancho, @texto, @guion, @hashtags, @origen, @enlace, @autor, @nota, @creada, @creada)`);
  const estado = db.sql.prepare('UPDATE publicaciones SET estado = ?, enlace = COALESCE(?, enlace), actualizada = ? WHERE id = ?');
  const borrar = db.sql.prepare('DELETE FROM publicaciones WHERE id = ?');
  return {
    lista: () => lista.all() as Publicacion[],
    obtener: (id) => (obtener.get(id) as Publicacion | undefined) ?? null,
    crear: (p, ahora) => {
      if ((contar.get() as { n: number }).n >= MAX_PUBLICACIONES) return null;
      return Number(crear.run({ ...p, enlace: p.enlace ?? null, creada: ahora.toISOString() }).lastInsertRowid);
    },
    cambiarEstado: (id, e, ahora, enlace) => estado.run(e, enlace ?? null, ahora.toISOString(), id).changes > 0,
    borrar: (id) => void borrar.run(id),
  };
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');

/** Enlace https cualquiera (sin credenciales); null si no lo es. */
export function limpiarEnlace(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}

/** «#lol #LeagueOfLegends, coach» → «#lol #leagueoflegends #coach» (sin repetidos, como mucho 8). */
export function limpiarHashtags(v: unknown): string {
  if (typeof v !== 'string' && !Array.isArray(v)) return '';
  const partes = (Array.isArray(v) ? v.join(' ') : v).split(/[\s,]+/);
  const vistos = new Set<string>();
  for (const p of partes) {
    const t = p.replace(/^#+/, '').toLowerCase().replace(/[^\p{L}\p{N}_]/gu, '');
    if (t) vistos.add(`#${t}`);
    if (vistos.size >= 8) break;
  }
  return [...vistos].join(' ').slice(0, LIMITES.hashtags);
}

export const esPlataforma = (v: unknown): v is Plataforma => PLATAFORMAS.includes(v as Plataforma);
export const esEstado = (v: unknown): v is EstadoPublicacion => ESTADOS.includes(v as EstadoPublicacion);

/**
 * Lee una publicación de un formulario o de JSON. Devuelve el motivo si falta algo. Desde fuera del panel (API o IA)
 * nunca puede entrar ya «aprobada» ni «publicada»: eso solo lo decide el dueño en el panel.
 */
export function leerPublicacion(b: Record<string, unknown>, autor: 'panel' | 'ia' | 'api'): NuevaPublicacion | string {
  const plataforma = b.plataforma ?? 'tiktok';
  if (!esPlataforma(plataforma)) return 'Elige una plataforma.';
  const gancho = texto(b.gancho, LIMITES.gancho);
  if (!gancho) return 'Falta el gancho (la primera frase del vídeo o del post).';
  const pedido = b.estado ?? 'idea';
  if (!esEstado(pedido)) return 'Ese estado no existe.';
  const estado: EstadoPublicacion = autor !== 'panel' && pedido !== 'idea' && pedido !== 'preparado' ? 'idea' : pedido;
  const fecha = typeof b.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.fecha) ? b.fecha : null;
  const hora = typeof b.hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.hora) ? b.hora : null;
  const origen = limpiarEnlace(b.origen);
  if (typeof b.origen === 'string' && b.origen.trim() && !origen) return 'El enlace del material tiene que empezar por https://.';
  return {
    plataforma,
    estado,
    fecha,
    hora,
    gancho,
    texto: texto(b.texto, LIMITES.texto),
    guion: texto(b.guion, LIMITES.guion),
    hashtags: limpiarHashtags(b.hashtags),
    origen,
    autor,
    nota: texto(b.nota, LIMITES.nota),
  };
}
