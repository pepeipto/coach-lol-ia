export type Rol = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY';
export const ROLES: Rol[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

export type Habilidad = 'Q' | 'W' | 'E' | 'R';

/** runas: 9 ids: 4 principal, 2 secundaria, 3 fragmentos (ataque, flexible, defensa). */
export interface PaginaRunas {
  estiloPrincipal: number;
  estiloSecundario: number;
  runas: number[];
}

/** Media por partida de asesinatos, muertes y asistencias; ratio = (asesinatos + asistencias) / máx(1, muertes). */
export interface KdaMedio {
  asesinatos: number;
  muertes: number;
  asistencias: number;
  ratio: number;
}

/**
 * Una página de runas elegible por separado (al estilo Blitz/U.GG): partidas agrupadas por runa clave y rama
 * secundaria, con la página completa más habitual del grupo y las cifras del grupo.
 */
export interface OpcionRunas {
  runas: PaginaRunas;
  partidas: number;
  tasaVictoria: number; // 0..1
  /** 0..1: partidas del grupo entre el total del campeón (y rol). */
  popularidad: number;
  /** Menos de 30 partidas: la app muestra «Datos limitados». */
  datosLimitados: boolean;
}

export interface Build {
  campeon: string; // id de Data Dragon, p. ej. "Ahri"
  /** Rol en clasificatoria; null en los modos sin roles (ARAM, ARAM: Caos y Arena). */
  rol: Rol | null;
  /** Modo de los datos; falta en builds de servidores anteriores a 3.0 (clasificatoria). */
  modo?: ModoJuego;
  parche: string; // "15.20"
  partidas: number;
  /** Menos de 30 partidas: la app muestra «Datos limitados». Falta en builds de servidores antiguos. */
  datosLimitados?: boolean;
  tasaVictoria: number; // 0..1
  mezclaParches: boolean;
  runas: PaginaRunas;
  hechizos: [number, number];
  objetosIniciales: number[];
  nucleo: number[];
  botas: number | null;
  situacionales: number[];
  ordenHabilidades: Habilidad[]; // 18 elementos
  calculadoEn: string; // ISO
  /** KDA medio del campeón en el rol; null con menos de 10 partidas con el dato. Falta en builds anteriores a la 3.0. */
  kda?: KdaMedio | null;
  /** Solo en la build de jungla de clasificatoria con 30 partidas o más con ruta (Track F2): ruta habitual estimada. */
  rutaJungla?: RutaJungla;
  /** 0..1: partidas de esta opción entre el total del campeón y rol (1 en la build global; falta en builds de v1). */
  popularidad?: number;
  /**
   * Solo en la build de nivel superior que sirve el servidor, que es la agregación global de v1 (todas
   * las partidas): las 1-3 opciones por núcleo, de más a menos jugada. `opciones[0]` no tiene por qué
   * coincidir con la de nivel superior. Falta en builds de v1: entonces la de nivel superior es la única opción.
   */
  opciones?: Build[];
  /**
   * Solo en la build de nivel superior de clasificatoria, ARAM y ARAM: Caos (Arena no tiene runas): 1-3 páginas
   * de runas elegibles aparte de la opción de objetos, de más a menos jugada. Falta en servidores anteriores a
   * la 3.0.1: entonces cada opción usa sus propias runas.
   */
  opcionesRunas?: OpcionRunas[];
  /**
   * ARAM: Caos y Arena: aumentos de las partidas (Match-v5 `playerAugment1..6`), de más a menos elegidos.
   * Solo en la build de nivel superior.
   */
  aumentos?: EstadisticaElemento[];
  /**
   * ARAM: Caos y Arena: los mejores aumentos con 5 o más partidas, aparte de los más elegidos (que pueden no
   * incluirlos). En Arena, por posición media (de mejor a peor); en ARAM: Caos, que no tiene puestos, por victorias.
   * Va en la build de nivel superior y en cada opción.
   */
  aumentosMejores?: EstadisticaElemento[];
  /** Arena: objetos del inventario final, de más a menos elegidos (con su posición media). */
  objetosArena?: EstadisticaElemento[];
  /** Arena: los mejores objetos por posición media, con 5 o más partidas. */
  objetosArenaMejores?: EstadisticaElemento[];
  /** Arena: cifras del campeón (Match-v5 `placement`, 1..8). */
  arena?: EstadisticasArena;
}

/** Un aumento u objeto con sus cifras dentro de las partidas del campeón. */
export interface EstadisticaElemento {
  id: number;
  partidas: number;
  /** Fracción de las partidas del campeón en las que se eligió (0..1). */
  uso: number;
  /** Fracción de esas partidas ganadas (en Arena: terminadas en 1.er puesto). */
  tasaVictoria: number;
  /** Arena: posición media (1..8) de esas partidas; null en los demás modos. */
  posicionMedia: number | null;
}

export interface EstadisticasArena {
  /** Posición media (1 = primero). */
  posicionMedia: number;
  /** Fracción de partidas terminadas entre los 4 primeros (0..1). */
  top4: number;
  /** Fracción de partidas terminadas en 1.er puesto (0..1); también va en `tasaVictoria`. */
  victorias: number;
}

export interface RolesCampeon {
  campeon: string;
  roles: { rol: Rol; partidas: number }[];
}

export interface ItemDDragonCrudo {
  gold: { total: number; purchasable: boolean };
  from?: string[];
  into?: string[];
  tags?: string[];
  consumed?: boolean;
  maps?: Record<string, boolean>;
  name?: string;
}

/**
 * Modo de juego de los datos (plan 3.0, Track E): clasificatoria (Grieta, cola 420), ARAM (450),
 * ARAM: Caos (2400) y Arena (1700/1710). Las colas y sus fuentes están en `modos.ts`.
 */
export type ModoJuego = 'clasificatoria' | 'aram' | 'caos' | 'arena';
export const MODOS_JUEGO: ModoJuego[] = ['clasificatoria', 'aram', 'caos', 'arena'];
export const MODO_POR_DEFECTO: ModoJuego = 'clasificatoria';

export type Tier = 'S' | 'A' | 'B' | 'C';
export const TIERS: Tier[] = ['S', 'A', 'B', 'C'];

/** Una fila de la lista de campeones: un campeón en un rol, con sus cifras del parche. */
export interface EntradaCampeon {
  /** Nombre del campeón tal como lo guarda el servidor (Match-v5); se compara sin distinguir mayúsculas. */
  campeon: string;
  /** Rol en clasificatoria; null en los modos sin roles. */
  rol: Rol | null;
  partidas: number;
  tasaVictoria: number; // 0..1 (en Arena: 1.er puesto)
  /** Solo en Arena: posición media y fracción de top 4. */
  posicionMedia?: number;
  top4?: number;
  /** Fracción de las partidas del rol en el parche que son de este campeón (0..1). */
  uso: number;
  tier: Tier;
  /** Menos de 30 partidas: nunca pasa de B. */
  datosLimitados: boolean;
}

/** Respuesta de `GET /campeones`. */
export interface ListaCampeones {
  parche: string;
  campeones: EntradaCampeon[];
}

/** Calles de la Grieta para la ruta del jungla (Track F2). */
export type CalleJungla = 'top' | 'mid' | 'bot';

/**
 * Respuesta de `GET /jungla/ruta/:campeon` (Track F2): ruta habitual de un campeón en la jungla, estimada con las
 * posiciones de los minutos 1 a 4 de las líneas de tiempo de Match-v5. Es un dato agregado de muchas partidas,
 * nunca la posición de nadie en una partida en curso. Solo se publica con al menos 30 partidas.
 */
export interface RutaJungla {
  /** Lado del primer campamento, relativo a su equipo: su bufo rojo o su bufo azul; null si no hay uno claro. */
  inicio: 'rojo' | 'azul' | null;
  /** Calle más frecuente del primer gank (entre los minutos 2 y 4) y el minuto mediano; null si no hay una clara. */
  primerGank: { calle: CalleJungla; minuto: number } | null;
  partidas: number;
}
