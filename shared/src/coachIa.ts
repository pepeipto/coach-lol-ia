import type { ModoJuego, Rol } from './tipos';

/*
 * Coach con IA (3.2): contratos entre la app y el servidor.
 *
 * - A. Análisis al terminar la partida (POST /api/coach/analisis): la app manda un resumen compacto de la partida
 *   (estadísticas de fin de partida de la LCU, la línea de tiempo que fue tomando de la Live Client Data API y la
 *   build de nuestros datos) y el servidor devuelve el análisis en el idioma de la app.
 * - B. Consejos en los momentos muertos (POST /api/coach/consejo): muerto, al reaparecer con oro o antes de un
 *   objetivo estando muerto. Una frase corta, educativa, nunca una orden en tiempo real.
 *
 * Privacidad: nunca viajan nombres de invocador ni Riot ID; el servidor no guarda ni registra los datos de la partida.
 */

/** Idiomas de la app. */
export type IdiomaIa = 'es' | 'en' | 'pt-BR' | 'fr' | 'de';
export const IDIOMAS_IA: readonly IdiomaIa[] = ['es', 'en', 'pt-BR', 'fr', 'de'];

export type ResultadoPartidaIa = 'victoria' | 'derrota';
export type EquipoRelativo = 'aliado' | 'enemigo';
export type TipoObjetivoIa = 'dragon' | 'anciano' | 'heraldo' | 'baron' | 'larvas' | 'atakhan' | 'torre' | 'inhibidor';

/** Una muestra por minuto de la partida (Live Client Data API). */
export interface MuestraMinuto {
  /** Minuto de la partida (1, 2, 3…). */
  m: number;
  cs: number;
  nivel: number;
  k: number;
  d: number;
  a: number;
  /** Oro aproximado: el que lleva más el valor de sus objetos (la Live Client no da el oro ganado). */
  oro: number;
}

export interface ObjetivoTomadoIa {
  /** Segundos de partida. */
  t: number;
  tipo: TipoObjetivoIa;
  equipo: EquipoRelativo;
  /** Tipo de dragón («Fire»…), si lo es. */
  subtipo?: string;
}

/** Estadísticas finales del jugador (de la LCU si se pudieron leer; si no, del último estado de la partida). */
export interface EstadisticasFinales {
  k: number;
  d: number;
  a: number;
  cs: number;
  nivel: number;
  /** Ids de los objetos al terminar. */
  objetos: number[];
  oro?: number;
  danoCampeones?: number;
  danoRecibido?: number;
  vision?: number;
  guardianes?: number;
  guardianesDestruidos?: number;
  guardianesControl?: number;
}

/** Cuerpo de POST /api/coach/analisis. */
export interface PeticionAnalisis {
  idioma: IdiomaIa;
  modo: ModoJuego;
  /** Id de Data Dragon del campeón (p. ej. «Ahri»). */
  campeon: string;
  /** Rol en la Grieta; null en ARAM, ARAM: Caos y Arena (sin calles) o si no se sabe. */
  rol: Rol | null;
  resultado: ResultadoPartidaIa | null;
  /** Segundos. */
  duracion: number;
  final: EstadisticasFinales;
  /** Asesinatos de cada equipo al terminar (si se saben). */
  equipos?: { aliados: number; enemigos: number };
  linea: MuestraMinuto[];
  /** Segundos de partida de cada muerte del jugador. */
  muertes: number[];
  compras: { t: number; id: number }[];
  objetivos: ObjetivoTomadoIa[];
  /** Build recomendada con nuestros datos para el campeón (y el rol), para comparar los objetos. */
  build: { nucleo: number[]; botas: number | null; situacionales: number[] } | null;
  /** CS por minuto de referencia para el rol (solo en la Grieta). */
  csObjetivoMinuto: number | null;
  /** Nombres (en el idioma de la app) de los objetos que aparecen arriba, por id. */
  nombresObjetos: Record<string, string>;
  /** Nombre del campeón en el idioma de la app. */
  nombreCampeon?: string;
}

export interface PuntoAnalisis {
  titulo: string;
  porque: string;
}

export interface MomentoClave {
  /** Segundos de partida. */
  t: number;
  texto: string;
}

/** Análisis que devuelve el servidor. */
export interface AnalisisPartida {
  veredicto: string;
  bien: PuntoAnalisis[];
  mejorar: PuntoAnalisis[];
  momentos: MomentoClave[];
  enfoque: string;
}

export type MomentoConsejo = 'muerte' | 'tienda' | 'objetivo';

/** Un jugador tal como lo enseña el marcador (TAB): campeón, nivel y objetos. Nunca su nombre. */
export interface JugadorConsejo {
  campeon: string;
  nivel: number;
  objetos: number[];
  k?: number;
  d?: number;
  a?: number;
}

/** Cuerpo de POST /api/coach/consejo. */
export interface PeticionConsejo {
  idioma: IdiomaIa;
  modo: ModoJuego;
  momento: MomentoConsejo;
  /** Segundos de partida. */
  tiempo: number;
  yo: {
    campeon: string;
    rol: Rol | null;
    nivel: number;
    oro: number;
    objetos: number[];
    k: number;
    d: number;
    a: number;
    cs: number;
  };
  aliados: JugadorConsejo[];
  enemigos: JugadorConsejo[];
  marcador: { aliados: number; enemigos: number };
  /** Objetivos ya tomados en la partida. */
  objetivos: ObjetivoTomadoIa[];
  /** Próximo objetivo épico que aparece pronto (evento público de la partida), si lo hay. */
  proximoObjetivo?: { tipo: 'dragon' | 'heraldo' | 'baron' | 'anciano' | 'larvas' | 'atakhan'; enSegundos: number; subtipo?: string };
  /** Sucesos recientes de la partida, ya en texto corto y sin nombres de jugadores. */
  recientes: string[];
  nombresObjetos: Record<string, string>;
}

/** Límites de tamaño compartidos (el servidor rechaza lo que se pase). */
export const LIMITES_IA = {
  minutos: 90,
  muertes: 60,
  compras: 80,
  objetivos: 80,
  objetos: 7,
  nombresObjetos: 120,
  textoNombre: 60,
  recientes: 12,
  textoReciente: 80,
  jugadoresEquipo: 5,
  /** Palabras como mucho de un consejo de momento muerto. */
  palabrasConsejo: 16,
} as const;

/** Modos en los que hay consejos de momentos muertos: la Grieta y los ARAM (en Arena no hay tienda libre ni muertes normales). */
export const MODOS_CONSEJO: readonly ModoJuego[] = ['clasificatoria', 'aram', 'caos'];
