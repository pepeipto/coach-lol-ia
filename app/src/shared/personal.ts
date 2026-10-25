import type { Rol } from '@coach/shared';

/*
 * 3.9: «Tus estadísticas» (lo que U.GG cobra como «Personal Counters & Stats» y «Personal Tier List»), calculado solo
 * con el historial que la app ya guarda en el PC del jugador. Nada sale del PC y no hay ninguna comparación con otros
 * jugadores (ni MMR ni clasificaciones acumuladas): es el propio historial del jugador.
 */

/** Partidas mínimas de un grupo (campeón y rol, cruce o rival) para salir en las tablas. */
export const MINIMO_PARTIDAS_PERSONAL = 3;
/** Por debajo de estas partidas el dato sale con el aviso «pocas partidas». */
export const AVISO_PARTIDAS_PERSONAL = 8;

export type TierPersonal = 'S' | 'A' | 'B' | 'C' | 'D';

/** Tu campeón contra un rival de tu línea en un rol. */
export interface CrucePersonal {
  campeonId: number;
  rivalId: number;
  rol: Rol;
  partidas: number;
  victorias: number;
  /** 0–1. */
  winrate: number;
  /** Nota media 0–100 (la puntuación total de cada partida). */
  nota: number;
  kda: number;
  /** Menos de AVISO_PARTIDAS_PERSONAL partidas. */
  pocas: boolean;
}

/** Contra quién te va peor y mejor con un campeón en un rol. */
export interface CountersPersonales {
  campeonId: number;
  rol: Rol;
  /** Partidas con ese campeón y rol en las que se sabe quién era el rival de línea. */
  partidas: number;
  /** Cruces con % de victorias por debajo del 50 %, del peor al menos malo. */
  peores: CrucePersonal[];
  /** Cruces con el 50 % o más, del mejor al menos bueno. */
  mejores: CrucePersonal[];
}

export interface CampeonTierPersonal {
  campeonId: number;
  rol: Rol;
  partidas: number;
  victorias: number;
  winrate: number;
  /** % de victorias suavizado hacia el 50 % (0–1); ver `puntosTier`. */
  winrateSuavizado: number;
  kda: number;
  nota: number;
  /** 0–100: lo que decide el tier. */
  puntos: number;
  tier: TierPersonal;
  pocas: boolean;
}

/** Un campeón rival de tu línea, juegues con lo que juegues. */
export interface RivalPersonal {
  rivalId: number;
  rol: Rol;
  partidas: number;
  victorias: number;
  derrotas: number;
  winrate: number;
  winrateSuavizado: number;
  /** Tu nota media en esas partidas. */
  nota: number;
  pocas: boolean;
}

export interface EstadisticasPersonales {
  /** Partidas de la Grieta (clasificatoria y normales, sin rehechas) con rol conocido. */
  partidas: number;
  /** De ellas, las que tienen un rival de línea claro. */
  partidasConRival: number;
  /** Todos los cruces con el mínimo de partidas, del peor al mejor. */
  counters: CrucePersonal[];
  tierList: CampeonTierPersonal[];
  peoresRivales: RivalPersonal[];
  /** Cuántas partidas faltan para que cada tabla tenga su primera fila (0 si ya tiene alguna). */
  faltan: { tierList: number; counters: number; rivales: number };
}

/** Lo que pide la IPC 'coach:personal-stats': sin nada, todo; con campeón y rol, sus counters; con rival, el cruce. */
export interface ConsultaPersonal {
  campeon?: number;
  rol?: Rol;
  rival?: number;
}

export interface RespuestaPersonal {
  estadisticas: EstadisticasPersonales;
  counters: CountersPersonales | null;
  enfrentamiento: CrucePersonal | null;
}
