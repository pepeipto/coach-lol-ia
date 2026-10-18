import { parcheDeVersion, type ItemDDragonCrudo } from '@coach/shared';
import { extraerParticipaciones } from './extraer';
import type { Db } from './db';
import { ErrorRiot, REGIONES, type PartidaRiot, type LineaTiempoRiot, type Region, type RiotApi } from './riot/riotApi';

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
/** Las partidas más cortas son rehechas (remakes) y no aportan datos útiles. */
const DURACION_MINIMA_S = 300;

function describir(e: unknown): string {
  if (e instanceof ErrorRiot) return `error ${e.estado}`;
  return e instanceof Error ? e.message : String(e);
}

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
  // Una página que falla solo se pierde ella: el resto de la liga sigue sirviendo.
  const anadir = async (descripcion: string, pedir: () => Promise<{ puuid: string }[]>) => {
    try {
      for (const e of await pedir()) puuids.add(e.puuid);
    } catch (e) {
      console.error(`[recolector] ${region}: no se pudo leer ${descripcion}: ${describir(e)}`);
    }
  };
  for (const liga of LIGAS_APEX) await anadir(`la liga ${liga}`, () => api.ligaApex(plataforma, liga));
  for (const tier of TIERS) {
    for (const division of DIVISIONES) {
      await anadir(`la liga ${tier} ${division}`, () => api.entradasLiga(plataforma, tier, division, 1));
    }
  }
  return [...puuids];
}

/** Partida del parche y la cola que buscamos, y no rehecha. Lanza si los datos no tienen la forma esperada. */
function esUtil(partida: PartidaRiot, parche: string): boolean {
  return (
    parcheDeVersion(partida.info.gameVersion) === parche &&
    partida.info.queueId === COLA_CLASIFICATORIA &&
    !(partida.info.gameDuration < DURACION_MINIMA_S)
  );
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
      console.error(`[recolector] ${region}: no se pudieron listar las partidas de un jugador: ${describir(e)}`);
      continue;
    }
    for (const id of ids) {
      if (guardadas >= maxPartidas) break;
      if (db.partidaVista(id)) continue;
      // Un fallo al descargar (red, 5xx, 429…) puede ser pasajero: la partida no se marca como vista.
      // Un fallo al procesar es de datos (partida mal formada) y no se arreglará: se marca como vista.
      const datosNoValidos = (e: unknown) => {
        console.error(`[recolector] ${region}: partida ${id} con datos no válidos, se descarta: ${describir(e)}`);
        db.marcarVista(id);
      };
      const descargaFallida = (e: unknown) =>
        console.error(`[recolector] ${region}: no se pudo descargar la partida ${id}: ${describir(e)}`);

      let partida: PartidaRiot | null;
      try {
        partida = await api.partida(ruta, id);
      } catch (e) {
        descargaFallida(e);
        continue;
      }
      if (!partida) continue;
      let util: boolean;
      try {
        util = esUtil(partida, parche);
      } catch (e) {
        datosNoValidos(e);
        continue;
      }
      if (!util) {
        db.marcarVista(id);
        continue;
      }
      let linea: LineaTiempoRiot | null;
      try {
        linea = await api.lineaTiempo(ruta, id);
      } catch (e) {
        descargaFallida(e);
        continue;
      }
      if (!linea) continue;
      try {
        const participaciones = extraerParticipaciones(partida, linea, objetos);
        if (participaciones.length === 0) db.marcarVista(id);
        else db.guardarParticipaciones(region, participaciones);
        guardadas++;
      } catch (e) {
        datosNoValidos(e);
      }
    }
  }
  return guardadas;
}
