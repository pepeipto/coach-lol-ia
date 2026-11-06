// Tier list de TFT para la web: se lee del servidor al compilar (la web es estática y se recompila a diario) y se
// le ponen nombres e iconos de Data Dragon en el idioma de la página. Si el servidor o Data Dragon no responden, la
// página sale sin tabla y lo dice; nunca se inventan datos. Política de Riot: ni aumentos ni Leyendas.
import {
  crearIndiceNombresTft,
  normalizarResultadoTft,
  RUTAS_TFT,
  type EntradaDDragonTft,
  type NombreTft,
  type TierTft,
} from '../../../shared/src/tft';
import type { Idioma } from '../i18n/idiomas.ts';
import { API_URL } from './sitio';

const CDN = 'https://ddragon.leagueoflegends.com';
const TIEMPO_ESPERA_MS = 15_000;
const LOCALE: Record<Idioma, string> = { es: 'es_ES', en: 'en_US', 'pt-br': 'pt_BR', fr: 'fr_FR', de: 'de_DE' };

export interface ElementoTftWeb {
  id: string;
  nombre: string;
  icono?: string;
}

export interface CompTftWeb {
  id: string;
  tier: TierTft;
  rasgos: ElementoTftWeb[];
  portador: ElementoTftWeb;
  unidades: ElementoTftWeb[];
  objetos: ElementoTftWeb[];
  nivelMedio: number;
  tableros: number;
  puestoMedio: number;
  top4: number;
  victorias: number;
}

export interface TierListTftWeb {
  parche: string;
  partidas: number;
  comps: CompTftWeb[];
}

async function json(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
  if (!r.ok) throw new Error(`Respuesta ${r.status} de ${url}`);
  return r.json();
}

async function archivo(version: string, locale: string, nombre: string): Promise<Record<string, EntradaDDragonTft>> {
  try {
    const d = (await json(`${CDN}/cdn/${version}/data/${locale}/${nombre}.json`)) as { data?: Record<string, EntradaDDragonTft> };
    return d?.data && typeof d.data === 'object' ? d.data : {};
  } catch {
    return {};
  }
}

let datos: Promise<{ resultado: ReturnType<typeof normalizarResultadoTft>; version: string | null }> | null = null;
const indices = new Map<Idioma, Promise<Record<'campeon' | 'rasgo' | 'objeto', (id: string) => NombreTft>>>();

/** Lo que es igual en todos los idiomas: la tier list del servidor y la versión de Data Dragon (una vez por compilación). */
function cargarDatos() {
  datos ??= (async () => {
    let resultado: ReturnType<typeof normalizarResultadoTft> = null;
    try {
      resultado = normalizarResultadoTft(await json(`${API_URL}${RUTAS_TFT.comps}`));
    } catch (e) {
      console.warn(`[tft] Sin tier list de TFT: ${(e as Error).message}`);
    }
    let version: string | null = null;
    try {
      const v = (await json(`${CDN}/api/versions.json`)) as unknown;
      version = Array.isArray(v) && typeof v[0] === 'string' ? v[0] : null;
    } catch {
      version = null;
    }
    return { resultado, version };
  })();
  return datos;
}

function indicesDe(lang: Idioma, version: string | null) {
  let p = indices.get(lang);
  if (!p) {
    p = (async () => {
      const pedir = (n: string) =>
        version ? Promise.all([archivo(version, LOCALE[lang], n), archivo(version, 'en_US', n)]) : Promise.resolve([{}, {}] as const);
      const [[cl, ce], [rl, re], [ol, oe]] = await Promise.all(['tft-champion', 'tft-trait', 'tft-item'].map(pedir));
      return { campeon: crearIndiceNombresTft(cl, ce), rasgo: crearIndiceNombresTft(rl, re), objeto: crearIndiceNombresTft(ol, oe) };
    })();
    indices.set(lang, p);
  }
  return p;
}

/** Tier list de TFT con nombres en el idioma de la página, o null si no hay datos. */
export async function tierListTft(lang: Idioma): Promise<TierListTftWeb | null> {
  const { resultado, version } = await cargarDatos();
  if (!resultado || resultado.comps.length === 0) return null;
  const idx = await indicesDe(lang, version);
  const el = (id: string, n: NombreTft): ElementoTftWeb => ({
    id,
    nombre: n.nombre,
    ...(n.icono && version ? { icono: `${CDN}/cdn/${version}/img/${n.icono.grupo}/${n.icono.archivo}` } : {}),
  });
  return {
    parche: resultado.parche,
    partidas: resultado.partidas,
    comps: resultado.comps.map((c) => ({
      id: c.id,
      tier: c.tier,
      rasgos: c.rasgos.map((x) => el(x, idx.rasgo(x))),
      portador: el(c.portador, idx.campeon(c.portador)),
      unidades: c.unidades.map((u) => el(u.id, idx.campeon(u.id))),
      objetos: c.objetosPortador.map((x) => el(x, idx.objeto(x))),
      nivelMedio: c.nivelMedio,
      tableros: c.tableros,
      puestoMedio: c.puestoMedio,
      top4: c.top4,
      victorias: c.victorias,
    })),
  };
}
