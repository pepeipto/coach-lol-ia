import {
  MODOS_JUEGO,
  parcheDeVersion,
  repartirPresupuesto,
  type ItemDDragonCrudo,
  type ModoJuego,
} from '@coach/shared';
import { extraerParticipaciones, extraerParticipacionesArena, type Participacion } from './extraer';
import type { Db } from './db';
import type { DetectorRotativos } from './rotativos/colas';
import { colasDe, modoRotativo, type ModoInterno } from './rotativos/modos';
import { ErrorRiot, REGIONES, type PartidaRiot, type LineaTiempoRiot, type Region, type RiotApi } from './riot/riotApi';

export interface OpcionesRecolector {
  region: Region;
  parche: string;
  maxPartidas: number;
  /** Modo que se recolecta (clasificatoria por defecto); fija las colas que se piden. 3.8: o «rotativo:<cola>». */
  modo?: ModoInterno;
  /** Jugadores ya reunidos (puuid); si falta, se reúnen de las ligas de la región. */
  jugadores?: string[];
  /**
   * 3.7: jugadores que se prueban antes que los de las ligas (p. ej. los de las partidas de ARAM recién guardadas,
   * que juegan ARAM: Caos y Arena mucho más que los de las ligas altas).
   */
  prioritarios?: string[];
  /** 3.7: recibe los jugadores (puuid) de cada partida guardada. */
  alGuardar?: (puuids: string[]) => void;
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
function esUtil(partida: PartidaRiot, parche: string, modo: ModoInterno): boolean {
  return (
    parcheDeVersion(partida.info.gameVersion) === parche &&
    colasDe(modo).includes(partida.info.queueId) &&
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
  const aleatorio = opciones.aleatorio ?? Math.random;
  const prioritarios = barajar([...new Set(opciones.prioritarios ?? [])], aleatorio);
  const deLigas = barajar(opciones.jugadores ?? (await reunirJugadores(api, region)), aleatorio);
  const jugadores = [...prioritarios, ...deLigas.filter((p) => !prioritarios.includes(p))];
  const otroModo = modo !== 'clasificatoria';
  // Fuera de clasificatoria se mira un número limitado de jugadores (cada uno cuesta una petición).
  const limiteJugadores = otroModo ? maxJugadoresOtrosModos(maxPartidas) : jugadores.length;
  // 3.4: los jugadores de las ligas altas casi no juegan ARAM: Caos ni Arena. Los compañeros de una partida del modo
  // sí lo juegan: pasan delante en la cola («bola de nieve»), sin repetir a nadie.
  const vistos = new Set(jugadores);
  const inicio = opciones.inicioParche ?? Math.floor((opciones.ahora ?? Date.now)() / 1000) - VENTANA_SIN_PARCHE_S;
  let guardadas = 0;
  let avisoSinAumentos = false;
  // 3.8.1: diagnóstico de los modos que se quedan sin datos (ARAM: Caos llevaba 0 partidas sin ningún error).
  let probados = 0;
  let listadas = 0;
  let descartadas = 0;

  for (let i = 0; i < jugadores.length && i < limiteJugadores; i++) {
    const puuid = jugadores[i];
    if (guardadas >= maxPartidas) break;
    probados++;
    const ids: string[] = [];
    for (const cola of colasDe(modo)) {
      try {
        ids.push(...(await api.idsPartidas(ruta, puuid, PARTIDAS_POR_JUGADOR, cola, inicio)));
      } catch (e) {
        console.error(`[recolector] ${region}: no se pudieron listar las partidas (cola ${cola}) de un jugador: ${describir(e)}`);
      }
    }
    listadas += ids.length;
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
        descartadas++;
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
          modo === 'arena' ? extraerParticipacionesArena(partida) : extraerParticipaciones(partida, linea!, objetos, modo as Exclude<ModoInterno, 'arena'>);
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
        opciones.alGuardar?.(partida.info.participants.map((p) => p.puuid).filter((p): p is string => typeof p === 'string' && p !== ''));
        if (otroModo) {
          const nuevos = partida.info.participants.map((p) => p.puuid).filter((p) => typeof p === 'string' && p && !vistos.has(p));
          for (const p of nuevos) vistos.add(p);
          jugadores.splice(i + 1, 0, ...nuevos);
        }
      } catch (e) {
        datosNoValidos(e);
      }
    }
  }
  if (otroModo) {
    console.info(`[recolector] ${region} ${modo}: ${probados} jugadores probados, ${listadas} partidas listadas, ${descartadas} descartadas (otro parche o cola), ${guardadas} guardadas`);
  }
  return guardadas;
}

/**
 * 3.8: parte del presupuesto de cada región para los modos rotativos activos (sin contar los PvE). Sale de
 * clasificatoria y solo cuando hay alguno activo: con 300 partidas, 30 (un 10 %), a partes iguales entre las colas
 * activas (el resto del redondeo, a las primeras). Lo que no gasten vuelve a clasificatoria en el mismo ciclo.
 */
export const FRACCION_ROTATIVOS = 0.1;

export function repartirRotativos(total: number, colas: readonly number[]): Record<number, number> {
  const reparto: Record<number, number> = {};
  if (colas.length === 0) return reparto;
  const parte = Math.floor(Math.max(0, Math.floor(total)) * FRACCION_ROTATIVOS);
  const cada = Math.floor(parte / colas.length);
  let resto = parte - cada * colas.length;
  for (const cola of colas) {
    reparto[cola] = cada + (resto > 0 ? 1 : 0);
    if (resto > 0) resto--;
  }
  return reparto;
}

export type ResultadoModos = Record<ModoJuego, number> & {
  /** 3.8: partidas guardadas por cola rotativa (solo si se pasó un detector). */
  rotativos?: Record<number, number>;
};

/**
 * Recolecta todos los modos de una región con un solo reparto de jugadores: el presupuesto `maxPartidas` se
 * divide con `repartirPresupuesto` (clasificatoria 60 %, ARAM 15 %, ARAM: Caos 10 %, Arena 15 %). Primero van
 * ARAM, ARAM: Caos y Arena; después (3.8, con `rotativos`) los modos rotativos activos, con un 10 % que se quita a
 * clasificatoria (`repartirRotativos`); lo que no gasten pasa a clasificatoria en el mismo ciclo.
 * Un modo que falla no impide recolectar los demás. Devuelve las partidas guardadas por modo.
 */
export async function recolectarModos(
  api: RiotApi,
  db: Db,
  objetos: Record<number, ItemDDragonCrudo>,
  opciones: Omit<OpcionesRecolector, 'modo' | 'jugadores'> & { rotativos?: DetectorRotativos },
): Promise<ResultadoModos> {
  const { rotativos: detector, ...base } = opciones;
  const presupuesto = repartirPresupuesto(base.maxPartidas);
  const jugadores = await reunirJugadores(api, base.region);
  const resultado: ResultadoModos = { clasificatoria: 0, aram: 0, caos: 0, arena: 0 };
  let sobrante = 0;
  // 3.7: casi ningún jugador de las ligas altas juega ARAM: Caos ni Arena (0 partidas en producción). Los de las partidas
  // de ARAM sí: se prueban primero en esos dos modos (y, 3.8, en los rotativos).
  const deAram: string[] = [];
  const recoger = async (modo: ModoInterno, maxPartidas: number, extra: Partial<OpcionesRecolector>, nombre: string) => {
    try {
      return await recolectar(api, db, objetos, { ...base, maxPartidas, modo, jugadores, ...extra });
    } catch (e) {
      console.error(`[recolector] ${base.region}: fallo al recolectar el modo ${nombre}`, e);
      return 0;
    }
  };
  for (const modo of MODOS_JUEGO.filter((m) => m !== 'clasificatoria')) {
    const extra = modo === 'aram' ? { alGuardar: (ps: string[]) => deAram.push(...ps) } : { prioritarios: deAram };
    resultado[modo] = await recoger(modo, presupuesto[modo], extra, modo);
    sobrante += Math.max(0, presupuesto[modo] - resultado[modo]);
  }

  if (detector) {
    resultado.rotativos = {};
    let activas: number[] = [];
    try {
      const sondeo = [...new Set([...deAram, ...jugadores])];
      activas = (await detector.revisar(base.region, sondeo)).filter((c) => !c.pve).map((c) => c.cola);
    } catch (e) {
      console.error(`[recolector] ${base.region}: no se pudieron revisar las colas rotativas`, e);
    }
    const reparto = repartirRotativos(base.maxPartidas, activas);
    for (const cola of activas) {
      const max = reparto[cola] ?? 0;
      presupuesto.clasificatoria -= max;
      const n = await recoger(
        modoRotativo(cola),
        max,
        {
          prioritarios: [...detector.jugadoresDe(base.region, cola), ...deAram],
          alGuardar: (ps) => detector.anotarJugadores(base.region, cola, ps),
        },
        `rotativo ${cola}`,
      );
      resultado.rotativos[cola] = n;
      sobrante += Math.max(0, max - n);
    }
  }

  resultado.clasificatoria = await recoger('clasificatoria', Math.max(0, presupuesto.clasificatoria) + sobrante, {}, 'clasificatoria');
  return resultado;
}
