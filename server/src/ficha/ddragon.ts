import { URL_VERSIONES, urlDatosDDragon, type IdiomaIa } from '@coach/shared';

/*
 * Data Dragon para la ficha del campeón: la versión vigente, la lista de campeones (para validar los «parecidos») y
 * el detalle de un campeón en un idioma (habilidades, pasiva, etiquetas y consejos de Riot). Es el CDN público de
 * Riot: no usa la clave ni la API de juego.
 */

/** Locale de Data Dragon de cada idioma (los mismos que usa la app). */
export const LOCALE_FICHA: Record<IdiomaIa, string> = {
  es: 'es_MX',
  en: 'en_US',
  'pt-BR': 'pt_BR',
  fr: 'fr_FR',
  de: 'de_DE',
};

export interface CampeonLista {
  id: string;
  /** Nombre en inglés (la lista se descarga en en_US). */
  nombre: string;
  tags: string[];
}

/** Lo que lee el modelo de un campeón, en el idioma pedido. */
export interface DatosCampeonFicha {
  id: string;
  nombre: string;
  titulo: string;
  tags: string[];
  /** Recurso («Maná», «Energía»…). */
  recurso: string;
  /** Ataque, defensa, magia y dificultad de Riot (0-10). */
  info: { ataque: number; defensa: number; magia: number; dificultad: number };
  pasiva: { nombre: string; descripcion: string };
  habilidades: { tecla: 'Q' | 'W' | 'E' | 'R'; nombre: string; descripcion: string }[];
  consejosAliado: string[];
  consejosRival: string[];
}

export interface FuenteDDragonFicha {
  /** Versión vigente de Data Dragon («15.21.1»). */
  version(): Promise<string>;
  /** Campeones de esa versión, por id en minúsculas. */
  campeones(version: string): Promise<Map<string, CampeonLista>>;
  /** Detalle de un campeón (id exacto de Data Dragon) en un idioma; null si no existe. */
  detalle(version: string, id: string, idioma: IdiomaIa): Promise<DatosCampeonFicha | null>;
}

const VIGENCIA_VERSION_MS = 60 * 60_000;
const TIEMPO_ESPERA_MS = 10_000;

/** Texto plano de una descripción de Data Dragon (lleva etiquetas como <br> o <magicDamage>). */
export function textoPlano(html: unknown, max = 600): string {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\{\{[^}]*\}\}/g, '?')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

const TECLAS = ['Q', 'W', 'E', 'R'] as const;

interface CampeonCrudo {
  id?: string;
  name?: string;
  title?: string;
  tags?: string[];
  partype?: string;
  info?: { attack?: number; defense?: number; magic?: number; difficulty?: number };
  passive?: { name?: string; description?: string };
  spells?: { name?: string; description?: string }[];
  allytips?: string[];
  enemytips?: string[];
}

/** Convierte el JSON de `champion/<Id>.json` en lo que lee el modelo. */
export function datosDeDDragon(c: CampeonCrudo): DatosCampeonFicha | null {
  if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') return null;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  const tips = (l: unknown) => (Array.isArray(l) ? l.map((x) => textoPlano(x, 300)).filter(Boolean).slice(0, 6) : []);
  return {
    id: c.id,
    nombre: c.name,
    titulo: textoPlano(c.title, 120),
    tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string') : [],
    recurso: textoPlano(c.partype, 40),
    info: { ataque: n(c.info?.attack), defensa: n(c.info?.defense), magia: n(c.info?.magic), dificultad: n(c.info?.difficulty) },
    pasiva: { nombre: textoPlano(c.passive?.name, 80), descripcion: textoPlano(c.passive?.description) },
    habilidades: (Array.isArray(c.spells) ? c.spells : []).slice(0, 4).map((s, i) => ({
      tecla: TECLAS[i]!,
      nombre: textoPlano(s?.name, 80),
      descripcion: textoPlano(s?.description),
    })),
    consejosAliado: tips(c.allytips),
    consejosRival: tips(c.enemytips),
  };
}

/** Fuente real (CDN de Data Dragon), con la versión y la lista de campeones en memoria. */
export function crearFuenteDDragonFicha(o: { fetch?: typeof fetch; ahora?: () => number } = {}): FuenteDDragonFicha {
  const hacerFetch = o.fetch ?? fetch;
  const ahora = o.ahora ?? Date.now;
  let version: { valor: string; hasta: number } | null = null;
  const listas = new Map<string, Promise<Map<string, CampeonLista>>>();

  async function pedirJson<T>(url: string): Promise<T> {
    const r = await hacerFetch(url, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
    if (!r.ok) throw new Error(`Data Dragon respondió ${r.status}`);
    return (await r.json()) as T;
  }

  return {
    async version() {
      if (version && ahora() < version.hasta) return version.valor;
      const [v] = await pedirJson<string[]>(URL_VERSIONES);
      if (typeof v !== 'string' || !v) throw new Error('Data Dragon no devolvió versiones');
      version = { valor: v, hasta: ahora() + VIGENCIA_VERSION_MS };
      return v;
    },
    campeones(v) {
      let lista = listas.get(v);
      if (!lista) {
        lista = pedirJson<{ data: Record<string, { id: string; name: string; tags?: string[] }> }>(urlDatosDDragon(v, 'champion', 'en_US')).then(
          (d) => new Map(Object.values(d.data).map((c) => [c.id.toLowerCase(), { id: c.id, nombre: c.name, tags: c.tags ?? [] }])),
        );
        // Un fallo no se queda en la memoria; y solo se conserva la lista de la última versión pedida.
        lista.catch(() => listas.delete(v));
        listas.clear();
        listas.set(v, lista);
      }
      return lista;
    },
    async detalle(v, id, idioma) {
      const url = `https://ddragon.leagueoflegends.com/cdn/${v}/data/${LOCALE_FICHA[idioma]}/champion/${encodeURIComponent(id)}.json`;
      const d = await pedirJson<{ data: Record<string, CampeonCrudo> }>(url);
      const c = d.data?.[id] ?? Object.values(d.data ?? {})[0];
      return c ? datosDeDDragon(c) : null;
    },
  };
}
