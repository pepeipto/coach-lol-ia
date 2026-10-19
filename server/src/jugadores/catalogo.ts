import { URL_VERSIONES, urlDatosDDragon } from '@coach/shared';
import type { InfoCampeon } from './tipos';

/** El catálogo se renueva cada 6 h (los parches salen cada dos semanas). */
const VIGENCIA_MS = 6 * 60 * 60_000;
/** Tras un fallo de Data Dragon no se reintenta en cada petición, sino pasados 5 min. */
const REINTENTO_MS = 5 * 60_000;
const TIEMPO_ESPERA_MS = 10_000;

interface CampeonDDragon {
  key: string;
  id: string;
  name: string;
  tags?: string[];
  info?: { difficulty?: number };
}

/** Campeones de Data Dragon por id numérico (nombre en español, etiquetas y dificultad), en memoria. */
export function crearCatalogoCampeones(o: { fetch?: typeof fetch; ahora?: () => number } = {}) {
  const hacerFetch = o.fetch ?? fetch;
  const ahora = o.ahora ?? Date.now;
  let campeones = new Map<number, InfoCampeon>();
  let siguiente = -Infinity;
  let enCurso: Promise<Map<number, InfoCampeon>> | null = null;

  async function pedirJson<T>(url: string): Promise<T> {
    const r = await hacerFetch(url, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
    if (!r.ok) throw new Error(`Data Dragon respondió ${r.status}`);
    return (await r.json()) as T;
  }

  async function descargar(): Promise<Map<number, InfoCampeon>> {
    try {
      const [version] = await pedirJson<string[]>(URL_VERSIONES);
      if (!version) throw new Error('Data Dragon no devolvió versiones');
      const datos = await pedirJson<{ data: Record<string, CampeonDDragon> }>(urlDatosDDragon(version, 'champion'));
      const nuevo = new Map<number, InfoCampeon>();
      for (const c of Object.values(datos.data)) {
        nuevo.set(Number(c.key), { id: c.id, nombre: c.name, tags: c.tags ?? [], dificultad: c.info?.difficulty ?? 0 });
      }
      campeones = nuevo;
      siguiente = ahora() + VIGENCIA_MS;
    } catch (e) {
      console.warn('[jugadores] No se pudo descargar el catálogo de campeones:', e instanceof Error ? e.message : String(e));
      siguiente = ahora() + REINTENTO_MS;
    }
    return campeones;
  }

  return {
    async campeones(): Promise<Map<number, InfoCampeon>> {
      if (ahora() < siguiente) return campeones;
      enCurso ??= descargar().finally(() => {
        enCurso = null;
      });
      return enCurso;
    },
  };
}
