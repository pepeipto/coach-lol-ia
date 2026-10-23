import type { Build, ListaCampeones } from './tipos';

/*
 * 3.8 «Todo LoL»: contrato entre el servidor (sector 1) y la app (sector 2) para los modos rotativos (URF, Uno para
 * todos, Nexus Blitz, Libro de hechizos…) y las colas normales de la Grieta. Lo mantiene el jefe de proyecto: los
 * sectores no lo cambian; si necesitan algo distinto, lo piden.
 *
 * - Las colas normales de la Grieta usan los datos de clasificatoria (mismo juego y muchos más datos).
 * - Un modo rotativo es cualquier cola de LoL que no es clasificatoria, ARAM, ARAM: Caos ni Arena. Se identifica por su
 *   cola (queueId) y su `gameMode` (los de https://static.developer.riotgames.com/docs/lol/queues.json y gameModes.json).
 * - Los modos PvE (Enjambre y similares) no tienen builds: `pve: true`.
 */

/** Colas normales de la Grieta (reclutamiento, a ciegas, Flex, partida rápida/Swiftplay): datos de clasificatoria. */
export const COLAS_GRIETA_NORMAL: readonly number[] = [400, 430, 440, 480, 490];

/** Un modo rotativo de LoL que el servidor conoce (activo ahora o con datos del parche). */
export interface ModoRotativo {
  /** Cola de Match-v5 / LCU (queueId), p. ej. 1900 (URF). */
  cola: number;
  /** `gameMode` de la Live Client Data API y de Match-v5, p. ej. «URF», «ONEFORALL». */
  gameMode: string;
  /** Mapa (11 Grieta, 12 Abismo, 30 Arena…). */
  mapa: number;
  /** Nombre del modo (inglés, de queues.json; la app lo traduce si tiene traducción propia). */
  nombre: string;
  /** Hay partidas recogidas del parche y se pueden pedir sus builds. */
  conDatos: boolean;
  /** Modo contra la IA o PvE sin builds (Enjambre…): la app no pide builds. */
  pve: boolean;
}

/** `GET /rotativos` */
export interface ListaModosRotativos {
  /** ISO de la última vez que el servidor revisó las colas activas. */
  actualizado: string;
  modos: ModoRotativo[];
}

/**
 * `GET /rotativos/:cola/builds/:campeon` → `BuildRotativa` (404 `{ error: 'sin_datos' }` si no hay datos).
 * Es una build normal por campeón (rol null) con la cola y el modo.
 */
export interface BuildRotativa extends Build {
  rol: null;
  cola: number;
  gameMode: string;
}

/** `GET /rotativos/:cola/campeones` → la lista de campeones con su tier en ese modo (mismo formato que `/campeones`). */
export type ListaCampeonesRotativo = ListaCampeones;

/** Rutas del servidor (relativas a su URL). */
export const RUTAS_ROTATIVOS = {
  lista: '/rotativos',
  build: (cola: number, campeon: string) => `/rotativos/${cola}/builds/${encodeURIComponent(campeon)}`,
  campeones: (cola: number) => `/rotativos/${cola}/campeones`,
} as const;

/** La cola es una normal de la Grieta (usa los datos de clasificatoria). */
export const esColaGrietaNormal = (cola: unknown): boolean => typeof cola === 'number' && COLAS_GRIETA_NORMAL.includes(cola);
