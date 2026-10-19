import {
  COLAS_MODO,
  MODOS_JUEGO,
  parcheDeVersion,
  repartirPresupuesto,
  type ItemDDragonCrudo,
  type ModoJuego,
} from '@coach/shared';
import { extraerParticipaciones, extraerParticipacionesArena, type Participacion } from './extraer';
import type { Db } from './db';
import { ErrorRiot, REGIONES, type PartidaRiot, type LineaTiempoRiot, type Region, type RiotApi } from './riot/riotApi';

export interface OpcionesRecolector {
  region: Region;
  parche: string;
  maxPartidas: number;
  /** Modo que se recolecta (clasificatoria por defecto); fija las colas que se piden. */
  modo?: ModoJuego;
  /** Jugadores ya reunidos (puuid); si falta, se reúnen de las ligas de la región. */
  jugadores?: string[];
  /** Inicio del parche (segundos epoch), si se sabe: solo se piden partidas posteriores (`startTime`). */
  inicioParche?: number;
  /** Reloj en milisegundos (inyectable en las pruebas). */
  ahora?: () => number;
  /** Fuente de aleatoriedad en [0, 1); inyectable para pruebas deterministas. */
  aleatorio?: () => number;
}

/**
 * Los jugadores salen de las ligas de clasificatoria. En los demás modos muchos no tienen partidas recientes,
 * así que se prueba con un máximo de jugadores para no gastar el límite de la clave de desarrollo en listas vacías:
 * max(80, presupuesto / 2), para que un presupuesto grande (MAX_PARTIDAS=3000) tenga jugadores suficientes.
 */
const MIN_JUGADORES_OTROS_MODOS = 80;
export const maxJugadoresOtrosModos = (presupuesto: number): number =>
  Math.max(MIN_JUGADORES_OTROS_MODOS, Math.ceil(presupuesto / 2));
/** Sin la fecha del parche, solo se piden partidas de los últimos 14 días. */
const VENTANA_SIN_PARCHE_S = 14 * 24 * 60 * 60;
const PARTIDAS_POR_JUGADOR = 20;
const LIGAS_APEX = ['challenger', 'grandmaster', 'master'] as const;
const TIERS = ['DIAMOND', 'EMERALD'] as const;
const DIVISIONES = ['I', 'II', 'III', 'IV'] as const;
/** Las partidas más cortas son rehechas (remakes) y no aportan datos útiles. */
const DURACION_MINIMA_S = 300;

function describir(e: unknown): string {
  if (e instanceof ErrorRiot) {
    if (e.estado === 401 || e.estado === 403) {
      return `error ${e.estado} (Riot no acepta la clave: revisa RIOT_API_KEY o genera una nueva en developer.riotgames.com)`;
    }
    return `error ${e.estado}`;
  }
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

export async function reunirJugadores(api: RiotApi, region: Region): Promise<string[]> {
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

/** Partida del parche y de una cola del modo, y no rehecha. Lanza si los datos no tienen la forma esperada. */
function esUtil(partida: PartidaRiot, parche: string, modo: ModoJuego): boolean {
  return (
    parcheDeVersion(partida.info.gameVersion) === parche &&
    COLAS_MODO[modo].includes(partida.info.queueId) &&
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
  const modo = opciones.modo ?? 'clasificatoria';
  const { ruta } = REGIONES[region];
  if (maxPartidas <= 0) return 0;
  let jugadores = barajar(opciones.jugadores ?? (await reunirJugadores(api, region)), opciones.aleatorio ?? Math.random);
  if (modo !== 'clasificatoria') jugadores = jugadores.slice(0, maxJugadoresOtrosModos(maxPartidas));
  const inicio = opciones.inicioParche ?? Math.floor((opciones.ahora ?? Date.now)() / 1000) - VENTANA_SIN_PARCHE_S;
  let guardadas = 0;
  let avisoSinAumentos = false;

  for (const puuid of jugadores) {
    if (guardadas >= maxPartidas) break;
    const ids: string[] = [];
    for (const cola of COLAS_MODO[modo]) {
      try {
        ids.push(...(await api.idsPartidas(ruta, puuid, PARTIDAS_POR_JUGADOR, cola, inicio)));
      } catch (e) {
        console.error(`[recolector] ${region}: no se pudieron listar las partidas (cola ${cola}) de un jugador: ${describir(e)}`);
      }
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
        util = esUtil(partida, parche, modo);
      } catch (e) {
        datosNoValidos(e);
        continue;
      }
      if (!util) {
        db.marcarVista(id);
        continue;
      }
      // Arena no usa la línea de tiempo (ni orden de habilidades ni compras en orden): media petición por partida.
      let linea: LineaTiempoRiot | null = null;
      if (modo !== 'arena') {
        try {
          linea = await api.lineaTiempo(ruta, id);
        } catch (e) {
          descargaFallida(e);
          continue;
        }
        if (!linea) continue;
      }
      try {
        const participaciones: Participacion[] =
          modo === 'arena' ? extraerParticipacionesArena(partida) : extraerParticipaciones(partida, linea!, objetos, modo);
        if (modo === 'caos' && !avisoSinAumentos && participaciones.length > 0 && participaciones.every((p) => !p.aumentos?.length)) {
          // La documentación de Match-v5 no confirma que ARAM: Caos rellene playerAugment1..6.
          avisoSinAumentos = true;
          console.warn(
            `[recolector] ${region}: la partida ${id} de ARAM: Caos no trae aumentos (playerAugment1..6): no soportado; se guarda sin aumentos`,
          );
        }
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

/**
 * Recolecta todos los modos de una región con un solo reparto de jugadores: el presupuesto `maxPartidas` se
 * divide con `repartirPresupuesto` (clasificatoria 60 %, ARAM 15 %, ARAM: Caos 10 %, Arena 15 %). Primero van
 * ARAM, ARAM: Caos y Arena; lo que no gasten pasa a clasificatoria en el mismo ciclo.
 * Un modo que falla no impide recolectar los demás. Devuelve las partidas guardadas por modo.
 */
export async function recolectarModos(
  api: RiotApi,
  db: Db,
  objetos: Record<number, ItemDDragonCrudo>,
  opciones: Omit<OpcionesRecolector, 'modo' | 'jugadores'>,
): Promise<Record<ModoJuego, number>> {
  const presupuesto = repartirPresupuesto(opciones.maxPartidas);
  const jugadores = await reunirJugadores(api, opciones.region);
  const resultado = { clasificatoria: 0, aram: 0, caos: 0, arena: 0 } as Record<ModoJuego, number>;
  const orden = [...MODOS_JUEGO.filter((m) => m !== 'clasificatoria'), 'clasificatoria' as const];
  let sobrante = 0;
  for (const modo of orden) {
    const maxPartidas = presupuesto[modo] + (modo === 'clasificatoria' ? sobrante : 0);
    try {
      resultado[modo] = await recolectar(api, db, objetos, { ...opciones, maxPartidas, modo, jugadores });
    } catch (e) {
      console.error(`[recolector] ${opciones.region}: fallo al recolectar el modo ${modo}`, e);
    }
    if (modo !== 'clasificatoria') sobrante += Math.max(0, presupuesto[modo] - resultado[modo]);
  }
  return resultado;
}
