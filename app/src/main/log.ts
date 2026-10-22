import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type NivelLog = 'info' | 'aviso' | 'error';

let directorio: (() => string) | null = null;

/** Por encima de este tamaño, coach.log pasa a coach.old.log (se pierde el anterior) y se empieza uno nuevo. */
const TAMANO_MAXIMO_LOG = 5 * 1024 * 1024;

function rotarSiHaceFalta(ruta: string, dir: string): void {
  try {
    if (statSync(ruta).size > TAMANO_MAXIMO_LOG) renameSync(ruta, join(dir, 'coach.old.log'));
  } catch {
    // aún no existe (o no se puede rotar): se sigue escribiendo
  }
}

/** Define cómo se obtiene el directorio de logs (en la app: userData/logs). Se resuelve de forma perezosa. */
export function configurarDirectorioLog(obtener: () => string): void {
  directorio = obtener;
}

/** Añade una línea a coach.log. Nunca lanza: un fallo de log no debe romper la app. */
export function registrar(nivel: NivelLog, mensaje: string): void {
  if (!directorio) return;
  try {
    const dir = directorio();
    mkdirSync(dir, { recursive: true });
    const ruta = join(dir, 'coach.log');
    rotarSiHaceFalta(ruta, dir);
    appendFileSync(ruta, `${new Date().toISOString()} [${nivel}] ${mensaje}\n`, 'utf8');
  } catch {
    // ignorar
  }
}
