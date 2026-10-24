import type { Build, Rol } from './tipos';

/*
 * 3.9 «Counters»: contrato entre el servidor y la app para los enfrentamientos de línea (quién te cuesta y contra
 * quién te va bien en tu rol) y para un cruce concreto durante la selección de campeón.
 *
 * Normas de Riot: son datos agregados de partidas de clasificatoria ya terminadas (las normales de la Grieta usan los
 * mismos datos). Nada de una partida en curso, nada del rival como jugador (solo su campeón, que el propio cliente
 * enseña en la selección) y nada de MMR. Es información de antes de la partida: no va en el overlay.
 *
 * Dos jugadores de la misma partida con el mismo rol y distinto resultado son rivales de línea; las partidas en las
 * que un rol no tiene exactamente un jugador por equipo se descartan.
 */

/** Partidas mínimas de un cruce para listarlo o servirlo. */
export const MIN_PARTIDAS_ENFRENTAMIENTO = 8;
/** Por debajo de estas partidas, el cruce se marca como «datos limitados». */
export const PARTIDAS_ENFRENTAMIENTO_FIABLE = 30;
/**
 * Suavizado bayesiano del orden: la tasa se ordena como (victorias + K/2) / (partidas + K), es decir, como si cada
 * cruce tuviera K partidas más al 50 %. Así un 3 de 3 no sale el primero.
 */
export const SUAVIZADO_ENFRENTAMIENTO = 20;
/** Cruces de cada lista de `CountersCampeon`. */
export const MAX_ENFRENTAMIENTOS_LISTA = 6;
/** Partidas mínimas de un cruce para calcular su build propia. */
export const MIN_PARTIDAS_BUILD_ENFRENTAMIENTO = 40;

/** Un rival de línea del campeón pedido. */
export interface EnfrentamientoLinea {
  /** Id de Data Dragon del rival (la app lo compara sin distinguir mayúsculas). */
  rival: string;
  partidas: number;
  /** Tasa de victorias (0..1) del campeón pedido contra este rival. */
  tasaVictoria: number;
  /** Menos de `PARTIDAS_ENFRENTAMIENTO_FIABLE` partidas. */
  datosLimitados: boolean;
}

/** `GET /counters/:campeon/:rol` */
export interface CountersCampeon {
  /** Id de Data Dragon del campeón. */
  campeon: string;
  rol: Rol;
  parche: string;
  /** Partidas de los cruces listables (con `MIN_PARTIDAS_ENFRENTAMIENTO` o más) del campeón en ese rol. */
  partidas: number;
  /** Los rivales contra los que mejor le va (más fáciles primero), como mucho `MAX_ENFRENTAMIENTOS_LISTA`. */
  faciles: EnfrentamientoLinea[];
  /** Los rivales que le counterean (más difíciles primero), como mucho `MAX_ENFRENTAMIENTOS_LISTA`. */
  dificiles: EnfrentamientoLinea[];
}

/** `GET /enfrentamiento/:campeon/:rival/:rol` */
export interface Enfrentamiento {
  campeon: string;
  rival: string;
  rol: Rol;
  parche: string;
  partidas: number;
  /** Tasa de victorias (0..1) de `campeon` contra `rival`. */
  tasaVictoria: number;
  datosLimitados: boolean;
  /**
   * La opción de núcleo (con la página de runas) que más gana en este cruce, con suavizado; solo si el cruce tiene
   * `MIN_PARTIDAS_BUILD_ENFRENTAMIENTO` partidas o más y la opción llega a un mínimo. Es una build normal: se importa
   * como las demás.
   */
  build?: Build;
}

/** Tasa de victorias suavizada hacia el 50 % (para ordenar). */
export function tasaSuavizada(victorias: number, partidas: number, k = SUAVIZADO_ENFRENTAMIENTO): number {
  return (victorias + k / 2) / (partidas + k);
}

/** Rutas del servidor (relativas a su URL). 404 `{ error: 'sin_datos' }` si no hay datos. */
export const RUTAS_COUNTERS = {
  counters: (campeon: string, rol: Rol) => `/counters/${encodeURIComponent(campeon)}/${encodeURIComponent(rol)}`,
  enfrentamiento: (campeon: string, rival: string, rol: Rol) =>
    `/enfrentamiento/${encodeURIComponent(campeon)}/${encodeURIComponent(rival)}/${encodeURIComponent(rol)}`,
} as const;
