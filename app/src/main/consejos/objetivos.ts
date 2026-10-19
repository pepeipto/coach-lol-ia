// Constantes del juego, revisables en cada parche. Tiempos en segundos de partida.
//
// Verificado el 2026-10-19 para el parche 26.20 (Data Dragon 16.20.x). Fuentes:
// - Notas del parche 26.1 (espejo de la wiki oficial): https://wiki.leagueoflegends.com/en-us/V26.01
//   · Atakhan se elimina del juego.
//   · Barón: «Initial spawn timer reduced to 20:00 from 25:00».
//   · Campamentos (azul, lobos, aves, rojo): primera aparición 0:55; Gromp y Krugs 1:07.
//   · Escarabajo de la Grieta: «Initial spawn time reduced to 2:55 from 3:30».
//   · Sin cambios de tiempos en dragones, Anciano, Heraldo ni larvas.
// - Avance de la temporada 2026 de Riot: https://www.leagueoflegends.com/en-us/news/dev/dev-2026-season-one-gameplay-preview/
//   (Atakhan eliminado; el Barón vuelve a los 20:00).
// - Larvas del Vacío: https://wiki.leagueoflegends.com/en-us/Voidgrub_camp — 8:00, 3 larvas, sin
//   reaparición desde 25.09, se van a las 14:45 (14:55 en combate) y el Heraldo ocupa su sitio a las 15:00.
// - Heraldo: https://wiki.leagueoflegends.com/en-us/Rift_Herald — 15:00, una sola vez por partida, se va
//   a las 19:45 (19:55 en combate) y el Barón ocupa su sitio a las 20:00.
// - Barón: https://wiki.leagueoflegends.com/en-us/Baron_Nashor — 20:00, reaparece a los 6:00.
// - Dragones: https://wiki.leagueoflegends.com/en-us/Dragon_pit — primer dragón a las 5:00, el siguiente
//   5 min después de morir el anterior; con el cuarto dragón de un equipo (alma) el foso pasa al
//   Dragón Anciano con 6 min de espera, y el Anciano reaparece a los 6 min.
// - Notas del parche 26.20 (riftpatchnotes.com/lol/patch/26-20, u.gg): sin cambios de tiempos de objetivos.
// - EventName de la Live Client Data API: muestra oficial de Riot
//   https://static.developer.riotgames.com/docs/lol/liveclientdata_events.json — «DragonKill» (con
//   «DragonType», incluido «Elder», y «KillerName»), «HeraldKill» y «BaronKill».
//   «HordeKill» (cada larva) NO está en la muestra oficial: solo lo documentan herramientas de la
//   comunidad (github.com/jyaniee/league-studio-agent). Si no llega, las larvas siguen en la lista
//   hasta las 14:45, que sí es un dato confirmado.
// No se usa el tiempo de combate (14:55 / 19:55): la API no dice si el campamento está en combate.

import type { IdObjetivo } from '../../shared/tiposApp';

export interface ObjetivoNeutral {
  /** Claves de i18n: objetivo.<id> (aviso) y objetivoCorto.<id> (lista del panel). */
  id: IdObjetivo;
  aparece: number;
  /** Segundos hasta la reaparición tras su muerte; null si no reaparece. */
  reaparece: number | null;
  /** Momento en que se va del mapa aunque nadie lo mate; null si no se va. */
  desaparece: number | null;
  /** EventName que emite la API de partida al morir; null si la API no lo informa. */
  evento: string | null;
  /** Muertes con ese evento que lo terminan (3 larvas); por defecto 1. */
  muertes?: number;
  /** Épico: avisa y cuenta como «próximo objetivo». Los campamentos solo se listan al empezar. */
  epico: boolean;
}

export const CAMPAMENTOS: ObjetivoNeutral = { id: 'campamentos', aparece: 55, reaparece: null, desaparece: null, evento: null, epico: false };
export const ESCARABAJO: ObjetivoNeutral = { id: 'escarabajo', aparece: 175, reaparece: null, desaparece: null, evento: null, epico: false };
export const LARVAS: ObjetivoNeutral = { id: 'larvas', aparece: 480, reaparece: null, desaparece: 885, evento: 'HordeKill', muertes: 3, epico: true };
export const DRAGON: ObjetivoNeutral = { id: 'dragon', aparece: 300, reaparece: 300, desaparece: null, evento: 'DragonKill', epico: true };
export const HERALDO: ObjetivoNeutral = { id: 'heraldo', aparece: 900, reaparece: null, desaparece: 1185, evento: 'HeraldKill', epico: true };
export const BARON: ObjetivoNeutral = { id: 'baron', aparece: 1200, reaparece: 360, desaparece: null, evento: 'BaronKill', epico: true };

/** Dragón Anciano: sale tras el alma de dragón y comparte el foso (y el evento DragonKill) con los elementales. */
export const DRAGONES_PARA_ALMA = 4;
/** Con 7 dragones elementales en total, uno de los dos equipos tiene 4 seguro (aunque no se sepa cuál). */
export const DRAGONES_ALMA_SEGURA = 7;
export const ANCIANO_TRAS_ALMA = 360;
export const ANCIANO_REAPARECE = 360;
export const TIPO_ANCIANO = 'Elder';

/** Nombres en plural, para las plantillas de los avisos. */
export const OBJETIVOS_PLURALES: ReadonlySet<IdObjetivo> = new Set<IdObjetivo>(['larvas', 'campamentos']);

/** Segundos de antelación con los que se avisa de un objetivo. */
export const AVISO_OBJETIVO_ANTES = 60;

export const ID_GUARDIAN_CONTROL = 2055;
export const VISION_DESDE = 300;
export const VISION_ORO_MINIMO = 75;

export const FASE_MEDIA_DESDE = 840;
export const FASE_TARDIA_DESDE = 1500;
