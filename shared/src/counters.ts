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
  /**
   * 3.9.1: fracción (0..1) de las partidas en las que el campeón pedido llegó al minuto 14 con más oro que este rival
   * de línea («gana la fase de líneas»). Los empates no cuentan. Solo con `MIN_PARTIDAS_ENFRENTAMIENTO` partidas o más
   * con el dato (las guardadas desde la 3.9.1 que llegan al minuto 14).
   */
  tasaFaseLineas?: number;
  /** 3.9.1: partidas (sin empates) que respaldan `tasaFaseLineas`. */
  partidasFaseLineas?: number;
  /** 3.9.1: puntuación del cruce de −100 a 100 (`puntuacionEnfrentamiento`); solo junto a `tasaFaseLineas`. */
  puntuacion?: number;
}

/** `GET /counters/:campeon/:rol` */
export interface CountersCampeon {
  /** Id de Data Dragon del campeón. */
  campeon: string;
  rol: Rol;
  parche: string;
  /** Partidas de los cruces listables (con `MIN_PARTIDAS_ENFRENTAMIENTO` o más) del campeón en ese rol. */
  partidas: number;
  /**
   * Todos los rivales listables (con `MIN_PARTIDAS_ENFRENTAMIENTO` o más), de mejor a peor para el campeón pedido por
   * tasa suavizada. `faciles` y `dificiles` son sus extremos.
   */
  enfrentamientos: EnfrentamientoLinea[];
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
  /** 3.9.1: como en `EnfrentamientoLinea`. */
  tasaFaseLineas?: number;
  partidasFaseLineas?: number;
  puntuacion?: number;
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

/** 3.9.1: peso de la tasa de victorias en la puntuación de un cruce (el resto es la fase de líneas). */
export const PESO_VICTORIA_PUNTUACION = 0.7;

/**
 * 3.9.1: puntuación de un cruce de −100 a 100 que combina la victoria y la fase de líneas, cada una suavizada hacia
 * el 50 % con `tasaSuavizada` (K = `SUAVIZADO_ENFRENTAMIENTO` partidas ficticias al 50 %, así pocas partidas pesan
 * poco):
 *
 *   v = (victorias + K/2) / (partidas + K)
 *   f = (victoriasFase + K/2) / (partidasFase + K)
 *   puntuación = 100 · (2 · (0,7 · v + 0,3 · f) − 1)
 *
 * 0 es un cruce parejo; +100 sería ganarlo todo (partida y línea) con infinitas partidas, −100 perderlo todo. Se
 * redondea a una décima.
 */
export function puntuacionEnfrentamiento(victorias: number, partidas: number, victoriasFase: number, partidasFase: number): number {
  const v = tasaSuavizada(victorias, partidas);
  const f = tasaSuavizada(victoriasFase, partidasFase);
  const combinada = PESO_VICTORIA_PUNTUACION * v + (1 - PESO_VICTORIA_PUNTUACION) * f;
  return Math.round(1000 * (2 * combinada - 1)) / 10;
}

/*
 * 3.9.1 «Sinergias»: con qué compañeros de equipo gana más un campeón en un rol. Dos jugadores de la misma partida
 * con el mismo resultado son del mismo equipo; cuentan los pares de roles distintos de equipos con los cinco roles
 * sin repetir. Mismos mínimos, parches y suavizado que los enfrentamientos. Datos agregados de partidas terminadas.
 */

/** Compañeros de cada rol en `SinergiasCampeon`. */
export const MAX_SINERGIAS_POR_ROL = 5;

/** Un compañero de equipo del campeón pedido. */
export interface SinergiaAliado {
  /** Id de Data Dragon del compañero. */
  aliado: string;
  partidas: number;
  /** Tasa de victorias (0..1) del campeón pedido jugando con este compañero. */
  tasaVictoria: number;
  /** Menos de `PARTIDAS_ENFRENTAMIENTO_FIABLE` partidas. */
  datosLimitados: boolean;
}

/** `GET /sinergias/:campeon/:rol` */
export interface SinergiasCampeon {
  campeon: string;
  rol: Rol;
  parche: string;
  /**
   * Por rol del compañero (en el orden de `ROLES`, sin el del campeón y solo los que tienen datos): los mejores
   * compañeros por tasa suavizada, como mucho `MAX_SINERGIAS_POR_ROL`.
   */
  porRol: { rol: Rol; aliados: SinergiaAliado[] }[];
}

/** Rutas del servidor (relativas a su URL). 404 `{ error: 'sin_datos' }` si no hay datos. */
export const RUTAS_COUNTERS = {
  counters: (campeon: string, rol: Rol) => `/counters/${encodeURIComponent(campeon)}/${encodeURIComponent(rol)}`,
  enfrentamiento: (campeon: string, rival: string, rol: Rol) =>
    `/enfrentamiento/${encodeURIComponent(campeon)}/${encodeURIComponent(rival)}/${encodeURIComponent(rol)}`,
  /** 3.9.1 */
  sinergias: (campeon: string, rol: Rol) => `/sinergias/${encodeURIComponent(campeon)}/${encodeURIComponent(rol)}`,
} as const;
