import { parcheDeVersion, type ItemDDragonCrudo } from '@coach/shared';
import { extraerParticipaciones } from './extraer';
import type { Db } from './db';
import { ErrorRiot, REGIONES, type Region, type RiotApi } from './riot/riotApi';

export interface OpcionesRecolector {
  region: Region;
  parche: string;
  maxPartidas: number;
  /** Fuente de aleatoriedad en [0, 1); inyectable para pruebas deterministas. */
  aleatorio?: () => number;
}

const COLA_CLASIFICATORIA = 420;
const PARTIDAS_POR_JUGADOR = 20;
const LIGAS_APEX = ['challenger', 'grandmaster', 'master'] as const;
const TIERS = ['DIAMOND', 'EMERALD'] as const;
const DIVISIONES = ['I', 'II', 'III', 'IV'] as const;

function barajar<T>(items: T[], aleatorio: () => number): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

async function reunirJugadores(api: RiotApi, region: Region): Promise<string[]> {
  const { plataforma } = REGIONES[region];
  const puuids = new Set<string>();
  for (const liga of LIGAS_APEX) {
    for (const e of await api.ligaApex(plataforma, liga)) puuids.add(e.puuid);
  }
  for (const tier of TIERS) {
    for (const division of DIVISIONES) {
      for (const e of await api.entradasLiga(plataforma, tier, division, 1)) puuids.add(e.puuid);
    }
  }
  return [...puuids];
}

/** Recolecta partidas nuevas de la región y devuelve cuántas guardó. */
export async function recolectar(
  api: RiotApi,
  db: Db,
  objetos: Record<number, ItemDDragonCrudo>,
  opciones: OpcionesRecolector,
): Promise<number> {
  const { region, parche, maxPartidas } = opciones;
  const { ruta } = REGIONES[region];
  const jugadores = barajar(await reunirJugadores(api, region), opciones.aleatorio ?? Math.random);
  let guardadas = 0;

  for (const puuid of jugadores) {
    if (guardadas >= maxPartidas) break;
    let ids: string[];
    try {
      ids = await api.idsPartidas(ruta, puuid, PARTIDAS_POR_JUGADOR);
    } catch (e) {
      if (!(e instanceof ErrorRiot)) throw e;
      console.error(`[recolector] ${region}: error ${e.estado} al listar partidas de un jugador`);
      continue;
    }
    for (const id of ids) {
      if (guardadas >= maxPartidas) break;
      if (db.partidaVista(id)) continue;
      try {
        const partida = await api.partida(ruta, id);
        if (!partida) continue;
        if (
          parcheDeVersion(partida.info.gameVersion) !== parche ||
          partida.info.queueId !== COLA_CLASIFICATORIA
        ) {
          db.marcarVista(id);
          continue;
        }
        const linea = await api.lineaTiempo(ruta, id);
        if (!linea) continue;
        const participaciones = extraerParticipaciones(partida, linea, objetos);
        if (participaciones.length === 0) db.marcarVista(id);
        else db.guardarParticipaciones(region, participaciones);
        guardadas++;
      } catch (e) {
        if (!(e instanceof ErrorRiot)) throw e;
        console.error(`[recolector] ${region}: error ${e.estado} en la partida ${id}`);
      }
    }
  }
  return guardadas;
}
