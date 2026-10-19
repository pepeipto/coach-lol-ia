import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { URL_AUMENTOS_ES, urlIconoAumento } from '@coach/shared';
import { registrar } from '../log';

/** Nombre en español e icono de un aumento (ARAM: Caos y Arena). */
export interface Aumento {
  nombre: string;
  /** URL de CommunityDragon; null si la ruta del icono no tiene la forma esperada. */
  icono: string | null;
}

export type Aumentos = Map<number, Aumento>;

const ARCHIVO_CACHE = 'aumentos-es_mx.json';
const TIEMPO_ESPERA_MS = 10_000;

/**
 * Convierte cherry-augments.json de CommunityDragon (es_MX; ver URL_AUMENTOS_ES en shared/modos.ts) en un mapa
 * id → { nombre, icono }. Las entradas sin id entero o sin nombre se descartan. Null si no es una lista.
 */
export function interpretarAumentos(json: unknown): Aumentos | null {
  if (!Array.isArray(json)) return null;
  const mapa: Aumentos = new Map();
  for (const e of json as { id?: unknown; nameTRA?: unknown; augmentSmallIconPath?: unknown }[]) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'number' || !Number.isInteger(e.id)) continue;
    if (typeof e.nameTRA !== 'string' || !e.nameTRA.trim()) continue;
    mapa.set(e.id, { nombre: e.nameTRA.trim(), icono: urlIconoAumento(e.augmentSmallIconPath) });
  }
  return mapa;
}

/** De dónde salieron los aumentos: de la red, de la copia en disco o de ningún sitio (mapa vacío). */
export type OrigenAumentos = 'red' | 'cache' | 'vacio';

/**
 * Aumentos en español: los descarga de CommunityDragon y guarda una copia; sin red, usa la copia. Si no hay
 * ninguna de las dos, devuelve un mapa vacío (la app enseña el id del aumento) y lo deja en el registro.
 */
export async function cargarAumentos(dirCache: string, fetchFn: typeof fetch = fetch): Promise<Aumentos> {
  return (await cargarAumentosConOrigen(dirCache, fetchFn)).mapa;
}

/** Tras usar la copia en disco, cuánto se espera para volver a intentar la red. */
export const REINTENTO_RED_MS = 30 * 60 * 1000;

/**
 * Cargador memorizado: descarga una vez y reutiliza el resultado. Si salió de la copia en disco, vuelve a
 * intentar la red pasados 30 minutos; si salió vacío, lo intenta en la siguiente petición.
 */
export function crearCargadorAumentos(
  dirCache: string,
  o: { fetch?: typeof fetch; ahora?: () => number } = {},
): () => Promise<Aumentos> {
  const ahora = o.ahora ?? Date.now;
  let actual: Promise<{ mapa: Aumentos; origen: OrigenAumentos; en: number }> | null = null;
  return async () => {
    if (actual) {
      const r = await actual;
      const caducado = r.origen === 'vacio' || (r.origen === 'cache' && ahora() - r.en >= REINTENTO_RED_MS);
      if (!caducado) return r.mapa;
      actual = null;
    }
    actual ??= cargarAumentosConOrigen(dirCache, o.fetch ?? fetch).then((r) => ({ ...r, en: ahora() }));
    return (await actual).mapa;
  };
}

async function cargarAumentosConOrigen(dirCache: string, fetchFn: typeof fetch): Promise<{ mapa: Aumentos; origen: OrigenAumentos }> {
  const ruta = join(dirCache, ARCHIVO_CACHE);
  try {
    const respuesta = await fetchFn(URL_AUMENTOS_ES, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
    if (!respuesta.ok) throw new Error(`CommunityDragon respondió ${respuesta.status}`);
    const json: unknown = await respuesta.json();
    const mapa = interpretarAumentos(json);
    if (!mapa || mapa.size === 0) throw new Error('la lista de aumentos no tiene la forma esperada');
    try {
      await mkdir(dirCache, { recursive: true });
      await writeFile(ruta, JSON.stringify(json), 'utf8');
    } catch {
      // la copia es solo una ayuda
    }
    return { mapa, origen: 'red' };
  } catch (e) {
    try {
      const mapa = interpretarAumentos(JSON.parse(await readFile(ruta, 'utf8')));
      if (mapa) return { mapa, origen: 'cache' };
    } catch {
      // sin copia
    }
    registrar('aviso', `No se pudieron cargar los nombres de los aumentos: ${String(e)}`);
    return { mapa: new Map(), origen: 'vacio' };
  }
}
