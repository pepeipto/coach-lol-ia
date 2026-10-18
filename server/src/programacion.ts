import {
  parcheDeVersion,
  URL_VERSIONES,
  urlDatosDDragon,
  type ItemDDragonCrudo,
} from '@coach/shared';
import { calcularBuilds } from './agregador';
import type { Db } from './db';
import { recolectar } from './recolector';
import { REGIONES, type Region, type RiotApi } from './riot/riotApi';

export interface DepsCiclo {
  api: RiotApi;
  db: Db;
  fetch?: typeof fetch;
  maxPartidasPorRegion?: number;
}

const INTERVALO_POR_DEFECTO_MS = 6 * 60 * 60 * 1000;
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
    for (const region of Object.keys(REGIONES) as Region[]) {
      const nuevas = await recolectar(deps.api, deps.db, objetos, {
        region,
        parche,
        maxPartidas: max,
      });
      console.info(`[ciclo] ${region}: ${nuevas} partidas nuevas`);
    }

    const builds = calcularBuilds(deps.db, objetos, parche, parcheAnterior);
    deps.db.borrarParchesAntiguos([parche, parcheAnterior]);
    console.info(`[ciclo] ${builds} builds calculadas (parche ${parche})`);
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
