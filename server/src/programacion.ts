import {
  parcheDeVersion,
  URL_VERSIONES,
  urlDatosDDragon,
  type ItemDDragonCrudo,
} from '@coach/shared';
import { calcularBuilds } from './agregador';
import type { Db } from './db';
import { recolectarModos } from './recolector';
import { REGIONES, type Region, type RiotApi } from './riot/riotApi';

export interface DepsCiclo {
  api: RiotApi;
  db: Db;
  fetch?: typeof fetch;
  maxPartidasPorRegion?: number;
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
    // Una región que falla no impide recolectar las demás ni recalcular las builds.
    for (const region of Object.keys(REGIONES) as Region[]) {
      try {
        const nuevas = await recolectarModos(deps.api, deps.db, objetos, {
          region,
          parche,
          maxPartidas: max,
        });
        const detalle = Object.entries(nuevas).map(([modo, n]) => `${modo} ${n}`).join(', ');
        console.info(`[ciclo] ${region}: partidas nuevas (${detalle})`);
      } catch (e) {
        console.error(`[ciclo] ${region}: fallo de la recolección; se reintentará en el siguiente ciclo`, e);
      }
    }

    try {
      const builds = calcularBuilds(deps.db, objetos, parche, parcheAnterior);
      console.info(`[ciclo] ${builds} builds calculadas (parche ${parche})`);
    } catch (e) {
      console.error('[ciclo] fallo al calcular las builds', e);
    }
    deps.db.borrarParchesAntiguos([parche, parcheAnterior]);
  } catch (e) {
    console.error('[ciclo] fallo del ciclo; se reintentará en el siguiente', e);
  }
}

/** Ejecuta un ciclo al arrancar y luego cada `intervaloMs`; devuelve la función para detenerlo. */
export function iniciarProgramacion(
  deps: DepsCiclo,
  intervaloMs: number = INTERVALO_POR_DEFECTO_MS,
): () => void {
  let enCurso = false;
  const lanzar = () => {
    if (enCurso) return;
    enCurso = true;
    void ejecutarCiclo(deps).finally(() => {
      enCurso = false;
    });
  };
  lanzar();
  const temporizador = setInterval(lanzar, intervaloMs);
  return () => clearInterval(temporizador);
}
