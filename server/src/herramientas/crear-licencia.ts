/**
 * Herramienta de administración: crea una licencia sin Stripe.
 *
 *   npm run licencia:crear -w server -- --vitalicia --nota "Desarrollador" [--db <ruta>]
 *   npm run licencia:crear -w server -- --horas 72 --nota "Tester" [--db <ruta>]
 *
 * Exactamente una de --vitalicia o --horas <n>. La base por defecto es RUTA_DB o ./coach.db
 * (relativa a server/ al lanzarla con -w server). No necesita RIOT_API_KEY ni Stripe.
 * Imprime la clave (y, en las pruebas, la fecha de caducidad).
 */
import { pathToFileURL } from 'node:url';
import { abrirDb } from '../db';
import { crearRepoLicencias } from '../premium/licencias';

export type Argumentos =
  | { tipo: 'vitalicia'; nota: string; db: string }
  | { tipo: 'prueba'; horas: number; nota: string; db: string };

/** Lee los argumentos. Lanza un error en español si falta algo o sobra una de las dos opciones. */
export function leerArgumentos(argv: string[], env: Record<string, string | undefined>): Argumentos {
  const valor = (nombre: string): string | undefined => {
    const i = argv.indexOf(nombre);
    if (i === -1) return undefined;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`Falta el valor de ${nombre}.`);
    return v;
  };
  const vitalicia = argv.includes('--vitalicia');
  const horasTexto = valor('--horas');
  if (vitalicia === (horasTexto !== undefined)) {
    throw new Error('Indica exactamente una de estas opciones: --vitalicia o --horas <n>.');
  }
  const nota = valor('--nota')?.trim();
  if (!nota) throw new Error('Falta --nota "<texto>": describe para quién es la licencia.');
  const db = valor('--db') ?? (env.RUTA_DB?.trim() || './coach.db');
  if (vitalicia) return { tipo: 'vitalicia', nota, db };
  const horas = /^\d+$/.test(horasTexto!) ? Number(horasTexto) : NaN;
  if (!Number.isInteger(horas) || horas <= 0) throw new Error('--horas debe ser un número entero de horas mayor que 0.');
  return { tipo: 'prueba', horas, nota, db };
}

/** Crea la licencia en la base indicada (la migra si hace falta). */
export function crearLicencia(
  rutaDb: string,
  a: { tipo: 'vitalicia'; nota: string } | { tipo: 'prueba'; horas: number; nota: string },
  ahora: number = Date.now(),
): { clave: string; caducaEn: string | null } {
  const db = abrirDb(rutaDb);
  try {
    const repo = crearRepoLicencias(db);
    const l = a.tipo === 'vitalicia' ? repo.crearVitalicia({ nota: a.nota }) : repo.crearPrueba({ horas: a.horas, nota: a.nota, ahora });
    return { clave: l.clave, caducaEn: l.caducaEn };
  } finally {
    db.cerrar();
  }
}

/** Atajo de C2-6: crea una licencia vitalicia y devuelve su clave. */
export function crearLicenciaVitalicia(rutaDb: string, nota: string): string {
  return crearLicencia(rutaDb, { tipo: 'vitalicia', nota }).clave;
}

// Solo al ejecutarlo directamente (no al importarlo desde las pruebas).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = leerArgumentos(process.argv.slice(2), process.env);
    const { clave, caducaEn } = crearLicencia(args.db, args);
    console.log(clave);
    if (caducaEn) console.log(`Caduca: ${caducaEn} (${new Date(caducaEn).toLocaleString('es')})`);
    console.error(`Licencia ${args.tipo === 'vitalicia' ? 'vitalicia' : 'de prueba'} creada en ${args.db} («${args.nota}»).`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}
