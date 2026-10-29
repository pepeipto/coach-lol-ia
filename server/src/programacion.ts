import {
  parcheDeVersion,
  URL_VERSIONES,
  urlDatosDDragon,
  type ItemDDragonCrudo,
} from '@coach/shared';
import { calcularBuilds } from './agregador';
import { calcularEnfrentamientos } from './enfrentamientos';
import { calcularSinergias } from './sinergias';
import type { Db } from './db';
import type { ServicioParche } from './parche/rutas';
import { recolectarModos } from './recolector';
import { crearDetectorRotativos, type DetectorRotativos } from './rotativos/colas';
import { REGIONES_RECOLECTOR_POR_DEFECTO, type Region, type RiotApi } from './riot/riotApi';

export interface DepsCiclo {
  api: RiotApi;
  db: Db;
  fetch?: typeof fetch;
  maxPartidasPorRegion?: number;
  /** Regiones que se recolectan (REGIONES_RECOLECTOR); por defecto EUW, LAN y LAS. */
  regiones?: readonly Region[];
  /**
   * 3.8: detector de colas rotativas activas (se crea uno si falta; `null` lo desactiva). Conviene que dure entre
   * ciclos: recuerda los jugadores de cada modo rotativo para sembrar el siguiente.
   */
  rotativos?: DetectorRotativos | null;
  /** Novedades del parche: lee las notas oficiales de cada versión nueva y escribe los resúmenes que falten. */
  parche?: Pick<ServicioParche, 'actualizar'> | null;
}

const INTERVALO_POR_DEFECTO_MS = 6 * 60 * 60 * 1000;
/** Presupuesto de partidas por región y ciclo, repartido entre modos (60/15/10/15, ver `repartirPresupuesto`). */
const MAX_PARTIDAS_POR_REGION = 300;

async function pedirJson<T>(hacerFetch: typeof fetch, url: string): Promise<T> {
  const resp = await hacerFetch(url);
  if (!resp.ok) throw new Error(`Respuesta ${resp.status} de ${url}`);
  return (await resp.json()) as T;
}

export async function ejecutarCiclo(deps: DepsCiclo): Promise<void> {
  const hacerFetch = deps.fetch ?? fetch;
  try {
    const versiones = await pedirJson<string[]>(hacerFetch, URL_VERSIONES);
    const version = versiones[0];
    const parche = parcheDeVersion(version);
    const parcheAnterior = versiones.map(parcheDeVersion).find((p) => p !== parche) ?? parche;

    const crudo = await pedirJson<{ data: Record<string, ItemDDragonCrudo> }>(
      hacerFetch,
      urlDatosDDragon(version, 'item'),
    );
    const objetos: Record<number, ItemDDragonCrudo> = {};
    for (const [id, objeto] of Object.entries(crudo.data)) objetos[Number(id)] = objeto;

    const max = deps.maxPartidasPorRegion ?? MAX_PARTIDAS_POR_REGION;
    const rotativos =
      deps.rotativos === null ? undefined : (deps.rotativos ?? crearDetectorRotativos({ api: deps.api, db: deps.db, fetch: hacerFetch }));
    // Las builds, los enfrentamientos y las sinergias se recalculan en cuanto termina cada región con partidas nuevas
    // (no solo al final del ciclo, que con la clave de desarrollo puede tardar horas): la app ve los datos antes.
    let pendiente = true;
    const recalcular = () => {
      recalcularTodo(deps.db, objetos, parche, parcheAnterior);
      pendiente = false;
    };
    // Una región que falla no impide recolectar las demás ni recalcular las builds.
    for (const region of deps.regiones ?? REGIONES_RECOLECTOR_POR_DEFECTO) {
      try {
        const nuevas = await recolectarModos(deps.api, deps.db, objetos, {
          region,
          parche,
          maxPartidas: max,
          rotativos,
        });
        const { rotativos: porCola, ...porModo } = nuevas;
        const detalle = [
          ...Object.entries(porModo).map(([modo, n]) => `${modo} ${n}`),
          ...Object.entries(porCola ?? {}).map(([cola, n]) => `rotativo ${cola} ${n}`),
        ].join(', ');
        console.info(`[ciclo] ${region}: partidas nuevas (${detalle})`);
        const total = Object.values(porModo).reduce((a, n) => a + n, 0) + Object.values(porCola ?? {}).reduce((a, n) => a + n, 0);
        if (total > 0) recalcular();
      } catch (e) {
        console.error(`[ciclo] ${region}: fallo de la recolección; se reintentará en el siguiente ciclo`, e);
      }
    }
    // Sin partidas nuevas en ninguna región, se recalcula igualmente una vez (p. ej. al cambiar de parche).
    if (pendiente) recalcular();
    // Novedades del parche: un fallo (notas aún no publicadas, formato raro, la IA) se reintenta en el siguiente ciclo.
    if (deps.parche) {
      try {
        await deps.parche.actualizar(version);
      } catch (e) {
        console.error('[ciclo] fallo al leer las notas del parche; se reintentará en el siguiente ciclo', e instanceof Error ? e.message : e);
      }
    }
    deps.db.borrarParchesAntiguos([parche, parcheAnterior]);
  } catch (e) {
    console.error('[ciclo] fallo del ciclo; se reintentará en el siguiente', e);
  }
}

/** Builds, enfrentamientos y sinergias con las partidas guardadas; un fallo en uno no impide los demás. */
function recalcularTodo(db: Db, objetos: Record<number, ItemDDragonCrudo>, parche: string, parcheAnterior: string): void {
  try {
    const builds = calcularBuilds(db, objetos, parche, parcheAnterior);
    console.info(`[ciclo] ${builds} builds calculadas (parche ${parche})`);
  } catch (e) {
    console.error('[ciclo] fallo al calcular las builds', e);
  }
  // 3.9: enfrentamientos de línea, con los mismos parches que las builds (un fallo no para el ciclo).
  try {
    const cruces = calcularEnfrentamientos(db, objetos, parche, parcheAnterior);
    console.info(`[ciclo] ${cruces} enfrentamientos de línea calculados (parche ${parche})`);
  } catch (e) {
    console.error('[ciclo] fallo al calcular los enfrentamientos', e);
  }
  // 3.9.1: sinergias (compañeros de equipo), con los mismos parches y mínimos.
  try {
    const pares = calcularSinergias(db, parche, parcheAnterior);
    console.info(`[ciclo] ${pares} sinergias calculadas (parche ${parche})`);
  } catch (e) {
    console.error('[ciclo] fallo al calcular las sinergias', e);
  }
}

/**
 * Ejecuta un ciclo al arrancar y luego cada `intervaloMs`; devuelve la función para detenerlo, con `lanzar()` para
 * empezar un ciclo ahora (si no hay otro en curso), p. ej. cuando la clave de Riot vuelve a funcionar.
 */
export function iniciarProgramacion(
  deps: DepsCiclo,
  intervaloMs: number = INTERVALO_POR_DEFECTO_MS,
): (() => void) & { lanzar: () => boolean } {
  let enCurso = false;
  // Un solo detector para todos los ciclos (su caché y los jugadores de cada modo rotativo duran entre ciclos).
  const conDetector: DepsCiclo =
    deps.rotativos === undefined
      ? { ...deps, rotativos: crearDetectorRotativos({ api: deps.api, db: deps.db, fetch: deps.fetch }) }
      : deps;
  const lanzar = (): boolean => {
    if (enCurso) return false;
    enCurso = true;
    void ejecutarCiclo(conDetector).finally(() => {
      enCurso = false;
    });
    return true;
  };
  lanzar();
  const temporizador = setInterval(lanzar, intervaloMs);
  return Object.assign(() => clearInterval(temporizador), { lanzar });
}
