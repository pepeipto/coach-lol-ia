import { IDIOMAS_IA, type IdiomaIa } from './coachIa';
import { esIdCampeonFicha } from './ficha';
import { ROLES, type Rol } from './tipos';

/*
 * Consejos del enfrentamiento (mejora 12 del estudio de la competencia, 25-10-2026): contrato entre el servidor y la
 * app para el bloque «Claves del cruce» de la tarjeta «Contra {rival}».
 *
 * La IA del servidor los escribe una vez por parche, idioma, rol y pareja de campeones a partir de Data Dragon de los
 * dos (habilidades, pasivas y consejos de Riot) y, si las hay, de las cifras agregadas del cruce (solo como contexto:
 * nunca salen en el texto). Son consejos de ANTES de la partida («cuidado con su E a nivel 2», «su ventana de poder
 * es…»): ninguna orden en tiempo real, nada de información oculta y ningún % de victorias.
 */

/** `GET /enfrentamiento-consejos/:campeon/:rival/:rol?idioma=es` */
export interface ConsejosEnfrentamiento {
  /** Id de Data Dragon de tu campeón. */
  campeon: string;
  /** Id de Data Dragon del rival de línea. */
  rival: string;
  idioma: IdiomaIa;
  rol: Rol;
  /** 3-4 consejos cortos para este cruce. */
  consejos: string[];
  /** 0-2 combos de tu campeón en texto («E → Q → W → R»). */
  combos?: string[];
  /** Fecha ISO en la que se generaron. */
  generadoEn: string;
}

export const LIMITES_CONSEJOS_ENFRENTAMIENTO = {
  consejos: { min: 3, max: 4 },
  combos: { max: 2 },
  /** Caracteres máximos de cada consejo. */
  caracteres: 180,
  /** Caracteres máximos de cada combo. */
  caracteresCombo: 80,
} as const;

export const RUTAS_CONSEJOS_ENFRENTAMIENTO = {
  consejos: (campeon: string, rival: string, rol: Rol, idioma: IdiomaIa) =>
    `/enfrentamiento-consejos/${encodeURIComponent(campeon)}/${encodeURIComponent(rival)}/${encodeURIComponent(rol)}?idioma=${encodeURIComponent(idioma)}`,
} as const;

const limpia = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Un combo tiene que nombrar alguna habilidad (Q, W, E o R). */
export const esComboValido = (s: string): boolean => s.length > 0 && s.length <= LIMITES_CONSEJOS_ENFRENTAMIENTO.caracteresCombo && /(^|[^A-Za-z])[QWER]([^A-Za-z]|$)/.test(s);

/**
 * Consejos recibidos (del servidor o de la caché de la app) con la forma del contrato: null si no la tienen. Las
 * frases vacías o demasiado largas se descartan, los bloques se recortan a su máximo y los combos raros se quitan.
 */
export function normalizarConsejosEnfrentamiento(x: unknown): ConsejosEnfrentamiento | null {
  const c = x as Partial<ConsejosEnfrentamiento> | null;
  if (!c || typeof c !== 'object' || !esIdCampeonFicha(c.campeon) || !esIdCampeonFicha(c.rival)) return null;
  if (c.campeon.toLowerCase() === c.rival.toLowerCase()) return null;
  if (!(IDIOMAS_IA as readonly unknown[]).includes(c.idioma) || !ROLES.includes(c.rol as Rol)) return null;
  if (typeof c.generadoEn !== 'string' || !c.generadoEn || !Array.isArray(c.consejos)) return null;
  const L = LIMITES_CONSEJOS_ENFRENTAMIENTO;
  const consejos = c.consejos
    .filter((s): s is string => typeof s === 'string')
    .map(limpia)
    .filter((s) => s.length > 0 && s.length <= L.caracteres)
    .slice(0, L.consejos.max);
  if (consejos.length < L.consejos.min) return null;
  const combos = (Array.isArray(c.combos) ? c.combos : [])
    .filter((s): s is string => typeof s === 'string')
    .map(limpia)
    .filter(esComboValido)
    .slice(0, L.combos.max);
  return {
    campeon: c.campeon,
    rival: c.rival,
    idioma: c.idioma as IdiomaIa,
    rol: c.rol as Rol,
    consejos,
    ...(combos.length ? { combos } : {}),
    generadoEn: c.generadoEn,
  };
}
