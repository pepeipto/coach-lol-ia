import { ErrorRiot, REGIONES, type PartidaTftRiot, type Region, type RiotApiTft } from '../riot/riotApi';
import type { AlmacenTft, TableroTft } from './datos';

/** Cola clasificatoria de TFT (queue_id de tft-match-v1). */
export const COLA_CLASIFICATORIA_TFT = 1100;
const LIGAS_APEX = ['challenger', 'grandmaster', 'master'] as const;
const DIVISIONES_DIAMANTE = ['I', 'II'] as const;
const PARTIDAS_POR_JUGADOR = 20;
/** Solo partidas de los últimos 14 días. */
const VENTANA_S = 14 * 24 * 60 * 60;

export interface OpcionesRecolectorTft {
  region: Region;
  /** Parche actual («15.20»): las partidas de otros parches se marcan como vistas y no se guardan. */
  parche: string;
  /** Partidas clasificatorias nuevas que se guardan como mucho. */
  maxPartidas: number;
  ahora?: () => number;
  aleatorio?: () => number;
}

/** «Linux Version 15.20.712.3456 (Oct 08 2025/…) [PUBLIC] <Releases/15.20>» → «15.20». */
export function parcheTft(gameVersion: string): string | null {
  const m = /<Releases\/(\d+\.\d+)>/.exec(gameVersion) ?? /(\d+\.\d+)\.\d+/.exec(gameVersion);
  return m ? m[1] : null;
}

/** Los tableros de una partida clasificatoria del parche, o null si no vale (otra cola, otro parche). */
export function tablerosDePartida(p: PartidaTftRiot, parche: string): TableroTft[] | null {
  if (p.info.queue_id !== COLA_CLASIFICATORIA_TFT) return null;
  if (parcheTft(p.info.game_version) !== parche) return null;
  if (p.info.participants.length !== 8) return null;
  return p.info.participants.map((j) => ({
    matchId: p.metadata.match_id,
    parche,
    set: p.info.tft_set_number ?? null,
    puesto: j.placement,
    nivel: j.level,
    rasgos: (j.traits ?? [])
      .filter((r) => r.tier_current > 0)
      .map((r) => ({ nombre: r.name, unidades: r.num_units, estilo: r.style ?? 0 })),
    unidades: (j.units ?? []).map((u) => ({ id: u.character_id, estrellas: u.tier, objetos: u.itemNames ?? [] })),
  }));
}

function barajar<T>(xs: T[], aleatorio: () => number): T[] {
  const r = [...xs];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/**
 * Reúne partidas clasificatorias de TFT de jugadores de Maestro en adelante (y Diamante I-II si faltan) y guarda sus
 * tableros. Devuelve las partidas nuevas guardadas. Un 401/403 se relanza con un mensaje claro: suele significar que
 * el producto de Riot aún no tiene TFT activado.
 */
export async function recolectarTft(api: RiotApiTft, almacen: AlmacenTft, o: OpcionesRecolectorTft): Promise<number> {
  const { plataforma, ruta } = REGIONES[o.region];
  const ahora = o.ahora ?? Date.now;
  const aleatorio = o.aleatorio ?? Math.random;
  const inicio = Math.floor(ahora() / 1000) - VENTANA_S;
  // Como mucho el doble de peticiones de partida que el presupuesto: también llegan normales, Doble Up, etc.
  let peticionesRestantes = o.maxPartidas * 2;
  let nuevas = 0;

  try {
    let jugadores: string[] = [];
    for (const liga of LIGAS_APEX) jugadores.push(...(await api.tftLigaApex(plataforma, liga)).map((e) => e.puuid));
    if (jugadores.length < o.maxPartidas / 4) {
      for (const division of DIVISIONES_DIAMANTE) {
        jugadores.push(...(await api.tftEntradasLiga(plataforma, 'DIAMOND', division, 1)).map((e) => e.puuid));
      }
    }
    jugadores = barajar([...new Set(jugadores.filter(Boolean))], aleatorio);

    for (const puuid of jugadores) {
      if (nuevas >= o.maxPartidas || peticionesRestantes <= 0) break;
      const ids = await api.tftIdsPartidas(ruta, puuid, PARTIDAS_POR_JUGADOR, inicio);
      for (const id of ids) {
        if (nuevas >= o.maxPartidas || peticionesRestantes <= 0) break;
        if (almacen.partidaVista(id)) continue;
        peticionesRestantes--;
        const partida = await api.tftPartida(ruta, id);
        const tableros = partida ? tablerosDePartida(partida, o.parche) : null;
        if (!tableros) {
          almacen.marcarVista(id);
          continue;
        }
        almacen.guardarTableros(o.region, tableros);
        nuevas++;
      }
    }
  } catch (e) {
    if (e instanceof ErrorRiot && (e.estado === 401 || e.estado === 403)) {
      throw new Error(
        `Riot rechaza la API de TFT (error ${e.estado}): comprueba en developer.riotgames.com que el producto tiene TFT activado.`,
      );
    }
    throw e;
  }
  return nuevas;
}
