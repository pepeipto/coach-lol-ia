import type { Rol } from '@coach/shared';
import type { Region } from '../riot/riotApi';

/**
 * Copia en el servidor del contrato `JugadorCarga` de la app (app/src/shared/tiposApp.ts): el servidor
 * no depende del código de la app, así que la forma se repite aquí y debe coincidir.
 */
export type TipoEtiqueta = 'positivo' | 'neutro' | 'info';
export interface Etiqueta {
  tipo: TipoEtiqueta;
  texto: string;
}

export interface JugadorCarga {
  equipo: 'aliado' | 'enemigo';
  riotId: string;
  campeonId: number;
  /** Id de Data Dragon (p. ej. «MonkeyKing»), como `EstadoPartida.campeon`; '' si no se conoce. */
  campeon: string;
  rol: Rol | null;
  rango: { tier: string; division: string; lp: number; victorias: number; derrotas: number } | null;
  maestria: { nivel: number; puntos: number } | null;
  /** Tasa de victorias (0..1) de nuestras builds agregadas para el campeón y el rol. */
  campeonWinrate: number | null;
  etiquetas: Etiqueta[];
}

/** Lo que pide la app por cada jugador de la partida. */
export interface JugadorPedido {
  /** '' para los bots: no se consulta nada en Riot. */
  puuid: string;
  campeonId: number;
  rol: Rol | null;
  equipo: 'aliado' | 'enemigo';
  /** Opcional: «Nombre#TAG» tal y como lo ve el cliente; se devuelve sin cambios. */
  riotId?: string;
}

export interface PeticionJugadores {
  region: Region;
  jugadores: JugadorPedido[];
}

/** Datos de Data Dragon de un campeón que hacen falta para la tarjeta y sus rasgos. */
export interface InfoCampeon {
  /** Id de Data Dragon (p. ej. «MonkeyKing»). */
  id: string;
  /** Nombre en español (p. ej. «Wukong»). */
  nombre: string;
  /** Etiquetas de Data Dragon: Assassin, Fighter, Mage, Marksman, Support, Tank. */
  tags: string[];
  /** `info.difficulty` de Data Dragon (1..10). */
  dificultad: number;
}
