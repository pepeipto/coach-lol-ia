import type { ModoJuego } from './tipos';

/*
 * Modos de juego (plan 3.0, Track E). Fuentes consultadas el 2026-10-19:
 *
 * - Colas (queueId), lista oficial de Riot:
 *   https://static.developer.riotgames.com/docs/lol/queues.json
 *     420 = 5v5 Ranked Solo, 450 = «5v5 ARAM games» (Howling Abyss),
 *     2400 = «ARAM: Mayhem» (Howling Abyss), 1700 = «Arena» y 1710 = «Arena» («16 player lobby»), ambas en
 *     «Rings of Wrath».
 *   Nombres en español (es_MX) de CommunityDragon:
 *   https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/es_mx/v1/queues.json
 *     450 = «ARAM», 2400 = «ARAM: Caos», 1700/1710 = «Arena».
 *
 * - `gameMode` de la Live Client Data API (/liveclientdata/gamestats y allgamedata.gameData):
 *   «ARAM» y «CLASSIC» están en la lista oficial https://static.developer.riotgames.com/docs/lol/gameModes.json.
 *   Esa lista no incluye Arena ni ARAM: Caos; sus valores salen de fuentes de la comunidad:
 *     «CHERRY» (Arena) y «KIWI» (ARAM: Caos): https://jbnado.dev/en/contribution/adg
 *       («Riot calls Mayhem KIWI internally (Arena is CHERRY)», y lo lee de /liveclientdata/gamestats);
 *     «queue 2400 / gameMode KIWI»: https://github.com/lucasdmi/aram-player
 *     El nombre en clave «kiwi» de ARAM: Caos: https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem
 *   Por eso la app prefiere siempre la cola del cliente (LCU) y usa `gameMode` solo como respaldo.
 */

/** Cola de Match-v5 / LCU de cada modo. La primera es la que se recolecta primero. */
export const COLAS_MODO: Record<ModoJuego, readonly number[]> = {
  clasificatoria: [420],
  aram: [450],
  caos: [2400],
  // 3.8.1: desde el parche 26.x la Arena se juega en la cola 1750 («Arena 3x6», visto en el cliente el 2026-10-25).
  arena: [1700, 1710, 1750],
};

/** Modo de una cola (queueId); null si no es uno de los modos con datos. */
export function modoDeCola(cola: unknown): ModoJuego | null {
  if (typeof cola !== 'number') return null;
  for (const [modo, colas] of Object.entries(COLAS_MODO) as [ModoJuego, readonly number[]][]) {
    if (colas.includes(cola)) return modo;
  }
  return null;
}

/**
 * Modo de la partida a partir del `gameMode` de la Live Client Data API. «CLASSIC» (la Grieta) usa los datos
 * de clasificatoria, aunque sea una normal. Null para cualquier otro valor (TFT, URF, tutoriales…).
 */
export function modoDeGameMode(gameMode: unknown): ModoJuego | null {
  switch (gameMode) {
    case 'CLASSIC':
      return 'clasificatoria';
    case 'ARAM':
      return 'aram';
    case 'KIWI':
      return 'caos';
    case 'CHERRY':
      return 'arena';
    default:
      return null;
  }
}

/**
 * Mapa de cada modo (mapNumber de la Live Client Data API y `maps` de Data Dragon), según
 * https://static.developer.riotgames.com/docs/lol/maps.json: 11 = Grieta del Invocador, 12 = Abismo de los
 * Lamentos (ARAM y ARAM: Caos), 30 = Rings of Wrath (Arena).
 */
export const MAPA_DE_MODO: Record<ModoJuego, number> = { clasificatoria: 11, aram: 12, caos: 12, arena: 30 };

/** Modo con datos de un mapa (para los modos de juego cuyo gameMode no conocemos: URF, Uno para todos…). */
export function modoDeMapa(mapa: unknown): ModoJuego | null {
  if (mapa === 11) return 'clasificatoria';
  if (mapa === 12) return 'aram';
  if (mapa === 30) return 'arena';
  return null;
}

/** Los modos sin roles (ARAM, ARAM: Caos y Arena) agregan por campeón solo (rol = null). */
export const tieneRoles = (modo: ModoJuego): boolean => modo === 'clasificatoria';

/** Modos con aumentos (Match-v5 `playerAugment1..6`). */
export const tieneAumentos = (modo: ModoJuego): boolean => modo === 'caos' || modo === 'arena';

/**
 * Reparto del presupuesto de partidas de cada región entre modos (plan 3.0, Track E):
 * clasificatoria 60 %, ARAM 15 %, ARAM: Caos 10 % y Arena 15 %.
 */
export const REPARTO_MODOS: Record<ModoJuego, number> = {
  clasificatoria: 0.6,
  aram: 0.15,
  caos: 0.1,
  arena: 0.15,
};

/** Partidas por modo de un presupuesto total; lo que sobra del redondeo va a clasificatoria. */
export function repartirPresupuesto(total: number): Record<ModoJuego, number> {
  const t = Math.max(0, Math.floor(total));
  const aram = Math.floor(t * REPARTO_MODOS.aram);
  const caos = Math.floor(t * REPARTO_MODOS.caos);
  const arena = Math.floor(t * REPARTO_MODOS.arena);
  return { clasificatoria: t - aram - caos - arena, aram, caos, arena };
}

/*
 * Aumentos: nombres e iconos de CommunityDragon (es_MX). El mismo fichero trae los de Arena (iconos en
 * ASSETS/UX/Cherry/…) y los de ARAM: Caos (ids con el prefijo «ARAM_» o iconos en ASSETS/UX/Kiwi/…), con ids únicos:
 * https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/es_mx/v1/cherry-augments.json
 * Cada entrada: { id, augmentNameId, nameTRA, augmentSmallIconPath, rarity }. Las rutas «/lol-game-data/assets/…»
 * se sirven en minúsculas desde …/rcp-be-lol-game-data/global/default/… (comprobado con dos iconos, HTTP 200).
 */
export const URL_AUMENTOS_ES = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/es_mx/v1/cherry-augments.json';

/**
 * Mismo fichero en otro idioma. `locale` es el de Data Dragon (es_MX, en_US, pt_BR, fr_FR, de_DE): CommunityDragon
 * usa las mismas carpetas en minúsculas, salvo el inglés, que es «default».
 */
export function urlAumentos(locale: string): string {
  const carpeta = locale.toLowerCase() === 'en_us' ? 'default' : locale.toLowerCase();
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/${carpeta}/v1/cherry-augments.json`;
}
const BASE_ACTIVOS_CDRAGON = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';

/** URL del icono de un aumento a partir de `augmentSmallIconPath`; null si la ruta no tiene la forma esperada. */
export function urlIconoAumento(ruta: unknown): string | null {
  if (typeof ruta !== 'string') return null;
  const prefijo = '/lol-game-data/assets/';
  if (!ruta.toLowerCase().startsWith(prefijo)) return null;
  const resto = ruta.slice(prefijo.length).toLowerCase();
  if (!/^[a-z0-9_\-./]+$/.test(resto) || resto.includes('..')) return null;
  return BASE_ACTIVOS_CDRAGON + resto;
}
