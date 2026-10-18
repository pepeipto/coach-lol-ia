// Constantes del juego, revisables en cada parche. Tiempos en segundos.
export interface ObjetivoNeutral {
  /** Clave de i18n: objetivo.<nombre>. */
  nombre: 'dragon' | 'heraldo' | 'baron';
  aparece: number;
  /** Segundos hasta la reaparición tras su muerte; null si no reaparece. */
  reaparece: number | null;
  /** EventName que emite la API de partida al morir. */
  evento: string;
}

export const DRAGON: ObjetivoNeutral = { nombre: 'dragon', aparece: 300, reaparece: 300, evento: 'DragonKill' };
export const HERALDO: ObjetivoNeutral = { nombre: 'heraldo', aparece: 900, reaparece: null, evento: 'HeraldKill' };
export const BARON: ObjetivoNeutral = { nombre: 'baron', aparece: 1200, reaparece: 360, evento: 'BaronKill' };
export const OBJETIVOS: ObjetivoNeutral[] = [DRAGON, HERALDO, BARON];

/** Segundos de antelación con los que se avisa de un objetivo. */
export const AVISO_OBJETIVO_ANTES = 60;

export const ID_GUARDIAN_CONTROL = 2055;
export const VISION_DESDE = 300;
export const VISION_ORO_MINIMO = 75;

export const FASE_MEDIA_DESDE = 840;
export const FASE_TARDIA_DESDE = 1500;
