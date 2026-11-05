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
  /**
   * Parche anterior: también se guarda (con su parche), porque el día del cambio Data Dragon ya va por el nuevo y
   * casi todas las partidas de los últimos 14 días son del anterior.
   */
  parcheAnterior?: string;
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

export type MotivoDescarte = 'cola' | 'parche' | 'jugadores';

/**
 * Desde el cliente nuevo de TFT, `game_version` llega como «TFT Unreal Version ?.?.?.?», sin número. Entonces la
 * partida cuenta como del parche actual solo si es de los últimos 3 días (los parches duran unas 2 semanas).
 */
const VENTANA_SIN_VERSION_MS = 3 * 24 * 60 * 60 * 1000;

/** Parche al que se asigna la partida (uno de `parches`, el primero es el actual) o null si no vale. */
export function parcheDePartida(p: PartidaTftRiot, parches: string[], ahoraMs: number = Date.now()): string | null {
  const leido = parcheTft(String(p.info.game_version ?? ''));
  if (leido) return parches.includes(leido) ? leido : null;
  const fecha = p.info.game_datetime;
  if (typeof fecha === 'number' && fecha <= ahoraMs + 60_000 && ahoraMs - fecha <= VENTANA_SIN_VERSION_MS) return parches[0];
  return null;
}

/** Por qué no vale una partida (otra cola, otro parche, no son 8 jugadores), o null si vale. */
export function motivoDescarte(p: PartidaTftRiot, parches: string[], ahoraMs: number = Date.now()): MotivoDescarte | null {
  if (p.info.queue_id !== COLA_CLASIFICATORIA_TFT) return 'cola';
  if (!parcheDePartida(p, parches, ahoraMs)) return 'parche';
  if ((p.info.participants ?? []).length !== 8) return 'jugadores';
  return null;
}

/** Los tableros de una partida clasificatoria de uno de los parches, o null si no vale. */
export function tablerosDePartida(p: PartidaTftRiot, parches: string | string[], ahoraMs: number = Date.now()): TableroTft[] | null {
  const lista = typeof parches === 'string' ? [parches] : parches;
  if (motivoDescarte(p, lista, ahoraMs) !== null) return null;
  const parche = parcheDePartida(p, lista, ahoraMs)!;
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
/** Lo que pasó en una recolección, para /tft/estado (saber desde fuera por qué no entran partidas). */
export interface InformeRecolectorTft {
  nuevas: number;
  jugadores: number;
  partidasPedidas: number;
  descartes: Record<MotivoDescarte | 'vacia', number>;
  /** Cola y versión de la última partida descartada por cola o parche. */
  ejemploDescarte?: { cola?: number; version: string };
}

export async function recolectarTft(api: RiotApiTft, almacen: AlmacenTft, o: OpcionesRecolectorTft): Promise<number> {
  return (await recolectarTftConInforme(api, almacen, o)).nuevas;
}

export async function recolectarTftConInforme(
  api: RiotApiTft,
  almacen: AlmacenTft,
  o: OpcionesRecolectorTft,
): Promise<InformeRecolectorTft> {
  const parches = o.parcheAnterior && o.parcheAnterior !== o.parche ? [o.parche, o.parcheAnterior] : [o.parche];
  const informe: InformeRecolectorTft = {
    nuevas: 0,
    jugadores: 0,
    partidasPedidas: 0,
    descartes: { cola: 0, parche: 0, jugadores: 0, vacia: 0 },
  };
  const { plataforma, ruta } = REGIONES[o.region];
  const ahora = o.ahora ?? Date.now;
  const aleatorio = o.aleatorio ?? Math.random;
  const inicio = Math.floor(ahora() / 1000) - VENTANA_S;
  // Como mucho el doble de peticiones de partida que el presupuesto: también llegan normales, Doble Up, etc.
  let peticionesRestantes = o.maxPartidas * 2;

  try {
    let jugadores: string[] = [];
    for (const liga of LIGAS_APEX) jugadores.push(...(await api.tftLigaApex(plataforma, liga)).map((e) => e.puuid));
    if (jugadores.length < o.maxPartidas / 4) {
      for (const division of DIVISIONES_DIAMANTE) {
        jugadores.push(...(await api.tftEntradasLiga(plataforma, 'DIAMOND', division, 1)).map((e) => e.puuid));
      }
    }
    jugadores = barajar([...new Set(jugadores.filter(Boolean))], aleatorio);
    informe.jugadores = jugadores.length;

    for (const puuid of jugadores) {
      if (informe.nuevas >= o.maxPartidas || peticionesRestantes <= 0) break;
      const ids = await api.tftIdsPartidas(ruta, puuid, PARTIDAS_POR_JUGADOR, inicio);
      for (const id of ids) {
        if (informe.nuevas >= o.maxPartidas || peticionesRestantes <= 0) break;
        if (almacen.partidaVista(id)) continue;
        peticionesRestantes--;
        informe.partidasPedidas++;
        const partida = await api.tftPartida(ruta, id);
        const motivo = partida ? motivoDescarte(partida, parches, ahora()) : 'vacia';
        if (motivo !== null || !partida) {
          informe.descartes[motivo ?? 'vacia']++;
          if (partida && (motivo === 'cola' || motivo === 'parche')) {
            informe.ejemploDescarte = { cola: partida.info.queue_id, version: String(partida.info.game_version).slice(0, 120) };
          }
          almacen.marcarVista(id);
          continue;
        }
        almacen.guardarTableros(o.region, tablerosDePartida(partida, parches, ahora())!);
        informe.nuevas++;
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
  return informe;
}
