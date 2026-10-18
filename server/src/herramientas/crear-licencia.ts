/**
 * Herramienta de administración: crea una licencia vitalicia (p. ej. la del desarrollador).
 *
 *   npm run licencia:crear -w server -- --nota "<texto>" [--db <ruta>]
 *
 * La base por defecto es RUTA_DB o ./coach.db (relativa a server/ al lanzarla con -w server).
 * No necesita RIOT_API_KEY ni Stripe. Imprime la clave en la salida estándar.
 */
import { pathToFileURL } from 'node:url';
import { abrirDb } from '../db';
import { crearRepoLicencias } from '../premium/licencias';

export interface Argumentos {
  nota: string;
  db: string;
}

/** Lee `--nota` (obligatoria) y `--db` (opcional). Lanza un error en español si faltan. */
export function leerArgumentos(argv: string[], env: Record<string, string | undefined>): Argumentos {
  const valor = (nombre: string): string | undefined => {
    const i = argv.indexOf(nombre);
    if (i === -1) return undefined;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`Falta el valor de ${nombre}.`);
    return v;
  };
  const nota = valor('--nota')?.trim();
  if (!nota) throw new Error('Falta --nota "<texto>": describe para quién es la licencia.');
  const db = valor('--db') ?? (env.RUTA_DB?.trim() || './coach.db');
  return { nota, db };
}

/** Crea una licencia vitalicia en la base indicada (la migra si hace falta) y devuelve su clave. */
export function crearLicenciaVitalicia(rutaDb: string, nota: string): string {
  const db = abrirDb(rutaDb);
  try {
    return crearRepoLicencias(db).crearVitalicia({ nota }).clave;
  } finally {
    db.cerrar();
  }
}

// Solo al ejecutarlo directamente (no al importarlo desde las pruebas).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { nota, db } = leerArgumentos(process.argv.slice(2), process.env);
    const clave = crearLicenciaVitalicia(db, nota);
    console.log(clave);
    console.error(`Licencia vitalicia creada en ${db} («${nota}»).`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}
