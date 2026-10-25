import { IDIOMAS_IA, type IdiomaIa } from './coachIa';

/*
 * Ficha del campeón (mejora 4 del estudio de la competencia, 25-10-2026): contrato entre el servidor y la app.
 *
 * «Información clave», «Fortalezas», «Debilidades» y «Campeones parecidos» los escribe una vez por parche e idioma la
 * IA del servidor a partir de Data Dragon (habilidades, pasiva, etiquetas y consejos de Riot): es información
 * estática del campeón, sin datos de ninguna partida. El «Desglose de daño» sale de las partidas de clasificatoria ya
 * terminadas (daño físico, mágico y verdadero a campeones de Match-v5), solo con `MIN_PARTIDAS_DANIO` partidas o más.
 *
 * Normas de Riot: nada de información oculta, ninguna orden de qué hacer en la partida y ninguna cifra de rendimiento
 * más allá del reparto del daño. Es información de antes de la partida: no va en el overlay.
 */

/** Reparto del daño a campeones (fracciones 0..1 que suman 1). */
export interface DesgloseDanio {
  fisico: number;
  magico: number;
  verdadero: number;
}

/** `GET /ficha/:campeon?idioma=es` */
export interface FichaCampeon {
  /** Id de Data Dragon del campeón («Ahri», «MonkeyKing»). */
  campeon: string;
  idioma: IdiomaIa;
  /** Información clave: 3-5 frases cortas. */
  claves: string[];
  /** 3-4 fortalezas. */
  fortalezas: string[];
  /** 3-4 debilidades. */
  debilidades: string[];
  /** 4-6 ids de Data Dragon de campeones de estilo parecido (nunca el propio campeón). */
  parecidos: string[];
  /** Desglose medio del daño a campeones; falta sin `MIN_PARTIDAS_DANIO` partidas con el dato. */
  danio?: DesgloseDanio;
  /** Fecha ISO en la que se generaron los textos. */
  generadoEn: string;
}

/** Tamaños de cada bloque de la ficha. */
export const LIMITES_FICHA = {
  claves: { min: 3, max: 5 },
  fortalezas: { min: 3, max: 4 },
  debilidades: { min: 3, max: 4 },
  parecidos: { min: 4, max: 6 },
  /** Caracteres máximos de cada frase. */
  caracteres: 220,
} as const;

/** Partidas mínimas con el dato de daño para publicar el desglose. */
export const MIN_PARTIDAS_DANIO = 30;

export const RUTAS_FICHA = {
  ficha: (campeon: string, idioma: IdiomaIa) => `/ficha/${encodeURIComponent(campeon)}?idioma=${encodeURIComponent(idioma)}`,
} as const;

/** Ids de Data Dragon: letras y números. */
const ID_CAMPEON = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
export const esIdCampeonFicha = (x: unknown): x is string => typeof x === 'string' && ID_CAMPEON.test(x);

const esFraccion = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;

/** Desglose válido (tres fracciones que suman 1 con un margen de redondeo); null si no lo es. */
export function normalizarDesglose(x: unknown): DesgloseDanio | null {
  const d = x as Partial<DesgloseDanio> | null;
  if (!d || typeof d !== 'object' || !esFraccion(d.fisico) || !esFraccion(d.magico) || !esFraccion(d.verdadero)) return null;
  const suma = d.fisico + d.magico + d.verdadero;
  if (Math.abs(suma - 1) > 0.02) return null;
  return { fisico: d.fisico, magico: d.magico, verdadero: d.verdadero };
}

function textos(x: unknown, min: number, max: number): string[] | null {
  if (!Array.isArray(x)) return null;
  const limpias = x
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0 && s.length <= LIMITES_FICHA.caracteres)
    .slice(0, max);
  return limpias.length >= min ? limpias : null;
}

/**
 * Ficha recibida (del servidor o de la caché de la app) con la forma del contrato: null si no la tiene. Las frases
 * vacías o demasiado largas se descartan, los bloques se recortan a su máximo y el desglose raro se quita.
 */
export function normalizarFicha(x: unknown): FichaCampeon | null {
  const f = x as Partial<FichaCampeon> | null;
  if (!f || typeof f !== 'object' || !esIdCampeonFicha(f.campeon) || !(IDIOMAS_IA as readonly unknown[]).includes(f.idioma)) return null;
  if (typeof f.generadoEn !== 'string' || !f.generadoEn) return null;
  const L = LIMITES_FICHA;
  const claves = textos(f.claves, L.claves.min, L.claves.max);
  const fortalezas = textos(f.fortalezas, L.fortalezas.min, L.fortalezas.max);
  const debilidades = textos(f.debilidades, L.debilidades.min, L.debilidades.max);
  if (!claves || !fortalezas || !debilidades || !Array.isArray(f.parecidos)) return null;
  const vistos = new Set<string>([f.campeon.toLowerCase()]);
  const parecidos: string[] = [];
  for (const p of f.parecidos) {
    if (!esIdCampeonFicha(p) || vistos.has(p.toLowerCase())) continue;
    vistos.add(p.toLowerCase());
    parecidos.push(p);
  }
  if (parecidos.length < L.parecidos.min) return null;
  const danio = f.danio === undefined ? null : normalizarDesglose(f.danio);
  return {
    campeon: f.campeon,
    idioma: f.idioma as IdiomaIa,
    claves,
    fortalezas,
    debilidades,
    parecidos: parecidos.slice(0, L.parecidos.max),
    ...(danio ? { danio } : {}),
    generadoEn: f.generadoEn,
  };
}
