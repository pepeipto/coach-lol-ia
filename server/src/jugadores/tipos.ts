import type { Rol } from '@coach/shared';
import type { Region } from '../riot/riotApi';

/**
 * Copia en el servidor del contrato `JugadorCarga` de la app (app/src/shared/tiposApp.ts): el servidor
 * no depende del código de la app, así que la forma se repite aquí y debe coincidir.
 */
export type TipoEtiqueta = 'positivo' | 'neutro' | 'info';
export interface Etiqueta {
  tipo: TipoEtiqueta;
  /** En español: lo que enseñan las apps anteriores a la 3.0. */
  texto: string;
  /** Clave de i18n de la app (3.0, cinco idiomas): «carga.etiqueta.*» o «carga.rasgo.*». */
  clave: string;
  /** Parámetros de la clave (p. ej. `campeon`, que la app sustituye por el nombre en su idioma). */
  params?: Record<string, string>;
}

export interface JugadorCarga {
  equipo: 'aliado' | 'enemigo';
  riotId: string;
  campeonId: number;
  /** Id de Data Dragon (p. ej. «MonkeyKing»), como `EstadoPartida.campeon`; '' si no se conoce. */
  campeon: string;
  /** Nombre visible del campeón en español (Data Dragon es_MX); '' si no se conoce. */
  nombre: string;
  rol: Rol | null;
  rango: { tier: string; division: string; lp: number; victorias: number; derrotas: number } | null;
  maestria: { nivel: number; puntos: number } | null;
  /** Tasa de victorias (0..1) de nuestras builds agregadas para el campeón y el rol. */
  campeonWinrate: number | null;
  etiquetas: Etiqueta[];
  /** Riot no respondió al pedir el rango (clave caducada, caída, tiempo agotado): `rango: null` no es «sin clasificar». */
  rangoNoDisponible?: boolean;
}

/** Lo que pide la app por cada jugador de la partida. */
export interface JugadorPedido {
  /** '' para los bots: no se consulta nada en Riot. */
  puuid: string;
  campeonId: number;
  rol: Rol | null;
  equipo: 'aliado' | 'enemigo';
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
