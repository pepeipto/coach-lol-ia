import { IDIOMAS_IA, type IdiomaIa } from './coachIa';

/*
 * Novedades del parche (mejora 9 del estudio de la competencia, 25-10-2026): contrato entre el servidor y la app.
 *
 * Con cada versión nueva de Data Dragon, el servidor lee las notas oficiales del parche en inglés de
 * leagueoflegends.com (solo los apartados «Champions» e «Items»), y la IA escribe por cada campeón y objeto cambiado
 * una frase propia y corta, en cada idioma de la app, con su tipo: mejora, empeora o ajuste. No se copian las notas:
 * solo resúmenes, siempre con el enlace a la fuente oficial de Riot. Es información pública de antes de la partida.
 */

export type TipoCambioParche = 'mejora' | 'empeora' | 'ajuste';
export const TIPOS_CAMBIO_PARCHE: readonly TipoCambioParche[] = ['mejora', 'empeora', 'ajuste'];

export interface CambioCampeonParche {
  /** Id de Data Dragon («Ahri», «MonkeyKing»). */
  campeon: string;
  tipo: TipoCambioParche;
  /** Una frase corta, escrita por la IA en el idioma pedido. */
  resumen: string;
}

export interface CambioObjetoParche {
  /** Nombre del objeto tal y como sale en las notas en inglés. */
  objeto: string;
  /** Id de Data Dragon del objeto, si se reconoce (la app lo usa para el nombre en su idioma y el icono). */
  id?: number;
  tipo: TipoCambioParche;
  resumen: string;
}

/** `GET /parche/:parche?idioma=es` (`:parche` es «16.21», «26.21» o «actual»). */
export interface NotasParche {
  /** Parche de Data Dragon («16.21»). */
  parche: string;
  /** Número del parche en el juego y en las notas de Riot («26.21»). */
  parcheJuego: string;
  idioma: IdiomaIa;
  /** Notas oficiales de Riot en el idioma pedido. */
  url: string;
  /** Resumen general del parche en 1-2 frases (puede faltar). */
  general?: string;
  campeones: CambioCampeonParche[];
  objetos: CambioObjetoParche[];
  /** Fecha ISO en la que se escribió el resumen. */
  generadoEn: string;
}

export const LIMITES_NOTAS_PARCHE = {
  /** Caracteres máximos de cada frase. */
  caracteres: 220,
  /** Caracteres máximos del resumen general. */
  general: 320,
  campeones: 120,
  objetos: 80,
} as const;

export const RUTAS_PARCHE = {
  notas: (parche: string, idioma: IdiomaIa) => `/parche/${encodeURIComponent(parche)}?idioma=${encodeURIComponent(idioma)}`,
} as const;

/** Locale de leagueoflegends.com para cada idioma de la app. */
const LOCALE_WEB: Record<IdiomaIa, string> = { es: 'es-es', en: 'en-us', 'pt-BR': 'pt-br', fr: 'fr-fr', de: 'de-de' };

/**
 * Data Dragon numera los parches 10 por debajo del juego desde 2025 («15.x» → «25.x», «16.21» → «26.21»).
 * Devuelve null si no es un parche «mayor.menor».
 */
export function parcheJuegoDeDDragon(parche: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})$/.exec(parche);
  if (!m) return null;
  const mayor = Number(m[1]);
  return mayor >= 15 && mayor < 20 ? `${mayor + 10}.${Number(m[2])}` : null;
}

/** «26.21» → «16.21»; «16.21» se deja igual. Null si no es un parche válido. */
export function parcheDDragonDe(parche: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})$/.exec(parche);
  if (!m) return null;
  const mayor = Number(m[1]);
  if (mayor >= 25 && mayor < 30) return `${mayor - 10}.${Number(m[2])}`;
  if (mayor >= 15 && mayor < 20) return `${mayor}.${Number(m[2])}`;
  return null;
}

/** Notas oficiales de Riot de un parche del juego («26.21») en el idioma de la app. */
export function urlNotasParche(parcheJuego: string, idioma: IdiomaIa): string {
  const [mayor, menor] = parcheJuego.split('.');
  return `https://www.leagueoflegends.com/${LOCALE_WEB[idioma]}/news/game-updates/league-of-legends-patch-${mayor}-${menor}-notes/`;
}

const ID_CAMPEON = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
const esTipo = (x: unknown): x is TipoCambioParche => TIPOS_CAMBIO_PARCHE.includes(x as TipoCambioParche);
const frase = (x: unknown, max: number = LIMITES_NOTAS_PARCHE.caracteres): string | null => {
  if (typeof x !== 'string') return null;
  const t = x.replace(/\s+/g, ' ').trim();
  return t.length > 0 && t.length <= max ? t : null;
};

/** Notas válidas (de la red o de una caché) o null. Descarta las entradas mal formadas. */
export function normalizarNotasParche(x: unknown): NotasParche | null {
  if (typeof x !== 'object' || x === null) return null;
  const n = x as Record<string, unknown>;
  if (typeof n.parche !== 'string' || !parcheJuegoDeDDragon(n.parche)) return null;
  if (typeof n.parcheJuego !== 'string' || parcheJuegoDeDDragon(n.parche) !== n.parcheJuego) return null;
  if (!IDIOMAS_IA.includes(n.idioma as IdiomaIa)) return null;
  if (typeof n.url !== 'string' || !n.url.startsWith('https://www.leagueoflegends.com/')) return null;
  if (typeof n.generadoEn !== 'string') return null;
  if (!Array.isArray(n.campeones) || !Array.isArray(n.objetos)) return null;
  const vistos = new Set<string>();
  const campeones: CambioCampeonParche[] = [];
  for (const c of n.campeones.slice(0, LIMITES_NOTAS_PARCHE.campeones)) {
    const e = c as Record<string, unknown>;
    const resumen = frase(e?.resumen);
    if (typeof e?.campeon !== 'string' || !ID_CAMPEON.test(e.campeon) || !esTipo(e.tipo) || !resumen) continue;
    if (vistos.has(e.campeon.toLowerCase())) continue;
    vistos.add(e.campeon.toLowerCase());
    campeones.push({ campeon: e.campeon, tipo: e.tipo, resumen });
  }
  const objetos: CambioObjetoParche[] = [];
  for (const o of n.objetos.slice(0, LIMITES_NOTAS_PARCHE.objetos)) {
    const e = o as Record<string, unknown>;
    const resumen = frase(e?.resumen);
    const nombre = frase(e?.objeto, 80);
    if (!nombre || !esTipo(e.tipo) || !resumen) continue;
    const id = typeof e.id === 'number' && Number.isInteger(e.id) && e.id > 0 ? e.id : undefined;
    objetos.push({ objeto: nombre, ...(id ? { id } : {}), tipo: e.tipo, resumen });
  }
  const general = frase(n.general, LIMITES_NOTAS_PARCHE.general);
  return {
    parche: n.parche,
    parcheJuego: n.parcheJuego,
    idioma: n.idioma as IdiomaIa,
    url: n.url,
    ...(general ? { general } : {}),
    campeones,
    objetos,
    generadoEn: n.generadoEn,
  };
}
