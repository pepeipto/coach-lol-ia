import type { ModoJuego, Rol } from '@coach/shared';

/*
 * 3.5: perfil, historial y post-partida del jugador. Todo sale del cliente de LoL (LCU) del propio jugador y se
 * guarda solo en su PC; no gasta la clave de Riot. Política de Riot: solo datos que el jugador ya puede ver en su
 * cliente; nada de MMR ni de etiquetas negativas sobre otros jugadores.
 */

export type ColaRango = 'solo' | 'flex';

export interface RangoCola {
  cola: ColaRango;
  /** IRON…CHALLENGER; '' sin clasificar. */
  tier: string;
  division: string;
  lp: number;
  victorias: number;
  derrotas: number;
}

/** Foto del rango tras una partida (la LCU no da el historial de PL: se construye en local). */
export interface PuntoPl {
  fecha: string;
  cola: ColaRango;
  tier: string;
  division: string;
  lp: number;
  /** Escala continua para la gráfica: 400 por tier, 100 por división, más los PL. */
  valor: number;
}

export interface Puntuaciones {
  /** 0–100: KDA, participación en asesinatos y cuota de daño. */
  combate: number;
  /** 0–100: CS y oro por minuto frente a la referencia del rol. */
  farmeo: number;
  /** 0–100: puntuación de visión por minuto frente a la referencia del rol. */
  vision: number;
  /** Media de las tres (en ARAM: de combate y farmeo). */
  total: number;
}

/** Solo etiquetas positivas o neutras (política de Riot: nada que humille a otros jugadores). */
export type Etiqueta = 'mvp' | 'masDano' | 'masOro' | 'masVision' | 'sinMuertes' | 'masAsesinatos' | 'muroDefensivo' | 'farmeador';

export interface JugadorHistorial {
  participante: number;
  equipo: 100 | 200;
  campeonId: number;
  /** Nombre visible (Riot ID sin la etiqueta); '' si el cliente no lo da. */
  nombre: string;
  rol: Rol | null;
  asesinatos: number;
  muertes: number;
  asistencias: number;
  cs: number;
  oro: number;
  dano: number;
  danoRecibido: number;
  vision: number;
  nivel: number;
  objetos: number[];
  hechizos: [number, number];
  victoria: boolean;
  puntuaciones: Puntuaciones;
  etiquetas: Etiqueta[];
}

export interface PartidaHistorial {
  id: number;
  fecha: string;
  /** Segundos. */
  duracion: number;
  cola: number;
  /** Modo con datos propios; 'otro' para el resto (URF, tutorial…). */
  modo: ModoJuego | 'otro';
  /** Participante del jugador. */
  yo: number;
  victoria: boolean;
  /** Partida rehecha (menos de 5 min): no cuenta para tendencias ni retos. */
  rehecha: boolean;
  jugadores: JugadorHistorial[];
}

/** Un minuto de la partida: oro, CS, experiencia y nivel de cada participante. */
export interface MinutoPartida {
  m: number;
  oro: Record<number, number>;
  cs: Record<number, number>;
  xp: Record<number, number>;
  nivel: Record<number, number>;
}

export interface EventoLinea {
  /** Segundos. */
  t: number;
  tipo: 'asesinato' | 'dragon' | 'heraldo' | 'baron' | 'larvas' | 'torre' | 'inhibidor';
  /** Participante que lo hizo (0 si fue un súbdito o una torre). */
  autor: number;
  victima?: number;
  equipo: 100 | 200;
}

export interface LineaTiempo {
  minutos: MinutoPartida[];
  eventos: EventoLinea[];
}

export interface CampeonPerfil {
  campeonId: number;
  partidas: number;
  victorias: number;
  kda: number;
  csMin: number;
  puntuacion: number;
}

/** Media de las últimas partidas y su cambio frente a las anteriores (tarjetas de tendencia). */
export interface Tendencia {
  id: 'csMin' | 'kp' | 'muertes' | 'vision' | 'dano' | 'puntuacion';
  valor: number;
  /** Diferencia con el bloque de partidas anterior (null si no hay bastantes). */
  cambio: number | null;
  /** Si subir es bueno (las muertes, al revés). */
  mejorSiSube: boolean;
}

export type IdReto = 'cs7' | 'cs8' | 'muertes4' | 'kp50' | 'vision1' | 'dano25' | 'puntuacion60' | 'victorias3';

export interface EstadoReto {
  id: IdReto;
  /** Partidas que lo cumplen desde que se eligió. */
  hechas: number;
  objetivo: number;
  /** Partidas seguidas cumpliéndolo (la última primero). */
  racha: number;
  completado: boolean;
  desde: string;
  /** Resultado en las últimas partidas desde que se eligió (true = cumplido), la más reciente primero. */
  ultimas: boolean[];
}

export interface Perfil {
  invocador: { nombre: string; tag: string; nivel: number; icono: number } | null;
  rangos: RangoCola[];
  pl: PuntoPl[];
  partidas: PartidaHistorial[];
  campeones: CampeonPerfil[];
  tendencias: Tendencia[];
  reto: EstadoReto | null;
  /** Reto que se propone: el que menos cumple el jugador en sus últimas partidas. */
  retoSugerido: IdReto;
  /** Última vez que se leyó del cliente (ISO); null si nunca. */
  actualizado: string | null;
  /** El cliente de LoL está abierto ahora (si no, se enseña lo guardado). */
  conectado: boolean;
  /** Versión de Data Dragon para los iconos ('' si no se sabe). */
  version: string;
  /** Data Dragon id de cada campeón por su número (para los iconos). */
  campeonesDD: Record<number, { id: string; nombre: string }>;
}

/** 3.6: palabras (en los 5 idiomas de la app) que relacionan un punto a mejorar del análisis con un reto. */
const RETO_POR_TEMA: [IdReto, RegExp][] = [
  ['muertes4', /muert|muer[ae]|morir|death|dying|\bdie\b|morte|morrer|\bmort|mourir|\btod|sterb/i],
  ['vision1', /visi[oó]n|vision|vis[aã]o|ward|guardi[aá]n|sentinel|sicht/i],
  ['cs7', /\bcs\b|farm|s[uú]bdit|minion|tropa|sbire|vasall|oleada|wave/i],
  ['kp50', /particip|pelea|teamfight|luta|combat|kampf|agrup|group/i],
  ['dano25', /da[ñn]o|damage|dano|d[ée]g[aâ]ts|schaden/i],
];

/** Reto que encaja con lo que el último análisis pide mejorar (el primer punto que lo deja claro); null si ninguno. */
export function retoDeAnalisis(textos: string[]): IdReto | null {
  for (const texto of textos) {
    for (const [id, re] of RETO_POR_TEMA) if (re.test(texto)) return id;
  }
  return null;
}
